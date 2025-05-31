import {
  type AccountAuthenticator,
  AccountAuthenticatorEd25519,
  type AnyRawTransaction,
  Deserializer,
  Ed25519PublicKey,
  Ed25519Signature,
  generateSigningMessageForTransaction,
  MultiAgentTransaction,
  SimpleTransaction,
  type Aptos as _Aptos,
  type PendingTransactionResponse,
  generateSignedTransaction,
  postAptosFullNode,
  SignedTransaction,
  MimeType,
  AbstractKeylessAccount,
  KeylessPublicKey,
  FederatedKeylessPublicKey,
  type KeylessSignature,
} from '@aptos-labs/ts-sdk'
import bs58 from 'bs58'

import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import { type ChainSignatureContract } from '@contracts'
import { type HashToSign, type Signature } from '@types'

export class Aptos extends ChainAdapter<AnyRawTransaction, AnyRawTransaction> {
  private readonly contract: ChainSignatureContract
  private readonly client: _Aptos

  /**
   * Creates a new Aptos chain instance
   * @param params - Configuration parameters
   * @param params.client - A Aptos client instance to interact with the blockchain
   * @param params.contract - Instance of the chain signature contract for MPC operations
   */
  constructor({
    contract,
    client,
  }: {
    contract: ChainSignatureContract
    client: _Aptos
  }) {
    super()

    this.contract = contract
    this.client = client
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const amount = await this.client.account.getAccountAPTAmount({
      accountAddress: address,
    })

    return {
      balance: BigInt(amount),
      decimals: 8,
    }
  }

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: string
  ): Promise<{ address: string; publicKey: string }> {
    const pubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
      IsEd25519: true,
    })

    const base58Key = pubKey.replace('ed25519:', '')
    const bytes = bs58.decode(base58Key)
    const publicKey = '0x' + Buffer.from(bytes).toString('hex')
    const address = new Ed25519PublicKey(bytes)
      .authKey()
      .derivedAddress()
      .toString()

    return {
      address,
      publicKey,
    }
  }

  serializeTransaction(transaction: AnyRawTransaction): string {
    return transaction.bcsToHex().toString()
  }

  deserializeTransaction(
    serialized: string
  ): MultiAgentTransaction | SimpleTransaction {
    const isPrefixWith0x = serialized.startsWith('0x')

    const buffer = Buffer.from(
      isPrefixWith0x ? serialized.slice(2) : serialized,
      'hex'
    )
    try {
      const deserializer = new Deserializer(buffer)
      return MultiAgentTransaction.deserialize(deserializer)
    } catch {
      // failed to deserialize as MultiAgentTransaction
      // try multi agent next
    }

    const deserializer = new Deserializer(buffer)
    return SimpleTransaction.deserialize(deserializer)
  }

  async prepareTransactionForSigning(
    transactionRequest: AnyRawTransaction
  ): Promise<{ transaction: AnyRawTransaction; hashesToSign: HashToSign[] }> {
    return {
      transaction: transactionRequest,
      hashesToSign: [generateSigningMessageForTransaction(transactionRequest)],
    }
  }

  rsvSignatureToSenderAuthenticator(params: {
    rsvSignatures: Signature
    publicKey: string
  }): AccountAuthenticatorEd25519 {
    const signatureBuffer = Buffer.from(params.rsvSignatures.signature)

    const isPublicKeyPrefixWith0x = params.publicKey.startsWith('0x')

    const publicKeyBuffer = Buffer.from(
      isPublicKeyPrefixWith0x ? params.publicKey.slice(2) : params.publicKey,
      'hex'
    )

    const publicKey = new Ed25519PublicKey(publicKeyBuffer)

    const senderAuthenticator = new AccountAuthenticatorEd25519(
      publicKey,
      new Ed25519Signature(signatureBuffer.toString('hex'))
    )

    return senderAuthenticator
  }

  finalizeTransactionSigning(params: {
    transaction: AnyRawTransaction
    rsvSignatures: Signature
    publicKey: string
    additionalSignersAuthenticators?: AccountAuthenticator[]
    feePayerAuthenticator?: AccountAuthenticator
  }): string {
    const senderAuthenticator = this.rsvSignatureToSenderAuthenticator({
      rsvSignatures: params.rsvSignatures,
      publicKey: params.publicKey,
    })

    const signedTx = generateSignedTransaction({
      transaction: params.transaction,
      senderAuthenticator,
      additionalSignersAuthenticators: params.additionalSignersAuthenticators,
      feePayerAuthenticator: params.feePayerAuthenticator,
    })

    return '0x' + Buffer.from(signedTx).toString('hex')
  }

  private deserializeSignedTransaction(
    serializedSignedTransaction: string
  ): SignedTransaction {
    const isPrefixWith0x = serializedSignedTransaction.startsWith('0x')
    const buffer = Buffer.from(
      isPrefixWith0x
        ? serializedSignedTransaction.slice(2)
        : serializedSignedTransaction,
      'hex'
    )

    const deserializer = new Deserializer(buffer)

    const signedTransaction = SignedTransaction.deserialize(deserializer)

    return signedTransaction
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    // copy from aptos-ts-sdk, `transactionSubmission.ts` -> `submitTransaction()`
    const signedTransaction = this.deserializeSignedTransaction(txSerialized)

    try {
      const { data } = await postAptosFullNode<
        Uint8Array,
        PendingTransactionResponse
      >({
        aptosConfig: this.client.config,
        body: signedTransaction.bcsToBytes(),
        path: 'transactions',
        originMethod: 'submitTransaction',
        contentType: MimeType.BCS_SIGNED_TRANSACTION,
      })

      return {
        hash: data.hash,
      }
    } catch (e) {
      if (
        signedTransaction.authenticator.isSingleSender() &&
        signedTransaction.authenticator.sender.isSingleKey() &&
        (signedTransaction.authenticator.sender.public_key.publicKey instanceof
          KeylessPublicKey ||
          signedTransaction.authenticator.sender.public_key.publicKey instanceof
            FederatedKeylessPublicKey)
      ) {
        await AbstractKeylessAccount.fetchJWK({
          aptosConfig: this.client.config,
          publicKey:
            signedTransaction.authenticator.sender.public_key.publicKey,
          kid: (
            signedTransaction.authenticator.sender.signature
              .signature as KeylessSignature
          ).getJwkKid(),
        })
      }
      throw e
    }
  }
}

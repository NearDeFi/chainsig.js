import bs58 from 'bs58'
import {
  Address,
  Transaction,
  TransactionComputer,
  NetworkEntrypoint,
  INetworkProvider,
  DevnetEntrypoint,
} from '@multiversx/sdk-core'

import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import type { ChainSignatureContract } from '@contracts'
import type {
  HashToSign,
  Signature,
  RSVSignature,
  Ed25519Signature,
} from '@types'

import type {
  MultiversXTransactionRequest,
  MultiversXUnsignedTransaction,
} from './types'

const EGLD_DECIMALS = 18

export class MultiversX extends ChainAdapter<
  MultiversXTransactionRequest,
  MultiversXUnsignedTransaction
> {
  private readonly contract: ChainSignatureContract
  private readonly networkEntrypoint: NetworkEntrypoint
  private readonly networkProvider: INetworkProvider

  constructor({
    contract,
    networkEntrypoint,
  }: {
    contract: ChainSignatureContract
    networkEntrypoint?: NetworkEntrypoint
  }) {
    super()
    this.contract = contract
    this.networkEntrypoint = networkEntrypoint ?? new DevnetEntrypoint()
    this.networkProvider = this.networkEntrypoint.createNetworkProvider()
  }

  private async getAccountNonce(address: string): Promise<bigint> {
    try {
      const account = await this.networkProvider.getAccount(
        Address.newFromBech32(address)
      )
      return account.nonce
    } catch {
      return 0n
    }
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    try {
      const account = await this.networkProvider.getAccount(
        Address.newFromBech32(address)
      )
      return { balance: account.balance, decimals: EGLD_DECIMALS }
    } catch {
      return { balance: 0n, decimals: EGLD_DECIMALS }
    }
  }

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: string
  ): Promise<{ address: string; publicKey: string }> {
    const derivedKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
      IsEd25519: true,
    })

    if (!derivedKey.startsWith('ed25519:')) {
      throw new Error(
        `Expected ed25519 derived key from MPC contract, received: ${derivedKey}. ` +
          'Use a fresh derivation path that has not been used with ECDSA keys.'
      )
    }

    const base58Key = derivedKey.replace('ed25519:', '')
    const rawPublicKey = bs58.decode(base58Key)
    const address = new Address(rawPublicKey).toBech32()

    return {
      address,
      publicKey: `0x${Buffer.from(rawPublicKey).toString('hex')}`,
    }
  }

  serializeTransaction(transaction: MultiversXUnsignedTransaction): string {
    return JSON.stringify(transaction.toPlainObject())
  }

  deserializeTransaction(serialized: string): MultiversXUnsignedTransaction {
    const plainObject = JSON.parse(serialized)
    return Transaction.newFromPlainObject(plainObject)
  }

  async prepareTransactionForSigning(
    transactionRequest: MultiversXTransactionRequest
  ): Promise<{
    transaction: MultiversXUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    const networkConfig = await this.networkProvider.getNetworkConfig()
    const senderAddress = Address.newFromBech32(transactionRequest.sender)
    const receiverAddress = Address.newFromBech32(transactionRequest.receiver)

    const nonce =
      transactionRequest.nonce !== undefined
        ? BigInt(transactionRequest.nonce)
        : await this.getAccountNonce(transactionRequest.sender)

    const value = BigInt(transactionRequest.value)
    const gasLimit =
      transactionRequest.gasLimit !== undefined
        ? BigInt(transactionRequest.gasLimit)
        : networkConfig.minGasLimit
    const gasPrice =
      transactionRequest.gasPrice !== undefined
        ? BigInt(transactionRequest.gasPrice)
        : networkConfig.minGasPrice
    const chainID = transactionRequest.chainId ?? networkConfig.chainID

    const transaction = new Transaction({
      sender: senderAddress,
      receiver: receiverAddress,
      nonce,
      value,
      gasLimit,
      gasPrice,
      data: Buffer.from(transactionRequest.data ?? ''),
      chainID,
      version: transactionRequest.version,
      options: transactionRequest.options,
      guardian: transactionRequest.guardian
        ? Address.newFromBech32(transactionRequest.guardian)
        : undefined,
      relayer: transactionRequest.relayer
        ? Address.newFromBech32(transactionRequest.relayer)
        : undefined,
    })

    const computer = new TransactionComputer()
    const payload = computer.computeBytesForSigning(transaction)

    return {
      transaction,
      hashesToSign: [Array.from(payload)],
    }
  }

  finalizeTransactionSigning(params: {
    transaction: MultiversXUnsignedTransaction
    rsvSignatures: RSVSignature[] | Signature
  }): string {
    const { transaction, rsvSignatures } = params
    const signatureInput = Array.isArray(rsvSignatures)
      ? (rsvSignatures[0] as unknown)
      : rsvSignatures

    const signatureRecord = signatureInput as
      | Signature
      | Ed25519Signature
      | undefined

    if (!signatureRecord || !('signature' in signatureRecord)) {
      throw new Error('Missing MultiversX signature')
    }

    const signatureBytes = Uint8Array.from(signatureRecord.signature)
    transaction.signature = signatureBytes

    return this.serializeTransaction(transaction)
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    const transaction = this.deserializeTransaction(txSerialized)

    const hash = await this.networkProvider.sendTransaction(transaction)

    return { hash }
  }
}

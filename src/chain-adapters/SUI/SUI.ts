import { toBase64 } from '@mysten/bcs'
import {
  type SuiClient,
  SuiHTTPTransport,
  type SuiTransactionBlockResponse,
} from '@mysten/sui/client'
import {
  messageWithIntent,
  toSerializedSignature,
} from '@mysten/sui/cryptography'
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519'
import { type Transaction } from '@mysten/sui/transactions'
import { blake2b } from '@noble/hashes/blake2b'
import bs58 from 'bs58'

import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import { type ChainSignatureContract } from '@contracts'
import { type HashToSign, type Signature } from '@types'

import {
  type SUITransactionRequest,
  type SUIUnsignedTransaction,
} from './types'

export class SUI extends ChainAdapter<
  SUITransactionRequest,
  SUIUnsignedTransaction
> {
  private readonly contract: ChainSignatureContract
  private readonly client: SuiClient
  private readonly transport: SuiHTTPTransport
  /**
   * Creates a new SUI chain instance
   * @param params - Configuration parameters
   * @param params.client - A SUI client instance to interact with the blockchain
   * @param params.contract - Instance of the chain signature contract for MPC operations
   */
  constructor({
    contract,
    client,
    rpcUrl,
  }: {
    contract: ChainSignatureContract
    client: SuiClient
    rpcUrl: string
  }) {
    super()

    this.contract = contract
    this.client = client
    this.transport = new SuiHTTPTransport({ url: rpcUrl })
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const balance = await this.client.getBalance({
      owner: address,
    })

    return {
      balance: BigInt(balance.totalBalance),
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

    const pubKeyInSui = new Ed25519PublicKey(bytes)

    return {
      publicKey: pubKeyInSui.toSuiPublicKey(),
      address: pubKeyInSui.toSuiAddress(),
    }
  }

  serializeTransaction(transaction: Uint8Array<ArrayBufferLike>): string {
    return Buffer.from(transaction).toString('hex')
  }

  deserializeTransaction(serialized: string): Uint8Array<ArrayBufferLike> {
    const buffer = Buffer.from(serialized, 'hex')
    return new Uint8Array(buffer)
  }

  async prepareTransactionForSigning(transactionRequest: Transaction): Promise<{
    transaction: Uint8Array<ArrayBufferLike>
    hashesToSign: HashToSign[]
  }> {
    const txBytes = await transactionRequest.build({
      client: this.client,
    })
    const intent = 'TransactionData'

    const intentMessage = messageWithIntent(intent, txBytes)
    const digest = blake2b(intentMessage, { dkLen: 32 })

    return {
      hashesToSign: [digest],
      transaction: txBytes,
    }
  }

  rsvSignatureToSuiSignature(params: {
    transaction: Uint8Array<ArrayBufferLike>
    rsvSignatures: Signature
    publicKey: string
  }): string {
    const publicKeyBufferWithPrefix = Buffer.from(params.publicKey, 'base64')
    const rawPublicKeyBuffer = publicKeyBufferWithPrefix.subarray(1)
    const signature = toSerializedSignature({
      signature: Buffer.from(params.rsvSignatures.signature),
      signatureScheme: 'ED25519',
      publicKey: new Ed25519PublicKey(rawPublicKeyBuffer),
    })

    return signature
  }

  finalizeTransactionSigning(params: {
    transaction: Uint8Array<ArrayBufferLike>
    rsvSignatures: Signature
    publicKey: string
  }): string {
    const signature = this.rsvSignatureToSuiSignature(params)

    // doing this as SUI dont have a way to serialize
    // signature and transaction
    return JSON.stringify([
      typeof params.transaction === 'string'
        ? params.transaction
        : toBase64(params.transaction),
      Array.isArray(signature) ? signature : [signature],
    ])
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    const result: SuiTransactionBlockResponse = await this.transport.request({
      method: 'sui_executeTransactionBlock',
      params: JSON.parse(txSerialized),
    })

    return {
      hash: result.digest,
    }
  }
}

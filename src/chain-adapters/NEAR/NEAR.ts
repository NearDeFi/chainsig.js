import {
  Transaction as NearTransaction,
  SignedTransaction as NearSignedTransaction,
  createTransaction as nearCreateTransaction,
  encodeTransaction as nearEncodeTransaction,
  Action as NearAction,
  Transfer as NearTransfer,
  Signature as NearSignature,
} from '@near-js/transactions'
import { PublicKey as NearPublicKey } from '@near-js/crypto'
import { baseDecode } from '@near-js/utils'
import { JsonRpcProvider } from '@near-js/providers'

// Cross-runtime SHA-256 (browser & Node)
const sha256Bytes = async (data: Uint8Array): Promise<Uint8Array> => {
  const cryptoAny = (globalThis as any).crypto
  if (cryptoAny && cryptoAny.subtle) {
    const digest = await cryptoAny.subtle.digest('SHA-256', data)
    return new Uint8Array(digest)
  }
  const { createHash } = await import('node:crypto')
  return new Uint8Array(createHash('sha256').update(data).digest())
}

import type { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { HashToSign, Signature, RSVSignature } from '@types'
import type { Transaction as SolanaTransaction } from '@solana/web3.js'
import { ChainAdapter } from '@chain-adapters/ChainAdapter'

import type { NearTransactionRequest, NearUnsignedTransaction } from './types'

export class NEAR extends ChainAdapter<NearTransactionRequest, NearUnsignedTransaction> {
  private readonly provider: JsonRpcProvider
  private readonly contract: ChainSignatureContract
  private readonly networkId: 'mainnet' | 'testnet'

  constructor(args: { rpcUrl: string; networkId: 'mainnet' | 'testnet'; contract: ChainSignatureContract }) {
    super()
    this.provider = new JsonRpcProvider({ url: args.rpcUrl })
    this.contract = args.contract
    this.networkId = args.networkId
  }

  private isAccountDoesNotExistError(error: unknown): boolean {
    const msg = (error as any)?.message?.toString?.() || ''
    const type = (error as any)?.type?.toString?.() || ''
    return type === 'AccountDoesNotExist' || msg.includes('AccountDoesNotExist') || msg.includes("doesn't exist") || msg.includes('does not exist')
  }

  async getBalance(address: string): Promise<{ balance: bigint; decimals: number }> {
    try {
      const res = (await this.provider.query<any>(`account/${address}`, '')) as any
      return { balance: BigInt(res.amount), decimals: 24 }
    } catch (e) {
      if (this.isAccountDoesNotExistError(e)) {
        throw new Error(
          `NEAR derived account not found: ${address}. Create & fund it or call chainAdapters.near.utils.ensureDerivedAccountExists(...) before sending.`
        )
      }
      throw e
    }
  }

  async deriveAddressAndPublicKey(predecessor: string, path: string): Promise<{ address: string; publicKey: string }> {
    const derivedKey = await this.contract.getDerivedPublicKey({ path, predecessor, IsEd25519: true })
    const pk = NearPublicKey.fromString(derivedKey as string)
    const derivedAccountId = `${path}.${predecessor}`
    return { address: derivedAccountId, publicKey: pk.toString() }
  }

  serializeTransaction(unsigned: NearUnsignedTransaction): string {
    const bytes = nearEncodeTransaction(unsigned.transaction)
    return Buffer.from(bytes).toString('base64')
  }

  deserializeTransaction(serialized: string): NearUnsignedTransaction {
    const buffer = Buffer.from(serialized, 'base64')
    const tx = NearTransaction.decode(buffer)
    return { transaction: tx }
  }

  async prepareTransactionForSigning(request: NearTransactionRequest): Promise<{ transaction: NearUnsignedTransaction; hashesToSign: HashToSign[] }> {
    const { from, to, amount, publicKey } = request
    let accessKey: any
    try {
      accessKey = (await this.provider.query<any>(`access_key/${from}/${publicKey}`, '')) as any
    } catch (e) {
      if (this.isAccountDoesNotExistError(e)) {
        throw new Error(
          `NEAR derived account not found: ${from}. Create & fund it or call chainAdapters.near.utils.ensureDerivedAccountExists({ derivedAccountId: "${from}", mpcPublicKey: "${publicKey}" }).`
        )
      }
      throw e
    }
    const block = await this.provider.block({ finality: 'final' })
    const recentBlockHash = baseDecode((accessKey?.block_hash as string) ?? block.header.hash)
    const txPublicKey = NearPublicKey.fromString(accessKey?.public_key ? accessKey.public_key : publicKey)
    const nextNonce: number = accessKey?.nonce ? accessKey.nonce + 1 : 1
    const actions = [new NearAction({ transfer: new NearTransfer({ deposit: BigInt(amount) }) })]
    const tx = nearCreateTransaction(from, txPublicKey, to, nextNonce, actions, recentBlockHash)
    const serialized = nearEncodeTransaction(tx)
    const hash = await sha256Bytes(serialized)
    return { transaction: { transaction: tx }, hashesToSign: [Array.from(hash)] }
  }

  finalizeTransactionSigning({ transaction, rsvSignatures }: { transaction: NearUnsignedTransaction | SolanaTransaction; rsvSignatures: RSVSignature[] | Signature }): string {
    if (Array.isArray(rsvSignatures)) throw new Error('NEAR expects an Ed25519 signature object, not RSV array')
    const signatureBytes = Buffer.from(rsvSignatures.signature)
    const txObj = 'transaction' in (transaction as any) ? (transaction as NearUnsignedTransaction).transaction : (transaction as any)
    const signedTransaction = new NearSignedTransaction({ transaction: txObj, signature: new NearSignature({ keyType: txObj.publicKey.keyType, data: signatureBytes }) })
    const encoded = signedTransaction.encode()
    // Use browser-safe base64 from Uint8Array
    return Buffer.from(encoded).toString('base64')
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    const signedTxBytes = Buffer.from(txSerialized, 'base64')
    const signedTx = NearSignedTransaction.decode(signedTxBytes)
    const result = await this.provider.sendTransaction(signedTx)
    return { hash: (result as any).transaction.hash }
  }
}

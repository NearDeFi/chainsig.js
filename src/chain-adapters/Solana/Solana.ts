import type { Connection as SolanaConnection } from '@solana/web3.js'
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js'
import type BN from 'bn.js'

import type { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { HashToSign, Signature } from '@types'

import { ChainAdapter } from '../ChainAdapter'

import type {
  SolanaTransactionRequest,
  SolanaUnsignedTransaction,
} from './types'

const toBigInt = (value: bigint | BN): bigint => {
  if (typeof value === 'bigint') return value
  return BigInt(value.toString())
}

export class Solana extends ChainAdapter<
  SolanaTransactionRequest,
  SolanaUnsignedTransaction
> {
  private readonly connection: SolanaConnection
  private readonly contract: ChainSignatureContract

  constructor(args: {
    solanaConnection: SolanaConnection
    contract: ChainSignatureContract
  }) {
    super()
    this.connection = args.solanaConnection
    this.contract = args.contract
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const pubkey = new PublicKey(address)
    const balance = await this.connection.getBalance(pubkey)
    return {
      balance: BigInt(balance),
      decimals: 9, // Solana uses 9 decimals (LAMPORTS_PER_SOL)
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
    const publicKey = new PublicKey(base58Key)

    return {
      address: publicKey.toBase58(),
      publicKey: publicKey.toString(),
    }
  }

  serializeTransaction(transaction: SolanaUnsignedTransaction): string {
    return Buffer.from(
      transaction.transaction.serialize({
        requireAllSignatures: false,
      })
    ).toString('base64')
  }

  deserializeTransaction(serialized: string): SolanaUnsignedTransaction {
    const buffer = Buffer.from(serialized, 'base64')
    const transaction = Transaction.from(buffer)

    return {
      transaction,
      feePayer:
        transaction.feePayer ||
        new PublicKey('11111111111111111111111111111111'),
      recentBlockhash: transaction.recentBlockhash || '',
    }
  }

  async prepareTransactionForSigning(
    request: SolanaTransactionRequest
  ): Promise<{
    transaction: SolanaUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    const transaction = new Transaction()

    // Add transfer instruction if amount is specified
    const amount = toBigInt(request.amount)
    if (amount > 0n) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(request.from),
          toPubkey: new PublicKey(request.to),
          lamports: Number(amount),
        })
      )
    }

    // Add any additional instructions
    if (request.instructions) {
      transaction.add(...request.instructions)
    }

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash

    // Set fee payer
    transaction.feePayer = request.feePayer || new PublicKey(request.from)

    const messageBytes = transaction.compileMessage().serialize()

    return {
      transaction: {
        transaction,
        feePayer: transaction.feePayer,
        recentBlockhash: blockhash,
      },
      hashesToSign: [Array.from(messageBytes)],
    }
  }

  finalizeTransactionSigning({
    transaction,
    rsvSignatures,
    senderAddress,
  }: {
    transaction: Transaction
    rsvSignatures: Signature
    senderAddress: string
  }): string {
    const signatureBuffer = Buffer.from(rsvSignatures.signature)
    transaction.addSignature(new PublicKey(senderAddress), signatureBuffer)
    return transaction.serialize().toString('base64')
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    const transaction = this.deserializeTransaction(txSerialized)

    const signature = await this.connection.sendRawTransaction(
      transaction.transaction.serialize()
    )

    return { hash: signature }
  }
}

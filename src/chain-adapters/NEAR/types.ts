import type { Transaction as NearTransaction } from '@near-js/transactions'

export interface NearTransactionRequest {
  from: string
  to: string
  amount: bigint
  publicKey: string
  memo?: string
}

export interface NearUnsignedTransaction {
  transaction: NearTransaction
}
 
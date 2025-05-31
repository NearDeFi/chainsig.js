import { type Transaction } from '@mysten/sui/transactions'

export type SUIUnsignedTransaction = Uint8Array<ArrayBufferLike>

export type SUITransactionRequest = Transaction

export interface XRPTransactionRequest {
  from: string
  to: string
  amount: string
  destinationTag?: number
  memo?: string
  fee?: string
  sequence?: number
  publicKey: string
}

export interface XRPUnsignedTransaction {
  transaction: {
    Account: string
    Destination: string
    Amount: string
    TransactionType: string
    Fee: string
    Sequence: number
    DestinationTag?: number
    Memos?: Array<{
      Memo: {
        MemoData?: string
        MemoType?: string
        MemoFormat?: string
      }
    }>
    LastLedgerSequence?: number
    SigningPubKey: string
    Flags?: number
    NetworkID?: number
  }
  signingPubKey: string
}

export interface XRPAccountInfo {
  sequence: number
  balance: string
  exists: boolean
  reserve?: string
  ownerCount?: number
}

export interface XRPTransactionHistory {
  hash: string
  ledger_index: number
  date: number
  transaction: {
    Account: string
    Destination?: string
    Amount?: string
    TransactionType: string
    Fee: string
    Sequence: number
    DestinationTag?: number
    Memos?: Array<{
      Memo: {
        MemoData?: string
        MemoType?: string
        MemoFormat?: string
      }
    }>
  }
  meta: {
    TransactionResult: string
    delivered_amount?: string
  }
}

export interface XRPNetworkFee {
  base_fee: string
  median_fee: string
  minimum_fee: string
  open_ledger_fee: string
}

export interface XRPLedgerInfo {
  ledger_index: number
  ledger_hash: string
  ledger_time: number
  reserve_base: string
  reserve_inc: string
  fee_base: string
  fee_ref: string
}

export interface XRPPaymentChannelRequest
  extends Omit<XRPTransactionRequest, 'to'> {
  destination: string
  settleDelay: number
  cancelAfter?: number
  destinationTag?: number
}

export interface XRPEscrowRequest extends Omit<XRPTransactionRequest, 'to'> {
  destination: string
  finishAfter?: number
  cancelAfter?: number
  condition?: string
  fulfillment?: string
}

export interface XRPTrustLineRequest
  extends Omit<XRPTransactionRequest, 'to' | 'amount'> {
  limitAmount: {
    currency: string
    issuer: string
    value: string
  }
  qualityIn?: number
  qualityOut?: number
}

export type XRPTransactionType =
  | 'Payment'
  | 'OfferCreate'
  | 'OfferCancel'
  | 'TrustSet'
  | 'AccountSet'
  | 'SetRegularKey'
  | 'SignerListSet'
  | 'EscrowCreate'
  | 'EscrowFinish'
  | 'EscrowCancel'
  | 'PaymentChannelCreate'
  | 'PaymentChannelFund'
  | 'PaymentChannelClaim'
  | 'CheckCreate'
  | 'CheckCash'
  | 'CheckCancel'
  | 'DepositPreauth'
  | 'SetOracle'
  | 'DeleteOracle'

// Nuevos tipos para mayor precisión
export interface XRPSignedTransaction {
  Account: string
  Destination: string
  Amount: string
  TransactionType: string
  Fee: string
  Sequence: number
  DestinationTag?: number
  Memos?: Array<{
    Memo: {
      MemoData?: string
      MemoType?: string
      MemoFormat?: string
    }
  }>
  LastLedgerSequence?: number
  SigningPubKey: string
  TxnSignature: string
  Flags?: number
  NetworkID?: number
}

export interface XRPSubmitResponse {
  result: {
    engine_result: string
    engine_result_code?: number
    engine_result_message?: string
    tx_blob: string
    tx_json?: {
      hash: string
      [key: string]: any
    }
  }
}

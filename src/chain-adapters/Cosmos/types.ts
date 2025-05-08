import { type EncodeObject } from '@cosmjs/proto-signing'
import { type TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'

export type CosmosNetworkId = string

export type CosmosUnsignedTransaction = TxRaw

export interface CosmosTransactionRequest {
  address: string
  publicKey: string
  messages: EncodeObject[]
  memo?: string
  gas?: number
}

export interface BalanceResponse {
  balances: Array<{
    denom: string
    amount: string
  }>
  pagination: {
    next_key: string | null
    total: string
  }
}

export interface ChainInfo {
  prefix: string
  denom: string
  rpcUrl: string
  restUrl: string
  expectedChainId: string
  gasPrice: number
  decimals: number
}

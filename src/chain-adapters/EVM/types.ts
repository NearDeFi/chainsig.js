import type {
  Address,
  Hex,
  TransactionRequest,
  TypedDataDefinition,
  SignableMessage,
} from 'viem'
import { type HashAuthorizationParameters } from 'viem/experimental'

export type EVMUnsignedTransaction = TransactionRequest & {
  type: 'eip1559'
  chainId: number
}

export interface EVMTransactionRequest
  extends Omit<EVMUnsignedTransaction, 'chainId' | 'type' | 'nonce'> {
  from: Address
  nonce?: number
}

// Legacy transaction request coming from your dApp (includes 'from' address)
export interface EVMTransactionRequestLegacy {
  from: `0x${string}`
  to: `0x${string}`
  value?: bigint
  gas?: bigint
  gasPrice?: bigint
  nonce?: number
}

// Legacy unsigned transaction to be signed
export interface EVMUnsignedLegacyTransaction {
  to: `0x${string}`
  value?: bigint
  gasPrice: bigint
  nonce: number
  gas: bigint
  chainId: number
  type: 'legacy'
}

export type EVMAuthorizationRequest = HashAuthorizationParameters<'hex'>

export type EVMMessage = SignableMessage

export type EVMTypedData = TypedDataDefinition

export interface UserOperationV7 {
  sender: Hex
  nonce: Hex
  factory: Hex
  factoryData: Hex
  callData: Hex
  callGasLimit: Hex
  verificationGasLimit: Hex
  preVerificationGas: Hex
  maxFeePerGas: Hex
  maxPriorityFeePerGas: Hex
  paymaster: Hex
  paymasterVerificationGasLimit: Hex
  paymasterPostOpGasLimit: Hex
  paymasterData: Hex
  signature: Hex
}

export interface UserOperationV6 {
  sender: Hex
  nonce: Hex
  initCode: Hex
  callData: Hex
  callGasLimit: Hex
  verificationGasLimit: Hex
  preVerificationGas: Hex
  maxFeePerGas: Hex
  maxPriorityFeePerGas: Hex
  paymasterAndData: Hex
  signature: Hex
}

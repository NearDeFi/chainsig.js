import type {
  Address,
  Hex,
  TransactionRequest,
  TypedDataDefinition,
  SignableMessage,
} from 'viem'
import { HashAuthorizationParameters } from 'viem/experimental'

export type EVMUnsignedTransaction = TransactionRequest & {
  type: 'eip1559'
  chainId: number
}

export interface EVMTransactionRequest
  extends Omit<EVMUnsignedTransaction, 'chainId' | 'type'> {
  from: Address
}

export type EVMAuthorizationRequest = HashAuthorizationParameters<"hex">

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

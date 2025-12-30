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

/**
 * RSV signature format returned from chain signature signing
 */
export interface RSVSignature {
  r: string
  s: string
  v: number
}

/**
 * Parameters for preparing an EIP-1559 transaction for signing
 */
export interface PrepareTransactionParams {
  from: string
  to: string
  value: bigint
  data?: string
  gasLimit?: bigint
  gasPrice?: bigint
}

/**
 * Parameters for preparing a legacy transaction for signing
 */
export interface PrepareTransactionLegacyParams {
  from: string
  to: string
  value: bigint
  data?: string
  gasPrice?: bigint
  gas?: bigint
}

/**
 * Result of preparing a transaction for signing
 */
export interface PreparedTransaction {
  transaction: EVMUnsignedTransaction | EVMUnsignedLegacyTransaction
  hashesToSign: string[]
}

/**
 * Parameters for finalizing a signed transaction
 */
export interface FinalizeTransactionParams {
  transaction: EVMUnsignedTransaction | EVMUnsignedLegacyTransaction
  rsvSignatures: RSVSignature[]
  chainId?: number
}

/**
 * Parameters for finalizing a legacy signed transaction
 */
export interface FinalizeTransactionLegacyParams {
  transaction: EVMUnsignedLegacyTransaction
  rsvSignatures: RSVSignature[]
}

/**
 * Result of deriving address and public key
 */
export interface DerivedAddressResult {
  address: string
  publicKey?: string
}

import type { Transaction } from '@multiversx/sdk-core'

/**
 * Unsigned MultiversX transaction representation used within the adapter.
 */
export type MultiversXUnsignedTransaction = Transaction

/**
 * Input parameters required to build a MultiversX transaction prior to signing.
 */
export interface MultiversXTransactionRequest {
  /**
   * Sender address in bech32 format (e.g. "erd...").
   */
  sender: string

  /**
   * Receiver address in bech32 format.
   */
  receiver: string

  /**
   * Amount to transfer, in the smallest denomination (eg. 1 EGLD = 10^18).
   */
  value: bigint | string | number

  /**
   * Optional transaction payload. If provided as a string it is treated as UTF-8 by default.
   */
  data?: string | Uint8Array

  /**
   * Optional gas limit. Defaults to the network minimum.
   */
  gasLimit?: bigint | string | number

  /**
   * Optional gas price. Defaults to the network minimum.
   */
  gasPrice?: bigint | string | number

  /**
   * Optional explicit nonce. When omitted the adapter fetches it from the network.
   */
  nonce?: bigint | string | number

  /**
   * Optional chain identifier (e.g. "1" for mainnet). Defaults to the network chain id.
   */
  chainId?: string

  /**
   * Optional transaction version.
   */
  version?: number

  /**
   * Optional transaction options flag.
   */
  options?: number

  /**
   * Optional sender username encoded as plain string. Defaults to empty string.
   */
  senderUsername?: string

  /**
   * Optional receiver username encoded as plain string. Defaults to empty string.
   */
  receiverUsername?: string

  /**
   * Optional guardian address (bech32) for guarded transactions.
   */
  guardian?: string

  /**
   * Optional relayer address (bech32) for relayed transactions.
   */
  relayer?: string
}

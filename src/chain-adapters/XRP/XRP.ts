import { createHash } from 'crypto'

import { encodeAccountID } from 'ripple-address-codec'
import { encode as encodeTx } from 'ripple-binary-codec'
import { Client } from 'xrpl'

import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import type { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { HashToSign, RSVSignature, UncompressedPubKeySEC1 } from '@types'
import { cryptography } from '@utils'

import type { XRPTransactionRequest, XRPUnsignedTransaction } from './types'

/**
 * XRP Ledger chain adapter implementation
 *
 * Provides functionality to interact with the XRP Ledger blockchain including
 * balance queries, address derivation, transaction preparation, signing, and broadcasting.
 */
export class XRP extends ChainAdapter<
  XRPTransactionRequest,
  XRPUnsignedTransaction
> {
  private readonly rpcUrl: string
  private readonly contract: ChainSignatureContract
  private readonly client: Client

  /**
   * Creates a new XRP chain adapter instance
   *
   * @param params - Configuration parameters
   * @param params.rpcUrl - XRP Ledger RPC endpoint URL
   * @param params.contract - Instance of the chain signature contract for MPC operations
   * @param params.client - Optional XRPL client instance (for testing)
   */
  constructor({
    rpcUrl,
    contract,
    client,
  }: {
    rpcUrl: string
    contract: ChainSignatureContract
    client?: Client
  }) {
    super()

    this.rpcUrl = rpcUrl
    this.contract = contract
    this.client = client || new Client(this.rpcUrl)
  }

  /**
   * Retrieves the XRP balance for a given address
   *
   * @param address - The XRP address to query
   * @returns Promise resolving to balance information with amount in drops and decimal places
   * @throws Error if the balance query fails for reasons other than account not found
   */
  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    try {
      await this.client.connect()

      const response = await this.client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated',
      })

      const balance = BigInt(String(response?.result?.account_data?.Balance))

      return {
        balance: balance || 0n,
        decimals: 6,
      }
    } catch (error: any) {
      // Handle account not found errors
      if (
        error?.data?.error === 'actNotFound' ||
        error?.message?.includes('Account not found') ||
        error?.data?.error_message?.includes('Account not found')
      ) {
        return {
          balance: 0n,
          decimals: 6,
        }
      }

      console.error('Failed to fetch XRP balance:', error)
      throw new Error('Failed to fetch XRP balance')
    } finally {
      // Always disconnect in finally block to ensure cleanup
      try {
        await this.client.disconnect()
      } catch (disconnectError) {
        console.warn('Error disconnecting XRP client:', disconnectError)
      }
    }
  }

  /**
   * Derives an XRP address and compressed public key from the given path and predecessor
   *
   * @param predecessor - The predecessor for key derivation
   * @param path - The derivation path
   * @returns Promise resolving to the derived address and compressed public key
   * @throws Error if public key derivation fails
   */
  async deriveAddressAndPublicKey(
    predecessor: string,
    path: string
  ): Promise<{ address: string; publicKey: string }> {
    const uncompressedPubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
    })

    if (!uncompressedPubKey) {
      throw new Error('Failed to get derived secp256k1 public key')
    }

    const compressedPubKey = cryptography.compressPubKey(
      uncompressedPubKey as UncompressedPubKeySEC1
    )

    const address = this.deriveXRPAddress(compressedPubKey)

    return {
      address,
      publicKey: compressedPubKey,
    }
  }

  /**
   * Derives an XRP address from a compressed secp256k1 public key
   *
   * @param publicKeyHex - The compressed secp256k1 public key in hex format (66 chars: 02/03 + 64)
   * @returns The XRP address encoded using ripple-address-codec
   */
  private deriveXRPAddress(publicKeyHex: string): string {
    const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex')
    const sha256Hash = createHash('sha256').update(publicKeyBuffer).digest()
    const ripemd160Hash = createHash('ripemd160').update(sha256Hash).digest()
    const address = encodeAccountID(ripemd160Hash)

    return address
  }

  /**
   * Serializes an XRP unsigned transaction to a JSON string
   *
   * @param transaction - The unsigned transaction to serialize
   * @returns JSON string representation of the transaction
   */
  serializeTransaction(transaction: XRPUnsignedTransaction): string {
    return JSON.stringify(transaction)
  }

  /**
   * Deserializes a JSON string back to an XRP unsigned transaction
   *
   * @param serialized - The JSON string to deserialize
   * @returns The deserialized unsigned transaction
   */
  deserializeTransaction(serialized: string): XRPUnsignedTransaction {
    return JSON.parse(serialized)
  }

  /**
   * Prepares an XRP transaction for signing by autofilling required fields and generating signing hash
   *
   * @param transactionRequest - The transaction request containing payment details
   * @returns Promise resolving to the prepared unsigned transaction and hash to sign
   * @throws Error if transaction preparation fails
   */
  async prepareTransactionForSigning(
    transactionRequest: XRPTransactionRequest
  ): Promise<{
    transaction: XRPUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    try {
      await this.client.connect()

      const signingPubKey = transactionRequest.publicKey
      const prepared = await this.client.autofill({
        TransactionType: 'Payment',
        Account: transactionRequest.from,
        Destination: transactionRequest.to,
        Amount: transactionRequest.amount,
        SigningPubKey: signingPubKey.toUpperCase(),
      })

      // Don't disconnect here - allow connection reuse

      const unsignedTx: XRPUnsignedTransaction = {
        transaction: prepared as any,
        signingPubKey,
      }

      const encodedTx = encodeTx(prepared)

      const signingPrefix = new Uint8Array([0x53, 0x54, 0x58, 0x00])
      const encodedBytes = new Uint8Array(Buffer.from(encodedTx, 'hex'))

      const signingData = new Uint8Array(
        signingPrefix.length + encodedBytes.length
      )
      signingData.set(signingPrefix, 0)
      signingData.set(encodedBytes, signingPrefix.length)

      const hash = createHash('sha512').update(signingData).digest()
      const signingHash = new Uint8Array(hash.subarray(0, 32))

      return {
        transaction: unsignedTx,
        hashesToSign: [signingHash],
      }
    } catch (error) {
      console.error('Failed to prepare XRP transaction for signing:', error)
      throw new Error('Failed to prepare XRP transaction for signing')
    }
  }

  /**
   * Finalizes transaction signing by applying RSV signatures to the prepared transaction
   *
   * @param params - Object containing the unsigned transaction and RSV signatures
   * @param params.transaction - The unsigned transaction to sign
   * @param params.rsvSignatures - Array of RSV signatures (only first signature is used)
   * @returns JSON string of the signed transaction ready for broadcast
   * @throws Error if no signatures are provided
   */
  finalizeTransactionSigning({
    transaction,
    rsvSignatures,
  }: {
    transaction: XRPUnsignedTransaction
    rsvSignatures: RSVSignature[]
  }): string {
    if (rsvSignatures.length === 0) {
      throw new Error('Invalid signatures provided')
    }

    const signature = rsvSignatures[0]

    const derSignature = this.generateTxnSignature(
      signature.r,
      signature.s,
      signature.v
    )

    const signedTransaction = {
      ...transaction.transaction,
      TxnSignature: derSignature,
      SigningPubKey: transaction.signingPubKey.toUpperCase(),
    }

    return JSON.stringify(signedTransaction)
  }

  /**
   * Generates a DER-encoded transaction signature from RSV signature components
   *
   * @param r - The R component of the signature in hex
   * @param s - The S component of the signature in hex
   * @param v - The V component of the signature (recovery ID)
   * @returns DER-encoded signature in uppercase hex format
   */
  generateTxnSignature(r: string, s: string, v: number): string {
    const rBuf = Buffer.from(r, 'hex')
    const sBuf = Buffer.from(s, 'hex')
    let rVal = rBuf
    if (rBuf[0] > 0x7f) {
      rVal = Buffer.concat([Buffer.from([0x00]), rBuf])
    }

    let sVal = sBuf
    if (sBuf[0] > 0x7f) {
      sVal = Buffer.concat([Buffer.from([0x00]), sBuf])
    }

    const totalLength = 2 + rVal.length + 2 + sVal.length

    const derSignature = Buffer.alloc(2 + totalLength)
    let offset = 0

    derSignature.writeUInt8(0x30, offset++)
    derSignature.writeUInt8(totalLength, offset++)
    derSignature.writeUInt8(0x02, offset++)
    derSignature.writeUInt8(rVal.length, offset++)
    rVal.copy(derSignature, offset)
    offset += rVal.length

    derSignature.writeUInt8(0x02, offset++)
    derSignature.writeUInt8(sVal.length, offset++)
    sVal.copy(derSignature, offset)

    return derSignature.toString('hex').toUpperCase()
  }

  /**
   * Broadcasts a signed XRP transaction to the network
   *
   * @param txSerialized - JSON string of the signed transaction
   * @returns Promise resolving to the transaction hash
   * @throws Error if transaction submission fails or is rejected by the network
   */
  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    try {
      await this.client.connect()

      const transaction = JSON.parse(txSerialized) as Record<string, unknown>

      const txBlob = encodeTx(transaction)
      const response = await this.client.submit(txBlob)

      await this.client.disconnect()

      if (
        response.result.engine_result === 'tesSUCCESS' ||
        response.result.engine_result === 'terQUEUED'
      ) {
        const txHash = response.result.tx_json?.hash
        if (!txHash) {
          throw new Error('Transaction submitted but no hash received')
        }
        return { hash: txHash }
      } else {
        throw new Error(
          `Transaction failed: ${response.result.engine_result} - ${response.result.engine_result === 'terQUEUED' ? 'Transaction is queued' : response.result.engine_result}`
        )
      }
    } catch (error) {
      console.error('Failed to broadcast XRP transaction:', error)
      throw new Error('Failed to broadcast XRP transaction')
    }
  }
}

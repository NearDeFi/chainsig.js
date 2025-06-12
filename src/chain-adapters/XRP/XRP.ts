import { createHash } from 'crypto'

import { base58 } from '@scure/base'
import { encodeAccountID } from 'ripple-address-codec'
import { encode as encodeTx } from 'ripple-binary-codec'
import { Client } from 'xrpl'

import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import type { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { HashToSign, Signature, RSVSignature } from '@types'

import type {
  XRPTransactionRequest,
  XRPUnsignedTransaction,
  XRPNetworkIds,
} from './types'

export class XRP extends ChainAdapter<
  XRPTransactionRequest,
  XRPUnsignedTransaction
> {
  private readonly rpcUrl: string
  private readonly contract: ChainSignatureContract
  private readonly network: XRPNetworkIds

  /**
   * Creates a new XRP chain instance
   * @param params - Configuration parameters
   * @param params.rpcUrl - XRP Ledger RPC endpoint URL
   * @param params.contract - Instance of the chain signature contract for MPC operations
   * @param params.network - Network identifier (mainnet/testnet/devnet)
   */
  constructor({
    rpcUrl,
    contract,
    network,
  }: {
    rpcUrl: string
    contract: ChainSignatureContract
    network: XRPNetworkIds
  }) {
    super()

    this.rpcUrl = rpcUrl
    this.contract = contract
    this.network = network
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    try {
      const client = new Client(this.rpcUrl)
      await client.connect()

      try {
        const response = await client.request({
          command: 'account_info',
          account: address,
          ledger_index: 'validated',
        })

        const balance = BigInt(String(response?.result?.account_data?.Balance))
        await client.disconnect()

        return {
          balance: balance || 0n,
          decimals: 6,
        }
      } catch (accountError: any) {
        await client.disconnect()

        // Check if error is specifically "Account not found"
        if (
          accountError?.data?.error === 'actNotFound' ||
          accountError?.message?.includes('Account not found') ||
          accountError?.data?.error_message?.includes('Account not found')
        ) {
          // Account doesn't exist yet (hasn't received any XRP)
          return {
            balance: 0n,
            decimals: 6,
          }
        }

        // Re-throw other errors
        throw accountError
      }
    } catch (error) {
      console.error('Failed to fetch XRP balance:', error)
      return {
        balance: 0n,
        decimals: 6,
      }
    }
  }

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: string
  ): Promise<{ address: string; publicKey: string }> {
    const ed25519PubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
      IsEd25519: true,
    })

    if (!ed25519PubKey) {
      throw new Error('Failed to get derived Ed25519 public key')
    }

    const base58Key = ed25519PubKey.replace(/^(Ed25519:|ed25519:)/, '')

    const keyBytes = base58.decode(base58Key)
    const cleanPubKey = Buffer.from(keyBytes).toString('hex')

    if (cleanPubKey.length !== 64) {
      throw new Error(
        `Invalid Ed25519 public key length: ${cleanPubKey.length}. Expected 64 hex characters. Raw key: ${ed25519PubKey}`
      )
    }

    const address = this.deriveXRPAddress(cleanPubKey)

    return {
      address,
      publicKey: cleanPubKey,
    }
  }

  /**
   * Derives an XRP address from an Ed25519 public key
   * @param publicKeyHex - The Ed25519 public key in hex format (64 chars)
   * @returns The XRP address
   */
  private deriveXRPAddress(publicKeyHex: string): string {
    const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex')
    const sha256Hash = createHash('sha256').update(publicKeyBuffer).digest()
    const ripemd160Hash = createHash('ripemd160').update(sha256Hash).digest()
    const address = encodeAccountID(ripemd160Hash)

    return address
  }

  serializeTransaction(transaction: XRPUnsignedTransaction): string {
    return JSON.stringify(transaction)
  }

  deserializeTransaction(serialized: string): XRPUnsignedTransaction {
    return JSON.parse(serialized)
  }

  async prepareTransactionForSigning(
    transactionRequest: XRPTransactionRequest
  ): Promise<{
    transaction: XRPUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    try {
      const client = new Client(this.rpcUrl)
      await client.connect()

      const accountInfo = await client.request({
        command: 'account_info',
        account: transactionRequest.from,
        ledger_index: 'validated',
      })

      const sequence =
        accountInfo.result.account_data?.Sequence ||
        transactionRequest.sequence ||
        1

      const ledger = await client.request({
        command: 'ledger',
        ledger_index: 'validated',
      })

      await client.disconnect()

      const lastLedgerSequence = ledger.result.ledger_index + 20
      // https://xrpl.org/resources/dev-tools/websocket-api-tool#simulate
      const transaction: Record<string, unknown> = {
        TransactionType: 'Payment',
        Account: transactionRequest.from,
        Destination: transactionRequest.to,
        Amount: transactionRequest.amount,
        Fee: transactionRequest.fee || '12',
        Sequence: sequence,
        LastLedgerSequence: lastLedgerSequence,
        SigningPubKey: '',
      }

      if (transactionRequest.destinationTag !== undefined) {
        transaction.DestinationTag = transactionRequest.destinationTag
      }

      if (transactionRequest.memo) {
        transaction.Memos = [
          {
            Memo: {
              MemoData: Buffer.from(transactionRequest.memo, 'utf8')
                .toString('hex')
                .toUpperCase(),
            },
          },
        ]
      }

      const unsignedTx: XRPUnsignedTransaction = {
        transaction: transaction as any,
        signingPubKey: '',
      }

      // Encode the transaction for signing using ripple-binary-codec
      const encodedTx = encodeTx(transaction)

      // For Ed25519 signatures, XRP requires the signing prefix 'STX\x00' (0x53545800)
      // to be prepended to the encoded transaction before hashing
      const signingPrefix = Buffer.from([0x53, 0x54, 0x58, 0x00]) // 'STX\x00'
      const txBuffer = Buffer.from(encodedTx, 'hex')
      const prefixedTx = Buffer.concat([signingPrefix, txBuffer])

      // Create SHA-512 hash of the prefixed transaction for Ed25519 signing
      const txHash = createHash('sha512').update(prefixedTx).digest()

      // For Ed25519 signing, we need the full 64-byte SHA-512 hash as an array
      const hashToSign = Array.from(txHash)

      return {
        transaction: unsignedTx,
        hashesToSign: [hashToSign],
      }
    } catch (error) {
      console.error('Failed to prepare XRP transaction for signing:', error)
      throw new Error('Failed to prepare XRP transaction for signing')
    }
  }

  finalizeTransactionSigning({
    transaction,
    rsvSignatures,
    publicKey,
  }: {
    transaction: XRPUnsignedTransaction
    rsvSignatures: RSVSignature[]
    publicKey?: string
  }): string {
    if (rsvSignatures.length === 0) {
      throw new Error('Invalid signatures provided')
    }

    const signature = rsvSignatures[0]

    // Get the public key
    let signingPubKey = publicKey || transaction.signingPubKey
    if (!signingPubKey) {
      throw new Error(
        'Public key is required for XRP transaction signing. Please provide publicKey parameter.'
      )
    }

    // Clean up the public key format
    signingPubKey = signingPubKey.replace(/^(0x|ED)/i, '')

    // Validate Ed25519 public key length (32 bytes = 64 hex chars)
    if (signingPubKey.length !== 64) {
      throw new Error(
        `Invalid Ed25519 public key length: ${signingPubKey.length}`
      )
    }

    // Convert signature array to hex string
    const signatureArray = (signature as any).signature
    let signatureBuffer: Buffer

    if (Array.isArray(signatureArray)) {
      // Convert number array to Uint8Array first, then to Buffer
      signatureBuffer = Buffer.from(new Uint8Array(signatureArray))
    } else if (signatureArray instanceof Uint8Array) {
      signatureBuffer = Buffer.from(signatureArray)
    } else {
      throw new Error(
        'Invalid signature format: expected number array or Uint8Array'
      )
    }

    const signatureHex = signatureBuffer.toString('hex')

    // Validate Ed25519 signature length (64 bytes = 128 hex chars)
    if (signatureHex.length !== 128) {
      throw new Error(
        `Invalid Ed25519 signature length: ${signatureHex.length}. Expected 128 hex characters.`
      )
    }

    // Create signed transaction
    const signedTx: Record<string, unknown> = {
      ...transaction.transaction,
      TxnSignature: signatureHex.toUpperCase(),
      SigningPubKey: 'ED' + signingPubKey.toUpperCase(),
    }

    return JSON.stringify(signedTx)
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    try {
      const client = new Client(this.rpcUrl)
      await client.connect()

      const transaction = JSON.parse(txSerialized) as Record<string, unknown>

      // Handle Ed25519 SigningPubKey format for XRP Ledger
      if (
        transaction.SigningPubKey &&
        typeof transaction.SigningPubKey === 'string'
      ) {
        let pubKey = transaction.SigningPubKey

        // Remove any prefixes
        if (pubKey.startsWith('0x')) {
          pubKey = pubKey.slice(2)
        }
        if (pubKey.startsWith('ED')) {
          pubKey = pubKey.slice(2)
        }

        // Validate it's a proper hex string
        const isValidHex =
          /^[0-9A-Fa-f]+$/.test(pubKey) && pubKey.length % 2 === 0

        if (!isValidHex) {
          throw new Error(
            `Invalid SigningPubKey format: ${transaction.SigningPubKey}. Must be valid hex.`
          )
        }

        // For Ed25519 keys, XRP Ledger requires the 'ED' prefix
        // Ed25519 public keys are 32 bytes (64 hex chars)
        if (pubKey.length === 64) {
          transaction.SigningPubKey = 'ED' + pubKey.toUpperCase()
        } else {
          throw new Error(
            `Invalid Ed25519 public key length: ${pubKey.length}. Expected 64 hex characters.`
          )
        }
      }

      // Encode the transaction to hex blob format
      const txBlob = encodeTx(transaction)
      console.log('Encoded XRP transaction blob:', txBlob)
      console.log('Transaction JSON:', JSON.stringify(transaction, null, 2))

      // Use the correct XRPL client method for submitting transactions
      const response = await client.submit(txBlob)

      await client.disconnect()

      // Check if the transaction was successfully submitted
      if (
        response.result.engine_result === 'tesSUCCESS' ||
        response.result.engine_result === 'terQUEUED'
      ) {
        // Get transaction hash from the tx_json response
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

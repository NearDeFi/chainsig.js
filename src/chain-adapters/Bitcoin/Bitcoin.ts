import * as bitcoin from 'bitcoinjs-lib'

import { type BTCRpcAdapter } from '@chain-adapters/Bitcoin/BTCRpcAdapter'
import type {
  BTCInput,
  BTCNetworkIds,
  BTCOutput,
  BTCTransactionRequest,
  BTCUnsignedTransaction,
} from '@chain-adapters/Bitcoin/types'
import { parseBTCNetwork } from '@chain-adapters/Bitcoin/utils'
import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import type { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { HashToSign, RSVSignature, UncompressedPubKeySEC1 } from '@types'
import { cryptography } from '@utils'

/**
 * Implementation of the ChainAdapter interface for Bitcoin network.
 * Handles interactions with both Bitcoin mainnet and testnet, supporting P2WPKH transactions.
 */
export class Bitcoin extends ChainAdapter<
  BTCTransactionRequest,
  BTCUnsignedTransaction
> {
  private static readonly SATOSHIS_PER_BTC = 100_000_000

  private readonly network: BTCNetworkIds
  private readonly btcRpcAdapter: BTCRpcAdapter
  private readonly contract: ChainSignatureContract

  /**
   * Creates a new Bitcoin chain instance
   * @param params - Configuration parameters
   * @param params.network - Network identifier (mainnet/testnet)
   * @param params.contract - Instance of the chain signature contract for MPC operations
   * @param params.btcRpcAdapter - Bitcoin RPC adapter for network interactions
   */
  constructor({
    network,
    contract,
    btcRpcAdapter,
  }: {
    network: BTCNetworkIds
    contract: ChainSignatureContract
    btcRpcAdapter: BTCRpcAdapter
  }) {
    super()

    this.network = network
    this.btcRpcAdapter = btcRpcAdapter
    this.contract = contract
  }

  /**
   * Converts satoshis to BTC
   * @param satoshis - Amount in satoshis
   * @returns Amount in BTC
   */
  static toBTC(satoshis: number): number {
    return satoshis / Bitcoin.SATOSHIS_PER_BTC
  }

  /**
   * Converts BTC to satoshis
   * @param btc - Amount in BTC
   * @returns Amount in satoshis (rounded)
   */
  static toSatoshi(btc: number): number {
    return Math.round(btc * Bitcoin.SATOSHIS_PER_BTC)
  }

  private async fetchTransaction(
    transactionId: string
  ): Promise<bitcoin.Transaction> {
    const data = await this.btcRpcAdapter.getTransaction(transactionId)
    const tx = new bitcoin.Transaction()

    data.vout.forEach((vout) => {
      const scriptPubKey = Buffer.from(vout.scriptpubkey, 'hex')
      tx.addOutput(scriptPubKey, Number(vout.value))
    })

    return tx
  }

  private static transformRSVSignature(signature: RSVSignature): Buffer {
    const r = signature.r.padStart(64, '0')
    const s = signature.s.padStart(64, '0')

    const rawSignature = Buffer.from(r + s, 'hex')

    if (rawSignature.length !== 64) {
      throw new Error('Invalid signature length.')
    }

    return rawSignature
  }

  /**
   * Creates a Partially Signed Bitcoin Transaction (PSBT)
   * @param params - Parameters for creating the PSBT
   * @param params.transactionRequest - Transaction request containing inputs and outputs
   * @returns Created PSBT instance
   */
  async createPSBT({
    transactionRequest,
  }: {
    transactionRequest: BTCTransactionRequest
  }): Promise<bitcoin.Psbt> {
    const { inputs, outputs } =
      transactionRequest.inputs && transactionRequest.outputs
        ? transactionRequest
        : await this.btcRpcAdapter.selectUTXOs(transactionRequest.from, [
            {
              address: transactionRequest.to,
              value: parseFloat(transactionRequest.value),
            },
          ])

    const psbt = new bitcoin.Psbt({ network: parseBTCNetwork(this.network) })

    await Promise.all(
      inputs.map(async (input: BTCInput) => {
        if (!input.scriptPubKey) {
          const transaction = await this.fetchTransaction(input.txid)
          const prevOut = transaction.outs[input.vout]
          input.scriptPubKey = prevOut.script
        }

        // Prepare the input as P2WPKH
        psbt.addInput({
          hash: input.txid,
          index: input.vout,
          witnessUtxo: {
            script: input.scriptPubKey,
            value: input.value,
          },
        })
      })
    )

    outputs.forEach((out: BTCOutput) => {
      if ('address' in out) {
        psbt.addOutput({
          address: out.address,
          value: out.value,
        })
      } else if ('script' in out) {
        psbt.addOutput({
          script: out.script,
          value: out.value,
        })
      } else if (transactionRequest.from !== undefined) {
        // Include change address from coinselect
        psbt.addOutput({
          value: Number(out.value),
          address: transactionRequest.from,
        })
      }
    })

    return psbt
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const balance = BigInt(await this.btcRpcAdapter.getBalance(address))
    return {
      balance,
      decimals: 8,
    }
  }

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: string
  ): Promise<{ address: string; publicKey: string }> {
    const uncompressedPubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
    })

    if (!uncompressedPubKey) {
      throw new Error('Failed to get derived public key')
    }

    const derivedKey = cryptography.compressPubKey(
      uncompressedPubKey as UncompressedPubKeySEC1
    )
    const publicKeyBuffer = Buffer.from(derivedKey, 'hex')
    const network = parseBTCNetwork(this.network)

    const payment = bitcoin.payments.p2wpkh({
      pubkey: publicKeyBuffer,
      network,
    })

    const { address } = payment

    if (!address) {
      throw new Error('Failed to generate Bitcoin address')
    }

    return { address, publicKey: derivedKey }
  }

  serializeTransaction(transaction: BTCUnsignedTransaction): string {
    return JSON.stringify({
      psbt: transaction.psbt.toHex(),
      publicKey: transaction.publicKey,
    })
  }

  deserializeTransaction(serialized: string): BTCUnsignedTransaction {
    const transactionJSON = JSON.parse(serialized)
    return {
      psbt: bitcoin.Psbt.fromHex(transactionJSON.psbt as string),
      publicKey: transactionJSON.publicKey,
    }
  }

  async prepareTransactionForSigning(
    transactionRequest: BTCTransactionRequest
  ): Promise<{
    transaction: BTCUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    const publicKeyBuffer = Buffer.from(transactionRequest.publicKey, 'hex')
    const psbt = await this.createPSBT({
      transactionRequest,
    })
    // We can't double sign a PSBT, therefore we serialize the payload before to return it
    const psbtHex = psbt.toHex()

    const hashesToSign: HashToSign[] = []

    const mockKeyPair = (index: number): bitcoin.Signer => ({
      publicKey: publicKeyBuffer,
      sign: (hash: Buffer): Buffer => {
        hashesToSign[index] = Array.from(hash)
        // Return dummy signature to satisfy the interface
        return Buffer.alloc(64)
      },
    })

    for (let index = 0; index < psbt.inputCount; index++) {
      psbt.signInput(index, mockKeyPair(index))
    }

    return {
      transaction: {
        psbt: bitcoin.Psbt.fromHex(psbtHex),
        publicKey: transactionRequest.publicKey,
      },
      hashesToSign,
    }
  }

  finalizeTransactionSigning({
    transaction: { psbt, publicKey },
    rsvSignatures,
  }: {
    transaction: BTCUnsignedTransaction
    rsvSignatures: RSVSignature[]
  }): string {
    const publicKeyBuffer = Buffer.from(publicKey, 'hex')

    const keyPair = (index: number): bitcoin.Signer => ({
      publicKey: publicKeyBuffer,
      sign: () => {
        const mpcSignature = rsvSignatures[index]
        return Bitcoin.transformRSVSignature(mpcSignature)
      },
    })

    for (let index = 0; index < psbt.inputCount; index++) {
      psbt.signInput(index, keyPair(index))
    }

    psbt.finalizeAllInputs()
    return psbt.extractTransaction().toHex()
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    const txId = await this.btcRpcAdapter.broadcastTransaction(txSerialized)
    return { hash: txId }
  }
}

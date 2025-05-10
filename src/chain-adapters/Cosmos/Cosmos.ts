import { encodeSecp256k1Pubkey } from '@cosmjs/amino'
import { ripemd160, sha256 } from '@cosmjs/crypto'
import { toBase64, fromBase64, fromHex } from '@cosmjs/encoding'
import {
  Registry,
  makeSignBytes,
  encodePubkey,
  makeAuthInfoBytes,
  makeSignDoc,
  type TxBodyEncodeObject,
} from '@cosmjs/proto-signing'
import { GasPrice, StargateClient, calculateFee } from '@cosmjs/stargate'
import { bech32 } from 'bech32'
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing'
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'

import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import type {
  CosmosNetworkIds,
  CosmosTransactionRequest,
  CosmosUnsignedTransaction,
  ChainInfo,
  BalanceResponse,
} from '@chain-adapters/Cosmos/types'
import { fetchChainInfo } from '@chain-adapters/Cosmos/utils'
import type { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { HashToSign, RSVSignature, UncompressedPubKeySEC1 } from '@types'
import { cryptography } from '@utils'

/**
 * Implementation of the ChainAdapter interface for Cosmos-based networks.
 * Handles interactions with Cosmos SDK chains like Cosmos Hub, Osmosis, etc.
 */
export class Cosmos extends ChainAdapter<
  CosmosTransactionRequest,
  CosmosUnsignedTransaction
> {
  private readonly registry: Registry
  private readonly chainId: CosmosNetworkIds
  private readonly contract: ChainSignatureContract
  private readonly endpoints?: {
    rpcUrl?: string
    restUrl?: string
  }

  /**
   * Creates a new Cosmos chain instance
   * @param params - Configuration parameters
   * @param params.chainId - Chain id for the Cosmos network
   * @param params.contract - Instance of the chain signature contract for MPC operations
   * @param params.endpoints - Optional RPC and REST endpoints
   * @param params.endpoints.rpcUrl - Optional RPC endpoint URL
   * @param params.endpoints.restUrl - Optional REST endpoint URL
   */
  constructor({
    chainId,
    contract,
    endpoints,
  }: {
    contract: ChainSignatureContract
    chainId: CosmosNetworkIds
    endpoints?: {
      rpcUrl?: string
      restUrl?: string
    }
  }) {
    super()

    this.contract = contract
    this.registry = new Registry()
    this.chainId = chainId
    this.endpoints = endpoints
  }

  private transformRSVSignature(rsvSignature: RSVSignature): Uint8Array {
    return new Uint8Array([
      ...fromHex(rsvSignature.r),
      ...fromHex(rsvSignature.s),
    ])
  }

  private async getChainInfo(): Promise<ChainInfo> {
    return {
      ...(await fetchChainInfo(this.chainId)),
      ...this.endpoints,
    }
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    try {
      const { restUrl, denom, decimals } = await this.getChainInfo()

      const response = await fetch(
        `${restUrl}/cosmos/bank/v1beta1/balances/${address}`
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = (await response.json()) as BalanceResponse
      const balance = data.balances.find((b) => b.denom === denom)
      const amount = balance?.amount ?? '0'

      return {
        balance: BigInt(amount),
        decimals,
      }
    } catch (error) {
      console.error('Failed to fetch Cosmos balance:', error)
      throw new Error('Failed to fetch Cosmos balance')
    }
  }

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: string
  ): Promise<{
    address: string
    publicKey: string
  }> {
    const { prefix } = await this.getChainInfo()
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
    const pubKeySha256 = sha256(fromHex(derivedKey))
    const ripemd160Hash = ripemd160(pubKeySha256)
    const address = bech32.encode(prefix, bech32.toWords(ripemd160Hash))

    return { address, publicKey: derivedKey }
  }

  serializeTransaction(transaction: CosmosUnsignedTransaction): string {
    const serialized = TxRaw.encode(transaction).finish()
    return toBase64(serialized)
  }

  deserializeTransaction(serialized: string): CosmosUnsignedTransaction {
    return TxRaw.decode(fromBase64(serialized))
  }

  async prepareTransactionForSigning(
    transactionRequest: CosmosTransactionRequest
  ): Promise<{
    transaction: CosmosUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    const { denom, rpcUrl, gasPrice } = await this.getChainInfo()
    const publicKeyBytes = fromHex(transactionRequest.publicKey)

    const gasLimit = transactionRequest.gas || 200_000

    const fee = calculateFee(
      gasLimit,
      GasPrice.fromString(`${gasPrice}${denom}`)
    )

    const client = await StargateClient.connect(rpcUrl)
    const accountOnChain = await client.getAccount(transactionRequest.address)
    if (!accountOnChain) {
      throw new Error(
        `Account ${transactionRequest.address} does not exist on chain`
      )
    }

    const { accountNumber, sequence } = accountOnChain

    const txBodyEncodeObject: TxBodyEncodeObject = {
      typeUrl: '/cosmos.tx.v1beta1.TxBody',
      value: {
        messages: transactionRequest.messages,
        memo: transactionRequest.memo || '',
      },
    }

    const txBodyBytes = this.registry.encode(txBodyEncodeObject)

    const pubkey = encodePubkey(encodeSecp256k1Pubkey(publicKeyBytes))

    // TODO: Allow caller to provide: multiple signers, fee payer, fee granter
    const authInfoBytes = makeAuthInfoBytes(
      [
        {
          pubkey,
          sequence,
        },
      ],
      fee.amount,
      Number(fee.gas),
      undefined,
      undefined,
      SignMode.SIGN_MODE_DIRECT
    )

    const signDoc = makeSignDoc(
      txBodyBytes,
      authInfoBytes,
      this.chainId,
      accountNumber
    )

    const signBytes = makeSignBytes(signDoc)
    const payload = Array.from(sha256(signBytes))

    return {
      transaction: TxRaw.fromPartial({
        bodyBytes: txBodyBytes,
        authInfoBytes,
        signatures: [],
      }),
      hashesToSign: [payload],
    }
  }

  finalizeTransactionSigning({
    transaction,
    rsvSignatures,
  }: {
    transaction: CosmosUnsignedTransaction
    rsvSignatures: RSVSignature[]
  }): string {
    // Allow support for multi-sig but the package only supports single-sig
    transaction.signatures = rsvSignatures.map((sig) =>
      this.transformRSVSignature(sig)
    )

    const txBytes = TxRaw.encode(transaction).finish()
    return Buffer.from(txBytes).toString('hex')
  }

  // @ts-expect-error - TODO: fix this
  async broadcastTx(txSerialized: string): Promise<string> {
    try {
      const { rpcUrl } = await this.getChainInfo()
      const client = await StargateClient.connect(rpcUrl)

      const txBytes = fromHex(txSerialized)
      const broadcastResponse = await client.broadcastTx(txBytes)

      if (broadcastResponse.code !== 0) {
        throw new Error(`Broadcast error: ${broadcastResponse.rawLog}`)
      }

      return broadcastResponse.transactionHash
    } catch (error) {
      console.error('Transaction broadcast failed:', error)
      throw new Error('Failed to broadcast transaction.')
    }
  }
}

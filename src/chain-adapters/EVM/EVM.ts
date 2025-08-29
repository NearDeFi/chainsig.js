import {
  parseTransaction,
  type PublicClient,
  hashMessage,
  hashTypedData,
  keccak256,
  toBytes,
  type Hex,
  serializeTransaction,
  type Signature,
  numberToHex,
  getAddress,
  type Address,
  type Hash,
  concatHex,
  encodeAbiParameters,
  hexToBigInt,
  concat,
  pad,
  isAddress,
  type SignedAuthorization,
} from 'viem'
import { hashAuthorization } from 'viem/experimental'

import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import type {
  EVMTransactionRequest,
  EVMUnsignedTransaction,
  EVMMessage,
  EVMTypedData,
  UserOperationV6,
  UserOperationV7,
  EVMAuthorizationRequest,
  EVMTransactionRequestLegacy,
  EVMUnsignedLegacyTransaction,
} from '@chain-adapters/EVM/types'
import { fetchEVMFeeProperties } from '@chain-adapters/EVM/utils'
import type { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { HashToSign, RSVSignature } from '@types'

/**
 * Implementation of the ChainAdapter interface for EVM-compatible networks.
 * Handles interactions with Ethereum Virtual Machine based blockchains like Ethereum, BSC, Polygon, etc.
 */
export class EVM extends ChainAdapter<EVMTransactionRequest, EVMUnsignedTransaction> {
  private readonly client: PublicClient
  private readonly contract: ChainSignatureContract

  /**
   * Creates a new EVM chain instance
   * @param params - Configuration parameters
   * @param params.publicClient - A Viem PublicClient instance for reading from the blockchain
   * @param params.contract - Instance of the chain signature contract for MPC operations
   */
  constructor({
    publicClient,
    contract,
  }: {
    publicClient: PublicClient
    contract: ChainSignatureContract
  }) {
    super()

    this.contract = contract
    this.client = publicClient
  }

  private async attachGasAndNonce(
    transaction: EVMTransactionRequest
  ): Promise<EVMUnsignedTransaction> {
    const fees = await fetchEVMFeeProperties(this.client, transaction)
    const nonce =
      transaction.nonce ??
      (await this.client.getTransactionCount({
        address: transaction.from,
      }))

    const { from, ...rest } = transaction

    return {
      ...fees,
      nonce,
      chainId: Number(await this.client.getChainId()),
      type: 'eip1559',
      ...rest,
    }
  }

  private async attachGasAndNonceLegacy(
    transaction: EVMTransactionRequestLegacy
  ): Promise<EVMUnsignedLegacyTransaction> {
    const gasPrice = transaction.gasPrice ?? (await this.client.getGasPrice())
    const nonce =
      transaction.nonce ??
      (await this.client.getTransactionCount({
        address: transaction.from,
      }))

    const { from, ...rest } = transaction

    return {
      ...rest,
      gasPrice: BigInt(gasPrice),
      nonce: Number(nonce),
      value: rest.value !== undefined ? BigInt(rest.value) : undefined,
      gas: rest.gas !== undefined ? BigInt(rest.gas) : BigInt(21000),
      chainId: await this.client.getChainId(),
      type: 'legacy',
    }
  }

  private transformRSVSignature(signature: RSVSignature): Signature {
    return {
      r: `0x${signature.r}`,
      s: `0x${signature.s}`,
      yParity: signature.v - 27,
    }
  }

  private assembleSignature(signature: RSVSignature): Hex {
    const { r, s, yParity } = this.transformRSVSignature(signature)

    if (yParity === undefined) {
      throw new Error('Missing yParity')
    }

    return concatHex([r, s, numberToHex(yParity + 27, { size: 1 })])
  }

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: string
  ): Promise<{
    address: string
    publicKey: string
  }> {
    const uncompressedPubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
    })

    if (!uncompressedPubKey) {
      throw new Error('Failed to get derived public key')
    }

    const publicKeyNoPrefix = uncompressedPubKey.startsWith('04')
      ? uncompressedPubKey.slice(2)
      : uncompressedPubKey

    const hash = keccak256(Buffer.from(publicKeyNoPrefix, 'hex'))
    const address = getAddress(`0x${hash.slice(-40)}`)

    return {
      address,
      publicKey: uncompressedPubKey,
    }
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const balance = await this.client.getBalance({
      address: address as Address,
    })
    return {
      balance,
      decimals: 18,
    }
  }

  serializeTransaction(transaction: EVMUnsignedTransaction): `0x${string}` {
    return serializeTransaction(transaction)
  }

  deserializeTransaction(serialized: `0x${string}`): EVMUnsignedTransaction {
    return parseTransaction(serialized) as EVMUnsignedTransaction
  }

  async prepareTransactionForSigning(
    transactionRequest: EVMTransactionRequest
  ): Promise<{
    transaction: EVMUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    const transaction = await this.attachGasAndNonce(transactionRequest)

    const serializedTx = serializeTransaction(transaction)
    const txHash = toBytes(keccak256(serializedTx))

    return {
      transaction,
      hashesToSign: [Array.from(txHash)],
    }
  }

  async prepareTransactionForSigningLegacy(
    transactionRequest: EVMTransactionRequestLegacy
  ): Promise<{
    transaction: EVMUnsignedLegacyTransaction
    hashesToSign: HashToSign[]
  }> {
    const transaction = await this.attachGasAndNonceLegacy(transactionRequest)
    const serializedTx = serializeTransaction(transaction)
    const txHash = toBytes(keccak256(serializedTx))
    return {
      transaction,
      hashesToSign: [Array.from(txHash)],
    }
  }

  async prepareMessageForSigning(message: EVMMessage): Promise<{
    hashToSign: HashToSign
  }> {
    return {
      hashToSign: Array.from(toBytes(hashMessage(message))),
    }
  }

  async prepareTypedDataForSigning(typedDataRequest: EVMTypedData): Promise<{
    hashToSign: HashToSign
  }> {
    return {
      hashToSign: Array.from(toBytes(hashTypedData(typedDataRequest))),
    }
  }

  /**
   * This implementation is a common step for Biconomy and Alchemy.
   * Key differences between implementations:
   * - Signature format: Biconomy omits 0x00 prefix when concatenating, Alchemy includes it
   * - Version support: Biconomy only supports v6, Alchemy supports both v6 and v7
   * - Validation: Biconomy uses modules for signature validation, Alchemy uses built-in validation
   */
  async prepareUserOpForSigning(
    userOp: UserOperationV7 | UserOperationV6,
    entryPointAddress?: Address,
    chainIdArgs?: number
  ): Promise<{
    userOp: UserOperationV7 | UserOperationV6
    hashToSign: HashToSign
  }> {
    const chainId = chainIdArgs ?? (await this.client.getChainId())
    const entryPoint =
      entryPointAddress || '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

    const encoded = encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
      [
        keccak256(
          encodeAbiParameters(
            [
              { type: 'address' },
              { type: 'uint256' },
              { type: 'bytes32' },
              { type: 'bytes32' },
              { type: 'bytes32' },
              { type: 'uint256' },
              { type: 'bytes32' },
              { type: 'bytes32' },
            ],
            [
              userOp.sender,
              hexToBigInt(userOp.nonce),
              keccak256(
                'factory' in userOp &&
                  'factoryData' in userOp &&
                  userOp.factory &&
                  userOp.factoryData
                  ? concat([userOp.factory, userOp.factoryData])
                  : 'initCode' in userOp
                    ? userOp.initCode
                    : '0x'
              ),
              keccak256(userOp.callData),
              concat([
                pad(userOp.verificationGasLimit, { size: 16 }),
                pad(userOp.callGasLimit, { size: 16 }),
              ]),
              hexToBigInt(userOp.preVerificationGas),
              concat([
                pad(userOp.maxPriorityFeePerGas, { size: 16 }),
                pad(userOp.maxFeePerGas, { size: 16 }),
              ]),
              keccak256(
                'paymaster' in userOp &&
                  userOp.paymaster &&
                  isAddress(userOp.paymaster)
                  ? concat([
                      userOp.paymaster,
                      pad(userOp.paymasterVerificationGasLimit, { size: 16 }),
                      pad(userOp.paymasterPostOpGasLimit, { size: 16 }),
                      userOp.paymasterData,
                    ])
                  : 'paymasterAndData' in userOp
                    ? userOp.paymasterAndData
                    : '0x'
              ),
            ]
          )
        ),
        entryPoint,
        BigInt(chainId),
      ]
    )

    const userOpHash = keccak256(encoded)

    return {
      userOp,
      hashToSign: Array.from(toBytes(hashMessage({ raw: userOpHash }))),
    }
  }

  prepareAuthorizationForSigning(params: EVMAuthorizationRequest): {
    hashToSign: HashToSign
  } {
    const address = params.contractAddress ?? params.address
    return {
      hashToSign: Array.from(
        toBytes(
          hashAuthorization({
            address,
            chainId: params.chainId,
            nonce: params.nonce,
          })
        )
      ),
    }
  }

  finalizeTransactionSigning({
    transaction,
    rsvSignatures,
  }: {
    transaction: EVMUnsignedTransaction
    rsvSignatures: RSVSignature[]
  }): `0x02${string}` {
    const signature = this.transformRSVSignature(rsvSignatures[0])

    return serializeTransaction(transaction, signature)
  }

  public finalizeTransactionSigningLegacy({
    transaction,
    rsvSignatures,
  }: {
    transaction: EVMUnsignedLegacyTransaction
    rsvSignatures: RSVSignature[]
  }): `0x${string}` {
    const signature = {
      v: BigInt(rsvSignatures[0].v),
      r: `0x${rsvSignatures[0].r.padStart(64, '0')}` as `0x${string}`,
      s: `0x${rsvSignatures[0].s.padStart(64, '0')}` as `0x${string}`,
      yParity: rsvSignatures[0].v - 27,
    }

    return serializeTransaction(transaction, signature)
  }

  finalizeMessageSigning({
    rsvSignature,
  }: {
    rsvSignature: RSVSignature
  }): Hex {
    return this.assembleSignature(rsvSignature)
  }

  finalizeTypedDataSigning({
    rsvSignature,
  }: {
    rsvSignature: RSVSignature
  }): Hex {
    return this.assembleSignature(rsvSignature)
  }

  finalizeUserOpSigning({
    userOp,
    rsvSignature,
  }: {
    userOp: UserOperationV7 | UserOperationV6
    rsvSignature: RSVSignature
  }): UserOperationV7 | UserOperationV6 {
    const { r, s, yParity } = this.transformRSVSignature(rsvSignature)
    if (yParity === undefined) {
      throw new Error('Missing yParity')
    }

    return {
      ...userOp,
      signature: concatHex([
        '0x00', // Alchemy specific implementation. Biconomy doesn't include the 0x00 prefix.
        r,
        s,
        numberToHex(Number(yParity + 27), { size: 1 }),
      ]),
    }
  }

  finalizeAuthorizationSigning(params: {
    authorization: EVMAuthorizationRequest
    rsvSignature: RSVSignature
  }): SignedAuthorization {
    return {
      address:
        params.authorization.contractAddress ?? params.authorization.address,
      chainId: params.authorization.chainId,
      nonce: params.authorization.nonce,
      ...this.transformRSVSignature(params.rsvSignature),
    }
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: Hash }> {
    try {
      const hash = await this.client.sendRawTransaction({
        serializedTransaction: txSerialized as `0x${string}`,
      })
      return { hash }
    } catch (error) {
      console.error('Transaction broadcast failed:', error)
      throw new Error('Failed to broadcast transaction.')
    }
  }
}

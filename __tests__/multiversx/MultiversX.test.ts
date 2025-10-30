import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import bs58 from 'bs58'

import {
  Address,
  AccountOnNetwork,
  NetworkConfig,
  type INetworkProvider,
  type NetworkEntrypoint,
} from '@multiversx/sdk-core'
import type { MockedFunction } from 'jest-mock'

import { MultiversX } from '../../src/chain-adapters/MultiversX/MultiversX'
import type { MultiversXTransactionRequest } from '../../src/chain-adapters/MultiversX/types'
import type { ChainSignatureContract } from '../../src/contracts/ChainSignatureContract'

type ProviderSubset = Pick<
  INetworkProvider,
  'getNetworkConfig' | 'getAccount' | 'sendTransaction'
>

describe('MultiversX Chain Adapter', () => {
  const basePublicKey = Buffer.alloc(32, 1)
  const derivedPublicKey = `ed25519:${bs58.encode(basePublicKey)}`
  const sampleSenderAddress = new Address(basePublicKey).toBech32()
  const sampleReceiverAddress = new Address(Buffer.alloc(32, 2)).toBech32()

  let networkConfig: NetworkConfig
  let mockProvider: {
    getNetworkConfig: MockedFunction<ProviderSubset['getNetworkConfig']>
    getAccount: MockedFunction<ProviderSubset['getAccount']>
    sendTransaction: MockedFunction<ProviderSubset['sendTransaction']>
  }
  let getNetworkConfigMock: MockedFunction<ProviderSubset['getNetworkConfig']>
  let getAccountMock: MockedFunction<ProviderSubset['getAccount']>
  let sendTransactionMock: MockedFunction<ProviderSubset['sendTransaction']>
  let getDerivedPublicKeyMock: MockedFunction<(args: any) => Promise<string>>
  let mockEntrypoint: NetworkEntrypoint
  let mockContract: ChainSignatureContract
  let adapter: MultiversX

  beforeEach(() => {
    networkConfig = new NetworkConfig()
    networkConfig.chainID = 'D'
    networkConfig.minGasLimit = 50000n
    networkConfig.minGasPrice = 1_000_000_000n

    const account = new AccountOnNetwork({
      address: Address.newFromBech32(sampleSenderAddress),
      balance: 1_000_000_000_000_000_000n,
      nonce: 7n,
    })

    getNetworkConfigMock = jest.fn(async () => networkConfig)
    getAccountMock = jest.fn(async () => account)
    sendTransactionMock = jest.fn(async () => 'mock-hash')

    mockProvider = {
      getNetworkConfig: getNetworkConfigMock,
      getAccount: getAccountMock,
      sendTransaction: sendTransactionMock,
    }

    const createNetworkProvider = jest.fn(
      () => mockProvider as unknown as INetworkProvider
    )
    mockEntrypoint = {
      createNetworkProvider,
    } as unknown as NetworkEntrypoint

    getDerivedPublicKeyMock = jest.fn(async () => derivedPublicKey)

    mockContract = {
      getDerivedPublicKey: getDerivedPublicKeyMock as unknown as ChainSignatureContract['getDerivedPublicKey'],
      sign: jest.fn(),
      getPublicKey: jest.fn(),
      getCurrentSignatureDeposit: jest.fn().mockReturnValue(1),
    } as unknown as ChainSignatureContract

    adapter = new MultiversX({
      contract: mockContract,
      networkEntrypoint: mockEntrypoint,
    })
  })

  it('derives MultiversX address and public key', async () => {
    const result = await adapter.deriveAddressAndPublicKey('test.near', 'path')

    expect(result.address.startsWith('erd')).toBe(true)
    expect(result.publicKey).toBe(`0x${Buffer.from(basePublicKey).toString('hex')}`)
    expect(getDerivedPublicKeyMock).toHaveBeenCalled()
  })

  it('returns balance with EGLD decimals', async () => {
    const { balance, decimals } = await adapter.getBalance(sampleSenderAddress)

    expect(balance).toBe(BigInt('1000000000000000000'))
    expect(decimals).toBe(18)
  })

  it('handles missing account when fetching balance', async () => {
    getAccountMock.mockRejectedValueOnce(new Error('account not found'))

    const { balance } = await adapter.getBalance(sampleReceiverAddress)
    expect(balance).toBe(0n)
  })

  it('prepares transaction for signing with network defaults', async () => {
    const request: MultiversXTransactionRequest = {
      sender: sampleSenderAddress,
      receiver: sampleReceiverAddress,
      value: '100000000000000000',
      data: 'hello',
    }

    const { transaction, hashesToSign } = await adapter.prepareTransactionForSigning(
      request
    )

    expect(transaction.nonce).toBe(7n)
    expect(transaction.gasPrice).toBe(networkConfig.minGasPrice)
    expect(transaction.gasLimit).toBe(networkConfig.minGasLimit)
    expect(transaction.chainID).toBe(networkConfig.chainID)
    expect(Array.isArray(hashesToSign)).toBe(true)
    expect(hashesToSign[0].length).toBeGreaterThan(0)
    expect(getNetworkConfigMock).toHaveBeenCalledTimes(1)
  })

  it('serializes and deserializes transactions', async () => {
    const request: MultiversXTransactionRequest = {
      sender: sampleSenderAddress,
      receiver: sampleReceiverAddress,
      value: '10',
    }

    const { transaction } = await adapter.prepareTransactionForSigning(request)
    const serialized = adapter.serializeTransaction(transaction)
    const restored = adapter.deserializeTransaction(serialized)

    expect(restored.toPlainObject()).toEqual(transaction.toPlainObject())
  })

  it('finalizes signing and broadcasts transaction', async () => {
    const request: MultiversXTransactionRequest = {
      sender: sampleSenderAddress,
      receiver: sampleReceiverAddress,
      value: '10',
    }

    const { transaction } = await adapter.prepareTransactionForSigning(request)
    const signed = adapter.finalizeTransactionSigning({
      transaction,
      rsvSignatures: {
        scheme: 'ed25519',
        signature: Array.from(Buffer.alloc(64, 2)),
      },
    })

    const result = await adapter.broadcastTx(signed)
    expect(result).toEqual({ hash: 'mock-hash' })
    expect(sendTransactionMock).toHaveBeenCalled()
  })
})

import { describe, it, expect, beforeEach } from '@jest/globals'
import { type KeyPair } from '@near-js/crypto'
import { createPublicClient } from 'viem'
import { vi } from 'vitest'

import * as chainAdapters from '@chain-adapters'
import type { BTCTransactionRequest } from '@chain-adapters/Bitcoin/types'
import type { CosmosTransactionRequest } from '@chain-adapters/Cosmos/types'
import type { EVMTransactionRequest } from '@chain-adapters/EVM/types'
import { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import * as keypair from '@contracts/signAndSend/keypair'

import { getNearAccount } from '../../../src/contracts/signAndSend/utils'

// Mock dependencies
vi.mock('@contracts/account')
vi.mock('@contracts/ChainSignatureContract')
vi.mock('@chain-adapters')
vi.mock('viem')

describe('signAndSend keypair', () => {
  const mockKeyPair = {} as KeyPair
  const mockAccount = {
    accountId: 'test.near',
  }
  const mockContract = {
    sign: vi.fn(),
  }
  const mockEVM = {
    prepareTransactionForSigning: vi.fn(),
    finalizeTransactionSigning: vi.fn(),
    broadcastTx: vi.fn(),
  }
  const mockBTC = {
    prepareTransactionForSigning: vi.fn(),
    finalizeTransactionSigning: vi.fn(),
    broadcastTx: vi.fn(),
  }
  const mockCosmos = {
    prepareTransactionForSigning: vi.fn(),
    finalizeTransactionSigning: vi.fn(),
    broadcastTx: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(getNearAccount as any).mockResolvedValue(mockAccount)
    ;(ChainSignatureContract as any).mockImplementation(() => mockContract)
    ;(chainAdapters.evm.EVM as any).mockImplementation(() => mockEVM)
    ;(chainAdapters.btc.Bitcoin as any).mockImplementation(() => mockBTC)
    ;(chainAdapters.cosmos.Cosmos as any).mockImplementation(() => mockCosmos)
    ;(createPublicClient as any).mockReturnValue({})
  })

  describe('EVMTransaction', () => {
    it('should successfully sign and send an EVM transaction', async () => {
      // Setup
      const mockTx: EVMTransactionRequest = {
        from: '0x123' as `0x${string}`,
        to: '0x456' as `0x${string}`,
        value: BigInt(100),
      }
      const mockHashes = [[1, 2, 3]]
      const mockSignature = { r: '1', s: '2', v: 27 }
      const mockTxHash = { hash: '0x789' }

      mockEVM.prepareTransactionForSigning.mockResolvedValue({
        transaction: mockTx,
        hashesToSign: mockHashes,
      })
      mockContract.sign.mockResolvedValue([mockSignature])
      mockEVM.finalizeTransactionSigning.mockReturnValue('signed_tx')
      mockEVM.broadcastTx.mockResolvedValue(mockTxHash)

      // Execute
      const result = await keypair.EVMTransaction(
        {
          nearAuthentication: {
            networkId: 'testnet',
            accountId: 'test.near',
          },
          chainConfig: {
            contract: 'test.contract',
            providerUrl: 'http://test.com',
          },
          derivationPath: 'm/44/60/0/0',
          transaction: mockTx,
        },
        mockKeyPair
      )

      // Verify
      expect(result).toEqual({
        transactionHash: '0x789',
        success: true,
      })
      expect(mockContract.sign).toHaveBeenCalledWith({
        payloads: [mockHashes[0]],
        path: 'm/44/60/0/0',
        keyType: 'Ecdsa',
        signerAccount: {
          accountId: 'test.near',
          signAndSendTransactions: expect.any(Function),
        },
      })
    })

    it('should handle errors in EVM transaction', async () => {
      // Setup
      mockEVM.prepareTransactionForSigning.mockRejectedValue(
        new Error('Test error')
      )

      // Execute
      const result = await keypair.EVMTransaction(
        {
          nearAuthentication: {
            networkId: 'testnet',
            accountId: 'test.near',
          },
          chainConfig: {
            contract: 'test.contract',
            providerUrl: 'http://test.com',
          },
          derivationPath: 'm/44/60/0/0',
          transaction: {
            from: '0x123' as `0x${string}`,
            to: '0x456' as `0x${string}`,
            value: BigInt(100),
          },
        },
        mockKeyPair
      )

      // Verify
      expect(result).toEqual({
        success: false,
        errorMessage: 'Test error',
      })
    })
  })

  describe('BTCTransaction', () => {
    it('should successfully sign and send a Bitcoin transaction', async () => {
      // Setup
      const mockTx: BTCTransactionRequest = {
        publicKey: '03...',
        from: 'tb1...',
        to: 'tb1...',
        value: '0.001',
      }
      const mockHashes = [
        [1, 2, 3],
        [4, 5, 6],
      ]
      const mockSignatures = [
        { r: '1', s: '2', v: 27 },
        { r: '3', s: '4', v: 28 },
      ]
      const mockTxHash = { hash: 'txid123' }

      mockBTC.prepareTransactionForSigning.mockResolvedValue({
        transaction: mockTx,
        hashesToSign: mockHashes,
      })
      mockContract.sign.mockResolvedValue(mockSignatures)
      mockBTC.finalizeTransactionSigning.mockReturnValue('signed_tx')
      mockBTC.broadcastTx.mockResolvedValue(mockTxHash)

      // Execute
      const result = await keypair.BTCTransaction(
        {
          nearAuthentication: {
            networkId: 'testnet',
            accountId: 'test.near',
          },
          chainConfig: {
            contract: 'test.contract',
            providerUrl: 'http://test.com',
            network: 'testnet',
          },
          derivationPath: 'm/44/0/0/0',
          transaction: mockTx,
        },
        mockKeyPair
      )

      // Verify
      expect(result).toEqual({
        transactionHash: 'txid123',
        success: true,
      })
      expect(mockContract.sign).toHaveBeenCalledTimes(2)
    })

    it('should handle errors in Bitcoin transaction', async () => {
      // Setup
      mockBTC.prepareTransactionForSigning.mockRejectedValue(
        new Error('Test error')
      )

      // Execute
      const result = await keypair.BTCTransaction(
        {
          nearAuthentication: {
            networkId: 'testnet',
            accountId: 'test.near',
          },
          chainConfig: {
            contract: 'test.contract',
            providerUrl: 'http://test.com',
            network: 'testnet',
          },
          derivationPath: 'm/44/0/0/0',
          transaction: {
            publicKey: '03...',
            from: 'tb1...',
            to: 'tb1...',
            value: '0.001',
          },
        },
        mockKeyPair
      )

      // Verify
      expect(result).toEqual({
        success: false,
        errorMessage: 'Test error',
      })
    })
  })

  describe('CosmosTransaction', () => {
    it('should successfully sign and send a Cosmos transaction', async () => {
      // Setup
      const mockTx: CosmosTransactionRequest = {
        address: 'cosmos1...',
        publicKey: '03...',
        messages: [
          {
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: {
              fromAddress: 'cosmos1...',
              toAddress: 'cosmos1...',
              amount: [{ denom: 'uatom', amount: '100' }],
            },
          },
        ],
      }
      const mockHashes = [
        [1, 2, 3],
        [4, 5, 6],
      ]
      const mockSignatures = [
        { r: '1', s: '2', v: 27 },
        { r: '3', s: '4', v: 28 },
      ]
      const mockTxHash = 'txhash123'

      mockCosmos.prepareTransactionForSigning.mockResolvedValue({
        transaction: mockTx,
        hashesToSign: mockHashes,
      })
      mockContract.sign.mockResolvedValue(mockSignatures)
      mockCosmos.finalizeTransactionSigning.mockReturnValue('signed_tx')
      mockCosmos.broadcastTx.mockResolvedValue(mockTxHash)

      // Execute
      const result = await keypair.CosmosTransaction(
        {
          nearAuthentication: {
            networkId: 'testnet',
            accountId: 'test.near',
          },
          chainConfig: {
            contract: 'test.contract',
            chainId: 'cosmos-testnet',
          },
          derivationPath: 'm/44/118/0/0',
          transaction: mockTx,
        },
        mockKeyPair
      )

      // Verify
      expect(result).toEqual({
        transactionHash: 'txhash123',
        success: true,
      })
      expect(mockContract.sign).toHaveBeenCalledTimes(2)
    })

    it('should handle errors in Cosmos transaction', async () => {
      // Setup
      mockCosmos.prepareTransactionForSigning.mockRejectedValue(
        new Error('Test error')
      )

      // Execute
      const result = await keypair.CosmosTransaction(
        {
          nearAuthentication: {
            networkId: 'testnet',
            accountId: 'test.near',
          },
          chainConfig: {
            contract: 'test.contract',
            chainId: 'cosmos-testnet',
          },
          derivationPath: 'm/44/118/0/0',
          transaction: {
            address: 'cosmos1...',
            publicKey: '03...',
            messages: [
              {
                typeUrl: '/cosmos.bank.v1beta1.MsgSend',
                value: {
                  fromAddress: 'cosmos1...',
                  toAddress: 'cosmos1...',
                  amount: [{ denom: 'uatom', amount: '100' }],
                },
              },
            ],
          },
        },
        mockKeyPair
      )

      // Verify
      expect(result).toEqual({
        success: false,
        errorMessage: 'Test error',
      })
    })
  })
})

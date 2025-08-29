import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import type { Client } from 'xrpl'

import { XRP } from '../../src/chain-adapters/XRP/XRP'
import type { ChainSignatureContract } from '../../src/contracts/ChainSignatureContract'
import type { RSVSignature } from '../../src/types'

// Create a properly typed mock contract that matches the ChainSignatureContract interface
const createMockContract = (): ChainSignatureContract => {
  const mockImpl = {
    sign: jest.fn().mockImplementation(
      async (_args: unknown): Promise<RSVSignature[]> => [
        {
          r: 'a'.repeat(64),
          s: 'b'.repeat(64),
          v: 27,
        },
      ]
    ),
    getCurrentSignatureDeposit: jest.fn().mockReturnValue(1),
    getPublicKey: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue(
      `04${'a'.repeat(128)}`
    ),
    getDerivedPublicKey: (
      jest.fn() as jest.MockedFunction<any>
    ).mockResolvedValue(`04${'a'.repeat(128)}`),
    contractId: 'test',
    networkId: 'testnet' as const,
    provider: {} as any,
    viewFunction: (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({}),
  }

  return mockImpl as unknown as ChainSignatureContract
}

describe('XRP Balance Tests', () => {
  let xrp: XRP
  let mockContract: ChainSignatureContract
  let mockClient: jest.Mocked<Client>

  beforeEach(() => {
    mockContract = createMockContract()

    // Create a properly mocked XRPL client
    mockClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      request: jest.fn(),
      autofill: jest.fn(),
      submit: jest.fn(),
    } as unknown as jest.Mocked<Client>

    // Create XRP instance with mocked client
    xrp = new XRP({
      rpcUrl: 'wss://s.altnet.rippletest.net:51233',
      contract: mockContract,
      client: mockClient,
    })
  })

  describe('getBalance', () => {
    it('should return balance for existing account', async () => {
      const mockBalance = '1000000' // 1 XRP in drops
      const testAddress = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

      // Mock successful responses
      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.request.mockResolvedValue({
        result: {
          account_data: {
            Balance: mockBalance,
          },
        },
      } as any)

      const result = await xrp.getBalance(testAddress)
      expect(result).toEqual({
        balance: BigInt(mockBalance),
        decimals: 6,
      })
    })

    it('should return zero balance for non-existent account', async () => {
      const testAddress = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.request.mockRejectedValue({
        data: {
          error: 'actNotFound',
        },
      })

      const result = await xrp.getBalance(testAddress)

      expect(result).toEqual({
        balance: 0n,
        decimals: 6,
      })
    })

    it('should return zero balance for account not found message', async () => {
      const testAddress = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.request.mockRejectedValue({
        message: 'Account not found',
      })

      const result = await xrp.getBalance(testAddress)

      expect(result).toEqual({
        balance: 0n,
        decimals: 6,
      })
    })

    it('should return zero balance for account not found in error message', async () => {
      const testAddress = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.request.mockRejectedValue({
        data: {
          error_message: 'Account not found',
        },
      })

      const result = await xrp.getBalance(testAddress)

      expect(result).toEqual({
        balance: 0n,
        decimals: 6,
      })
    })

    it('should handle large balance values', async () => {
      const mockBalance = '999999999999999999' // Very large balance
      const testAddress = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.request.mockResolvedValue({
        result: {
          account_data: {
            Balance: mockBalance,
          },
        },
      } as any)

      const result = await xrp.getBalance(testAddress)

      expect(result).toEqual({
        balance: BigInt(mockBalance),
        decimals: 6,
      })
    })
  })

  describe('deriveAddressAndPublicKey', () => {
    it('should derive address and public key successfully', async () => {
      const mockUncompressedPubKey = '04' + 'a'.repeat(128)
      const predecessor = 'test-predecessor'
      const path = 'test-path'

      // Mock the getDerivedPublicKey to return a valid uncompressed public key
      ;(
        mockContract.getDerivedPublicKey as jest.MockedFunction<any>
      ).mockResolvedValue(mockUncompressedPubKey)

      const result = await xrp.deriveAddressAndPublicKey(predecessor, path)

      expect(result).toHaveProperty('address')
      expect(result).toHaveProperty('publicKey')
      expect(typeof result.address).toBe('string')
      expect(typeof result.publicKey).toBe('string')
      expect(result.address.length).toBeGreaterThan(0)
      expect(result.publicKey.length).toBeGreaterThan(0)
    })

    it('should throw error when public key derivation fails', async () => {
      const predecessor = 'test-predecessor'
      const path = 'test-path'

      // Mock getDerivedPublicKey to return null/undefined
      ;(
        mockContract.getDerivedPublicKey as jest.MockedFunction<any>
      ).mockResolvedValue(null)

      await expect(
        xrp.deriveAddressAndPublicKey(predecessor, path)
      ).rejects.toThrow('Failed to get derived secp256k1 public key')
    })

    it('should throw error when getDerivedPublicKey rejects', async () => {
      const predecessor = 'test-predecessor'
      const path = 'test-path'

      // Mock getDerivedPublicKey to reject
      ;(
        mockContract.getDerivedPublicKey as jest.MockedFunction<any>
      ).mockRejectedValue(new Error('Contract error'))

      await expect(
        xrp.deriveAddressAndPublicKey(predecessor, path)
      ).rejects.toThrow('Contract error')
    })

    it('should generate valid XRP address format', async () => {
      const mockUncompressedPubKey = '04' + 'a'.repeat(128)
      const predecessor = 'test-predecessor'
      const path = 'test-path'

      ;(
        mockContract.getDerivedPublicKey as jest.MockedFunction<any>
      ).mockResolvedValue(mockUncompressedPubKey)

      const result = await xrp.deriveAddressAndPublicKey(predecessor, path)

      // XRP addresses start with 'r' and are typically 25-34 characters long
      expect(result.address).toMatch(/^r[a-zA-Z0-9]{24,33}$/)
    })

    it('should generate compressed public key format', async () => {
      const mockUncompressedPubKey = '04' + 'a'.repeat(128)
      const predecessor = 'test-predecessor'
      const path = 'test-path'

      ;(
        mockContract.getDerivedPublicKey as jest.MockedFunction<any>
      ).mockResolvedValue(mockUncompressedPubKey)

      const result = await xrp.deriveAddressAndPublicKey(predecessor, path)

      // Compressed public key should be 66 characters (33 bytes in hex)
      // and start with 02 or 03
      expect(result.publicKey).toMatch(/^(02|03)[a-fA-F0-9]{64}$/)
      expect(result.publicKey.length).toBe(66)
    })
  })

  describe('serializeTransaction', () => {
    it('should serialize unsigned transaction to JSON string', () => {
      const mockTransaction = {
        transaction: {
          Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
          Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
          Amount: '1000000',
          TransactionType: 'Payment',
          Fee: '12',
          Sequence: 123,
          SigningPubKey: '02' + 'a'.repeat(64),
          LastLedgerSequence: 456,
        },
        signingPubKey: '02' + 'a'.repeat(64),
      }

      const serialized = xrp.serializeTransaction(mockTransaction)

      expect(typeof serialized).toBe('string')
      expect(() => JSON.parse(serialized)).not.toThrow()

      const parsed = JSON.parse(serialized)
      expect(parsed).toEqual(mockTransaction)
    })

    it('should serialize transaction with optional fields', () => {
      const mockTransaction = {
        transaction: {
          Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
          Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
          Amount: '1000000',
          TransactionType: 'Payment',
          Fee: '12',
          Sequence: 123,
          SigningPubKey: '02' + 'a'.repeat(64),
          DestinationTag: 12345,
          Memos: [
            {
              Memo: {
                MemoData: '48656C6C6F20576F726C64',
                MemoType: '546578742F706C61696E',
              },
            },
          ],
        },
        signingPubKey: '02' + 'a'.repeat(64),
      }

      const serialized = xrp.serializeTransaction(mockTransaction)
      const parsed = JSON.parse(serialized)

      expect(parsed).toEqual(mockTransaction)
      expect(parsed.transaction.DestinationTag).toBe(12345)
      expect(parsed.transaction.Memos).toBeDefined()
    })
  })

  describe('deserializeTransaction', () => {
    it('should deserialize JSON string to unsigned transaction', () => {
      const mockTransaction = {
        transaction: {
          Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
          Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
          Amount: '1000000',
          TransactionType: 'Payment',
          Fee: '12',
          Sequence: 123,
          SigningPubKey: '02' + 'a'.repeat(64),
        },
        signingPubKey: '02' + 'a'.repeat(64),
      }

      const serialized = JSON.stringify(mockTransaction)
      const deserialized = xrp.deserializeTransaction(serialized)

      expect(deserialized).toEqual(mockTransaction)
    })

    it('should handle complex transaction structure', () => {
      const complexTransaction = {
        transaction: {
          Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
          Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
          Amount: '1000000',
          TransactionType: 'Payment',
          Fee: '12',
          Sequence: 123,
          SigningPubKey: '02' + 'a'.repeat(64),
          LastLedgerSequence: 456,
          DestinationTag: 789,
          Flags: 2147483648,
        },
        signingPubKey: '02' + 'a'.repeat(64),
      }

      const serialized = JSON.stringify(complexTransaction)
      const deserialized = xrp.deserializeTransaction(serialized)

      expect(deserialized).toEqual(complexTransaction)
      expect(deserialized.transaction.DestinationTag).toBe(789)
      expect(deserialized.transaction.Flags).toBe(2147483648)
    })

    it('should throw error for invalid JSON', () => {
      const invalidJson = 'invalid json string'

      expect(() => xrp.deserializeTransaction(invalidJson)).toThrow()
    })
  })

  describe('prepareTransactionForSigning', () => {
    it('should prepare transaction for signing successfully', async () => {
      const transactionRequest = {
        from: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        to: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        amount: '1000000',
        publicKey: '02' + 'a'.repeat(64),
      }

      const mockAutofillResponse = {
        TransactionType: 'Payment',
        Account: transactionRequest.from,
        Destination: transactionRequest.to,
        Amount: transactionRequest.amount,
        SigningPubKey: transactionRequest.publicKey.toUpperCase(),
        Fee: '12',
        Sequence: 123,
        LastLedgerSequence: 456,
      } as any

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.autofill.mockResolvedValue(mockAutofillResponse)

      const result = await xrp.prepareTransactionForSigning(transactionRequest)

      expect(result).toHaveProperty('transaction')
      expect(result).toHaveProperty('hashesToSign')
      expect(result.transaction.transaction).toEqual(mockAutofillResponse)
      expect(result.transaction.signingPubKey).toBe(
        transactionRequest.publicKey
      )
      expect(Array.isArray(result.hashesToSign)).toBe(true)
      expect(result.hashesToSign.length).toBe(1)
      expect(result.hashesToSign[0]).toBeInstanceOf(Uint8Array)
      expect(result.hashesToSign[0].length).toBe(32)
    })

    it('should handle transaction with destination tag', async () => {
      const transactionRequest = {
        from: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        to: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        amount: '1000000',
        publicKey: '02' + 'a'.repeat(64),
        destinationTag: 12345,
      }

      const mockAutofillResponse = {
        TransactionType: 'Payment',
        Account: transactionRequest.from,
        Destination: transactionRequest.to,
        Amount: transactionRequest.amount,
        SigningPubKey: transactionRequest.publicKey.toUpperCase(),
        Fee: '12',
        Sequence: 123,
        LastLedgerSequence: 456,
        DestinationTag: transactionRequest.destinationTag,
      } as any

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.autofill.mockResolvedValue(mockAutofillResponse)

      const result = await xrp.prepareTransactionForSigning(transactionRequest)

      expect(result.transaction.transaction.DestinationTag).toBe(12345)
    })

    it('should handle client connection errors', async () => {
      const transactionRequest = {
        from: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        to: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        amount: '1000000',
        publicKey: '02' + 'a'.repeat(64),
      }

      mockClient.connect.mockRejectedValue(new Error('Connection failed'))

      await expect(
        xrp.prepareTransactionForSigning(transactionRequest)
      ).rejects.toThrow('Failed to prepare XRP transaction for signing')
    })

    it('should handle autofill errors', async () => {
      const transactionRequest = {
        from: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        to: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        amount: '1000000',
        publicKey: '02' + 'a'.repeat(64),
      }

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.autofill.mockRejectedValue(new Error('Autofill failed'))

      await expect(
        xrp.prepareTransactionForSigning(transactionRequest)
      ).rejects.toThrow('Failed to prepare XRP transaction for signing')
    })

    it('should generate valid signing hash format', async () => {
      const transactionRequest = {
        from: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        to: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        amount: '1000000',
        publicKey: '02' + 'a'.repeat(64),
      }

      const mockAutofillResponse = {
        TransactionType: 'Payment',
        Account: transactionRequest.from,
        Destination: transactionRequest.to,
        Amount: transactionRequest.amount,
        SigningPubKey: transactionRequest.publicKey.toUpperCase(),
        Fee: '12',
        Sequence: 123,
      } as any

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.autofill.mockResolvedValue(mockAutofillResponse)

      const result = await xrp.prepareTransactionForSigning(transactionRequest)

      // The hash should be a 32-byte Uint8Array (SHA-512 first half)
      expect(result.hashesToSign[0]).toBeInstanceOf(Uint8Array)
      expect(result.hashesToSign[0].length).toBe(32)

      // Verify it's not all zeros
      const isAllZeros = result.hashesToSign[0].every((byte) => byte === 0)
      expect(isAllZeros).toBe(false)
    })
  })

  describe('finalizeTransactionSigning', () => {
    it('should finalize transaction signing with valid signatures', () => {
      const mockTransaction = {
        transaction: {
          Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
          Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
          Amount: '1000000',
          TransactionType: 'Payment',
          Fee: '12',
          Sequence: 123,
          SigningPubKey: '02' + 'a'.repeat(64),
        },
        signingPubKey: '02' + 'a'.repeat(64),
      }

      const mockSignatures = [
        {
          r: '1234567890abcdef'.repeat(4),
          s: 'fedcba0987654321'.repeat(4),
          v: 27,
        },
      ]

      const result = xrp.finalizeTransactionSigning({
        transaction: mockTransaction,
        rsvSignatures: mockSignatures,
      })

      expect(typeof result).toBe('string')
      expect(() => JSON.parse(result)).not.toThrow()

      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('TxnSignature')
      expect(parsed).toHaveProperty('SigningPubKey')
      expect(parsed.SigningPubKey).toBe(
        mockTransaction.signingPubKey.toUpperCase()
      )
      expect(parsed.Account).toBe(mockTransaction.transaction.Account)
      expect(parsed.Destination).toBe(mockTransaction.transaction.Destination)
      expect(parsed.Amount).toBe(mockTransaction.transaction.Amount)
    })

    it('should generate DER-encoded signature', () => {
      const mockTransaction = {
        transaction: {
          Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
          Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
          Amount: '1000000',
          TransactionType: 'Payment',
          Fee: '12',
          Sequence: 123,
          SigningPubKey: '02' + 'a'.repeat(64),
        },
        signingPubKey: '02' + 'a'.repeat(64),
      }

      const mockSignatures = [
        {
          r: '1234567890abcdef'.repeat(4),
          s: 'fedcba0987654321'.repeat(4),
          v: 27,
        },
      ]

      const result = xrp.finalizeTransactionSigning({
        transaction: mockTransaction,
        rsvSignatures: mockSignatures,
      })

      const parsed = JSON.parse(result)

      // DER signature should be a hex string and should start with 30 (DER sequence tag)
      expect(typeof parsed.TxnSignature).toBe('string')
      expect(parsed.TxnSignature).toMatch(/^[0-9A-F]+$/)
      expect(parsed.TxnSignature.startsWith('30')).toBe(true)
    })

    it('should handle signatures with high bit set requiring padding', () => {
      const mockTransaction = {
        transaction: {
          Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
          Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
          Amount: '1000000',
          TransactionType: 'Payment',
          Fee: '12',
          Sequence: 123,
          SigningPubKey: '02' + 'a'.repeat(64),
        },
        signingPubKey: '02' + 'a'.repeat(64),
      }

      const mockSignatures = [
        {
          r:
            'ff' +
            '1234567890abcdef'.repeat(3) +
            '1234567890abcdef'.slice(0, 14), // Starts with 0xff (high bit set)
          s:
            '80' +
            'fedcba0987654321'.repeat(3) +
            'fedcba0987654321'.slice(0, 14), // Starts with 0x80 (high bit set)
          v: 27,
        },
      ]

      const result = xrp.finalizeTransactionSigning({
        transaction: mockTransaction,
        rsvSignatures: mockSignatures,
      })

      const parsed = JSON.parse(result)
      expect(parsed.TxnSignature).toBeDefined()
      expect(parsed.TxnSignature.startsWith('30')).toBe(true)
    })

    it('should throw error when no signatures provided', () => {
      const mockTransaction = {
        transaction: {
          Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
          Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
          Amount: '1000000',
          TransactionType: 'Payment',
          Fee: '12',
          Sequence: 123,
          SigningPubKey: '02' + 'a'.repeat(64),
        },
        signingPubKey: '02' + 'a'.repeat(64),
      }

      expect(() =>
        xrp.finalizeTransactionSigning({
          transaction: mockTransaction,
          rsvSignatures: [],
        })
      ).toThrow('Invalid signatures provided')
    })

    it('should preserve all transaction fields in signed transaction', () => {
      const mockTransaction = {
        transaction: {
          Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
          Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
          Amount: '1000000',
          TransactionType: 'Payment',
          Fee: '12',
          Sequence: 123,
          SigningPubKey: '02' + 'a'.repeat(64),
          LastLedgerSequence: 456,
          DestinationTag: 789,
          Flags: 2147483648,
        },
        signingPubKey: '02' + 'a'.repeat(64),
      }

      const mockSignatures = [
        {
          r: '1234567890abcdef'.repeat(4),
          s: 'fedcba0987654321'.repeat(4),
          v: 27,
        },
      ]

      const result = xrp.finalizeTransactionSigning({
        transaction: mockTransaction,
        rsvSignatures: mockSignatures,
      })

      const parsed = JSON.parse(result)
      expect(parsed.Account).toBe(mockTransaction.transaction.Account)
      expect(parsed.Destination).toBe(mockTransaction.transaction.Destination)
      expect(parsed.Amount).toBe(mockTransaction.transaction.Amount)
      expect(parsed.Fee).toBe(mockTransaction.transaction.Fee)
      expect(parsed.Sequence).toBe(mockTransaction.transaction.Sequence)
      expect(parsed.LastLedgerSequence).toBe(
        mockTransaction.transaction.LastLedgerSequence
      )
      expect(parsed.DestinationTag).toBe(
        mockTransaction.transaction.DestinationTag
      )
      expect(parsed.Flags).toBe(mockTransaction.transaction.Flags)
    })

    it('should use only first signature when multiple signatures provided', () => {
      const mockTransaction = {
        transaction: {
          Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
          Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
          Amount: '1000000',
          TransactionType: 'Payment',
          Fee: '12',
          Sequence: 123,
          SigningPubKey: '02' + 'a'.repeat(64),
        },
        signingPubKey: '02' + 'a'.repeat(64),
      }

      const mockSignatures = [
        {
          r: '1234567890abcdef'.repeat(4),
          s: 'fedcba0987654321'.repeat(4),
          v: 27,
        },
        {
          r: 'different_r_value'.repeat(3) + 'different_r_val',
          s: 'different_s_value'.repeat(3) + 'different_s_val',
          v: 28,
        },
      ]

      const result = xrp.finalizeTransactionSigning({
        transaction: mockTransaction,
        rsvSignatures: mockSignatures,
      })

      // Should not throw and should use first signature
      expect(() => JSON.parse(result)).not.toThrow()
      const parsed = JSON.parse(result)
      expect(parsed.TxnSignature).toBeDefined()
    })
  })

  describe('broadcastTx', () => {
    it('should broadcast transaction successfully with tesSUCCESS', async () => {
      const mockSignedTransaction = JSON.stringify({
        Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        Amount: '1000000',
        TransactionType: 'Payment',
        Fee: '12',
        Sequence: 123,
        SigningPubKey: '02' + 'a'.repeat(64).toUpperCase(),
        TxnSignature: '3045022100' + 'a'.repeat(64) + '022100' + 'b'.repeat(64),
      })

      const expectedTxHash = '1234567890ABCDEF1234567890ABCDEF12345678'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.submit.mockResolvedValue({
        result: {
          engine_result: 'tesSUCCESS',
          tx_json: {
            hash: expectedTxHash,
          },
        },
      } as any)

      const result = await xrp.broadcastTx(mockSignedTransaction)

      expect(result).toEqual({ hash: expectedTxHash })
    })

    it('should broadcast transaction successfully with terQUEUED', async () => {
      const mockSignedTransaction = JSON.stringify({
        Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        Amount: '1000000',
        TransactionType: 'Payment',
        Fee: '12',
        Sequence: 123,
        SigningPubKey: '02' + 'a'.repeat(64).toUpperCase(),
        TxnSignature: '3045022100' + 'a'.repeat(64) + '022100' + 'b'.repeat(64),
      })

      const expectedTxHash = 'QUEUED_TX_HASH_1234567890ABCDEF'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.submit.mockResolvedValue({
        result: {
          engine_result: 'terQUEUED',
          tx_json: {
            hash: expectedTxHash,
          },
        },
      } as any)

      const result = await xrp.broadcastTx(mockSignedTransaction)

      expect(result).toEqual({ hash: expectedTxHash })
    })

    it('should handle client connection errors', async () => {
      const mockSignedTransaction = JSON.stringify({
        Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        Amount: '1000000',
        TransactionType: 'Payment',
        Fee: '12',
        Sequence: 123,
        SigningPubKey: '02' + 'a'.repeat(64).toUpperCase(),
        TxnSignature: '3045022100' + 'a'.repeat(64) + '022100' + 'b'.repeat(64),
      })

      mockClient.connect.mockRejectedValue(new Error('Connection failed'))

      await expect(xrp.broadcastTx(mockSignedTransaction)).rejects.toThrow(
        'Failed to broadcast XRP transaction'
      )
    })

    it('should handle submit errors', async () => {
      const mockSignedTransaction = JSON.stringify({
        Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        Amount: '1000000',
        TransactionType: 'Payment',
        Fee: '12',
        Sequence: 123,
        SigningPubKey: '02' + 'a'.repeat(64).toUpperCase(),
        TxnSignature: '3045022100' + 'a'.repeat(64) + '022100' + 'b'.repeat(64),
      })

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.submit.mockRejectedValue(new Error('Submit failed'))

      await expect(xrp.broadcastTx(mockSignedTransaction)).rejects.toThrow(
        'Failed to broadcast XRP transaction'
      )
    })

    it('should handle invalid JSON input', async () => {
      const invalidJson = 'invalid json string'

      await expect(xrp.broadcastTx(invalidJson)).rejects.toThrow(
        'Failed to broadcast XRP transaction'
      )
    })

    it('should properly encode transaction before submission', async () => {
      const mockSignedTransaction = JSON.stringify({
        Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        Amount: '1000000',
        TransactionType: 'Payment',
        Fee: '12',
        Sequence: 123,
        SigningPubKey: '02' + 'a'.repeat(64).toUpperCase(),
        TxnSignature: '3045022100' + 'a'.repeat(64) + '022100' + 'b'.repeat(64),
      })

      const expectedTxHash = 'ENCODED_TX_HASH_1234567890ABCDEF'

      mockClient.connect.mockResolvedValue(undefined)
      mockClient.disconnect.mockResolvedValue(undefined)
      mockClient.submit.mockResolvedValue({
        result: {
          engine_result: 'tesSUCCESS',
          tx_json: {
            hash: expectedTxHash,
          },
        },
      } as any)

      const result = await xrp.broadcastTx(mockSignedTransaction)

      expect(result).toEqual({ hash: expectedTxHash })

      // Verify that submit was called with a hex-encoded transaction blob
      const submitCalls = (mockClient.submit as jest.Mock).mock.calls
      expect(submitCalls).toHaveLength(1)
      const submitCall = submitCalls[0]
      expect(typeof submitCall[0]).toBe('string')
      // The encoded transaction should be a hex string
      expect(submitCall[0]).toMatch(/^[0-9A-Fa-f]+$/)
    })
  })
})

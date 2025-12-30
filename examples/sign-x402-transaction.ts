/**
 * Example: Sign x402 Payment Transaction using Chain Signatures
 *
 * This example demonstrates how to sign a USDC transferWithAuthorization (EIP-3009)
 * transaction using Chain Signatures. This is useful for x402 payment protocols
 * where gasless USDC transfers are required.
 *
 * Based on: https://github.com/kurodenjiro/Anyone-pay/blob/main/lib/chainSig.ts
 */

import { Account } from '@near-js/accounts'
import { KeyPair, type KeyPairString } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'
import { contracts, chainAdapters } from 'chainsig.js'
import { config } from 'dotenv'
import { createPublicClient, http, parseUnits, getAddress, hexToBigInt } from 'viem'
import { baseSepolia } from 'viem/chains'
import { ethers, TypedDataEncoder, Interface } from 'ethers'

config() // Load environment variables

// USDC contract address on Base
const USDC_CONTRACT = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

// x402 Quote interface
interface X402Quote {
    payTo: string
    maxAmountRequired: string // Amount in USDC (6 decimals)
    deadline: number // Unix timestamp
    nonce: string
}

async function signX402TransactionWithChainSignature(
    quote: X402Quote
): Promise<string> {
    const accountId = process.env.ACCOUNT_ID // 'your-account.near' or 'your-account.testnet'
    const privateKey = process.env.PRIVATE_KEY as KeyPairString // ed25519:3D4YudUahN...
    const networkId = process.env.NEAR_NETWORK || 'mainnet'

    if (!accountId || !privateKey) {
        throw new Error('Setup ACCOUNT_ID and PRIVATE_KEY in environment variables')
    }

    const keyPair = KeyPair.fromString(privateKey)
    const signer = new KeyPairSigner(keyPair)

    const provider = new JsonRpcProvider({
        url: networkId === 'mainnet'
            ? 'https://rpc.mainnet.fastnear.com'
            : 'https://test.rpc.fastnear.com',
    })

    const account = new Account(accountId, provider, signer)

    // Create Chain Signature Contract instance
    const contract = new contracts.ChainSignatureContract({
        networkId: networkId as 'mainnet' | 'testnet',
        contractId: process.env.CHAIN_SIGNATURE_CONTRACT || 'v1.signer',
    })

    // Create public client for Base network
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org'),
    })

    const derivationPath = process.env.DERIVATION_PATH || 'base-1'

    // Create EVM chain adapter
    const evmChain = new chainAdapters.evm.EVM({
        publicClient: publicClient as any,
        contract,
    })

    // Derive Ethereum address from NEAR account
    const { address } = await evmChain.deriveAddressAndPublicKey(
        accountId,
        derivationPath
    )

    console.log('Derived Ethereum address:', address)

    const baseChainId = 84532 // Base Sepolia testnet
    const amountInWei = parseUnits(quote.maxAmountRequired, 6) // USDC has 6 decimals

    // EIP-712 domain for USDC on Base
    const domain = {
        name: 'USD Coin',
        version: '2',
        chainId: baseChainId,
        verifyingContract: USDC_CONTRACT as `0x${string}`,
    }

    // EIP-712 types for transferWithAuthorization (EIP-3009)
    const types = {
        TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
        ],
    }

    // Convert nonce to bytes32
    const nonceBigInt = BigInt(quote.nonce)
    const nonceHex = `0x${nonceBigInt.toString(16).padStart(64, '0')}` as `0x${string}`

    // EIP-712 message value
    const message = {
        from: getAddress(address),
        to: getAddress(quote.payTo),
        value: amountInWei,
        validAfter: 0n,
        validBefore: BigInt(quote.deadline),
        nonce: nonceHex,
    }

    console.log('Signing authorization message for transferWithAuthorization...')
    console.log('Domain:', domain)
    console.log('Message:', {
        ...message,
        value: message.value.toString(),
        validBefore: message.validBefore.toString(),
    })

    // Sign EIP-712 typed data using Chain Signatures
    const authSignature = await evmChain.signTypedDataWithChainSignature({
        typedDataRequest: {
            domain,
            types,
            primaryType: 'TransferWithAuthorization',
            message,
        },
        signerAccount: account,
        path: derivationPath,
        keyType: 'Ecdsa',
    })

    console.log('Authorization signature:', {
        v: authSignature.v,
        r: `0x${authSignature.r.substring(0, 16)}...`,
        s: `0x${authSignature.s.substring(0, 16)}...`,
    })

    // Verify signature (optional but recommended)
    const hash = TypedDataEncoder.hash(
        domain,
        { TransferWithAuthorization: types.TransferWithAuthorization },
        message
    )
    const recoveredAddress = ethers.recoverAddress(hash, {
        r: `0x${authSignature.r}`,
        s: `0x${authSignature.s}`,
        v: authSignature.v,
    })

    console.log('Recovered address:', recoveredAddress)
    console.log('Expected address:', address)
    console.log('Signature valid:', recoveredAddress.toLowerCase() === address.toLowerCase())

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error(`Signature verification failed: recovered ${recoveredAddress} but expected ${address}`)
    }

    // Encode transferWithAuthorization function call
    const iface = new Interface([
        'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
    ])

    const rBytes32 = `0x${authSignature.r.padStart(64, '0')}`
    const sBytes32 = `0x${authSignature.s.padStart(64, '0')}`

    const data = iface.encodeFunctionData('transferWithAuthorization', [
        getAddress(address),
        getAddress(quote.payTo),
        amountInWei,
        0, // validAfter
        quote.deadline,
        nonceHex,
        authSignature.v,
        rBytes32,
        sBytes32,
    ])

    // Prepare legacy transaction for signing
    const gasPrice = ethers.parseUnits('0.1', 'gwei')
    const gasLimit = 150000n // Typical gas for transferWithAuthorization

    const { transaction, hashesToSign } = await evmChain.prepareTransactionForSigningLegacy({
        from: address as `0x${string}`,
        to: USDC_CONTRACT as `0x${string}`,
        value: 0n,
        data: data as `0x${string}`,
        gasPrice,
        gas: gasLimit,
    })

    console.log('Prepared transaction:', {
        to: transaction.to,
        gasPrice: transaction.gasPrice?.toString(),
        gas: transaction.gas?.toString(),
    })

    // Sign transaction with MPC
    const txSignature = await contract.sign({
        payloads: hashesToSign,
        path: derivationPath,
        keyType: 'Ecdsa',
        signerAccount: account,
    })

    // Finalize signed transaction
    const signedTx = evmChain.finalizeTransactionSigningLegacy({
        transaction: transaction as any,
        rsvSignatures: txSignature,
    })

    // Broadcast transaction
    const txHash = await publicClient.sendRawTransaction({
        serializedTransaction: signedTx as `0x${string}`,
    })

    console.log('Transaction hash:', txHash)
    console.log(`View on Base Explorer: https://basescan.org/tx/${txHash}`)

    return txHash
}

// Example usage
async function main(): Promise<void> {
    // Example x402 quote (replace with actual quote from x402 API)
    const exampleQuote: X402Quote = {
        payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f1eC26', // Recipient address
        maxAmountRequired: '1.00', // 1 USDC
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        nonce: '12345', // Unique nonce from x402 API
    }

    console.log('=== x402 Payment Example ===')
    console.log('Quote:', exampleQuote)
    console.log('')

    try {
        const txHash = await signX402TransactionWithChainSignature(exampleQuote)
        console.log('\n✅ Payment successful!')
        console.log('Transaction:', txHash)
    } catch (error) {
        console.error('\n❌ Payment failed:', error)
    }
}

main().catch(console.error)

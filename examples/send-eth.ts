import { KeyPairSigner } from '@near-js/signers'
import { Account } from '@near-js/accounts'
import { JsonRpcProvider } from '@near-js/providers'
import { getTransactionLastResult } from '@near-js/utils'
import { Action } from '@near-js/transactions'
import { contracts, chainAdapters } from 'chainsig.js'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { createAction } from '@near-wallet-selector/wallet-utils'

import dotenv from 'dotenv'
import { KeyPairString } from '@near-js/crypto'

// Load environment variables
dotenv.config({ path: '.env' }) // Path relative to the working directory

// Create an account object
const accountId = process.env.ACCOUNT_ID!
// Create a signer from a private key string
const privateKey = process.env.PRIVATE_KEY as KeyPairString
const signer = KeyPairSigner.fromSecretKey(privateKey) // ed25519:5Fg2...

// Create a connection to testnet RPC
const provider = new JsonRpcProvider({
  url: 'https://test.rpc.fastnear.com',
})

const account = new Account(accountId, provider, signer)

const contract = new contracts.ChainSignatureContract({
  networkId: 'testnet',
  contractId: 'v1.signer-prod.testnet',
})

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
})

const derivationPath = 'any_string'

const evmChain = new chainAdapters.evm.EVM({
  publicClient,
  contract,
})

// Derive address and public key
const { address, publicKey } = await evmChain.deriveAddressAndPublicKey(
  accountId,
  derivationPath
)

console.log('address', address)

// Check balance
const { balance, decimals } = await evmChain.getBalance(address)

console.log('balance', balance)

// Create and sign transaction
const { transaction, hashesToSign } =
  await evmChain.prepareTransactionForSigning({
    from: address,
    to: '0x427F9620Be0fe8Db2d840E2b6145D1CF2975bcaD',
    value: 1285141n,
  })

// Sign with MPC
const signature = await contract.sign({
  payloads: hashesToSign,
  path: derivationPath,
  keyType: 'Ecdsa',
  signerAccount: {
    accountId: account.accountId,
    signAndSendTransactions: async ({
      transactions: walletSelectorTransactions,
    }) => {
      const transactions = walletSelectorTransactions.map((tx) => {
        return {
          receiverId: tx.receiverId,
          actions: tx.actions.map((a) => createAction(a)),
        } satisfies { receiverId: string; actions: Action[] }
      })

      const txs = await account.signAndSendTransactions({
        transactions,
        waitUntil: 'FINAL',
      })

      return txs.map((tx) => getTransactionLastResult(tx))
    },
  },
})

// Add signature
const signedTx = evmChain.finalizeTransactionSigning({
  transaction,
  rsvSignatures: signature,
})

// Broadcast transaction
const { hash: txHash } = await evmChain.broadcastTx(signedTx)

// Print link to transaction on Sepolia Explorer
console.log(`${sepolia.blockExplorers.default.url}/tx/${txHash}`)

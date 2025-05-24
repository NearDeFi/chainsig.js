import { KeyPairSigner } from '@near-js/signers'
import { Account } from '@near-js/accounts'
import { JsonRpcProvider } from '@near-js/providers'
import { getTransactionLastResult } from '@near-js/utils'
import { Action } from '@near-js/transactions'
import { contracts, chainAdapters } from 'chainsig.js'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { createAction } from '@near-wallet-selector/wallet-utils'

import { Connection as SolanaConnection } from '@solana/web3.js'

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

const connection = new SolanaConnection('https://api.devnet.solana.com')

const derivationPath = 'any_string'

const solChain = new chainAdapters.solana.Solana({
  solanaConnection: connection,
  contract: contract,
})

// Derive address and public key
const { address, publicKey } = await solChain.deriveAddressAndPublicKey(
  accountId,
  derivationPath
)

console.log('address', address)

// Check balance
const { balance, decimals } = await solChain.getBalance(address)

console.log('balance', balance)

// Create and sign transaction
const {
  transaction: { transaction },
} = await solChain.prepareTransactionForSigning({
  from: address,
  to: '7CmF6R7kv77twtfRfwgXMrArmqLZ7M6tXbJa9SAUnviH',
  amount: 1285141n,
})

// Sign with MPC
const signatures = await contract.sign({
  // @ts-expect-error
  payloads: [transaction.serializeMessage()],
  path: derivationPath,
  keyType: 'Eddsa',
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

      console.dir(txs, { depth: Infinity })

      return txs.map((tx) => getTransactionLastResult(tx))
    },
  },
})

if (signatures.length === 0) throw new Error(`No signatures`);

// Add signature
const signedTx = solChain.finalizeTransactionSigning({
  transaction,
  rsvSignatures: signatures[0]!,
  senderAddress: address,
})

// Broadcast transaction
const { hash: txHash } = await solChain.broadcastTx(signedTx)

// Print link to transaction on Solana Explorer
console.log(`https://explorer.solana.com/tx/${txHash}?cluster=devnet`)

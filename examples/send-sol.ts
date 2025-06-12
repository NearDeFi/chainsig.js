import { InMemoryKeyStore } from '@near-js/keystores'
import { KeyPair } from '@near-js/crypto'
import { connect, Near } from 'near-api-js'
import { getTransactionLastResult } from '@near-js/utils'
import { Action } from '@near-js/transactions'
import { contracts, chainAdapters } from 'chainsig.js'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { createAction } from '@near-wallet-selector/wallet-utils'

import { Connection as SolanaConnection } from '@solana/web3.js'

import dotenv from 'dotenv'
import { KeyPairString } from '@near-js/crypto'

async function main() {
  // Load environment variables
  dotenv.config({ path: '.env' }) // Path relative to the working directory

  // Create an account object
  const accountId = process.env.ACCOUNT_ID!
  // Create a signer from a private key string
  const privateKey = process.env.PRIVATE_KEY as KeyPairString
  const keyPair = KeyPair.fromString(privateKey) // ed25519:5Fg2...

  // Create a keystore and add the key
  const keyStore = new InMemoryKeyStore()
  await keyStore.setKey('testnet', accountId, keyPair)

  // Create a connection to testnet
  const near = await connect({
    networkId: 'testnet',
    keyStore: keyStore as any,
    nodeUrl: 'https://test.rpc.fastnear.com',
  })

  const account = await near.account(accountId)

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

        const txs: any[] = []
        for (const transaction of transactions) {
          const tx = await account.signAndSendTransaction(transaction)
          txs.push(tx)
        }

        console.dir(txs, { depth: Infinity })

        return txs.map((tx) => getTransactionLastResult(tx))
      },
    },
  })

  if (signatures.length === 0) throw new Error(`No signatures`);

  // Add signature
  const signedTx = solChain.finalizeTransactionSigning({
    transaction,
    rsvSignatures: signatures[0]! as any,
    senderAddress: address,
  })

  // Broadcast transaction
  const { hash: txHash } = await solChain.broadcastTx(signedTx)

  // Print link to transaction on Solana Explorer
  console.log(`https://explorer.solana.com/tx/${txHash}?cluster=devnet`)
}

main().catch(console.error)

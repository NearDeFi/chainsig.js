import { InMemoryKeyStore } from '@near-js/keystores'
import { KeyPair } from '@near-js/crypto'
import { connect } from 'near-api-js'
import { getTransactionLastResult } from '@near-js/utils'
import { Action } from '@near-js/transactions'
import { contracts, chainAdapters } from 'chainsig.js'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { createAction } from '@near-wallet-selector/wallet-utils'

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
  await (keyStore as any).setKey('testnet', accountId, keyPair)

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
  

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  })

  const derivationPath = 'any_string'

  const evmChain = new chainAdapters.evm.EVM({
    publicClient: publicClient as any,
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
      from: address as `0x${string}`,
      to: '0x427F9620Be0fe8Db2d840E2b6145D1CF2975bcaD' as `0x${string}`,
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

        const txs: any[] = []
        for (const transaction of transactions) {
          const tx = await account.signAndSendTransaction(transaction)
          txs.push(tx)
        }

        return txs.map((tx) => {
          return (getTransactionLastResult as any)(tx)
        })
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
}

main().catch(console.error) 
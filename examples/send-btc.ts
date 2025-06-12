import { InMemoryKeyStore } from '@near-js/keystores'
import { KeyPair } from '@near-js/crypto'
import { connect } from 'near-api-js'
import { getTransactionLastResult } from '@near-js/utils'
import { Action } from '@near-js/transactions'
import { contracts, chainAdapters } from 'chainsig.js'

import dotenv from 'dotenv'
import { KeyPairString } from '@near-js/crypto'
import { createAction } from '@near-wallet-selector/wallet-utils'

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

  const derivationPath = 'any_string'

  const btcRpcAdapter = new chainAdapters.btc.BTCRpcAdapters.Mempool(
    'https://mempool.space/testnet4/api'
  )

  const btcChain = new chainAdapters.btc.Bitcoin({
    network: 'testnet',
    contract,
    btcRpcAdapter,
  })

  // Derive address and public key
  const { address, publicKey } = await btcChain.deriveAddressAndPublicKey(
    accountId,
    derivationPath
  )

  console.log('address', address)

  // Check balance
  const { balance, decimals } = await btcChain.getBalance(address)

  console.log('balance', balance)

  // Create and sign transaction
  const { transaction, hashesToSign } =
    await btcChain.prepareTransactionForSigning({
      publicKey,
      from: address,
      to: 'tb1qlj64u6fqutr0xue85kl55fx0gt4m4urun25p7q',
      value: BigInt(100_000).toString(),
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

        console.dir(txs, { depth: Infinity })

        return txs.map((tx) => getTransactionLastResult(tx))
      },
    },
  })

  // Add signature
  const signedTx = btcChain.finalizeTransactionSigning({
    transaction,
    rsvSignatures: signature,
  })

  // Broadcast transaction
  const { hash: txHash } = await btcChain.broadcastTx(signedTx)

  // Print link to transaction on BTC Explorer
  console.log(`https://mempool.space/testnet4/tx/${txHash}`)
}

main().catch(console.error)

import { InMemoryKeyStore } from '@near-js/keystores'
import { KeyPair } from '@near-js/crypto'
import { connect } from 'near-api-js'
import { getTransactionLastResult } from '@near-js/utils'
import { Action } from '@near-js/transactions'
import { contracts, chainAdapters } from 'chainsig.js'


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

  const derivationPath = 'any_string'

  // Create XRP chain adapter with testnet RPC URL
  const xrpChain = new chainAdapters.xrp.XRP({
    rpcUrl: 'wss://s.altnet.rippletest.net:51233',
    contract,
  })

  // Derive address and public key
  const { address, publicKey } = await xrpChain.deriveAddressAndPublicKey(
    accountId,
    derivationPath
  )

  console.log('XRP address:', address)
  console.log('Public key:', publicKey)

  // Check balance
  const { balance, decimals } = await xrpChain.getBalance(address)

  console.log('Balance:', balance.toString(), 'drops')
  console.log('Balance in XRP:', Number(balance) / Math.pow(10, decimals))

  // Create and sign transaction
  const { transaction, hashesToSign } =
    await xrpChain.prepareTransactionForSigning({
      from: address,
      to: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH', // Testnet destination address
      amount: '1000000', // 1 XRP in drops
      publicKey,
      destinationTag: 12345,
      memo: 'Test transaction from chainsig.js'
    })

  console.log('Transaction prepared for signing')

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
            actions: tx.actions,
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

  console.log('Transaction signed with MPC')

  // Add signature
  const signedTx = xrpChain.finalizeTransactionSigning({
    transaction,
    rsvSignatures: signature,
  })

  console.log('Transaction finalized')

  // Broadcast transaction
  const { hash: txHash } = await xrpChain.broadcastTx(signedTx)

  console.log('Transaction broadcasted!')
  console.log(`Transaction hash: ${txHash}`)
  console.log(`View on XRPL Explorer: https://testnet.xrpl.org/transactions/${txHash}`)
}

main().catch(console.error)
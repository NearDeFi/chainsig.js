import { KeyPairString } from '@near-js/crypto'
import { contracts, chainAdapters } from '../src/index'
import { KeyPairSigner } from '@near-js/signers'
import { JsonRpcProvider } from '@near-js/providers'
import { Account } from '@near-js/accounts'
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'
import { createAction } from '@near-wallet-selector/wallet-utils'
import { getTransactionLastResult } from '@near-js/utils'
import { Action } from '@near-js/transactions'

// Create an account object
const accountId = ''
// Create a signer from a private key string
const privateKey = 'ed25519:' as KeyPairString
const signer = KeyPairSigner.fromSecretKey(privateKey)

const provider = new JsonRpcProvider({
  url: 'https://test.rpc.fastnear.com',
})

const account = new Account(accountId, provider, signer)

const contract = new contracts.ChainSignatureContract({
  networkId: 'testnet',
  contractId: 'v1.signer-prod.testnet',
})

const aptosClient = new Aptos(
  new AptosConfig({
    network: Network.TESTNET,
  })
)

const derivationPath = 'any_string'

const aptosChain = new chainAdapters.aptos.Aptos({
  client: aptosClient,
  contract,
})

const { address, publicKey } = await aptosChain.deriveAddressAndPublicKey(
  accountId,
  derivationPath
)

console.log('address', address)

// Check balance
const { balance, decimals } = await aptosChain.getBalance(address)

console.log('balance', balance)

const transaction = await aptosClient.transaction.build.simple({
  sender: address,
  data: {
    function: '0x1::aptos_account::transfer',
    functionArguments: [
      // USDC address
      '0x7257adc3ae461378c2a3359933ecf35f316247dc2e163031313e57a638ecf0f4',
      '100',
    ],
  },
})

const { hashesToSign } =
  await aptosChain.prepareTransactionForSigning(transaction)

// Sign with MPC
const signature = await contract.sign({
  payloads: hashesToSign,
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

      return txs.map((tx) => getTransactionLastResult(tx))
    },
  },
})

// Add signature
const signedTx = aptosChain.finalizeTransactionSigning({
  transaction,
  rsvSignatures: signature[0],
  publicKey: publicKey,
})

const { hash: txHash } = await aptosChain.broadcastTx(signedTx)

console.log(`https://explorer.aptoslabs.com/txn/${txHash}?network=testnet`)

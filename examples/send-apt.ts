import { KeyPairString, KeyPair } from '@near-js/crypto'
import { contracts, chainAdapters } from '../src/index'
import { InMemorySigner } from '@near-js/signers'
import { JsonRpcProvider } from '@near-js/providers'
import { Account, Connection } from '@near-js/accounts'
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'
import { createAction } from '@near-wallet-selector/wallet-utils'
import { getTransactionLastResult } from '@near-js/utils'
import { config } from 'dotenv'

// Load environment variables
config()

async function main() {
  // Create an account object from environment variables
  const accountId = process.env.ACCOUNT_ID || 'your-account.testnet'
  // Create a signer from a private key string
  const privateKey = (process.env.PRIVATE_KEY || 'ed25519:3D4YudUahN1HMqD5VvhE6RdcjbJGgMvRpMYhtKZhKVGG5FNFMRik2bLBmXvSjSznKvJLhxpxehVLrDLpFAqbsciH') as KeyPairString
  const keyPair = KeyPair.fromString(privateKey)
  const signer = await InMemorySigner.fromKeyPair('testnet', accountId, keyPair)

const provider = new JsonRpcProvider({
  url: 'https://test.rpc.fastnear.com',
})

  const connection = new Connection('testnet', provider, signer as any, accountId)
  const account = new Account(connection, accountId)

const contract = new contracts.ChainSignatureContract({
  networkId: 'testnet',
  contractId: process.env.NEXT_PUBLIC_NEAR_CHAIN_SIGNATURE_CONTRACT || 'v1.signer-prod.testnet',
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
      const results = []
      
      for (const tx of walletSelectorTransactions) {
        const actions = tx.actions.map((a) => createAction(a))
        
        const result = await account.signAndSendTransaction({
          receiverId: tx.receiverId,
          actions,
        })
        
        // @ts-ignore - Type mismatch between @near-js package versions
        results.push(getTransactionLastResult(result))
      }
      
      return results
    },
  },
})

// The signature is already in the correct format for Ed25519
console.log('Raw signature:', signature[0])
const aptosSignature = signature[0] as any

// Add signature
const signedTx = aptosChain.finalizeTransactionSigning({
  transaction,
  rsvSignatures: aptosSignature,
  publicKey: publicKey,
})

const { hash: txHash } = await aptosChain.broadcastTx(signedTx)

  console.log(`https://explorer.aptoslabs.com/txn/${txHash}?network=testnet`)
}

main().catch(console.error)

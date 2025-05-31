import { Account } from '@near-js/accounts'
import { contracts, chainAdapters } from '../src/index'
import { KeyPairString } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { Action } from '@near-js/transactions'
import { getTransactionLastResult } from '@near-js/utils'
import { createAction } from '@near-wallet-selector/wallet-utils'

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

const rpcUrl = getFullnodeUrl('testnet')

const suiClient = new SuiClient({ url: rpcUrl })

const derivationPath = 'any_string'

const suiChain = new chainAdapters.sui.SUI({
  client: suiClient,
  contract,
  rpcUrl: rpcUrl,
})

const { address, publicKey } = await suiChain.deriveAddressAndPublicKey(
  accountId,
  derivationPath
)

console.log('address', address)

// Check balance
const { balance, decimals } = await suiChain.getBalance(address)

console.log('balance', balance)

const tx = new Transaction()

const [coin] = tx.splitCoins(tx.gas, [100])

tx.transferObjects(
  [coin],
  '0x4c25628acf4728f8c304426abb0af03ec1b2830fad88285f8b377b369a52de1d'
)
tx.setSender(address)

const { hashesToSign, transaction } =
  await suiChain.prepareTransactionForSigning(tx)

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
const signedTx = suiChain.finalizeTransactionSigning({
  transaction,
  rsvSignatures: signature[0],
  publicKey: publicKey,
})

const { hash: txHash } = await suiChain.broadcastTx(signedTx)

console.log(`https://suiscan.xyz/testnet/tx/${txHash}`)

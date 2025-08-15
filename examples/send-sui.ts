import { Account } from '@near-js/accounts'
import { contracts, chainAdapters } from '../src/index'
import { KeyPairString, KeyPair } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { getTransactionLastResult } from '@near-js/utils'
import { config } from 'dotenv'

config()

async function main() {
  const accountId = process.env.ACCOUNT_ID || 'your-account.testnet'
  const privateKey = (process.env.PRIVATE_KEY || '') as KeyPairString
  const keyPair = KeyPair.fromString(privateKey)
  const signer = new KeyPairSigner(keyPair)

  const provider = new JsonRpcProvider({ url: 'https://test.rpc.fastnear.com' })
  const account = new Account(accountId, provider, signer)

  const contract = new contracts.ChainSignatureContract({
    networkId: 'testnet',
    contractId: process.env.NEXT_PUBLIC_NEAR_CHAIN_SIGNATURE_CONTRACT || 'v1.signer-prod.testnet',
  })

  const rpcUrl = getFullnodeUrl('testnet')
  const suiClient = new SuiClient({ url: rpcUrl })

  const derivationPath = 'any_string'

  const suiChain = new chainAdapters.sui.SUI({ client: suiClient, contract, rpcUrl })

  const { address, publicKey } = await suiChain.deriveAddressAndPublicKey(accountId, derivationPath)
  console.log('address', address)

  const { balance } = await suiChain.getBalance(address)
  console.log('balance', balance)

  const tx = new Transaction()
  const [coin] = tx.splitCoins(tx.gas, [100])
  tx.transferObjects([coin], '0x4c25628acf4728f8c304426abb0af03ec1b2830fad88285f8b377b369a52de1d')
  tx.setSender(address)

  const { hashesToSign, transaction } = await suiChain.prepareTransactionForSigning(tx)

  const signature = await contract.sign({
    payloads: hashesToSign,
    path: derivationPath,
    keyType: 'Eddsa',
    signerAccount: {
      accountId,
      signAndSendTransactions: async ({ transactions }) => transactions.map(() => getTransactionLastResult({} as any)),
    },
  })

  const signedTx = suiChain.finalizeTransactionSigning({ transaction, rsvSignatures: signature[0] as any, publicKey })
  const { hash: txHash } = await suiChain.broadcastTx(signedTx)
  console.log(`https://suiscan.xyz/testnet/tx/${txHash}`)
}

main().catch(console.error)

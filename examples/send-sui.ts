import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { Account } from '@near-js/accounts'
import { type KeyPairString, KeyPair } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'
import { config } from 'dotenv'

import { contracts, chainAdapters } from '../src/index'

config() // Load environment variables

async function main(): Promise<void> {
  const accountId = process.env.ACCOUNT_ID // 'your-account.testnet'
  const privateKey = process.env.PRIVATE_KEY as KeyPairString // ed25519:3D4YudUahN...

  if (!accountId) throw new Error('Setup environmental variables')

  const keyPair = KeyPair.fromString(privateKey)
  const signer = new KeyPairSigner(keyPair)

  const provider = new JsonRpcProvider({
    url: 'https://test.rpc.fastnear.com',
  })

  const account = new Account(accountId, provider, signer)

  const contract = new contracts.ChainSignatureContract({
    networkId: 'testnet',
    contractId:
      process.env.NEXT_PUBLIC_NEAR_CHAIN_SIGNATURE_CONTRACT ||
      'v1.signer-prod.testnet',
  })

  const rpcUrl = getFullnodeUrl('testnet')

  const suiClient = new SuiClient({ url: rpcUrl })

  const derivationPath = 'any_string'

  const suiChain = new chainAdapters.sui.SUI({
    client: suiClient,
    contract,
    rpcUrl,
  })

  const { address, publicKey } = await suiChain.deriveAddressAndPublicKey(
    accountId,
    derivationPath
  )

  console.log('address', address)

  // Check balance
  const { balance } = await suiChain.getBalance(address)

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
    signerAccount: account,
  })

  // The signature is already in the correct format for Ed25519
  console.log('Raw signature:', signature[0])
  const suiSignature = signature[0] as any

  // Add signature
  const signedTx = suiChain.finalizeTransactionSigning({
    transaction,
    rsvSignatures: suiSignature,
    publicKey,
  })

  const { hash: txHash } = await suiChain.broadcastTx(signedTx)

  console.log(`https://suiscan.xyz/testnet/tx/${txHash}`)
}

main().catch(console.error)

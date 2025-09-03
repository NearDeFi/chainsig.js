import { Account } from '@near-js/accounts'
import { KeyPair } from '@near-js/crypto'
import { type KeyPairString } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'
import { Connection as SolanaConnection } from '@solana/web3.js'
import { contracts, chainAdapters } from 'chainsig.js'
import { config } from 'dotenv'

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

  const connection = new SolanaConnection('https://api.devnet.solana.com')

  const derivationPath = 'any_string'

  const solChain = new chainAdapters.solana.Solana({
    solanaConnection: connection,
    contract,
  })

  // Derive address and public key
  const { address } = await solChain.deriveAddressAndPublicKey(
    accountId,
    derivationPath
  )

  console.log('address', address)

  // Check balance
  const { balance } = await solChain.getBalance(address)

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
    signerAccount: account,
  })

  if (signatures.length === 0) throw new Error(`No signatures`)

  // Add signature
  const signedTx = solChain.finalizeTransactionSigning({
    transaction,
    rsvSignatures: signatures[0] as any,
    senderAddress: address,
  })

  // Broadcast transaction
  const { hash: txHash } = await solChain.broadcastTx(signedTx)

  // Print link to transaction on Solana Explorer
  console.log(`https://explorer.solana.com/tx/${txHash}?cluster=devnet`)
}

main().catch(console.error)

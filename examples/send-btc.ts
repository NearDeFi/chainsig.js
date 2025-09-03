import { Account } from '@near-js/accounts'
import { KeyPair, type KeyPairString } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'
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
    signerAccount: account,
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

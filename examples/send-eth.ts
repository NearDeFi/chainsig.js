import { Account } from '@near-js/accounts'
import { KeyPair, type KeyPairString } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'
import { contracts, chainAdapters } from 'chainsig.js'
import { config } from 'dotenv'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'

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
  const { address } = await evmChain.deriveAddressAndPublicKey(
    accountId,
    derivationPath
  )

  console.log('address', address)

  // Check balance
  const { balance } = await evmChain.getBalance(address)

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
    signerAccount: account,
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

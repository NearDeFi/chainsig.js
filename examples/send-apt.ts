import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'
import { Account } from '@near-js/accounts'
import { type KeyPairString, KeyPair } from '@near-js/crypto'
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
  const { balance } = await aptosChain.getBalance(address)

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
    signerAccount: account,
  })

  // The signature is already in the correct format for Ed25519
  console.log('Raw signature:', signature[0])
  const aptosSignature = signature[0] as any

  // Add signature
  const signedTx = aptosChain.finalizeTransactionSigning({
    transaction,
    rsvSignatures: aptosSignature,
    publicKey,
  })

  const { hash: txHash } = await aptosChain.broadcastTx(signedTx)

  console.log(`https://explorer.aptoslabs.com/txn/${txHash}?network=testnet`)
}

main().catch(console.error)

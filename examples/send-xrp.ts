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
      memo: 'Test transaction from chainsig.js',
    })

  console.log('Transaction prepared for signing')

  // Sign with MPC
  const signature = await contract.sign({
    payloads: hashesToSign,
    path: derivationPath,
    keyType: 'Ecdsa',
    signerAccount: account,
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
  console.log(
    `View on XRPL Explorer: https://testnet.xrpl.org/transactions/${txHash}`
  )
}

main().catch(console.error)

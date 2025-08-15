import { InMemoryKeyStore } from '@near-js/keystores'
import { KeyPair, type KeyPairString } from '@near-js/crypto'
import { getTransactionLastResult } from '@near-js/utils'
import { contracts, chainAdapters } from 'chainsig.js'

import dotenv from 'dotenv'

async function main() {
  dotenv.config({ path: '.env' })

  const accountId = process.env.ACCOUNT_ID!
  const privateKey = process.env.PRIVATE_KEY as KeyPairString
  const keyPair = KeyPair.fromString(privateKey)

  const keyStore = new InMemoryKeyStore()
  await keyStore.setKey('testnet', accountId, keyPair)

  const contract = new contracts.ChainSignatureContract({
    networkId: 'testnet',
    contractId: 'v1.signer-prod.testnet',
  })

  const derivationPath = 'any_string'

  const btcRpcAdapter = new chainAdapters.btc.BTCRpcAdapters.Mempool('https://mempool.space/testnet4/api')

  const btcChain = new chainAdapters.btc.Bitcoin({ network: 'testnet', contract, btcRpcAdapter })

  const { address, publicKey } = await btcChain.deriveAddressAndPublicKey(accountId, derivationPath)
  console.log('address', address)

  const { balance } = await btcChain.getBalance(address)
  console.log('balance', balance)

  const { transaction, hashesToSign } = await btcChain.prepareTransactionForSigning({
    publicKey,
    from: address,
    to: 'tb1qlj64u6fqutr0xue85kl55fx0gt4m4urun25p7q',
    value: BigInt(100_000).toString(),
  })

  const signature = await contract.sign({
    payloads: hashesToSign,
    path: derivationPath,
    keyType: 'Ecdsa',
    signerAccount: {
      accountId,
      signAndSendTransactions: async ({ transactions }) => transactions.map(() => getTransactionLastResult({} as any)),
    },
  })

  const signedTx = btcChain.finalizeTransactionSigning({ transaction, rsvSignatures: signature })
  const { hash: txHash } = await btcChain.broadcastTx(signedTx)
  console.log(`https://mempool.space/testnet4/tx/${txHash}`)
}

main().catch(console.error)

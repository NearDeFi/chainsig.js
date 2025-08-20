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

  const contract = new contracts.ChainSignatureContract({ networkId: 'testnet', contractId: 'v1.signer-prod.testnet' })
  const derivationPath = 'any_string'

  const xrpChain = new chainAdapters.xrp.XRP({ rpcUrl: 'wss://s.altnet.rippletest.net:51233', contract })

  const { address, publicKey } = await xrpChain.deriveAddressAndPublicKey(accountId, derivationPath)
  console.log('XRP address:', address)
  console.log('Public key:', publicKey)

  const { balance, decimals } = await xrpChain.getBalance(address)
  console.log('Balance:', balance.toString(), 'drops')
  console.log('Balance in XRP:', Number(balance) / Math.pow(10, decimals))

  const { transaction, hashesToSign } = await xrpChain.prepareTransactionForSigning({
    from: address,
    to: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
    amount: '1000000',
    publicKey,
    destinationTag: 12345,
    memo: 'Test transaction from chainsig.js',
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

  const signedTx = xrpChain.finalizeTransactionSigning({ transaction, rsvSignatures: signature })
  const { hash: txHash } = await xrpChain.broadcastTx(signedTx)
  console.log('Transaction broadcasted!')
  console.log(`Transaction hash: ${txHash}`)
  console.log(`View on XRPL Explorer: https://testnet.xrpl.org/transactions/${txHash}`)
}

main().catch(console.error)
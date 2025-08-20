import { getTransactionLastResult } from '@near-js/utils'
import { KeyPair, type KeyPairString } from '@near-js/crypto'
import dotenv from 'dotenv'
import { createAction } from '@near-wallet-selector/wallet-utils'

import { contracts, chainAdapters } from 'chainsig.js'

async function main() {
  dotenv.config({ path: '.env' })

  const accountId = process.env.ACCOUNT_ID!
  const privateKey = process.env.PRIVATE_KEY as KeyPairString
  if (!accountId || !privateKey) throw new Error('ACCOUNT_ID and PRIVATE KEY are required')

  const keyPair = KeyPair.fromString(privateKey)

  const contract = new contracts.ChainSignatureContract({
    networkId: 'testnet',
    contractId: 'v1.signer-prod.testnet',
  })

  const nearChain = new chainAdapters.near.NEAR({
    rpcUrl: 'https://test.rpc.fastnear.com',
    networkId: 'testnet',
    contract,
  })

  const derivationPath = 'near-3'

  const { address, publicKey } = await nearChain.deriveAddressAndPublicKey(accountId, derivationPath)
  console.log('Derived account:', address)

  // Optional: auto-create & fund derived account with MPC full-access key.
  // To enable, uncomment the block below and ensure your project resolves a single copy of @near-js/* v2.
  // const { JsonRpcProvider } = await import('@near-js/providers')
  // await chainAdapters.near.utils.ensureDerivedAccountExists({
  //   provider: new JsonRpcProvider({ url: 'https://test.rpc.fastnear.com' }),
  //   controllerAccountId: accountId,
  //   controllerKeyPair: keyPair,
  //   derivedAccountId: address,
  //   mpcPublicKey: publicKey,
  //   initialDepositYocto: 1_000_000_000_000_000_000_000_000n, // 1 NEAR
  // })

  const { balance, decimals } = await nearChain.getBalance(address)
  console.log(`Balance: ${balance} (decimals: ${decimals})`)

  const { transaction, hashesToSign } = await nearChain.prepareTransactionForSigning({
    from: address,
    to: 'receiver.testnet',
    amount: 10n ** 22n,
    publicKey,
  })

  const signatures = await contract.sign({
    payloads: hashesToSign,
    path: derivationPath,
    keyType: 'Eddsa',
    signerAccount: {
      accountId,
      signAndSendTransactions: async ({ transactions }) => {
        const results: any[] = []
        for (const tx of transactions) {
          const actions = tx.actions.map((a: any) => createAction(a))
          const outcome = await contracts.utils.transaction.sendTransactionUntil({
            accountId,
            keypair: keyPair,
            networkId: 'testnet',
            receiverId: tx.receiverId,
            actions,
          })
          results.push(getTransactionLastResult(outcome as any))
        }
        return results
      },
    },
  })

  if (signatures.length === 0) throw new Error('No signatures returned from MPC contract')

  const signedBase64 = nearChain.finalizeTransactionSigning({ transaction, rsvSignatures: signatures[0] as any })

  const { hash } = await nearChain.broadcastTx(signedBase64)
  console.log(`Sent: https://testnet.nearblocks.io/txns/${hash}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})



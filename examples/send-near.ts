import { InMemoryKeyStore } from '@near-js/keystores'
import { KeyPair, type KeyPairString } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { getTransactionLastResult, baseDecode } from '@near-js/utils'
import {
  Transaction as NearTransaction,
  SignedTransaction as NearSignedTransaction,
  encodeTransaction as nearEncodeTransaction,
  Signature as NearSignature,
  Action as NearAction,
  FunctionCall as NearFunctionCall,
} from '@near-js/transactions'
import { createHash } from 'node:crypto'
import dotenv from 'dotenv'

import { contracts, chainAdapters } from 'chainsig.js'

async function main() {
  dotenv.config({ path: '.env' })

  const accountId = process.env.ACCOUNT_ID!
  const privateKey = process.env.PRIVATE_KEY as KeyPairString
  if (!accountId || !privateKey) throw new Error('ACCOUNT_ID and PRIVATE KEY are required')

  const keyPair = KeyPair.fromString(privateKey)
  const keyStore = new InMemoryKeyStore()
  await keyStore.setKey('testnet', accountId, keyPair)

  const provider = new JsonRpcProvider({ url: 'https://test.rpc.fastnear.com' })

  const contract = new contracts.ChainSignatureContract({
    networkId: 'testnet',
    contractId: 'v1.signer-prod.testnet',
  })

  const nearChain = new chainAdapters.near.NEAR({
    rpcUrl: 'https://test.rpc.fastnear.com',
    networkId: 'testnet',
    contract,
  })

  const derivationPath = 'near-1'

  const { address, publicKey } = await nearChain.deriveAddressAndPublicKey(accountId, derivationPath)
  console.log('Derived account:', address)

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
      signAndSendTransactions: async ({ transactions: walletSelectorTransactions }) => {
        const results: any[] = []
        const pubKey = keyPair.getPublicKey()
        for (const tx of walletSelectorTransactions) {
          const accessKey = (await provider.query(`access_key/${accountId}/${pubKey.toString()}`, '')) as any
          const recentBlockHash = baseDecode(accessKey.block_hash)
          const nextNonce = BigInt((accessKey.nonce ?? 0) + 1)

          const actions: NearAction[] = tx.actions.map((a: any) => {
            if (a.type !== 'FunctionCall') throw new Error('Unsupported action in example')
            const gas = BigInt(a.params.gas)
            const deposit = BigInt(a.params.deposit)
            const argsBytes = Buffer.from(JSON.stringify(a.params.args))
            return new NearAction({
              functionCall: new NearFunctionCall({
                methodName: a.params.methodName,
                args: argsBytes,
                gas,
                deposit,
              }),
            })
          })

          const nearTx = new NearTransaction({
            signerId: accountId,
            publicKey: pubKey,
            nonce: nextNonce,
            receiverId: tx.receiverId,
            actions,
            blockHash: recentBlockHash,
          })

          const encoded = nearEncodeTransaction(nearTx)
          const digest = createHash('sha256').update(encoded).digest()
          const sig = keyPair.sign(digest)
          const signedTx = new NearSignedTransaction({
            transaction: nearTx,
            signature: new NearSignature({ keyType: pubKey.keyType, data: sig.signature }),
          })

          const sent = await provider.sendTransaction(signedTx)
          const txHash = (sent as any).transaction.hash
          const outcome = await provider.txStatus(txHash, accountId, 'FINAL')
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



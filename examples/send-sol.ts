import { InMemoryKeyStore } from '@near-js/keystores'
import { KeyPair, type KeyPairString } from '@near-js/crypto'
import { getTransactionLastResult, baseDecode } from '@near-js/utils'
import { Action, Transaction as NearTransaction, SignedTransaction as NearSignedTransaction, Signature as NearSignature, FunctionCall as NearFunctionCall, encodeTransaction as nearEncodeTransaction } from '@near-js/transactions'
import { JsonRpcProvider } from '@near-js/providers'
import { createHash } from 'node:crypto'
import { contracts, chainAdapters } from 'chainsig.js'

import { Connection as SolanaConnection } from '@solana/web3.js'

import dotenv from 'dotenv'

async function main() {
  dotenv.config({ path: '.env' })

  const accountId = process.env.ACCOUNT_ID!
  const privateKey = process.env.PRIVATE_KEY as KeyPairString
  const keyPair = KeyPair.fromString(privateKey)

  const keyStore = new InMemoryKeyStore()
  await keyStore.setKey('testnet', accountId, keyPair)

  const provider = new JsonRpcProvider({ url: 'https://test.rpc.fastnear.com' })

  const contract = new contracts.ChainSignatureContract({
    networkId: 'testnet',
    contractId: 'v1.signer-prod.testnet',
  })

  const connection = new SolanaConnection('https://api.devnet.solana.com')
  const derivationPath = 'any_string'

  const solChain = new chainAdapters.solana.Solana({ solanaConnection: connection, contract })

  const { address } = await solChain.deriveAddressAndPublicKey(accountId, derivationPath)
  console.log('address', address)

  const { balance } = await solChain.getBalance(address)
  console.log('balance', balance)

  const { transaction: { transaction } } = await solChain.prepareTransactionForSigning({
    from: address,
    to: '7CmF6R7kv77twtfRfwgXMrArmqLZ7M6tXbJa9SAUnviH',
    amount: 1285141n,
  })

  const signatures = await contract.sign({
    payloads: [transaction.serializeMessage()],
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

          const actions: Action[] = tx.actions.map((a: any) => new Action({
            functionCall: new NearFunctionCall({
              methodName: a.params.methodName,
              args: Buffer.from(JSON.stringify(a.params.args)),
              gas: BigInt(a.params.gas),
              deposit: BigInt(a.params.deposit),
            }),
          }))

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

  if (signatures.length === 0) throw new Error(`No signatures`)

  const signedTx = solChain.finalizeTransactionSigning({ transaction, rsvSignatures: signatures[0]! as any, senderAddress: address })
  const { hash: txHash } = await solChain.broadcastTx(signedTx)
  console.log(`https://explorer.solana.com/tx/${txHash}?cluster=devnet`)
}

main().catch(console.error)

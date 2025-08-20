import { InMemoryKeyStore } from '@near-js/keystores'
import { KeyPair, type KeyPairString } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { getTransactionLastResult, baseDecode } from '@near-js/utils'
import { Action, Transaction as NearTransaction, SignedTransaction as NearSignedTransaction, Signature as NearSignature, FunctionCall as NearFunctionCall, encodeTransaction as nearEncodeTransaction } from '@near-js/transactions'
import { createHash } from 'node:crypto'
import { contracts, chainAdapters } from 'chainsig.js'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'

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

  const publicClient = createPublicClient({ chain: sepolia, transport: http() })

  const derivationPath = 'any_string'

  const evmChain = new chainAdapters.evm.EVM({ publicClient: publicClient as any, contract })

  const { address } = await evmChain.deriveAddressAndPublicKey(accountId, derivationPath)
  console.log('address', address)

  const { balance } = await evmChain.getBalance(address)
  console.log('balance', balance)

  const { transaction, hashesToSign } = await evmChain.prepareTransactionForSigning({
    from: address as `0x${string}`,
    to: '0x427F9620Be0fe8Db2d840E2b6145D1CF2975bcaD' as `0x${string}`,
    value: 1285141n,
  })

  const signature = await contract.sign({
    payloads: hashesToSign,
    path: derivationPath,
    keyType: 'Ecdsa',
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

  const signedTx = evmChain.finalizeTransactionSigning({ transaction, rsvSignatures: signature })
  const { hash: txHash } = await evmChain.broadcastTx(signedTx)
  console.log(`${sepolia.blockExplorers.default.url}/tx/${txHash}`)
}

main().catch(console.error) 
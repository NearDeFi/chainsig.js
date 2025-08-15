import { InMemoryKeyStore } from '@near-js/keystores'
import { JsonRpcProvider } from '@near-js/providers'
import { Transaction as NearTransaction, SignedTransaction as NearSignedTransaction, encodeTransaction as nearEncodeTransaction, Signature as NearSignature, Action as NearAction, FunctionCall as NearFunctionCall } from '@near-js/transactions'
import type { FinalExecutionOutcome, NetworkId } from '@near-wallet-selector/core'
import { KeyPair } from '@near-js/crypto'
import { baseDecode } from '@near-js/utils'
import { createHash } from 'node:crypto'
import { withRetry } from 'viem'

import { type RSVSignature, type MPCSignature, type Ed25519Signature } from '@types'
import { cryptography } from '@utils'

export const responseToMpcSignature = ({
  signature,
}: {
  signature: MPCSignature
}): RSVSignature | Ed25519Signature | undefined => {
  if ('scheme' in signature && signature.scheme === 'Ed25519' && 'signature' in signature) {
    return signature as Ed25519Signature
  }
  if (signature) {
    return cryptography.toRSV(signature)
  } else {
    return undefined
  }
}

export interface SendTransactionOptions {
  until: any
  retryCount: number
  delay: number
  nodeUrl: string
}

export const sendTransactionUntil = async ({
  accountId,
  keypair,
  networkId,
  receiverId,
  actions,
  nonce,
  options = {
    until: 'EXECUTED_OPTIMISTIC',
    retryCount: 3,
    delay: 5000,
    nodeUrl: networkId === 'testnet' ? 'https://test.rpc.fastnear.com' : 'https://free.rpc.fastnear.com',
  },
}: {
  accountId: string
  keypair: KeyPair
  networkId: NetworkId
  receiverId: string
  actions: NearAction[]
  nonce?: number
  options?: SendTransactionOptions
}): Promise<FinalExecutionOutcome> => {
  const keyStore = new InMemoryKeyStore()
  await keyStore.setKey(networkId, accountId, keypair)

  const provider = new JsonRpcProvider({ url: options.nodeUrl })

  // Fetch current access key to get nonce and block hash
  const publicKey = keypair.getPublicKey()

  const accessKey = (await provider.query(`access_key/${accountId}/${publicKey.toString()}`, '')) as unknown as {
    block_hash: string
    block_height: number
    nonce: number
    permission: string
  }

  const recentBlockHash = baseDecode(accessKey.block_hash)

  const tx = new NearTransaction({
    signerId: accountId,
    publicKey,
    nonce: BigInt(nonce ?? accessKey.nonce + 1),
    receiverId,
    actions,
    blockHash: recentBlockHash,
  })

  const serializedTx = nearEncodeTransaction(tx)

  // NEAR signs the SHA-256 hash of the serialized transaction
  const digest = createHash('sha256').update(serializedTx).digest()
  const signature = keypair.sign(digest)

  const signedTransaction = new NearSignedTransaction({
    transaction: tx,
    signature: new NearSignature({
      keyType: publicKey.keyType,
      data: signature.signature,
    }),
  })

  // Submit and wait by polling
  const res = await provider.sendTransaction(signedTransaction)
  const txHash = (res as any).transaction.hash as string | undefined
  if (!txHash) throw new Error('No transaction hash found')

  return await withRetry(
    async () => {
      const txOutcome = await provider.txStatus(txHash, accountId, options.until)
      if (txOutcome) return txOutcome as FinalExecutionOutcome
      throw new Error('Transaction not found')
    },
    { retryCount: options.retryCount, delay: options.delay }
  )
}

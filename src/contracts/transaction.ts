import { InMemoryKeyStore } from '@near-js/keystores'
import type { Action as TransactionAction } from '@near-js/transactions'
import type { TxExecutionStatus } from '@near-js/types'
import type {
  FinalExecutionOutcome,
  NetworkId,
} from '@near-wallet-selector/core'
import {
  transactions,
  utils as nearUtils,
  connect,
  type KeyPair,
} from 'near-api-js'
import { withRetry } from 'viem'

import {
  type RSVSignature,
  type MPCSignature,
  type Ed25519Signature,
} from '@types'
import { cryptography } from '@utils'

export const responseToMpcSignature = ({
  signature,
}: {
  signature: MPCSignature
}): RSVSignature | Ed25519Signature | undefined => {
  if (
    'scheme' in signature &&
    signature.scheme === 'Ed25519' &&
    'signature' in signature
  ) {
    return signature as Ed25519Signature
  }
  if (signature) {
    return cryptography.toRSV(signature)
  } else {
    return undefined
  }
}

export interface SendTransactionOptions {
  until: TxExecutionStatus
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
    delay: 5000, // Near RPC timeout
    nodeUrl:
      networkId === 'testnet'
        ? 'https://test.rpc.fastnear.com'
        : 'https://free.rpc.fastnear.com',
  },
}: {
  accountId: string
  keypair: KeyPair
  networkId: NetworkId
  receiverId: string
  actions: TransactionAction[]
  nonce?: number
  options?: SendTransactionOptions
}): Promise<FinalExecutionOutcome> => {
  const keyStore = new InMemoryKeyStore()
  await keyStore.setKey(networkId, accountId, keypair)

  const near = await connect({
    networkId,
    keyStore,
    nodeUrl: options.nodeUrl,
  })

  const { signer } = near.connection
  const publicKey = await signer.getPublicKey(
    accountId,
    near.connection.networkId
  )

  const accessKey = (await near.connection.provider.query(
    `access_key/${accountId}/${publicKey.toString()}`,
    ''
  )) as unknown as {
    block_hash: string
    block_height: number
    nonce: number
    permission: string
  }

  const recentBlockHash = nearUtils.serialize.base_decode(accessKey.block_hash)

  const tx = transactions.createTransaction(
    accountId,
    publicKey,
    receiverId,
    nonce ?? ++accessKey.nonce,
    actions,
    recentBlockHash
  )

  const serializedTx = nearUtils.serialize.serialize(
    transactions.SCHEMA.Transaction,
    tx
  )

  const nearTransactionSignature = await signer.signMessage(
    serializedTx,
    accountId,
    near.connection.networkId
  )

  const signedTransaction = new transactions.SignedTransaction({
    transaction: tx,
    signature: new transactions.Signature({
      keyType: tx.publicKey.keyType,
      data: nearTransactionSignature.signature,
    }),
  })

  const { transaction } = await near.connection.provider.sendTransactionUntil(
    signedTransaction,
    'INCLUDED_FINAL'
  )

  const txHash = transaction.hash as string | undefined

  if (!txHash) {
    throw new Error('No transaction hash found')
  }

  return await withRetry(
    async () => {
      const txOutcome = await near.connection.provider.txStatus(
        txHash,
        accountId,
        options.until
      )

      if (txOutcome) {
        return txOutcome
      }

      throw new Error('Transaction not found')
    },
    {
      retryCount: options.retryCount,
      delay: options.delay,
    }
  )
}

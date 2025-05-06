import { InMemoryKeyStore } from '@near-js/keystores'
import type { Action as TransactionAction } from '@near-js/transactions'
import type { TxExecutionStatus } from '@near-js/types'
import type {
  Action as WalletAction,
  FinalExecutionOutcome,
  NetworkId,
} from '@near-wallet-selector/core'
import BN from 'bn.js'
import {
  transactions,
  utils as nearUtils,
  connect,
  type KeyPair,
} from 'near-api-js'
import { getTransactionLastResult } from 'near-api-js/lib/providers'
import { withRetry } from 'viem'

import { ChainSignatureContract } from '@mpc-contract/near/ChainSignatureContract'
import { NEAR_MAX_GAS } from '@mpc-contract/near/constants'
import { type ChainSignatureContractIds } from '@mpc-contract/near/types'
import {
  type RSVSignature,
  type KeyDerivationPath,
  type MPCSignature,
  type HashToSign,
} from '@types'
import { cryptography } from '@utils'

export const mpcPayloadsToChainSigTransaction = async ({
  networkId,
  contractId,
  hashesToSign,
  path,
}: {
  networkId: NetworkId
  contractId: ChainSignatureContractIds
  hashesToSign: HashToSign[]
  path: KeyDerivationPath
}): Promise<{
  receiverId: string
  actions: WalletAction[]
}> => {
  const contract = new ChainSignatureContract({
    networkId,
    contractId,
  })

  const currentContractFee = await contract.getCurrentSignatureDeposit()

  return {
    receiverId: contractId,
    actions: hashesToSign.map((payload) => ({
      type: 'FunctionCall',
      params: {
        methodName: 'sign',
        args: {
          request: {
            payload: Array.from(payload),
            path,
            key_version: 0,
          },
        },
        gas: NEAR_MAX_GAS.div(new BN(hashesToSign.length)).toString(),
        deposit: currentContractFee?.toString() || '1',
      },
    })),
  }
}

export const responseToMpcSignature = ({
  response,
}: {
  response: FinalExecutionOutcome
}): RSVSignature | undefined => {
  const signature = getTransactionLastResult(response) as MPCSignature

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

import { FailoverRpcProvider, JsonRpcProvider } from '@near-js/providers'
import { type Action, actionCreators } from '@near-js/transactions'
import { type FinalExecutionOutcome } from '@near-js/types'
import { getTransactionLastResult } from '@near-js/utils'
import {
  najToUncompressedPubKeySEC1,
  uint8ArrayToHex,
} from '@utils/cryptography'

import {
  type RSVSignature,
  type UncompressedPubKeySEC1,
  type NajPublicKey,
  type MPCSignature,
} from '@types'

import { NEAR_MAX_GAS } from './constants'
import { responseToMpcSignature } from './signature'
import type { NearNetworkIds } from './types'

interface Transaction {
  signerId?: string
  receiverId: string
  actions: Action[]
}

export type HashToSign = number[] | Uint8Array

export interface SignArgs {
  payloads: HashToSign[]
  path: string
  keyType: 'Eddsa' | 'Ecdsa'
  signerAccount: {
    accountId: string
    signAndSendTransactions: (transactions: {
      transactions: Transaction[]
    }) => Promise<FinalExecutionOutcome[]>
  }
}

export class ChainSignatureContract {
  private readonly contractId: string
  private readonly networkId: NearNetworkIds
  private readonly provider: FailoverRpcProvider

  constructor({
    contractId,
    networkId,
    fallbackRpcUrls,
  }: {
    contractId: string
    networkId: NearNetworkIds
    fallbackRpcUrls?: string[]
  }) {
    this.contractId = contractId
    this.networkId = networkId

    const rpcProviderUrls =
      fallbackRpcUrls && fallbackRpcUrls.length > 0
        ? fallbackRpcUrls
        : [`https://rpc.${this.networkId}.near.org`]

    this.provider = new FailoverRpcProvider(
      rpcProviderUrls.map((url) => new JsonRpcProvider({ url }))
    )
  }

  getCurrentSignatureDeposit(): number {
    return 1
  }

  async sign({
    payloads,
    path,
    keyType,
    signerAccount,
  }: SignArgs): Promise<RSVSignature[]> {
    const transactions = payloads.map((payload) => ({
      signerId: signerAccount.accountId,
      receiverId: this.contractId,
      actions: [
        actionCreators.functionCall(
          'sign',
          {
            request: {
              payload_v2: { [keyType]: uint8ArrayToHex(payload) },
              path,
              domain_id: keyType === 'Eddsa' ? 1 : 0,
            },
          },
          BigInt(NEAR_MAX_GAS),
          BigInt(1)
        ),
      ],
    }))

    const sentTxs = await signerAccount.signAndSendTransactions({
      transactions,
    })

    const results = sentTxs.map((tx) =>
      getTransactionLastResult(tx)
    ) as MPCSignature[]

    const rsvSignatures = results.map((tx) =>
      responseToMpcSignature({ signature: tx })
    )

    return rsvSignatures as RSVSignature[]
  }

  async getPublicKey(): Promise<UncompressedPubKeySEC1> {
    const najPubKey = await this.provider.callFunction(
      this.contractId,
      'public_key',
      {}
    )
    return najToUncompressedPubKeySEC1(najPubKey as NajPublicKey)
  }

  async getDerivedPublicKey(args: {
    path: string
    predecessor: string
    IsEd25519?: boolean
  }): Promise<UncompressedPubKeySEC1 | `Ed25519:${string}`> {
    const najPubKey = await this.provider.callFunction(
      this.contractId,
      'derived_public_key',
      {
        path: args.path,
        predecessor: args.predecessor,
        domain_id: args.IsEd25519 ? 1 : 0,
      }
    )
    return najToUncompressedPubKeySEC1(najPubKey as NajPublicKey)
  }
}

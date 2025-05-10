import { type CodeResult } from '@near-js/types'
import { type Transaction } from '@near-wallet-selector/core'
import {
  najToUncompressedPubKeySEC1,
  uint8ArrayToHex,
} from '@utils/cryptography'
import { providers } from 'near-api-js'

import {
  type RSVSignature,
  type UncompressedPubKeySEC1,
  type NajPublicKey,
  type MPCSignature,
} from '@types'

import { NEAR_MAX_GAS } from './constants'
import { responseToMpcSignature } from './transaction'
import { type NearNetworkIds } from './types'

interface ViewMethodParams {
  contractId: string
  method: string
  args?: Record<string, unknown>
}

export type HashToSign = number[]

export interface SignArgs<T = unknown> {
  payloads: HashToSign[]
  path: string
  keyType: 'Eddsa' | 'Ecdsa'
  signerAccount: {
    accountId: string
    signAndSendTransactions: (transactions: {
      transactions: Transaction[]
    }) => Promise<T>
  }
}

export class ChainSignatureContract {
  private readonly contractId: string
  private readonly networkId: NearNetworkIds
  private readonly provider: providers.FailoverRpcProvider

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

    this.provider = new providers.FailoverRpcProvider(
      rpcProviderUrls.map((url) => new providers.JsonRpcProvider({ url }))
    )
  }

  private async viewFunction({
    contractId,
    method,
    args = {},
  }: ViewMethodParams): Promise<number | string | object> {
    const res = await this.provider.query<CodeResult>({
      request_type: 'call_function',
      account_id: contractId,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      finality: 'optimistic',
    })

    return JSON.parse(Buffer.from(res.result).toString())
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
        {
          type: 'FunctionCall' as const,
          params: {
            methodName: 'sign',
            args: {
              request: {
                payload_v2: { [keyType]: uint8ArrayToHex(payload) },
                path,
                domain_id: keyType === 'Eddsa' ? 1 : 0,
              },
            },
            gas: NEAR_MAX_GAS.toString(),
            deposit: '1',
          },
        },
      ],
    }))

    const sentTxs = (await signerAccount.signAndSendTransactions({
      transactions,
    })) as MPCSignature[]

    const rsvSignatures = sentTxs.map((tx) =>
      responseToMpcSignature({ signature: tx })
    )

    return rsvSignatures as RSVSignature[]
  }

  async getPublicKey(): Promise<UncompressedPubKeySEC1> {
    const najPubKey = await this.viewFunction({
      contractId: this.contractId,
      method: 'public_key',
    })
    return najToUncompressedPubKeySEC1(najPubKey as NajPublicKey)
  }

  async getDerivedPublicKey(args: {
    path: string
    predecessor: string
    IsEd25519?: boolean
  }): Promise<UncompressedPubKeySEC1 | `Ed25519:${string}`> {
    if (args.IsEd25519) {
      return (await this.viewFunction({
        contractId: this.contractId,
        method: 'derived_public_key',
        args: {
          path: args.path,
          predecessor: args.predecessor,
          domain_id: 1,
        },
      })) as `Ed25519:${string}`
    }

    const najPubKey = (await this.viewFunction({
      contractId: this.contractId,
      method: 'derived_public_key',
      args,
    })) as NajPublicKey
    return najToUncompressedPubKeySEC1(najPubKey)
  }
}

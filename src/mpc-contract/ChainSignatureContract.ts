import { Contract } from '@near-js/accounts'
import { KeyPair } from '@near-js/crypto'
import { actionCreators } from '@near-js/transactions'
import { najToUncompressedPubKeySEC1 } from '@utils/cryptography'
import { getRootPublicKey } from '@utils/publicKey'
import BN from 'bn.js'

import { getNearAccount } from '@mpc-contract/account'
import { DONT_CARE_ACCOUNT_ID, NEAR_MAX_GAS } from '@mpc-contract/constants'
import {
  responseToMpcSignature,
  type SendTransactionOptions,
  sendTransactionUntil,
} from '@mpc-contract/transaction'
import {
  type NearNetworkIds,
  type ChainSignatureContractIds,
} from '@mpc-contract/types'
import type { RSVSignature, UncompressedPubKeySEC1, NajPublicKey } from '@types'
import { cryptography } from '@utils'

type NearContract = Contract & {
  public_key: () => Promise<NajPublicKey>
  experimental_signature_deposit: () => Promise<number>
  derived_public_key: (args: {
    path: string
    predecessor: string
    domain_id?: number
  }) => Promise<NajPublicKey | `Ed25519:${string}`>
}

export interface SignArgs {
  /** The payload to sign as an array of 32 bytes */
  payload: number[]
  /** The derivation path for key generation */
  path: string
  /** Version of the key to use */
  key_version: number
}

interface ChainSignatureContractArgs {
  networkId: NearNetworkIds
  contractId: ChainSignatureContractIds
  accountId?: string
  keypair?: KeyPair
  rootPublicKey?: NajPublicKey
  sendTransactionOptions?: SendTransactionOptions
}

/**
 * Implementation of the ChainSignatureContract for NEAR chains.
 *
 * This class provides an interface to interact with the ChainSignatures contract
 * deployed on NEAR. It supports both view methods (which don't require authentication)
 * and change methods (which require a valid NEAR account and keypair).
 */
export class ChainSignatureContract {
  private readonly networkId: NearNetworkIds
  private readonly contractId: ChainSignatureContractIds
  private readonly accountId: string
  private readonly keypair: KeyPair
  private readonly rootPublicKey?: NajPublicKey
  private readonly sendTransactionOptions?: SendTransactionOptions

  constructor({
    networkId,
    contractId,
    accountId = DONT_CARE_ACCOUNT_ID,
    keypair = KeyPair.fromRandom('ed25519'),
    rootPublicKey,
    sendTransactionOptions,
  }: ChainSignatureContractArgs) {
    this.networkId = networkId
    this.contractId = contractId
    this.accountId = accountId
    this.keypair = keypair
    this.sendTransactionOptions = sendTransactionOptions

    this.rootPublicKey =
      rootPublicKey || getRootPublicKey(this.contractId)
  }

  private async getContract(): Promise<NearContract> {
    const account = await getNearAccount({
      networkId: this.networkId,
      accountId: this.accountId,
      keypair: this.keypair,
    })

    return new Contract(account, this.contractId, {
      viewMethods: [
        'public_key',
        'experimental_signature_deposit',
        'derived_public_key',
      ],
      // Change methods use the sendTransactionUntil because the internal retry of the Contract class
      // throws on NodeJs.
      changeMethods: [],
      useLocalViewExecution: false,
    }) as unknown as NearContract
  }

  async getCurrentSignatureDeposit(): Promise<BN> {
    const contract = await this.getContract()
    return new BN(
      (await contract.experimental_signature_deposit()).toLocaleString(
        'fullwide',
        {
          useGrouping: false,
        }
      )
    )
  }

  async getDerivedPublicKey(args: {
    path: string
    predecessor: string
    IsEd25519?: boolean
  }): Promise<UncompressedPubKeySEC1 | `Ed25519:${string}`> {
    if (args.IsEd25519) {
      const contract = await this.getContract()
      return (await contract.derived_public_key({
        path: args.path,
        predecessor: args.predecessor,
        domain_id: 1,
      })) as `Ed25519:${string}`
    }

    if (this.rootPublicKey) {
      const pubKey = cryptography.deriveChildPublicKey(
        await this.getPublicKey(),
        args.predecessor.toLowerCase(),
        args.path,
      )
      return pubKey
    } else {
      // Support for legacy contract
      const contract = await this.getContract()
      const najPubKey = await contract.derived_public_key(args)
      return najToUncompressedPubKeySEC1(najPubKey as NajPublicKey)
    }
  }

  async getPublicKey(): Promise<UncompressedPubKeySEC1> {
    if (this.rootPublicKey) {
      return najToUncompressedPubKeySEC1(this.rootPublicKey)
    } else {
      // Support for legacy contract
      const contract = await this.getContract()
      const najPubKey = await contract.public_key()
      return najToUncompressedPubKeySEC1(najPubKey)
    }
  }

  async sign(
    args: SignArgs,
    options?: {
      nonce?: number
    }
  ): Promise<RSVSignature> {
    this.requireAccount()

    const deposit = await this.getCurrentSignatureDeposit()

    const result = await sendTransactionUntil({
      accountId: this.accountId,
      keypair: this.keypair,
      networkId: this.networkId,
      receiverId: this.contractId,
      actions: [
        actionCreators.functionCall(
          'sign',
          { request: args },
          BigInt(NEAR_MAX_GAS.toString()),
          BigInt(deposit.toString())
        ),
      ],
      nonce: options?.nonce,
      options: this.sendTransactionOptions,
    })

    const signature = responseToMpcSignature({ response: result })

    if (!signature) {
      throw new Error('Transaction failed')
    }

    return signature
  }

  private requireAccount(): void {
    if (this.accountId === DONT_CARE_ACCOUNT_ID) {
      throw new Error(
        'A valid account ID and keypair are required for change methods. Please instantiate a new contract with valid credentials.'
      )
    }
  }
}

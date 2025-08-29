import { Account } from '@near-js/accounts'
import { KeyPair } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'
import { createPublicClient, http } from 'viem'

import * as chainAdapters from '@chain-adapters'
import { BTCRpcAdapters } from '@chain-adapters/Bitcoin/BTCRpcAdapter'
import { ChainSignatureContract } from '@contracts/ChainSignatureContract'
import { DONT_CARE_ACCOUNT_ID } from '@contracts/constants'
import {
  type Response,
  type BitcoinRequest,
  type CosmosRequest,
  type EVMRequest,
} from '@contracts/types'

export const EVMTransaction = async (
  req: EVMRequest,
  keyPair: KeyPair
): Promise<Response> => {
  try {
    const account = await getNearAccount({
      networkId: req.nearAuthentication.networkId,
      accountId: req.nearAuthentication.accountId,
      keyPair,
    })

    const contract = new ChainSignatureContract({
      networkId: req.nearAuthentication.networkId,
      contractId: req.chainConfig.contract,
    })

    const evm = new chainAdapters.evm.EVM({
      publicClient: createPublicClient({
        transport: http(req.chainConfig.providerUrl),
      }),
      contract,
    })

    const { transaction, hashesToSign } =
      await evm.prepareTransactionForSigning(req.transaction)

    const signatures = await contract.sign({
      payloads: [hashesToSign[0]],
      path: req.derivationPath,
      keyType: 'Ecdsa',
      signerAccount: account,
    })

    const txSerialized = evm.finalizeTransactionSigning({
      transaction,
      rsvSignatures: signatures,
    })

    const txHash = await evm.broadcastTx(txSerialized)

    return {
      transactionHash: txHash.hash,
      success: true,
    }
  } catch (e: unknown) {
    console.error(e)
    return {
      success: false,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}

export const BTCTransaction = async (
  req: BitcoinRequest,
  keyPair: KeyPair
): Promise<Response> => {
  try {
    const account = await getNearAccount({
      networkId: req.nearAuthentication.networkId,
      accountId: req.nearAuthentication.accountId,
      keyPair,
    })

    const contract = new ChainSignatureContract({
      networkId: req.nearAuthentication.networkId,
      contractId: req.chainConfig.contract,
    })

    const btc = new chainAdapters.btc.Bitcoin({
      btcRpcAdapter: new BTCRpcAdapters.Mempool(req.chainConfig.providerUrl),
      contract,
      network: req.chainConfig.network,
    })

    const { transaction, hashesToSign } =
      await btc.prepareTransactionForSigning(req.transaction)

    const signatures = await Promise.all(
      hashesToSign.map(
        async (payload) =>
          await contract.sign({
            payloads: [payload],
            path: req.derivationPath,
            keyType: 'Ecdsa',
            signerAccount: account,
          })
      )
    )

    const txSerialized = btc.finalizeTransactionSigning({
      transaction,
      rsvSignatures: signatures.flat(),
    })

    const txHash = await btc.broadcastTx(txSerialized)

    return {
      transactionHash: txHash.hash,
      success: true,
    }
  } catch (e: unknown) {
    return {
      success: false,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}

export const CosmosTransaction = async (
  req: CosmosRequest,
  keyPair: KeyPair
): Promise<Response> => {
  try {
    const account = await getNearAccount({
      networkId: req.nearAuthentication.networkId,
      accountId: req.nearAuthentication.accountId,
      keyPair,
    })

    const contract = new ChainSignatureContract({
      networkId: req.nearAuthentication.networkId,
      contractId: req.chainConfig.contract,
    })

    const cosmos = new chainAdapters.cosmos.Cosmos({
      contract,
      chainId: req.chainConfig.chainId,
    })

    const { transaction, hashesToSign } =
      await cosmos.prepareTransactionForSigning(req.transaction)

    const signatures = await Promise.all(
      hashesToSign.map(
        async (payload) =>
          await contract.sign({
            payloads: [payload],
            path: req.derivationPath,
            keyType: 'Ecdsa',
            signerAccount: account,
          })
      )
    )

    const txSerialized = cosmos.finalizeTransactionSigning({
      transaction,
      rsvSignatures: signatures.flat(),
    })

    const txHash = await cosmos.broadcastTx(txSerialized)

    return {
      transactionHash: txHash,
      success: true,
    }
  } catch (e: unknown) {
    console.error(e)
    return {
      success: false,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}

// Aux function
type SetConnectionArgs =
  | {
      networkId: string
      accountId: string
      keyPair: KeyPair
    }
  | {
      networkId: string
      accountId?: never
      keyPair?: never
    }

const getNearAccount = async ({
  networkId,
  accountId = DONT_CARE_ACCOUNT_ID,
  keyPair = KeyPair.fromRandom('ed25519'),
}: SetConnectionArgs): Promise<Account> => {
  // Get the RPC URL for the network
  const rpcUrl = {
    testnet: 'https://rpc.testnet.near.org',
    mainnet: 'https://rpc.mainnet.near.org',
  }[networkId]

  if (!rpcUrl) {
    throw new Error(`Unsupported network: ${networkId}`)
  }

  // Create provider using new v2.0.0+ API
  const provider = new JsonRpcProvider({
    url: rpcUrl,
  })

  // Create signer using new v2.0.0+ API
  const signer = new KeyPairSigner(keyPair)

  // Use Account constructor (accountId, provider, signer)
  return new Account(accountId, provider, signer)
}

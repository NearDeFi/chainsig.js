import { type KeyPair } from '@near-js/crypto'
import { createPublicClient, http } from 'viem'

import * as chainAdapters from '@chain-adapters'
import { BTCRpcAdapters } from '@chain-adapters/Bitcoin/BTCRpcAdapter'
import { getNearAccount } from './utils'
import { ChainSignatureContract } from '@contracts/ChainSignatureContract'
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
      keypair: keyPair,
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
      signerAccount: {
        accountId: account.accountId,
        signAndSendTransactions: async () => [],
      },
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
      keypair: keyPair,
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
            signerAccount: {
              accountId: account.accountId,
              signAndSendTransactions: async () => [],
            },
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
      keypair: keyPair,
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
            signerAccount: {
              accountId: account.accountId,
              signAndSendTransactions: async () => [],
            },
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

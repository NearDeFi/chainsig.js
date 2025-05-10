import type {
  BTCTransactionRequest,
  BTCNetworkIds,
} from '@chain-adapters/Bitcoin/types'
import type {
  CosmosNetworkIds,
  CosmosTransactionRequest,
} from '@chain-adapters/Cosmos/types'
import { type EVMTransactionRequest } from '@chain-adapters/EVM/types'

export type ChainSignatureContractIds = string

export type NearNetworkIds = 'mainnet' | 'testnet'

export interface ChainProvider {
  providerUrl: string
  contract: ChainSignatureContractIds
}

export interface NearAuthentication {
  networkId: NearNetworkIds
  accountId: string
}

interface SuccessResponse {
  transactionHash: string
  success: true
}

interface FailureResponse {
  success: false
  errorMessage: string
}

export type Response = SuccessResponse | FailureResponse

export type EVMChainConfigWithProviders = ChainProvider

export interface EVMRequest {
  transaction: EVMTransactionRequest
  chainConfig: EVMChainConfigWithProviders
  nearAuthentication: NearAuthentication
  fastAuthRelayerUrl?: string
  derivationPath: string
}

export type BTCChainConfigWithProviders = ChainProvider & {
  network: BTCNetworkIds
}

export interface BitcoinRequest {
  transaction: BTCTransactionRequest
  chainConfig: BTCChainConfigWithProviders
  nearAuthentication: NearAuthentication
  fastAuthRelayerUrl?: string
  derivationPath: string
}

export interface CosmosChainConfig {
  contract: ChainSignatureContractIds
  chainId: CosmosNetworkIds
}

export interface CosmosRequest {
  chainConfig: CosmosChainConfig
  transaction: CosmosTransactionRequest
  nearAuthentication: NearAuthentication
  derivationPath: string
  fastAuthRelayerUrl?: string
}

import type {
  BTCTransactionRequest,
  BTCNetworkId,
} from '@chain-adapters/Bitcoin/types'
import type {
  CosmosNetworkId,
  CosmosTransactionRequest,
} from '@chain-adapters/Cosmos/types'
import { type EVMTransactionRequest } from '@chain-adapters/EVM/types'

export type ChainSignatureContractId = string

export type NearNetworkId = 'mainnet' | 'testnet'

export interface ChainProvider {
  providerUrl: string
  contract: ChainSignatureContractId
}

export interface NearAuthentication {
  networkId: NearNetworkId
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
  network: BTCNetworkId
}

export interface BitcoinRequest {
  transaction: BTCTransactionRequest
  chainConfig: BTCChainConfigWithProviders
  nearAuthentication: NearAuthentication
  fastAuthRelayerUrl?: string
  derivationPath: string
}

export interface CosmosChainConfig {
  contract: ChainSignatureContractId
  chainId: CosmosNetworkId
}

export interface CosmosRequest {
  chainConfig: CosmosChainConfig
  transaction: CosmosTransactionRequest
  nearAuthentication: NearAuthentication
  derivationPath: string
  fastAuthRelayerUrl?: string
}

import { type NajPublicKey } from '@types'

export const ENVS = {
  TESTNET: 'TESTNET',
  MAINNET: 'MAINNET',
} as const

/**
 * Root public keys for the Sig Network Smart Contracts across different environments.
 *
 * These keys should never change.
 */
export const ROOT_PUBLIC_KEYS: Record<keyof typeof ENVS, NajPublicKey> = {
  [ENVS.TESTNET]:
    'secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3',
  [ENVS.MAINNET]:
    'secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya',
}

/**
 * Contract addresses for different chains and environments.
 *
 * - Testnet: Used for external development, stable
 * - Mainnet: Production contract address
 *
 * @see ChainSignatureContract documentation for implementation details
 */
export const CONTRACT_ADDRESSES: Record<keyof typeof ENVS, string> = {
    [ENVS.TESTNET]: 'v1.signer-prod.testnet',
    [ENVS.MAINNET]: 'v1.signer',
}

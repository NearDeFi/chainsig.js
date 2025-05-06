import { type NajPublicKey } from '@types'

export const ENVS = {
  TESTNET_DEV: 'TESTNET_DEV',
  TESTNET: 'TESTNET',
  MAINNET: 'MAINNET',
} as const

/**
 * Root public keys for the Sig Network Smart Contracts across different environments.
 *
 * These keys should never change.
 */
export const ROOT_PUBLIC_KEYS: Record<keyof typeof ENVS, NajPublicKey> = {
  [ENVS.TESTNET_DEV]:
    'secp256k1:placeholder', // TODO: Is there still a deployment for this?
  [ENVS.TESTNET]:
    'secp256k1:3Ww8iFjqTHufye5aRGUvrQqETegR4gVUcW8FX5xzscaN9ENhpkffojsxJwi6N1RbbHMTxYa9UyKeqK3fsMuwxjR5',
  [ENVS.MAINNET]:
    'secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya',
}

/**
 * Chain ID used in the key derivation function (KDF) for deriving child public keys.
 *
 * @see {@link deriveChildPublicKey} in cryptography.ts for usage details
 */
export const KDF_CHAIN_ID = '0x18d' as const

/**
 * Contract addresses for different environments.
 *
 * - Testnet Dev: Used for internal development, very unstable
 * - Testnet: Used for external development, stable
 * - Mainnet: Production contract address
 *
 * @see ChainSignatureContract documentation for implementation details
 */
export const CONTRACT_ADDRESSES: Record<keyof typeof ENVS, string> = {
  [ENVS.TESTNET_DEV]: 'placeholder', // TODO: Is there still a deployment for this?
  [ENVS.TESTNET]: 'v1.signer-prod.testnet',
  [ENVS.MAINNET]: 'v1.signer',
}

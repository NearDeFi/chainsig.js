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
    'secp256k1:54hU5wcCmVUPFWLDALXMh1fFToZsVXrx9BbTbHzSfQq1Kd1rJZi52iPa4QQxo6s5TgjWqgpY8HamYuUDzG6fAaUq',
  [ENVS.TESTNET]:
    'secp256k1:3Ww8iFjqTHufye5aRGUvrQqETegR4gVUcW8FX5xzscaN9ENhpkffojsxJwi6N1RbbHMTxYa9UyKeqK3fsMuwxjR5',
  [ENVS.MAINNET]:
    'secp256k1:4tY4qMzusmgX5wYdG35663Y3Qar3CTbpApotwk9ZKLoF79XA4DjG8XoByaKdNHKQX9Lz5hd7iJqsWdTKyA7dKa6Z',
}

/**
 * Chain ID used in the key derivation function (KDF) for deriving child public keys.
 *
 * @see {@link deriveChildPublicKey} in cryptography.ts for usage details
 */
export const KDF_CHAIN_ID = '0x18d' as const


/**
 * Contract addresses for different chains and environments.
 *
 * - Testnet Dev: Used for internal development, very unstable
 * - Testnet: Used for external development, stable
 * - Mainnet: Production contract address
 *
 * @see ChainSignatureContract documentation for implementation details
 */
export const CONTRACT_ADDRESSES: Record<keyof typeof ENVS, string> = {
    [ENVS.TESTNET_DEV]: 'dev.sig-net.testnet',
    [ENVS.TESTNET]: 'v1.sig-net.testnet',
    [ENVS.MAINNET]: 'v1.sig-net.near',
}

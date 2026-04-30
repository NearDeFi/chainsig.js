import { type Ed25519PubKey, type NajPublicKey } from '@types'

export const ENVS = {
  TESTNET: 'TESTNET',
  MAINNET: 'MAINNET',
} as const

/**
 * Root public keys for the NEAR MPC contracts in `CONTRACT_ADDRESSES`.
 *
 * Used as the parent key by `deriveChildPublicKey` for client-side address
 * computation. These values come from each MPC contract's `public_key` view
 * method (domain_id 0 → secp256k1, domain_id 1 → ed25519) and should never
 * change for a given deployment.
 */
export const ROOT_PUBLIC_KEYS: Record<
  keyof typeof ENVS,
  { secp256k1: NajPublicKey; ed25519: Ed25519PubKey }
> = {
  [ENVS.TESTNET]: {
    secp256k1:
      'secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3',
    ed25519: 'ed25519:6vSEtQxrQj6txUMh33WC4ERyCWmNMRTdufDWAaDY3Un2',
  },
  [ENVS.MAINNET]: {
    secp256k1:
      'secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya',
    ed25519: 'ed25519:G9hwngxWNKdmqMCmU1Yt6LPhFpayJeKFxyAV1HqMNLtF',
  },
}

/**
 * NEAR MPC contract addresses per environment.
 */
export const CONTRACT_ADDRESSES: Record<keyof typeof ENVS, string> = {
  [ENVS.TESTNET]: 'v1.signer-prod.testnet',
  [ENVS.MAINNET]: 'v1.signer',
}

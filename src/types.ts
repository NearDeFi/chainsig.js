import { type SignArgs } from '@mpc-contract/ChainSignatureContract'

export type HashToSign = SignArgs['payload']

type Base58String = string

export type NajPublicKey = `secp256k1:${Base58String}`

export type UncompressedPubKeySEC1 = `04${string}`

export type CompressedPubKeySEC1 = `02${string}` | `03${string}`

export type Ed25519PubKey = `Ed25519:${string}`

export interface DerivedPublicKeyArgs {
  path: string
  predecessor: string
}

export interface Signature {
  scheme: string
  signature: number[]
}

export interface KeyDerivationPath {
  index: number
  scheme: 'secp256k1' | 'ed25519'
}

export interface RSVSignature {
  r: string
  s: string
  v: number
}

export interface NearNearMpcSignature {
  big_r: {
    affine_point: string
  }
  s: {
    scalar: string
  }
  recovery_id: number
}

export interface ChainSigNearMpcSignature {
  big_r: string
  s: string
  recovery_id: number
}

export interface ChainSigEvmMpcSignature {
  bigR: { x: bigint; y: bigint }
  s: bigint
  recoveryId: number
}

export type MPCSignature =
  | NearNearMpcSignature
  | ChainSigNearMpcSignature
  | ChainSigEvmMpcSignature

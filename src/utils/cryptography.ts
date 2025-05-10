import { base58 } from '@scure/base'
import { ec as EC } from 'elliptic'
import { sha3_256 } from 'js-sha3'
import { keccak256 } from 'viem'

import { KDF_CHAIN_IDS } from '@constants'
import {
  type NajPublicKey,
  type MPCSignature,
  type RSVSignature,
  type UncompressedPubKeySEC1,
} from '@types'

export const toRSV = (signature: MPCSignature): RSVSignature => {
  // Handle NearNearMpcSignature
  if (
    'big_r' in signature &&
    typeof signature.big_r === 'object' &&
    'affine_point' in signature.big_r &&
    's' in signature &&
    typeof signature.s === 'object' &&
    'scalar' in signature.s
  ) {
    return {
      r: signature.big_r.affine_point.substring(2),
      s: signature.s.scalar,
      v: signature.recovery_id + 27,
    }
  }
  // Handle ChainSigNearMpcSignature
  else if (
    'big_r' in signature &&
    typeof signature.big_r === 'string' &&
    's' in signature &&
    typeof signature.s === 'string'
  ) {
    return {
      r: signature.big_r.substring(2),
      s: signature.s,
      v: signature.recovery_id + 27,
    }
  }
  // Handle ChainSigEvmMpcSignature
  else if (
    'bigR' in signature &&
    'x' in signature.bigR &&
    's' in signature &&
    typeof signature.s === 'bigint'
  ) {
    return {
      r: signature.bigR.x.toString(16).padStart(64, '0'),
      s: signature.s.toString(16).padStart(64, '0'),
      v: signature.recoveryId + 27,
    }
  }

  throw new Error('Invalid signature format')
}

/**
 * Compresses an uncompressed public key to its compressed format following SEC1 standards.
 * In SEC1, a compressed public key consists of a prefix (02 or 03) followed by the x-coordinate.
 * The prefix indicates whether the y-coordinate is even (02) or odd (03).
 *
 * @param uncompressedPubKeySEC1 - The uncompressed public key in hex format, with or without '04' prefix
 * @returns The compressed public key in hex format
 * @throws Error if the uncompressed public key length is invalid
 */
export const compressPubKey = (
  uncompressedPubKeySEC1: UncompressedPubKeySEC1
): string => {
  const slicedPubKey = uncompressedPubKeySEC1.slice(2)

  if (slicedPubKey.length !== 128) {
    throw new Error('Invalid uncompressed public key length')
  }

  const x = slicedPubKey.slice(0, 64)
  const y = slicedPubKey.slice(64)

  const isEven = parseInt(y.slice(-1), 16) % 2 === 0
  const prefix = isEven ? '02' : '03'

  return prefix + x
}

/**
 * Converts a NAJ public key to an uncompressed SEC1 public key.
 *
 * @param najPublicKey - The NAJ public key to convert (e.g. secp256k1:3Ww8iFjqTHufye5aRGUvrQqETegR4gVUcW8FX5xzscaN9ENhpkffojsxJwi6N1RbbHMTxYa9UyKeqK3fsMuwxjR5)
 * @returns The uncompressed SEC1 public key (e.g. 04 || x || y)
 */
export const najToUncompressedPubKeySEC1 = (
  najPublicKey: NajPublicKey
): UncompressedPubKeySEC1 => {
  const decodedKey = base58.decode(najPublicKey.split(':')[1])
  return `04${Buffer.from(decodedKey).toString('hex')}`
}

/**
 * Derives a child public key from a parent public key using the sig.network v1.0.0 epsilon derivation scheme.
 * The parent public keys are defined in @constants.ts
 *
 * @param najPublicKey - The parent public key in uncompressed SEC1 format (e.g. 04 || x || y)
 * @param predecessorId - The predecessor ID is the address of the account calling the signer contract (e.g EOA or Contract Address)
 * @param path - Optional derivation path suffix (defaults to empty string)
 * @returns The derived child public key in uncompressed SEC1 format (04 || x || y)
 */
export function deriveChildPublicKey(
  rootUncompressedPubKeySEC1: UncompressedPubKeySEC1,
  predecessorId: string,
  path: string = '',
  chainId: string
): UncompressedPubKeySEC1 {
  const ec = new EC('secp256k1')

  const EPSILON_DERIVATION_PREFIX = 'sig.network v1.0.0 epsilon derivation'
  const derivationPath = `${EPSILON_DERIVATION_PREFIX},${chainId},${predecessorId},${path}`

  let scalarHex = ''

  if (chainId === KDF_CHAIN_IDS.ETHEREUM) {
    scalarHex = keccak256(Buffer.from(derivationPath)).slice(2)
  } else if (chainId === KDF_CHAIN_IDS.NEAR) {
    scalarHex = sha3_256(derivationPath)
  } else {
    throw new Error('Invalid chain ID')
  }

  const x = rootUncompressedPubKeySEC1.substring(2, 66)
  const y = rootUncompressedPubKeySEC1.substring(66)

  const oldPublicKeyPoint = ec.curve.point(x, y)
  const scalarTimesG = ec.g.mul(scalarHex)
  const newPublicKeyPoint = oldPublicKeyPoint.add(scalarTimesG)

  const newX = newPublicKeyPoint.getX().toString('hex').padStart(64, '0')
  const newY = newPublicKeyPoint.getY().toString('hex').padStart(64, '0')

  return `04${newX}${newY}`
}

/**
 * Converts a Uint8Array to a hexadecimal string.
 *
 * @param uint8Array - The Uint8Array to convert.
 * @returns The hexadecimal string representation of the Uint8Array.
 */
export const uint8ArrayToHex = (uint8Array: number[]): string => {
  return Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

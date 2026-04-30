import { ed25519 } from '@noble/curves/ed25519'
import { bytesToNumberLE, hexToBytes } from '@noble/curves/utils'
import { base58 } from '@scure/base'
import elliptic from 'elliptic'
import sha from 'js-sha3'
import {
  type Ed25519PubKey,
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

// near/mpc's `derive_tweak` from crates/near-mpc-crypto-types/src/kdf.rs.
// Output is the sha3_256 of `<prefix><predecessor>,<path>` as a hex string.
function computeTweakHex(predecessorId: string, path: string): string {
  const EPSILON_DERIVATION_PREFIX =
    'near-mpc-recovery v0.1.0 epsilon derivation:'
  return sha.sha3_256(`${EPSILON_DERIVATION_PREFIX}${predecessorId},${path}`)
}

/**
 * Derives a child secp256k1 public key from the MPC root key using near/mpc's
 * epsilon derivation scheme (`derive_key_secp256k1` in crates/contract/src/crypto_shared/kdf.rs).
 *
 * @param rootUncompressedPubKeySEC1 - The MPC secp256k1 root key in uncompressed SEC1 form (04 || x || y)
 * @param predecessorId - The account calling the signer contract
 * @param path - Optional derivation path suffix
 * @returns The derived child key in uncompressed SEC1 form
 */
export function deriveChildPublicKey(
  rootUncompressedPubKeySEC1: UncompressedPubKeySEC1,
  predecessorId: string,
  path: string = ''
): UncompressedPubKeySEC1 {
  // eslint-disable-next-line new-cap
  const ec = new elliptic.ec('secp256k1')

  const scalarHex = computeTweakHex(predecessorId, path)

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
 * Derives a child ed25519 public key from the MPC root key using near/mpc's
 * epsilon derivation scheme (`derive_public_key_edwards_point_ed25519` in
 * crates/contract/src/crypto_shared/kdf.rs).
 *
 * @param rootEd25519PubKey - The MPC ed25519 root key in NAJ form (`ed25519:<base58>`)
 * @param predecessorId - The account calling the signer contract
 * @param path - Optional derivation path suffix
 * @returns The derived child key in NAJ form (`ed25519:<base58>`)
 */
export function deriveChildPublicKeyEd25519(
  rootEd25519PubKey: Ed25519PubKey,
  predecessorId: string,
  path: string = ''
): Ed25519PubKey {
  const rootBytes = base58.decode(rootEd25519PubKey.split(':')[1])
  const rootPoint = ed25519.Point.fromHex(rootBytes)

  // near/mpc reads the tweak as little-endian and reduces mod L (curve order).
  const tweakBytes = hexToBytes(computeTweakHex(predecessorId, path))
  const scalar = bytesToNumberLE(tweakBytes) % ed25519.Point.Fn.ORDER

  const childPoint = rootPoint.add(ed25519.Point.BASE.multiply(scalar))
  return `ed25519:${base58.encode(childPoint.toBytes())}`
}

/**
 * Converts a Uint8Array to a hexadecimal string.
 *
 * @param uint8Array - The Uint8Array to convert.
 * @returns The hexadecimal string representation of the Uint8Array.
 */
export const uint8ArrayToHex = (
  uint8Array: number[] | Uint8Array<ArrayBufferLike>
): string => {
  return Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

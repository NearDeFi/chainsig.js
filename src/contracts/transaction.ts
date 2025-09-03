import {
  type RSVSignature,
  type MPCSignature,
  type Ed25519Signature,
} from '@types'
import { cryptography } from '@utils'

export const responseToMpcSignature = ({
  signature,
}: {
  signature: MPCSignature
}): RSVSignature | Ed25519Signature | undefined => {
  if (
    'scheme' in signature &&
    signature.scheme === 'Ed25519' &&
    'signature' in signature
  ) {
    return signature as Ed25519Signature
  }
  if (signature) {
    return cryptography.toRSV(signature)
  } else {
    return undefined
  }
}

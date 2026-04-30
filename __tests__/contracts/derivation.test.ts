import { describe, expect, it } from '@jest/globals'

import { ChainSignatureContract } from '../../src/contracts/ChainSignatureContract'
import { najToUncompressedPubKeySEC1 } from '../../src/utils/cryptography'

// These vectors were captured from the live near/mpc testnet contract
// (v1.signer-prod.testnet) on 2026-04-30. They pin the local KDF output to
// what the contract returns, so any change to the derivation logic that drifts
// from near/mpc will fail this test offline.
const PREDECESSOR = 'derivation-test.testnet'
const PATH = 'unit-test'

const EXPECTED_SECP256K1_NAJ =
  'secp256k1:3b3GS4kaAPvzxFUEYKiMvXeuBzttMZosggT3iAAbyZzAfQc1Dn4eLrDshNGGeKZyfSK7xegjPSq553NXHisMLiyA'
const EXPECTED_ED25519 =
  'ed25519:49KFz8zeqrPcaSKqLCXtY79zW98ZW6Nd7W8vSsC7FdKJ'

describe('Local derivation matches near/mpc contract output', () => {
  it('secp256k1 child key matches captured contract vector', async () => {
    const contract = new ChainSignatureContract({ networkId: 'testnet' })
    const local = await contract.getDerivedPublicKey({
      path: PATH,
      predecessor: PREDECESSOR,
    })
    expect(local).toBe(najToUncompressedPubKeySEC1(EXPECTED_SECP256K1_NAJ))
  })

  it('ed25519 child key matches captured contract vector', async () => {
    const contract = new ChainSignatureContract({ networkId: 'testnet' })
    const local = await contract.getDerivedPublicKey({
      path: PATH,
      predecessor: PREDECESSOR,
      IsEd25519: true,
    })
    expect(local).toBe(EXPECTED_ED25519)
  })
})

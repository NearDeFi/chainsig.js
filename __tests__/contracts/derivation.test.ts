import { JsonRpcProvider } from '@near-js/providers'

import { CONTRACT_ADDRESSES, ENVS } from '../../src/constants'
import { ChainSignatureContract } from '../../src/contracts/ChainSignatureContract'
import {
  najToUncompressedPubKeySEC1,
} from '../../src/utils/cryptography'
import type { Ed25519PubKey, NajPublicKey } from '../../src/types'

const PREDECESSOR = 'derivation-test.testnet'
const PATH = 'unit-test'

const provider = new JsonRpcProvider({ url: 'https://rpc.testnet.near.org' })
const TESTNET_CONTRACT = CONTRACT_ADDRESSES[ENVS.TESTNET]

async function contractDerivedPublicKey(
  domainId: 0 | 1
): Promise<string> {
  return (await provider.callFunction(
    TESTNET_CONTRACT,
    'derived_public_key',
    { path: PATH, predecessor: PREDECESSOR, domain_id: domainId }
  )) as string
}

describe('Local derivation matches NEAR MPC contract', () => {
  jest.setTimeout(30_000)

  it('secp256k1 child key matches the contract', async () => {
    const contract = new ChainSignatureContract({ networkId: 'testnet' })
    const local = await contract.getDerivedPublicKey({
      path: PATH,
      predecessor: PREDECESSOR,
    })
    const fromContract = najToUncompressedPubKeySEC1(
      (await contractDerivedPublicKey(0)) as NajPublicKey
    )
    expect(local).toBe(fromContract)
  })

  it('ed25519 child key matches the contract', async () => {
    const contract = new ChainSignatureContract({ networkId: 'testnet' })
    const local = await contract.getDerivedPublicKey({
      path: PATH,
      predecessor: PREDECESSOR,
      IsEd25519: true,
    })
    const fromContract = (await contractDerivedPublicKey(1)) as Ed25519PubKey
    expect(local).toBe(fromContract)
  })
})

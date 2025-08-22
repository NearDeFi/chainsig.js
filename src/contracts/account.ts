import { Account } from '@near-js/accounts'
import { KeyPair } from '@near-js/crypto'
import { InMemoryKeyStore } from '@near-js/keystores'
import { JsonRpcProvider, type Provider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'

import { DONT_CARE_ACCOUNT_ID } from '@contracts/constants'

type SetConnectionArgs =
  | {
      networkId: string
      accountId: string
      keypair: KeyPair
    }
  | {
      networkId: string
      accountId?: never
      keypair?: never
    }

export const getNearAccount = async ({
  networkId,
  accountId = DONT_CARE_ACCOUNT_ID,
  keypair = KeyPair.fromRandom('ed25519'),
}: SetConnectionArgs): Promise<Account> => {
  const keyStore = new InMemoryKeyStore()
  await keyStore.setKey(networkId, accountId, keypair)

  // Get the RPC URL for the network
  const rpcUrl = {
    testnet: 'https://rpc.testnet.near.org',
    mainnet: 'https://rpc.mainnet.near.org',
  }[networkId]

  if (!rpcUrl) {
    throw new Error(`Unsupported network: ${networkId}`)
  }

  // Create provider using new v2.0.0+ API
  const provider = new JsonRpcProvider({
    url: rpcUrl,
  })

  // Create signer using new v2.0.0+ API
  const signer = new KeyPairSigner(keypair)

  // Use Account constructor (accountId, provider, signer)
  return new Account(accountId, provider as Provider, signer)
}

import { Account } from '@near-js/accounts'
import { KeyPair } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'

import { DONT_CARE_ACCOUNT_ID } from '@contracts/constants'

type SetConnectionArgs =
  | {
      networkId: string
      accountId: string
      keyPair: KeyPair
    }
  | {
      networkId: string
      accountId?: never
      keyPair?: never
    }

export const getNearAccount = async ({
  networkId,
  accountId = DONT_CARE_ACCOUNT_ID,
  keyPair = KeyPair.fromRandom('ed25519'),
}: SetConnectionArgs): Promise<Account> => {
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
  const signer = new KeyPairSigner(keyPair)

  // Use Account constructor (accountId, provider, signer)
  return new Account(accountId, provider, signer)
}

import { Account, Connection } from '@near-js/accounts'
import { KeyPair } from '@near-js/crypto'
import { InMemoryKeyStore } from '@near-js/keystores'

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

  const connection = Connection.fromConfig({
    networkId,
    provider: {
      type: 'JsonRpcProvider',
      args: {
        url: {
          testnet: 'https://rpc.testnet.near.org',
          mainnet: 'https://rpc.mainnet.near.org',
        }[networkId],
      },
    },
    signer: { type: 'InMemorySigner', keyStore },
  })

  return new Account(connection, accountId)
}

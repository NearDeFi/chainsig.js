import { Account } from '@near-js/accounts'
import { type KeyPairString, KeyPair } from '@near-js/crypto'
import { JsonRpcProvider } from '@near-js/providers'
import { KeyPairSigner } from '@near-js/signers'
import { chainAdapters, contracts } from '../src'
import { config } from 'dotenv'
import { DevnetEntrypoint } from '@multiversx/sdk-core/out'

config()

async function main(): Promise<void> {
  const accountId = process.env.ACCOUNT_ID
  const privateKey = process.env.PRIVATE_KEY as KeyPairString
  const receiver = process.env.MULTIVERSX_RECEIVER ?? "erd1fmd662htrgt07xxd8me09newa9s0euzvpz3wp0c4pz78f83grt9qm6pn57"

  if (!accountId || !privateKey || !receiver) {
    throw new Error(
      'ACCOUNT_ID, PRIVATE_KEY and MULTIVERSX_RECEIVER must be provided in environment variables'
    )
  }

  const keyPair = KeyPair.fromString(privateKey)
  const signer = new KeyPairSigner(keyPair)
  const provider = new JsonRpcProvider({
    url: process.env.NEAR_RPC_URL ?? 'https://test.rpc.fastnear.com',
  })

  const account = new Account(accountId, provider, signer)

  const contract = new contracts.ChainSignatureContract({
    networkId:
      (process.env.NEAR_NETWORK_ID as 'testnet' | 'mainnet') ?? 'testnet',
    contractId:
      process.env.NEXT_PUBLIC_NEAR_CHAIN_SIGNATURE_CONTRACT ??
      'v1.signer-prod.testnet',
  })

  const mvxChain = new chainAdapters.multiversx.MultiversX({
    contract,
    networkEntrypoint: new DevnetEntrypoint(),
  })

  const derivationPath = process.env.MULTIVERSX_DERIVATION_PATH ?? 'mvx-1'

  const { address } = await mvxChain.deriveAddressAndPublicKey(
    accountId,
    derivationPath
  )

  console.log('Derived MultiversX address:', address)

  const { balance } = await mvxChain.getBalance(address)
  console.log('Current balance (attoEGLD):', balance.toString())

  const request: chainAdapters.multiversx.MultiversXTransactionRequest = {
    sender: address,
    receiver,
    value: process.env.MULTIVERSX_VALUE ?? '10000000000000000', // 0.01 EGLD
  }

  const { transaction, hashesToSign } =
    await mvxChain.prepareTransactionForSigning(request)

  const signature = await contract.sign({
    payloads: hashesToSign,
    path: derivationPath,
    keyType: 'Eddsa',
    signerAccount: account,
  })

  const signedTx = mvxChain.finalizeTransactionSigning({
    transaction,
    rsvSignatures: signature,
  })

  const { hash } = await mvxChain.broadcastTx(signedTx)

  console.log('Submitted MultiversX transaction hash:', hash)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

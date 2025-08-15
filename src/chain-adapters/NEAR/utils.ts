import { JsonRpcProvider } from '@near-js/providers'
import { PublicKey as NearPublicKey, KeyPair } from '@near-js/crypto'
import {
  Action as NearAction,
  AddKey as NearAddKey,
  AccessKey as NearAccessKey,
  AccessKeyPermission as NearAccessKeyPermission,
  FullAccessPermission as NearFullAccessPermission,
  CreateAccount as NearCreateAccount,
  Transfer as NearTransfer,
  Transaction as NearTransaction,
  SignedTransaction as NearSignedTransaction,
  Signature as NearSignature,
  encodeTransaction as nearEncodeTransaction,
} from '@near-js/transactions'
import { baseDecode } from '@near-js/utils'
import { createHash } from 'node:crypto'

export interface EnsureDerivedAccountParams {
  provider: JsonRpcProvider
  controllerAccountId: string
  controllerKeyPair: KeyPair
  derivedAccountId: string
  mpcPublicKey: string
  initialDepositYocto: bigint
}

export async function ensureDerivedAccountExists(
  params: EnsureDerivedAccountParams
): Promise<{ created: boolean }> {
  const {
    provider,
    controllerAccountId,
    controllerKeyPair,
    derivedAccountId,
    mpcPublicKey,
    initialDepositYocto,
  } = params

  // Check if derived account exists
  try {
    const acc = (await provider.query(`account/${derivedAccountId}`, '')) as any
    if (acc && typeof acc.amount === 'string') {
      return { created: false }
    }
  } catch (_) {
    // Not found -> continue to create
  }

  const controllerPubKey = controllerKeyPair.getPublicKey()
  const accessKey = (await provider.query(
    `access_key/${controllerAccountId}/${controllerPubKey.toString()}`,
    ''
  )) as any

  const recentBlockHash = baseDecode(accessKey.block_hash)
  const nextNonce = BigInt((accessKey.nonce ?? 0) + 1)

  const nearMpcPubKey = NearPublicKey.fromString(mpcPublicKey)

  const actions: NearAction[] = [
    new NearAction({ createAccount: new NearCreateAccount() }),
    new NearAction({ transfer: new NearTransfer({ deposit: initialDepositYocto }) }),
    new NearAction({
      addKey: new NearAddKey({
        publicKey: nearMpcPubKey,
        accessKey: new NearAccessKey({
          nonce: 0n,
          permission: new NearAccessKeyPermission({ fullAccess: new NearFullAccessPermission() }),
        }),
      }),
    }),
  ]

  const tx = new NearTransaction({
    signerId: controllerAccountId,
    publicKey: controllerPubKey,
    nonce: nextNonce,
    receiverId: derivedAccountId,
    actions,
    blockHash: recentBlockHash,
  })

  const encoded = nearEncodeTransaction(tx)
  const digest = createHash('sha256').update(encoded).digest()
  const sig = controllerKeyPair.sign(digest)

  const signedTx = new NearSignedTransaction({
    transaction: tx,
    signature: new NearSignature({ keyType: controllerPubKey.keyType, data: sig.signature }),
  })

  await provider.sendTransaction(signedTx)
  return { created: true }
}

 
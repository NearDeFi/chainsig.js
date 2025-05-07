import { CONTRACT_ADDRESSES, ROOT_PUBLIC_KEYS } from '@constants'
import type { NajPublicKey } from '@types'

export const getRootPublicKey = (
  contractAddress: string
): NajPublicKey | undefined => {
  const environment = Object.entries(CONTRACT_ADDRESSES).find(
    ([_, address]) => address.toLowerCase() === contractAddress.toLowerCase()
  )?.[0] as keyof typeof ROOT_PUBLIC_KEYS | undefined

  if (environment) {
    return ROOT_PUBLIC_KEYS[environment]
  }

  return undefined
}

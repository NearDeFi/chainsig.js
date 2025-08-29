import { type PublicClient, type TransactionRequest } from 'viem'

export interface EVMFeeProperties {
  gas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

export async function fetchEVMFeeProperties(
  client: PublicClient,
  transaction: TransactionRequest
): Promise<EVMFeeProperties> {
  const gasPromise = transaction.gas
    ? Promise.resolve(transaction.gas)
    : client.estimateGas(transaction)
  const feeDataPromise =
    transaction.maxFeePerGas && transaction.maxPriorityFeePerGas
      ? Promise.resolve({
          maxFeePerGas: transaction.maxFeePerGas,
          maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        })
      : client.estimateFeesPerGas()

  const [gas, feeData] = await Promise.all([gasPromise, feeDataPromise])

  const maxFeePerGas = feeData.maxFeePerGas ?? BigInt(10_000_000_000) // 10 gwei
  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas ?? BigInt(10_000_000_000) // 10 gwei

  return {
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  }
}

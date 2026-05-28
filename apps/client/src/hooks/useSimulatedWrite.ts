import { usePublicClient, useWriteContract, useAccount } from 'wagmi'

export function useSimulatedWrite() {
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const { address: account } = useAccount()

  const writeWithSimulate = async (config: {
    address: `0x${string}`
    abi: unknown
    functionName: string
    args?: readonly unknown[]
    value?: bigint
  }) => {
    const { request } = await publicClient!.simulateContract({
      ...config,
      account: account!,
    } as any)
    return writeContractAsync(request as any)
  }

  return { writeWithSimulate }
}

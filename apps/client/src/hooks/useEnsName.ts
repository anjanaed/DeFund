/**
 * F2 — ENS name resolution hook.
 * Resolves an Ethereum address to its ENS name using viem's getEnsName.
 * Falls back to shortened address if no ENS name is found.
 * Results are cached in-module to avoid redundant RPC calls.
 */
import { useEffect, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

// ENS is only on Ethereum mainnet
const ensClient = createPublicClient({ chain: mainnet, transport: http() })

const cache = new Map<string, string | null>()

export function useEnsName(address: string | undefined): string | null {
  const [name, setName] = useState<string | null>(() => {
    if (!address) return null
    return cache.get(address.toLowerCase()) ?? null
  })

  useEffect(() => {
    if (!address) return
    const key = address.toLowerCase()
    if (cache.has(key)) {
      setName(cache.get(key) ?? null)
      return
    }
    ensClient.getEnsName({ address: address as `0x${string}` })
      .then((n) => {
        cache.set(key, n ?? null)
        setName(n ?? null)
      })
      .catch(() => {
        cache.set(key, null)
        setName(null)
      })
  }, [address])

  return name
}

/**
 * Synchronous helper: return ENS name from cache if available,
 * otherwise return the shortened address.
 */
export function displayAddress(address: string, ensName: string | null): string {
  if (ensName) return ensName
  if (!address) return '—'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

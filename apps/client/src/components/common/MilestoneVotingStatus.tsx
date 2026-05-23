import { useState, useEffect } from 'react'
import { useReadContract, useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../../config/contracts'

interface Props {
  milestoneOnChainId: number
  paymentToken?: string
}

const MIN_QUORUM_PERCENTAGE = 30n

function formatCountdown(endTimeSec: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (endTimeSec <= now) return 'Voting ended'
  const diff = Number(endTimeSec - now)
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

export default function MilestoneVotingStatus({ milestoneOnChainId, paymentToken = 'ETH' }: Props) {
  const { address } = useAccount()
  const [, setTick] = useState(0)

  // Re-render every 30s so countdown stays accurate
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const { data: milestoneData } = useReadContract({
    address: CAMPAIGN_FACTORY_ADDRESS,
    abi: CAMPAIGN_FACTORY_ABI,
    functionName: 'milestones',
    args: [BigInt(milestoneOnChainId)],
  })

  const { data: hasVoted } = useReadContract({
    address: CAMPAIGN_FACTORY_ADDRESS,
    abi: CAMPAIGN_FACTORY_ABI,
    functionName: 'hasVoted',
    args: address ? [BigInt(milestoneOnChainId), address] : undefined,
    query: { enabled: !!address },
  })

  if (!milestoneData) return null

  const m = milestoneData as unknown as readonly [
    bigint, bigint, string, bigint, bigint, number,
    bigint, bigint, bigint, boolean, bigint, number,
  ]
  const votesFor = m[6]
  const votesAgainst = m[7]
  const votingEndTime = m[8]
  const raisedAtStart = m[10]

  const decimals = paymentToken === 'USDC' ? 6 : 18
  const quorumRequired = (raisedAtStart * MIN_QUORUM_PERCENTAGE) / 100n
  const totalVotes = votesFor + votesAgainst
  const quorumPct = quorumRequired === 0n ? 0 : Math.min(100, Number((totalVotes * 100n) / quorumRequired))
  const forPct = totalVotes === 0n ? 0 : Number((votesFor * 100n) / totalVotes)

  const fmt = (v: bigint) => Number(formatUnits(v, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })

  return (
    <div style={{
      marginTop: 12, padding: 12, borderRadius: 8,
      background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 600 }}>
        <span>Live voting status</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{formatCountdown(votingEndTime)}</span>
      </div>

      <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
        Approval: {fmt(votesFor)} for / {fmt(votesAgainst)} against {paymentToken}
      </div>
      <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${forPct}%`, height: '100%', background: 'var(--color-success, #22c55e)' }} />
      </div>

      <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
        Quorum: {fmt(totalVotes)} / {fmt(quorumRequired)} {paymentToken} ({quorumPct}%)
      </div>
      <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${quorumPct}%`, height: '100%', background: quorumPct >= 100 ? 'var(--color-success, #22c55e)' : 'var(--color-primary)' }} />
      </div>

      {address && (
        <div style={{ marginTop: 10, fontSize: 12, color: hasVoted ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
          {hasVoted ? '✓ You have voted' : 'You have not voted yet'}
        </div>
      )}
    </div>
  )
}

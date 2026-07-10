import { useState, useEffect } from 'react'
import { useReadContract, useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { HiCheckCircle } from 'react-icons/hi2'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../../config/contracts'

interface Props {
  milestoneOnChainId: number
  campaignOnChainId?: number | null
  paymentToken?: string
}

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

export default function MilestoneVotingStatus({ milestoneOnChainId, campaignOnChainId, paymentToken = 'ETH' }: Props) {
  const { address } = useAccount()
  const [, setTick] = useState(0)

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

  const { data: contributorAmount } = useReadContract({
    address: CAMPAIGN_FACTORY_ADDRESS,
    abi: CAMPAIGN_FACTORY_ABI,
    functionName: 'getContributorAmount',
    args: address && campaignOnChainId != null ? [BigInt(campaignOnChainId), address] : undefined,
    query: { enabled: !!address && campaignOnChainId != null },
  })

  if (!milestoneData) return null

  const m = milestoneData as unknown as readonly [
    bigint, bigint, string, bigint, bigint, number,
    bigint, bigint, bigint, boolean, bigint, number,
  ]
  const votesFor     = m[6]
  const votesAgainst = m[7]
  const votingEndTime = m[8]
  const raisedAtStart = m[10]

  const decimals = paymentToken === 'USDC' ? 6 : 18
  const totalVotes = votesFor + votesAgainst
  const forPct     = totalVotes === 0n ? 0 : Math.round(Number((votesFor * 100n) / totalVotes))
  const againstPct = 100 - forPct

  const fmt = (v: bigint) =>
    Number(formatUnits(v, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })

  const isEnded = BigInt(Math.floor(Date.now() / 1000)) >= votingEndTime

  return (
    <div style={{
      marginTop: 14,
      padding: '14px 16px',
      borderRadius: 10,
      background: 'var(--color-bg-subtle)',
      border: '1px solid var(--color-border)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
          Live Votes
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: isEnded ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
          background: isEnded ? 'var(--color-bg-card)' : 'rgba(99,102,241,0.08)',
          border: `1px solid ${isEnded ? 'var(--color-border)' : 'rgba(99,102,241,0.2)'}`,
          borderRadius: 20, padding: '2px 10px',
        }}>
          {formatCountdown(votingEndTime)}
        </span>
      </div>

      {/* Approval bar */}
      {totalVotes === 0n ? (
        <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
          No votes cast yet
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            <span style={{ color: '#16a34a' }}>For {forPct}%</span>
            <span style={{ color: 'var(--color-error)' }}>{againstPct}% Against</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(239,68,68,0.15)', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${forPct}%`,
              background: forPct > 50 ? '#22c55e' : '#f59e0b',
              borderRadius: 4,
              transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
            <span>{fmt(votesFor)} {paymentToken}</span>
            <span>{fmt(votesAgainst)} {paymentToken}</span>
          </div>
        </div>
      )}

      {/* Voted status */}
      {address && hasVoted !== undefined && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-border)',
          fontSize: 12, fontWeight: 600,
          color: hasVoted ? '#16a34a' : 'var(--color-text-tertiary)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {hasVoted ? <><HiCheckCircle size={13} /> You have voted</> : '- You have not voted yet'}
        </div>
      )}

      {/* Voting power */}
      {address && contributorAmount != null && (contributorAmount as bigint) > 0n && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 8, paddingTop: 8,
          borderTop: '1px solid var(--color-border)',
          fontSize: 12,
        }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Your voting power</span>
          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {fmt(contributorAmount as bigint)} {paymentToken}
            {raisedAtStart > 0n && (
              <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)', marginLeft: 4 }}>
                ({Math.round(Number(((contributorAmount as bigint) * 100n) / raisedAtStart))}%)
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

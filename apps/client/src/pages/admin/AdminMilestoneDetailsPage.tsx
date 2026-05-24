import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWriteContract } from 'wagmi'
import { HiArrowLeft, HiClock, HiDocumentText, HiCurrencyDollar, HiCheckCircle, HiXCircle } from 'react-icons/hi2'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../../config/contracts'
import { apiFetch } from '../../lib/api'
import LoadingScreen from '../../components/common/LoadingScreen'
import '../../Admin.css'

export default function AdminMilestoneDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { writeContractAsync } = useWriteContract()

  const [milestone, setMilestone] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [finalizeStatus, setFinalizeStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [finalizeMessage, setFinalizeMessage] = useState('')
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [notifyMessage, setNotifyMessage] = useState('')

  useEffect(() => {
    apiFetch(`/admin/milestones/${id}`)
      .then((r) => r.json())
      .then((data) => setMilestone(data))
      .catch(() => setFinalizeMessage('Failed to load milestone'))
      .finally(() => setLoading(false))
  }, [id])

  const handleNotifyRelease = async () => {
    setNotifyStatus('pending')
    setNotifyMessage('')
    try {
      const res = await apiFetch(`/admin/milestones/${id}/notify-release`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Notification failed')
      }
      const data = await res.json()
      setNotifyStatus('success')
      setNotifyMessage(data.message || 'Creator notified.')
    } catch (err: any) {
      setNotifyStatus('error')
      setNotifyMessage(err.message || 'Failed to send notification')
    }
  }

  const handleFinalizeVoting = async () => {
    if (!milestone?.onChainId) {
      setFinalizeMessage('Milestone has no on-chain ID')
      setFinalizeStatus('error')
      return
    }
    setFinalizeStatus('pending')
    setFinalizeMessage('')
    try {
      await writeContractAsync({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'finalizeMilestoneVoting',
        args: [BigInt(milestone.onChainId)],
      })
      setFinalizeStatus('success')
      setFinalizeMessage('Voting finalized on-chain. Refreshing in a few seconds…')
      // Reload from API so the actual vote result (APPROVED or REJECTED) is shown
      setTimeout(() => {
        apiFetch(`/admin/milestones/${id}`)
          .then((r) => r.json())
          .then((data) => {
            setMilestone(data)
            setFinalizeMessage(`Voting finalized — milestone is now ${data.status}.`)
          })
          .catch(() => setFinalizeMessage('Voting finalized. Refresh the page to see the updated status.'))
      }, 5000)
    } catch (err: any) {
      setFinalizeStatus('error')
      setFinalizeMessage(err.shortMessage || err.message || 'Transaction failed')
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading milestone" />
  }

  if (!milestone) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-error)' }}>Milestone not found.</div>
  }

  const isVoting = milestone.status === 'VOTING'
  const votingExpired = isVoting && milestone.votingEndTime && new Date(milestone.votingEndTime) < new Date()

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/admin/milestones')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
        >
          <HiArrowLeft /> Back to Milestones
        </button>
      </div>

      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1 className="admin-page-title" style={{ marginBottom: '8px' }}>{milestone.campaign?.title || 'Campaign'}</h1>
          <p className="admin-page-subtitle">Milestone Oversight • ID: #{id}</p>
        </div>
      </div>

      {finalizeMessage && (
        <div style={{
          padding: '10px 14px', borderRadius: '6px', marginBottom: '24px', fontSize: '14px',
          background: finalizeStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${finalizeStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          color: finalizeStatus === 'error' ? 'var(--color-error)' : '#15803d',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {finalizeStatus === 'error' ? <HiXCircle /> : <HiCheckCircle />} {finalizeMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '32px' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          <div className="admin-table-card" style={{ padding: '24px', borderLeft: `4px solid ${isVoting ? '#f59e0b' : milestone.status === 'COMPLETED' || milestone.status === 'APPROVED' ? 'var(--color-success)' : 'var(--color-border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Milestone</span>
              <span className={`admin-badge ${milestone.status === 'COMPLETED' ? 'success' : milestone.status === 'APPROVED' ? 'success' : isVoting ? 'warning' : 'neutral'}`}>
                {milestone.status}
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--color-text-primary)' }}>{milestone.title}</h2>
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>{milestone.description || '—'}</p>

            <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              {milestone.deadline && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HiClock /> Due: {new Date(milestone.deadline).toLocaleDateString()}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HiCurrencyDollar /> Value: {milestone.amount?.toLocaleString()} {milestone.campaign?.paymentToken || ''}
              </div>
              {milestone.votingEndTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: votingExpired ? 'var(--color-error)' : 'inherit' }}>
                  <HiClock /> Voting ends: {new Date(milestone.votingEndTime).toLocaleDateString()}
                  {votingExpired && ' (expired)'}
                </div>
              )}
            </div>

            {milestone.proofUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 12px', background: 'var(--color-bg-subtle)', borderRadius: '6px', border: '1px solid var(--color-border)', marginTop: '16px' }}>
                <HiDocumentText color="var(--color-primary)" size={16} />
                <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>Proof:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>{milestone.proofUrl}</span>
              </div>
            )}
          </div>

          {milestone.votes && milestone.votes.length > 0 && (
            <div className="admin-table-card">
              <div className="admin-table-header">
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--color-text-primary)' }}>Votes</h3>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Voter</th>
                    <th>Choice</th>
                  </tr>
                </thead>
                <tbody>
                  {milestone.votes.map((v: any) => (
                    <tr key={v.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {v.voter?.walletAddress?.slice(0, 8)}...{v.voter?.walletAddress?.slice(-4)}
                      </td>
                      <td>
                        <span className={`admin-badge ${v.choice ? 'success' : 'error'}`}>
                          {v.choice ? 'Approve' : 'Reject'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Actions</h3>

            {isVoting && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', lineHeight: '1.5' }}>
                  {votingExpired
                    ? 'Voting period has ended. Finalize to record the result on-chain.'
                    : 'Voting is still in progress. You can finalize early if needed.'}
                </p>
                <button
                  className="btn"
                  onClick={handleFinalizeVoting}
                  disabled={finalizeStatus === 'pending' || finalizeStatus === 'success'}
                  style={{
                    width: '100%', padding: '10px', fontSize: '14px',
                    background: 'var(--color-primary)', border: 'none', color: 'white',
                    borderRadius: '6px', fontWeight: '600',
                    opacity: (finalizeStatus === 'pending' || finalizeStatus === 'success') ? 0.5 : 1,
                    cursor: (finalizeStatus === 'pending' || finalizeStatus === 'success') ? 'not-allowed' : 'pointer',
                  }}
                >
                  {finalizeStatus === 'pending' ? 'Signing...' : finalizeStatus === 'success' ? 'Finalized ✓' : 'Finalize Voting'}
                </button>
              </div>
            )}

            {milestone.status === 'APPROVED' && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', lineHeight: '1.5' }}>
                  Voting passed. Notify the creator that they may release these funds on-chain.
                </p>
                <button
                  className="btn"
                  onClick={handleNotifyRelease}
                  disabled={notifyStatus === 'pending' || notifyStatus === 'success'}
                  style={{
                    width: '100%', padding: '10px', fontSize: '14px',
                    background: 'var(--color-success)', border: 'none', color: 'white',
                    borderRadius: '6px', fontWeight: '600',
                    opacity: (notifyStatus === 'pending' || notifyStatus === 'success') ? 0.6 : 1,
                    cursor: (notifyStatus === 'pending' || notifyStatus === 'success') ? 'not-allowed' : 'pointer',
                  }}
                >
                  {notifyStatus === 'pending' ? 'Sending…' : notifyStatus === 'success' ? 'Notified ✓' : 'Notify Creator'}
                </button>
                {notifyMessage && (
                  <p style={{
                    fontSize: '12px', marginTop: '8px',
                    color: notifyStatus === 'error' ? 'var(--color-error)' : 'var(--color-text-secondary)',
                  }}>
                    {notifyMessage}
                  </p>
                )}
              </div>
            )}

            {!isVoting && milestone.status !== 'APPROVED' && (
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                No actions available — milestone is {milestone.status.toLowerCase()}.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

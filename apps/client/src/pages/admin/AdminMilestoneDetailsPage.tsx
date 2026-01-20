import { useParams, useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiClock, HiDocumentText, HiCurrencyDollar } from 'react-icons/hi2'
import '../../Admin.css'

export default function AdminMilestoneDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()


  const project = {
    id,
    name: 'DeFi Protocol X',
    status: 'Active',
    totalFunding: '150,000',
    releasedFunding: '30,000',
    currentMilestoneIndex: 1, // 0-indexed
    milestones: [
      {
        id: 1,
        title: 'Smart Contract Development',
        amount: '30,000',
        deadline: '2026-01-01',
        status: 'Completed',
        description: 'Development and internal testing of core lending pools and staking contracts.',
        deliverables: ['Smart Contracts v1', 'Unit Tests', 'Testnet Deployment'],
        proof: { type: 'Github Repo', url: 'https://github.com/...' },
        votes: { yes: 95, no: 5, total: 120 },
        completedDate: '2025-12-28'
      },
      {
        id: 2,
        title: 'Frontend Development & Integration',
        amount: '25,000',
        deadline: '2026-02-15',
        status: 'In Progress', // 'Submitted' | 'In Progress' | 'Voting'
        description: 'Complete UI implementation and Web3 integration using React and Wagmi.',
        deliverables: ['Responsive Web App', 'Wagmi Wallet Connect', 'User Dashboard'],
        progress: 65,
        votes: { yes: 65, no: 35, total: 80 },
        proof: null
      },
      {
        id: 3,
        title: 'Security Audit & Mainnet Launch',
        amount: '95,000',
        deadline: '2026-04-01',
        status: 'Pending',
        description: 'Third party audit and final deployment.',
        deliverables: ['Audit PDF', 'Mainnet Contract Address', 'Liquidity Locking'],
        votes: null,
        proof: null
      }
    ]
  }

  const currentMilestone = project.milestones[project.currentMilestoneIndex]

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
          <h1 className="admin-page-title" style={{ marginBottom: '8px' }}>{project.name}</h1>
          <p className="admin-page-subtitle">Milestone Oversight & Fund Release • ID: #{id}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
           <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>FUNDS RELEASED</div>
           <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-primary)' }}>${project.releasedFunding} <span style={{ fontSize: '16px', color: 'var(--color-text-tertiary)', fontWeight: '400' }}>/ ${project.totalFunding}</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '32px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
           {/* Current Milestone Highlight */}
           <div className="admin-table-card" style={{ padding: '24px', borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Milestone</span>
                <span className="admin-badge warning">In Progress</span>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--color-text-primary)' }}>{currentMilestone.title}</h2>
              <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>{currentMilestone.description}</p>
              {currentMilestone.deliverables && (
                 <div style={{ marginBottom: '24px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>Sprint Deliverables:</span> {currentMilestone.deliverables.join(', ')}
                 </div>
              )}
              
              <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <HiClock /> Due: {currentMilestone.deadline}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <HiCurrencyDollar /> Value: ${currentMilestone.amount}
                </div>
              </div>
           </div>

           {/* All Milestones List */}
           <div className="admin-table-card">
              <div className="admin-table-header">
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--color-text-primary)' }}>Milestone History</h3>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th style={{ width: '40%' }}>Milestone Details</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Poll Status</th>
                    <th>Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {project.milestones.map((m) => (
                    <tr key={m.id} style={{ opacity: m.status === 'Pending' ? 0.6 : 1 }}>
                      <td style={{ verticalAlign: 'top' }}>{m.id}</td>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '4px' }}>{m.title}</div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px', lineHeight: '1.4' }}>{m.description}</div>
                        {m.deliverables && (
                           <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                              <span style={{ fontWeight: '500' }}>Deliverables:</span> {m.deliverables.join(', ')}
                           </div>
                        )}
                      </td>
                      <td style={{ verticalAlign: 'top' }}>{m.deadline}</td>
                      <td style={{ verticalAlign: 'top' }}>
                        <span className={`admin-badge ${m.status === 'Completed' ? 'success' : m.status === 'In Progress' ? 'warning' : 'neutral'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ width: '200px', verticalAlign: 'top' }}>
                        {m.votes ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                             <div className="admin-progress" style={{ height: '6px', background: 'var(--color-border)' }}>
                               <div className="admin-progress-bar" style={{ width: `${m.votes.yes}%`, background: 'var(--color-success)' }} />
                             </div>
                             <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                               <span>{m.votes.yes}% Yes</span>
                               <span>{m.votes.total} Votes</span>
                             </div>
                          </div>
                        ) : <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>-</span>}
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        {m.proof ? (
                           <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                             <HiDocumentText color="var(--color-primary)" />
                             <a href={m.proof.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '500' }}>
                               {m.proof.type}
                             </a>
                           </div>
                        ) : <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>No proof</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="admin-table-card" style={{ padding: '24px' }}>
             <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Actions</h3>
             <button className="btn" style={{ width: '100%', marginBottom: '8px', padding: '10px', background: 'white', border: '1px solid #3B82F6', color: '#3B82F6', borderRadius: '6px', fontWeight: '600' }}>Flag Project</button>
             <button className="btn" style={{ width: '100%', padding: '10px', background: 'white', border: '1px solid var(--color-error)', color: 'var(--color-error)', borderRadius: '6px', fontWeight: '600' }}>Block Project</button>
          </div>

        </div>

      </div>
    </div>
  )
}

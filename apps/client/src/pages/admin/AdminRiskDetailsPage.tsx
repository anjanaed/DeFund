import { useParams, useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiShieldCheck, HiCurrencyDollar, HiCheckCircle, HiXCircle, HiGlobeAlt, HiDocumentText } from 'react-icons/hi2'
import { FaGithub, FaTwitter, FaDiscord } from 'react-icons/fa6'
import '../../Admin.css'

export default function AdminRiskDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()


  const project = {
    id,
    name: 'DeFi Protocol X',
    status: 'Active',
    totalRaised: '150.0 ETH',
    currentBalance: '104.8 ETH',
    description: 'A decentralized lending platform that allows users to lend and borrow cryptocurrencies with minimal fees and maximum security. Our protocol leverages cutting-edge smart contract technology to ensure trustless execution.',
    milestones: [
        { 
          title: 'Smart Contract Development', 
          status: 'Completed',
          amount: '50.0 ETH',
          deadline: '2025-12-01',
          description: 'Development and internal testing of core lending pools and staking contracts.',
          proof: { type: 'GitHub Release v0.1', url: '#' }
        },
        { 
          title: 'Beta Launch', 
          status: 'In Progress',
          amount: '40.0 ETH',
          deadline: '2026-02-15',
          description: 'Public beta release on testnet with bug bounty program.',
          proof: null
        },
        { 
          title: 'Mainnet Deployment', 
          status: 'Pending',
          amount: '60.0 ETH',
          deadline: '2026-05-01',
          description: 'Full mainnet launch and liquidity mining kickoff.',
          proof: null
        }
    ],
    links: {
      website: true,
      github: true,
      twitter: true,
      discord: false
    },
    recentTransactions: [
      { id: 'tx-123', date: '2026-01-18 14:30', type: 'Milestone Release', amount: '-20.0 ETH', to: '0x8...93a', status: 'Completed' },
      { id: 'tx-124', date: '2026-01-15 09:15', type: 'Contribution', amount: '+3.0 ETH', from: 'Contract', status: 'Completed' },
      { id: 'tx-125', date: '2026-01-10 11:20', type: 'Contribution', amount: '+5.5 ETH', from: '0x1...b2c', status: 'Completed' }
    ]
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button 
          onClick={() => navigate('/admin/risk')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
        >
          <HiArrowLeft /> Back to Project Monitoring
        </button>
      </div>

      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 className="admin-page-title" style={{ marginBottom: 0 }}>{project.name}</h1>
            <span className={`admin-badge ${project.status === 'Active' ? 'success' : project.status === 'Flagged' ? 'warning' : 'error'}`}>
              {project.status.toUpperCase()}
            </span>
          </div>
          <p className="admin-page-subtitle">Project Details • ID: #{id}</p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34D399' }}><HiCurrencyDollar /></div>
          <div>
            <div className="admin-stat-label">Total Raised</div>
            <div className="admin-stat-value">{project.totalRaised}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}><HiShieldCheck /></div>
          <div>
            <div className="admin-stat-label">Current Balance</div>
            <div className="admin-stat-value">{project.currentBalance}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
           {/* Description */}
           <div className="admin-table-card" style={{ padding: '24px' }}>
             <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Description</h3>
             <p style={{ lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>{project.description}</p>
           </div>

           {/* Milestones Summary */}
           <div className="admin-table-card" style={{ padding: '24px' }}>
             <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Milestones</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {project.milestones.map((m, idx) => (
                    <div key={idx} style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--color-text-primary)' }}>{m.title}</span>
                            <span className={`admin-badge ${m.status === 'Completed' ? 'success' : m.status === 'In Progress' ? 'warning' : 'neutral'}`}>{m.status}</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>{m.description}</p>
                        <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: m.proof ? '12px' : '0' }}>
                             <div>Amount: <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{m.amount}</span></div>
                             <div>Due: <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{m.deadline}</span></div>
                        </div>
                        {m.proof && (
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px', background: 'white', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                              <HiDocumentText color="var(--color-primary)" size={16} />
                              <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>Proof of Work:</span>
                              <a href={m.proof.url} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '500' }}>{m.proof.type}</a>
                           </div>
                        )}
                    </div>
                ))}
             </div>
           </div>

          {/* Recent Transactions */}
          <div className="admin-table-card">
             <div className="admin-table-header">
               <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--color-text-primary)' }}>Recent Financial Activity</h3>
             </div>
             <table className="admin-table">
               <thead>
                 <tr>
                   <th>Type</th>
                   <th>Amount</th>
                   <th>Date</th>
                   <th>Status</th>
                 </tr>
               </thead>
               <tbody>
                 {project.recentTransactions.map((tx) => (
                   <tr key={tx.id}>
                     <td>{tx.type}</td>
                     <td style={{ color: tx.amount.startsWith('+') ? 'var(--color-success)' : 'var(--color-text-primary)', fontWeight: '600' }}>{tx.amount}</td>
                     <td>{tx.date}</td>
                     <td><span className="admin-badge success">{tx.status}</span></td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>

        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Verification Status */}
          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', color: 'var(--color-text-primary)' }}>Verification Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <HiGlobeAlt color="var(--color-text-secondary)" /> Website
                </div>
                {project.links.website ? (
                  <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCheckCircle /> Verified</span>
                ) : <span className="admin-badge error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiXCircle /> Unverified</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <FaGithub color="var(--color-text-secondary)" /> GitHub
                </div>
                {project.links.github ? (
                  <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCheckCircle /> Verified</span>
                ) : <span className="admin-badge error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiXCircle /> Unverified</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <FaTwitter color="var(--color-text-secondary)" /> Twitter/X
                </div>
                {project.links.twitter ? (
                  <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCheckCircle /> Verified</span>
                ) : <span className="admin-badge error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiXCircle /> Unverified</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <FaDiscord color="var(--color-text-secondary)" /> Discord
                </div>
                {project.links.discord ? (
                  <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCheckCircle /> Verified</span>
                ) : <span className="admin-badge neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiXCircle /> Missing</span>}
              </div>
            </div>
          </div>
          
          {/* Admin Actions */}
          <div className="admin-table-card" style={{ padding: '24px', background: 'var(--color-bg-subtle)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Admin Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn" style={{ width: '100%', padding: '10px', fontSize: '14px', background: 'white', border: '1px solid var(--color-border)', borderRadius: '6px', fontWeight: '500' }}>
                Download Audit Report
              </button>
              <button className="btn" style={{ width: '100%', padding: '10px', fontSize: '14px', background: 'white', border: '1px solid #3B82F6', color: '#3B82F6', borderRadius: '6px', fontWeight: '600' }}>
                Flag Project
              </button>
              <button className="btn" style={{ width: '100%', padding: '10px', fontSize: '14px', background: 'white', border: '1px solid var(--color-error)', color: 'var(--color-error)', borderRadius: '6px', fontWeight: '600' }}>
                Block Project
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

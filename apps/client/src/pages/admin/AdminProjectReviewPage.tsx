import { useParams, useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiCheckCircle, HiXCircle, HiGlobeAlt, HiCodeBracket, HiDocumentText, HiCurrencyDollar } from 'react-icons/hi2'
import { FaTwitter, FaDiscord, FaGithub } from 'react-icons/fa6'
import '../../Admin.css'

export default function AdminProjectReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()


  const project = {
    id,
    name: 'DeFi Protocol X',
    category: 'DeFi',
    submitted: '2026-01-14',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    email: 'contact@defiprotocolx.io',
    description: 'A decentralized lending platform that allows users to lend and borrow cryptocurrencies with minimal fees and maximum security. Our protocol leverages cutting-edge smart contract technology.',
    links: {
      website: { url: 'https://defiprotocolx.io', verified: true },
      github: { url: 'https://github.com/defiprotocolx', verified: true },
      twitter: { url: 'https://x.com/defiprotocolx', verified: true },
      discord: { url: 'https://discord.gg/defiprotocolx', verified: false }
    },
    milestones: [
      { number: 1, title: 'Smart Contract Development', amount: '30,000', description: 'Complete core smart contract architecture and security audits.' },
      { number: 2, title: 'Frontend Development', amount: '25,000', description: 'Build user interface and integrate with smart contracts.' },
      { number: 3, title: 'Security Audit & Launch', amount: '45,000', description: 'Complete third-party security audit and mainnet deployment.' }
    ],
    documents: [
      { name: 'Whitepaper.pdf', size: '2.4 MB' },
      { name: 'Pitch_Deck.pdf', size: '5.1 MB' },
      { name: 'Legal_Opinion.pdf', size: '1.2 MB' }
    ]
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button 
          onClick={() => navigate('/admin/verification')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
        >
          <HiArrowLeft /> Back to Queue
        </button>
      </div>

      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 className="admin-page-title" style={{ marginBottom: 0 }}>{project.name}</h1>
            <span className="admin-badge warning">Pending Review</span>
          </div>
          <p className="admin-page-subtitle">Submitted on {project.submitted} • ID: #{id}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button className="btn" style={{ background: 'white', border: '1px solid var(--color-error)', color: 'var(--color-error)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600' }}>
             Reject Application
           </button>
           <button className="btn" style={{ background: 'var(--color-success)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '600' }}>
             Approve Project
           </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        {/* Main Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Overview */}
          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Project Overview</h3>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Description</label>
              <p style={{ lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>{project.description}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Category</label>
                <div style={{ fontWeight: '500' }}>{project.category}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Creator Wallet</label>
                <div style={{ fontFamily: 'monospace', background: 'var(--color-bg-subtle)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', fontSize: '13px' }}>{project.walletAddress}</div>
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Proposed Milestones</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {project.milestones.map((milestone) => (
                <div key={milestone.number} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontWeight: '600' }}>{milestone.number}. {milestone.title}</div>
                    <div style={{ fontWeight: '700', color: 'var(--color-primary)' }}>${milestone.amount}</div>
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{milestone.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Verification Status */}
          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', color: 'var(--color-text-primary)' }}>Verification Status</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <HiGlobeAlt color="var(--color-text-secondary)" /> Website
                </div>
                {project.links.website.verified ? (
                  <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCheckCircle /> Verified</span>
                ) : <span className="admin-badge error">Unverified</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <FaGithub color="var(--color-text-secondary)" /> GitHub
                </div>
                {project.links.github.verified ? (
                  <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCheckCircle /> Verified</span>
                ) : <span className="admin-badge error">Unverified</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <FaTwitter color="var(--color-text-secondary)" /> Twitter/X
                </div>
                {project.links.twitter.verified ? (
                  <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCheckCircle /> Verified</span>
                ) : <span className="admin-badge error">Unverified</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <FaDiscord color="var(--color-text-secondary)" /> Discord
                </div>
                {project.links.discord.verified ? (
                  <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCheckCircle /> Verified</span>
                ) : <span className="admin-badge neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiXCircle /> Missing</span>}
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="admin-table-card" style={{ padding: '24px' }}>
             <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Submitted Documents</h3>
             <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {project.documents.map((doc, idx) => (
                 <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', background: 'var(--color-bg-subtle)', borderRadius: '6px', fontSize: '13px' }}>
                   <HiDocumentText size={20} color="var(--color-text-secondary)" />
                   <div style={{ flex: 1 }}>
                     <div style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{doc.name}</div>
                     <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>{doc.size}</div>
                   </div>
                   <button style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>View</button>
                 </li>
               ))}
             </ul>
          </div>

        </div>
      </div>
    </div>
  )
}

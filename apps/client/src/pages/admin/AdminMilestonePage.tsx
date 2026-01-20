import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiMagnifyingGlass } from 'react-icons/hi2'
import '../../Admin.css'

export default function AdminMilestonePage() {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const itemsPerPage = 10

  const milestones = [
    { id: 1, project: 'DeFi Protocol X', milestone: 'Smart Contract Audit', deadline: '2026-01-20', daysRemaining: '3 days remaining', votes: { approval: 86, total: 168 }, status: 'Pending' },
    { id: 2, project: 'NFT Marketplace Builder', milestone: 'Beta Launch', deadline: '2026-01-10', daysRemaining: 'Overdue', isOverdue: true, votes: { approval: 57, total: 156 }, status: 'Rejected' },
    { id: 3, project: 'DAO Governance Tool', milestone: 'UI/UX Design Complete', deadline: '2026-01-25', daysRemaining: '8 days remaining', votes: { approval: 95, total: 246 }, status: 'Approved' },
    { id: 4, project: 'Crypto Payment Gateway', milestone: 'API Integration', deadline: '2026-01-08', daysRemaining: 'Overdue', isOverdue: true, votes: { approval: 39, total: 145 }, status: 'Rejected' },
    { id: 5, project: 'Web3 Gaming Platform', milestone: 'Prototype Demo', deadline: '2026-01-30', daysRemaining: '13 days remaining', votes: { approval: 84, total: 212 }, status: 'Pending' },
    { id: 6, project: 'Social Graph Protocol', milestone: 'Graph Indexer', deadline: '2026-02-05', daysRemaining: '19 days remaining', votes: { approval: 92, total: 310 }, status: 'Approved' },
    { id: 7, project: 'Zero Knowledge Layer', milestone: 'Prover Service', deadline: '2026-01-15', daysRemaining: '2 days overdue', isOverdue: true, votes: { approval: 45, total: 89 }, status: 'Pending' },
    { id: 8, project: 'Decentralized Identity', milestone: 'Wallet Integration', deadline: '2026-02-12', daysRemaining: '26 days remaining', votes: { approval: 78, total: 150 }, status: 'Approved' },
    { id: 9, project: 'Cross-Chain Bridge', milestone: 'Relayer Network', deadline: '2026-01-28', daysRemaining: '11 days remaining', votes: { approval: 65, total: 420 }, status: 'Pending' },
    { id: 10, project: 'Music NFT Platform', milestone: 'Artist Dashboard', deadline: '2026-02-01', daysRemaining: '15 days remaining', votes: { approval: 88, total: 200 }, status: 'Approved' },
    { id: 11, project: 'DeFi Options Component', milestone: 'Pricing Oracle', deadline: '2026-01-18', daysRemaining: '1 day remaining', votes: { approval: 99, total: 180 }, status: 'Pending' },
    { id: 12, project: 'Metaverse Land', milestone: '3D Engine Update', deadline: '2026-01-05', daysRemaining: 'Overdue', isOverdue: true, votes: { approval: 30, total: 95 }, status: 'Rejected' },
    { id: 13, project: 'Prediction Market', milestone: 'Market Resolution', deadline: '2026-02-20', daysRemaining: '34 days remaining', votes: { approval: 91, total: 250 }, status: 'Approved' },
    { id: 14, project: 'Carbon Credit DAO', milestone: 'Token Launch', deadline: '2026-03-01', daysRemaining: '43 days remaining', votes: { approval: 82, total: 110 }, status: 'Pending' },
    { id: 15, project: 'AI Model Marketplace', milestone: 'Inference Node', deadline: '2026-01-22', daysRemaining: '5 days remaining', votes: { approval: 76, total: 300 }, status: 'Approved' },
    { id: 16, project: 'Supply Chain Track', milestone: 'QR Scanning App', deadline: '2026-01-12', daysRemaining: '5 days overdue', isOverdue: true, votes: { approval: 55, total: 130 }, status: 'Rejected' },
    { id: 17, project: 'EduTech Platform', milestone: 'Course Creator', deadline: '2026-02-10', daysRemaining: '24 days remaining', votes: { approval: 90, total: 190 }, status: 'Approved' },
    { id: 18, project: 'Legal Tech Contract', milestone: 'PDF Generator', deadline: '2026-01-29', daysRemaining: '12 days remaining', votes: { approval: 68, total: 140 }, status: 'Pending' },
    { id: 19, project: 'Sports Betting DEX', milestone: 'Odds Feed', deadline: '2026-02-08', daysRemaining: '22 days remaining', votes: { approval: 85, total: 280 }, status: 'Approved' },
    { id: 20, project: 'Charity Fund', milestone: 'Donation Widget', deadline: '2026-01-26', daysRemaining: '9 days remaining', votes: { approval: 96, total: 350 }, status: 'Pending' }
  ]

  const filteredMilestones = milestones.filter(item => {
    const matchesSearch = item.project.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.milestone.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredMilestones.length / itemsPerPage)
  const paginatedMilestones = filteredMilestones.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Milestone Oversight</h1>
        <p className="admin-page-subtitle">Review and manage milestone proof submissions</p>
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
        <button className="btn" style={{ background: 'white', padding: '8px 16px', borderRadius: '20px', fontWeight: '600', fontSize: '14px', border: '1px solid var(--color-border)' }}>Timeline Tracking</button>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-header" style={{ justifyContent: 'flex-end', gap: '16px' }}>
          <div className="admin-search">
            <HiMagnifyingGlass color="var(--color-text-tertiary)" />
            <input 
              type="text" 
              placeholder="Search milestones..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <select 
            value={statusFilter} 
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1) // Reset to page 1
            }}
            style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '14px', cursor: 'pointer', outline: 'none' }}
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Project / Milestone</th>
              <th>Deadline</th>
              <th>Community Vote</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMilestones.map((item) => (
              <tr 
                key={item.id}
                onClick={() => navigate(`/admin/milestones/${item.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <div style={{ fontWeight: '600', marginBottom: '2px' }}>{item.project}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.milestone}</div>
                </td>
                <td>
                  <div>{item.deadline}</div>
                  <div style={{ fontSize: '11px', color: item.isOverdue ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>{item.daysRemaining}</div>
                </td>
                <td style={{ width: '250px' }}>
                  <div className="admin-progress" style={{ width: '100%', marginBottom: '4px' }}>
                    <div className="admin-progress-bar" style={{ width: `${item.votes.approval}%` }} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {item.votes.approval}% approval ({item.votes.total} votes)
                  </div>
                </td>
                <td>
                  <span className={`admin-badge ${
                    item.status === 'Approved' ? 'success' :
                    item.status === 'Pending' ? 'warning' : 'error'
                  }`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Pagination UI */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Showing {paginatedMilestones.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredMilestones.length)} of {filteredMilestones.length} milestones
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn" 
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white', color: currentPage === 1 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }} 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              Previous
            </button>
            <button 
              className="btn" 
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white', color: currentPage === totalPages ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

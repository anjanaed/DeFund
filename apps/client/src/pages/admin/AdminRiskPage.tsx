import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiMagnifyingGlass } from 'react-icons/hi2'
import '../../Admin.css'

export default function AdminRiskPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  const riskProjects = [
    {
      id: 1,
      name: 'DeFi Protocol X',
      contributions: '45.2 ETH',
      lastUpdate: '2026-01-14',
      status: 'Active'
    },
    {
      id: 2,
      name: 'NFT Marketplace Builder',
      contributions: '28.7 ETH',
      lastUpdate: '2025-12-28',
      status: 'Flagged'
    },
    {
      id: 3,
      name: 'DAO Governance Tool',
      contributions: '67.9 ETH',
      lastUpdate: '2026-01-10',
      status: 'Active'
    },
    {
      id: 4,
      name: 'Crypto Payment Gateway',
      contributions: '52.3 ETH',
      lastUpdate: '2026-01-02',
      status: 'Flagged'
    },
    {
      id: 5,
      name: 'Web3 Gaming Platform',
      contributions: '91.4 ETH',
      lastUpdate: '2026-01-12',
      status: 'Active'
    },
    {
      id: 6,
      name: 'Scam Token Project',
      contributions: '12.4 ETH',
      lastUpdate: '2026-01-05',
      status: 'Blocked'
    }
  ]

  const filteredProjects = riskProjects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'All' || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Project Monitoring</h1>
        <p className="admin-page-subtitle">Monitor and manage all platform projects</p>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-header" style={{ justifyContent: 'flex-end', gap: '16px' }}>
          <div className="admin-search">
            <HiMagnifyingGlass color="var(--color-text-tertiary)" />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '14px', cursor: 'pointer', outline: 'none' }}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Flagged">Flagged</option>
            <option value="Blocked">Blocked</option>
          </select>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Contributions</th>
              <th>Last Update</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project) => (
              <tr 
                key={project.id}
                onClick={() => navigate(`/admin/risk/${project.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ fontWeight: '600', verticalAlign: 'middle' }}>{project.name}</td>
                <td style={{ verticalAlign: 'middle' }}>{project.contributions}</td>
                <td style={{ verticalAlign: 'middle' }}>
                  <div>{project.lastUpdate}</div>
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <span className={`admin-badge ${
                    project.status === 'Active' ? 'success' : 
                    project.status === 'Flagged' ? 'warning' : 'error'
                  }`}>
                    {project.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Pagination (Static for now as main focus is filter) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Showing {filteredProjects.length} projects</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white', color: 'var(--color-text-secondary)', cursor: 'not-allowed' }} disabled>Previous</button>
            <button className="btn" style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white', color: 'var(--color-text-primary)' }}>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}

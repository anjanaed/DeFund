import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiMagnifyingGlass } from 'react-icons/hi2'
import '../../Admin.css'

export default function AdminVerificationPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  const allProjects = [
    {
      id: 1,
      name: 'DeFi Protocol X',
      address: '0x742d35Cc...95f0bEb1',
      submitted: '2026-01-14',
      signature: 'Verified',
      status: 'Pending'
    },
    {
      id: 2,
      name: 'NFT Marketplace Builder',
      address: '0x8ba1f109...d64DBA72',
      submitted: '2026-01-13',
      signature: 'Verified',
      status: 'Pending'
    },
    {
      id: 3,
      name: 'Web3 Social Network',
      address: '0x12345678...34567890',
      submitted: '2026-01-13',
      signature: 'Invalid',
      status: 'Rejected'
    },
    {
      id: 4,
      name: 'DAO Governance Tool',
      address: '0xdAC17F95...3D831ec7',
      submitted: '2026-01-12',
      signature: 'Verified',
      status: 'Approved'
    },
    {
      id: 5,
      name: 'Crypto Payment Gateway',
      address: '0x6B175474...95271d0F',
      submitted: '2026-01-11',
      signature: 'Verified',
      status: 'Pending'
    },
    {
      id: 6,
      name: 'Web3 Gaming Platform',
      address: '0x9a8b...1c2d',
      submitted: '2026-01-10',
      signature: 'Verified',
      status: 'Approved'
    }
  ]

  const filteredProjects = allProjects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          project.address.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'All' || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Verification Queue</h1>
        <p className="admin-page-subtitle">Manage and monitor platform activity</p>
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
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Wallet Address</th>
              <th>Submitted</th>
              <th>Signature</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project) => (
              <tr 
                key={project.id} 
                onClick={() => navigate(`/admin/verification/${project.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ fontWeight: '600' }}>{project.name}</td>
                <td style={{ fontFamily: 'monospace' }}>{project.address}</td>
                <td>{project.submitted}</td>
                <td>
                  <span className={`admin-badge ${project.signature === 'Verified' ? 'success' : 'error'}`}>
                    {project.signature}
                  </span>
                </td>
                <td>
                  <span className={`admin-badge ${
                    project.status === 'Approved' ? 'success' : 
                    project.status === 'Pending' ? 'warning' : 'error'
                  }`}>{project.status}</span>
                </td>
                <td>
                  <button className="btn" style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

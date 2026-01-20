import { useState } from 'react'
import { HiClock, HiFlag, HiChartBar, HiXCircle, HiMagnifyingGlass } from 'react-icons/hi2'
import '../../Admin.css'

export default function AdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const stats = [
    { label: 'Pending Verification', value: '12', subtitle: 'Projects awaiting approval', icon: HiClock, trend: 'neutral' },
    { label: 'Flagged Projects', value: '3', subtitle: 'Require attention', icon: HiFlag, trend: 'negative' },
    { label: 'Total Contributions', value: '342.5 ETH', subtitle: '+12.5% from last month', icon: HiChartBar, trend: 'positive' },
    { label: 'Rejected Projects', value: '8', subtitle: 'Declined submissions', icon: HiXCircle, trend: 'neutral' }
  ]

  const recentActivity = [
    { title: 'DeFi Protocol X approved', time: '2 hours ago', status: 'success' },
    { title: 'NFT Marketplace flagged for review', time: '5 hours ago', status: 'warning' },
    { title: 'New project submitted: Web3 Gaming Platform', time: '1 day ago', status: 'info' },
    { title: 'Crypto Payment Gateway rejected', time: '1 day ago', status: 'error' }
  ]

  const systemStatus = [
    { name: 'Blockchain Network Status', status: 'Operational', color: 'success' },
    { name: 'API Gateway', status: 'Operational', color: 'success' }
  ]

  const allTransactions = [
    { id: 'tx-001', project: 'DeFi Protocol X', type: 'Milestone Release', amount: '30.0 ETH', time: '10 mins ago', status: 'Success', hash: '0x7a...9f2' },
    { id: 'tx-002', project: 'NFT Marketplace Builder', type: 'Funding', amount: '5.4 ETH', time: '45 mins ago', status: 'Success', hash: '0xb2...1c4' },
    { id: 'tx-003', project: 'DAO Governance Tool', type: 'Withdrawal', amount: '12.0 ETH', time: '2 hours ago', status: 'Pending', hash: '0x8d...3e1' },
    { id: 'tx-004', project: 'Web3 Gaming Platform', type: 'Funding', amount: '2.5 ETH', time: '3 hours ago', status: 'Success', hash: '0x4f...5a9' },
    { id: 'tx-005', project: 'Crypto Payment Gateway', type: 'Refund', amount: '0.8 ETH', time: '5 hours ago', status: 'Success', hash: '0x1c...9b3' },
    { id: 'tx-006', project: 'DeFi Protocol X', type: 'Funding', amount: '100.0 ETH', time: '1 day ago', status: 'Success', hash: '0x9e...2d8' },
    { id: 'tx-007', project: 'NFT Marketplace Builder', type: 'Staking', amount: '50.0 ETH', time: '1 day ago', status: 'Success', hash: '0x3f...1a2' },
    { id: 'tx-008', project: 'DeFi Protocol X', type: 'Withdrawal', amount: '5.0 ETH', time: '2 days ago', status: 'Success', hash: '0x2b...8c9' },
    { id: 'tx-009', project: 'DAO Governance Tool', type: 'Funding', amount: '15.0 ETH', time: '2 days ago', status: 'Success', hash: '0x5d...4e7' },
    { id: 'tx-010', project: 'Web3 Gaming Platform', type: 'Milestone Release', amount: '10.0 ETH', time: '3 days ago', status: 'Pending', hash: '0x1a...6b4' },
    { id: 'tx-011', project: 'Crypto Payment Gateway', type: 'Funding', amount: '20.0 ETH', time: '3 days ago', status: 'Success', hash: '0x8e...9f1' },
    { id: 'tx-012', project: 'DeFi Protocol X', type: 'Withdrawal', amount: '2.0 ETH', time: '4 days ago', status: 'Success', hash: '0x4c...3d2' }
  ]

  const filteredTransactions = allTransactions.filter(tx => {
    const matchesSearch = tx.project.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          tx.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.hash.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'All' || tx.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="admin-page-subtitle">Manage and monitor platform activity</p>
      </div>

      <div className="admin-stats-grid">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="admin-stat-card">
              <Icon className="admin-stat-icon" />
              <div className="admin-stat-label">{stat.label}</div>
              <div className="admin-stat-value">{stat.value}</div>
              <div className={`admin-stat-trend ${stat.trend}`}>
                {stat.subtitle}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px', marginBottom: '32px' }}>
        {/* Recent Activity */}
        <div className="admin-table-card">
          <div className="admin-table-header">
            <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Recent Activity</h3>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {recentActivity.map((activity, index) => (
                <div key={index} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    marginTop: '6px',
                    background: `var(--color-${activity.status})` 
                  }} />
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>{activity.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Status Updated */}
        <div className="admin-table-card">
          <div className="admin-table-header">
            <h3 style={{ fontSize: '16px', fontWeight: '600' }}>System Status</h3>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {systemStatus.map((item, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: `var(--color-${item.color})` }} />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)' }}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Section (Moved to Bottom) */}
      <div className="admin-table-card" style={{ marginBottom: '32px' }}>
        <div className="admin-table-header">
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Recent Transactions</h3>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="admin-search">
               <HiMagnifyingGlass color="var(--color-text-tertiary)" />
               <input 
                 type="text" 
                 placeholder="Search by project, type, or hash..." 
                 value={searchTerm}
                 onChange={(e) => {
                   setSearchTerm(e.target.value)
                   setCurrentPage(1) // Reset to page 1 on search
                 }}
               />
            </div>
            <select 
              value={statusFilter} 
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '14px', cursor: 'pointer', outline: 'none' }}
            >
              <option value="All">All Status</option>
              <option value="Success">Success</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tx Hash</th>
              <th>Project</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.map((tx) => (
              <tr key={tx.id}>
                <td style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{tx.hash}</td>
                <td style={{ fontWeight: '500' }}>{tx.project}</td>
                <td>{tx.type}</td>
                <td style={{ fontWeight: '600' }}>{tx.amount}</td>
                <td style={{ color: 'var(--color-text-secondary)' }}>{tx.time}</td>
                <td>
                   <span className={`admin-badge ${tx.status === 'Success' ? 'success' : tx.status === 'Pending' ? 'warning' : 'error'}`}>
                     {tx.status}
                   </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination UI */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Showing {paginatedTransactions.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
            {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
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

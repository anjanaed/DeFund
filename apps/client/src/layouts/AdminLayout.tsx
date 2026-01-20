import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { HiChartPie, HiClipboardDocumentCheck, HiShieldCheck, HiChartBar, HiArrowLeftOnRectangle } from 'react-icons/hi2'
import '../Admin.css'

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  
  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: HiChartPie },
    { path: '/admin/verification', label: 'Verification Queue', icon: HiClipboardDocumentCheck },
    { path: '/admin/risk', label: 'Project Monitoring', icon: HiShieldCheck },
    { path: '/admin/milestones', label: 'Milestone Oversight', icon: HiChartBar }
  ]

  return (
    <div className="admin-container">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <HiShieldCheck />
          </div>
          <span className="admin-brand-text">Admin Panel</span>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-card">
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Logged in as</div>
            <div style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'monospace' }}>0x742d...bEb1</div>
          </div>
          <button className="admin-logout-btn" onClick={() => navigate('/admin/login')}>
            <HiArrowLeftOnRectangle /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}

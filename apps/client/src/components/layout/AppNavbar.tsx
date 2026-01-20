import { Link, useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'
import logo from '../../assets/logo.png'
import { HiHome, HiMagnifyingGlass, HiSquares2X2, HiPencilSquare } from 'react-icons/hi2'
import ConnectWallet from '../wallet/ConnectWallet'

export default function AppNavbar() {
  const location = useLocation()
  const { isConnected } = useAccount()

  const navItems = [
    { path: '/home', label: 'Home', icon: HiHome, requiresWallet: false },
    { path: '/explore', label: 'Explore', icon: HiMagnifyingGlass, requiresWallet: false },
    { path: '/dashboard', label: 'Dashboard', icon: HiSquares2X2, requiresWallet: true },
    { path: '/creator-studio', label: 'Creator Studio', icon: HiPencilSquare, requiresWallet: true }
  ]

  const visibleNavItems = navItems.filter(item => !item.requiresWallet || isConnected)

  return (
    <nav className="app-navbar">
      <div className="app-navbar-container">
        <Link to="/home" className="app-navbar-logo">
          <img src={logo} alt="DeFund Logo" />
        </Link>
        
        <ul className="app-navbar-menu">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <li key={item.path}>
                <Link 
                  to={item.path} 
                  className={`app-navbar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon className="app-navbar-icon" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="app-navbar-actions">
          <ConnectWallet />
        </div>
      </div>
    </nav>
  )
}

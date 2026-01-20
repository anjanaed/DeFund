import { Link } from 'react-router-dom'
import Button from '../common/Button'
import logo from '../../assets/logo.png'

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <a href="#" className="navbar-logo">
          <img src={logo} alt="DeFund Logo" />
          
        </a>
        <ul className="navbar-menu">
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#community">Community</a></li>
          <li><a href="#start">Start Now</a></li>
          <li>
            <Link to="/home">
              <Button variant="launch">
                Launch App
              </Button>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}

import Button from '../common/Button'
import logo from '../../assets/logo.png'

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="container">
        <a href="#" className="navbar-logo">
          <img src={logo} alt="DeFund Logo" />
          
        </a>
        <ul className="navbar-menu">
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#community">Community</a></li>
          <li><a href="#start">Start Now</a></li>
          <li>
            <Button variant="launch">
              Launch App
            </Button>
          </li>
        </ul>
      </div>
    </nav>
  )
}

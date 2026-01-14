import logo from '../../assets/logo.png'
import { FaXTwitter, FaGithub, FaLinkedin, FaDiscord } from 'react-icons/fa6'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">
              <img src={logo} alt="DeFund Logo" />
              <span>DeFund</span>
            </div>
            <p className="footer-tagline">
              Transparent, milestone-based Web3 crowdfunding platform.
            </p>
          </div>
          
          <div className="footer-section">
            <h4>Product</h4>
            <ul className="footer-links">
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#security">Security</a></li>
              <li><a href="#roadmap">Roadmap</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Company</h4>
            <ul className="footer-links">
              <li><a href="#about">About</a></li>
              <li><a href="#blog">Blog</a></li>
              <li><a href="#careers">Careers</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Connect</h4>
            <ul className="footer-social">
              <li>
                <a href="#" aria-label="Twitter">
                  <FaXTwitter />
                </a>
              </li>
              <li>
                <a href="#" aria-label="GitHub">
                  <FaGithub />
                </a>
              </li>
              <li>
                <a href="#" aria-label="LinkedIn">
                  <FaLinkedin />
                </a>
              </li>
              <li>
                <a href="#" aria-label="Discord">
                  <FaDiscord />
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>© 2025 DeFund. All rights reserved.</p>
          <ul className="footer-legal">
            <li><a href="#privacy">Privacy</a></li>
            <li><a href="#terms">Terms</a></li>
            <li><a href="#cookies">Cookies</a></li>
          </ul>
        </div>
      </div>
    </footer>
  )
}

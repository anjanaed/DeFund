import Button from '../common/Button'
import StatCard from '../common/StatCard'
import logo from '../../assets/logo.png'

export default function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-badge">
          Transparent Web3 Funding
        </div>
        
        <div className="hero-logo">
          <img src={logo} alt="DeFund Logo" />
        </div>
        
        <h1 className="hero-title">
          <span className="text-gradient">DeFund</span>
        </h1>
        
        <h2 className="hero-subtitle">
          Fund Innovation<br />Without Risk
        </h2>
        
        <p className="hero-description">
          Milestone-based crowdfunding where contributors control fund release through voting. 
          Smart Contracts ensure transparency, accountability, and security at every stage.
        </p>
        
        <div className="hero-cta">
          <Button variant="primary">
            Start Your Project →
          </Button>
          <Button variant="secondary">
            Explore Projects
          </Button>
        </div>
        
        <div className="hero-stats">
          <StatCard value="$24+" label="Funding" />
          <StatCard value="1200+" label="Projects" />
          <StatCard value="45K+" label="Contributors" />
          <StatCard value="98%" label="Success Rate" />
        </div>
      </div>
    </section>
  )
}

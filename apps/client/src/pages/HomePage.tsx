import { Link } from 'react-router-dom'
import AppNavbar from '../components/layout/AppNavbar'
import { HiUsers, HiChartBar } from 'react-icons/hi2'
import logo from '../assets/logo.png'

export default function HomePage() {
  const stats = [
    { value: '$247K+', label: 'Total Funds Raised' },
    { value: '6', label: 'Active Projects' },
    { value: '488+', label: 'Community Contributors' }
  ]

  const trendingProjects = [
    {
      id: 1,
      category: 'DeFi',
      verified: true,
      title: 'DeFi Lending Protocol',
      description: 'A decentralized lending platform that allows users to lend and borrow cryptocurrencies with',
      raised: 75000,
      goal: 100000,
      contributors: 156,
      milestones: 3
    },
    {
      id: 2,
      category: 'Gaming',
      verified: true,
      title: 'Blockchain Gaming Engine',
      description: 'Open-source game engine optimized for blockchain gaming with built-in NFT and token',
      raised: 45000,
      goal: 120000,
      contributors: 103,
      milestones: 1
    },
    {
      id: 3,
      category: 'NFT',
      verified: true,
      title: 'NFT Marketplace Platform',
      description: 'A next-generation NFT marketplace with advanced features for creators and',
      raised: 35000,
      goal: 80000,
      contributors: 67,
      milestones: 3
    }
  ]

  return (
    <div className="app-container">
      <AppNavbar />
      
      {/* Hero Section */}
      <section className="app-hero">
        <div className="container">
          <div className="app-hero-badge">Milestone-Based Crowdfunding</div>
          <h1 className="app-hero-title">
            Fund Web3 Projects with<br />
            <span className="text-gradient">Complete Protection</span>
          </h1>
          <img src={logo} alt="DeFund Logo" className="app-hero-logo" />
          <p className="app-hero-description">
            Support innovative blockchain projects with milestone-based funding, on-chain
            governance, and automatic refunds. Your funds stay protected until milestones
            are achieved.
          </p>
          <div className="app-hero-buttons">
            <Link to="/explore" className="btn btn-primary">
              Explore Projects →
            </Link>
            <Link to="/creator-studio" className="btn btn-secondary">
              Start a Campaign
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="app-stats-section">
        <div className="container">
          <div className="app-stats-grid">
            {stats.map((stat, index) => (
              <div key={index} className="app-stat-card">
                <div className="app-stat-value">{stat.value}</div>
                <div className="app-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Projects */}
      <section className="app-trending-section">
        <div className="container">
          <div className="app-section-header">
            <div>
              <h2 className="app-section-title">Trending Projects</h2>
              <p className="app-section-subtitle">Discover the most popular campaigns</p>
            </div>
            <Link to="/explore" className="app-view-all">View All</Link>
          </div>

          <div className="app-projects-grid">
            {trendingProjects.map((project) => (
              <Link 
                key={project.id} 
                to={`/project/${project.id}`} 
                className="app-project-card clickable-card"
              >
                <div className="app-project-header">
                  <div className="app-project-category-badge">
                    <span className="app-category-label">{project.category}</span>
                  </div>
                </div>
                
                <h3 className="app-project-title">{project.title}</h3>
                <p className="app-project-description">{project.description}</p>
                
                <div className="app-project-progress">
                  <div className="app-progress-header">
                    <span className="app-progress-amount">${project.raised.toLocaleString()} raised</span>
                    <span className="app-progress-goal">of ${project.goal.toLocaleString()}</span>
                  </div>
                  <div className="app-progress-bar">
                    <div 
                      className="app-progress-fill" 
                      style={{ width: `${(project.raised / project.goal) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="app-project-meta">
                  <div className="app-meta-item">
                    <HiUsers />
                    <span>{project.contributors} contributors</span>
                  </div>
                  <div className="app-meta-item">
                    <HiChartBar />
                    <span>{project.milestones} milestones</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="app-cta-section">
        <div className="container">
          <div className="app-cta-box">
            <h2 className="app-cta-title">Ready to Start Your Campaign?</h2>
            <p className="app-cta-description">
              Launch your Web3 project with milestone-based funding and community support
            </p>
            <Link to="/creator-studio" className="btn btn-primary">
              Create a Project →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

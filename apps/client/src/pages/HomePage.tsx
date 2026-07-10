import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppNavbar from '../components/layout/AppNavbar'
import { HiUsers, HiChartBar } from 'react-icons/hi2'
import logo from '../assets/logo.png'
import { apiFetch } from '../lib/api'

interface PublicStats {
  totalRaised: number
  ethUsdPrice: number
  activeCampaigns: number
  totalContributors: number
  successRate: number
}

interface Campaign {
  id: string
  title: string
  description: string
  category: string
  raisedAmount: string
  goalAmount: string
  paymentToken: string
  _count: { milestones: number; contributions: number }
}

// n is already a USD value (e.g. stats.totalRaised, or a token amount pre-converted via toUsd)
const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toFixed(2)}`

// USDC is treated 1:1 with USD; ETH is converted using the live ETH/USD price
const toUsd = (amount: number, token: string, ethUsdPrice: number) =>
  token === 'ETH' ? amount * ethUsdPrice : amount

const STATS_REFRESH_MS = 5 * 60 * 1000 // matches the backend's ETH price / stats cache refresh cadence

export default function HomePage() {
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [trending, setTrending] = useState<Campaign[]>([])

  useEffect(() => {
    const loadStats = () => apiFetch('/stats').then(r => r.ok ? r.json() : null).then(d => d && setStats(d))
    loadStats()
    apiFetch('/projects/trending').then(r => r.ok ? r.json() : null).then(d => d && setTrending(d))

    // Keep the live ETH-derived totals fresh while the page stays open
    const interval = setInterval(loadStats, STATS_REFRESH_MS)
    return () => clearInterval(interval)
  }, [])

  const displayStats = stats
    ? [
        { value: fmt(stats.totalRaised), label: 'Total Raised' },
        { value: `${stats.activeCampaigns}`, label: 'Active Campaigns' },
        { value: `${stats.totalContributors}+`, label: 'Community Members' },
      ]
    : []

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
            <Link to="/explore" className="btn btn-primary">Explore Projects →</Link>
            <Link to="/creator-studio" className="btn btn-secondary">Start a Campaign</Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {displayStats.length > 0 && (
        <section className="app-stats-section">
          <div className="container">
            <div className="app-stats-grid">
              {displayStats.map((stat, i) => (
                <div key={i} className="app-stat-card">
                  <div className="app-stat-value">{stat.value}</div>
                  <div className="app-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trending Projects */}
      {trending.length > 0 && (
        <section className="app-trending-section">
          <div className="container">
            <div className="app-section-header">
              <div>
                <h2 className="app-section-title">Popular Projects</h2>
                <p className="app-section-subtitle">Discover the most popular campaigns</p>
              </div>
              <Link to="/explore" className="app-view-all">View All</Link>
            </div>

            <div className="app-projects-grid">
              {trending.map((project) => {
                const raised = Number(project.raisedAmount)
                const goal = Number(project.goalAmount)
                const ethUsdPrice = stats?.ethUsdPrice ?? 0
                const raisedUsd = toUsd(raised, project.paymentToken, ethUsdPrice)
                const goalUsd = toUsd(goal, project.paymentToken, ethUsdPrice)
                return (
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
                        <span className="app-progress-amount">{fmt(raisedUsd)} raised</span>
                        <span className="app-progress-goal">of {fmt(goalUsd)}</span>
                      </div>
                      <div className="app-progress-bar">
                        <div
                          className="app-progress-fill"
                          style={{ width: `${Math.min((raised / goal) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="app-project-meta">
                      <div className="app-meta-item">
                        <HiUsers />
                        <span>{project._count.contributions} contributors</span>
                      </div>
                      <div className="app-meta-item">
                        <HiChartBar />
                        <span>{project._count.milestones} milestones</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="app-cta-section">
        <div className="container">
          <div className="app-cta-box">
            <h2 className="app-cta-title">Ready to Start Your Campaign?</h2>
            <p className="app-cta-description">
              Launch your Web3 project with milestone-based funding and community support
            </p>
            <Link to="/creator-studio" className="btn btn-primary">Create a Project →</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

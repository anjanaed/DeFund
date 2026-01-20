import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppNavbar from '../components/layout/AppNavbar'
import { HiMagnifyingGlass, HiUsers, HiChartBar } from 'react-icons/hi2'

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState('all')
  const [sortBy, setSortBy] = useState('trending')

  const categories = ['All', 'DeFi', 'DAO', 'NFT', 'Open Source', 'Infrastructure', 'Gaming']
  const tabs = [
    { id: 'all', label: 'All Projects', count: 6 },
    { id: 'trending', label: 'Trending', count: null },
    { id: 'new', label: 'New', count: null }
  ]

  const projects = [
    {
      id: 1,
      category: 'Infrastructure',
      verified: true,
      active: true,
      title: 'Decentralized Storage Network',
      description: 'Building a secure and efficient decentralized storage solution for Web3',
      raised: 12000,
      goal: 150000,
      contributors: 28,
      milestones: 1
    },
    {
      id: 2,
      category: 'Gaming',
      verified: true,
      active: true,
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
      active: true,
      title: 'NFT Marketplace Platform',
      description: 'A next-generation NFT marketplace with advanced features for creators and',
      raised: 35000,
      goal: 80000,
      contributors: 67,
      milestones: 3
    },
    {
      id: 4,
      category: 'Open Source',
      verified: true,
      active: true,
      title: 'Open Source Analytics Tools',
      description: 'Privacy-focused analytics platform for Web3 applications.',
      raised: 28000,
      goal: 30000,
      contributors: 45,
      milestones: 2
    },
    {
      id: 5,
      category: 'DeFi',
      verified: true,
      active: true,
      title: 'DeFi Lending Protocol',
      description: 'A decentralized lending platform that allows users to lend and borrow cryptocurrencies with',
      raised: 75000,
      goal: 100000,
      contributors: 156,
      milestones: 3
    },
    {
      id: 6,
      category: 'DAO',
      verified: true,
      active: false,
      title: 'Community DAO Governance',
      description: 'Building a transparent and efficient DAO governance system for community-driven',
      raised: 52000,
      goal: 50000,
      contributors: 89,
      milestones: 2
    }
  ]

  return (
    <div className="app-container">
      <AppNavbar />
      
      <div className="explore-page">
        <div className="container">
          {/* Header */}
          <div className="explore-header">
            <h1 className="explore-title">Explore Projects</h1>
            <p className="explore-subtitle">
              Discover and support innovative Web3 projects with milestone-based funding
            </p>
          </div>

          {/* Search and Filters */}
          <div className="explore-filters">
            <div className="search-box">
              <HiMagnifyingGlass className="search-icon" />
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="search-input"
              />
            </div>
            
            <div className="filter-dropdowns">
              <select className="filter-select" value="all">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
              
              <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="trending">Trending</option>
                <option value="newest">Newest</option>
                <option value="funded">Most Funded</option>
              </select>
            </div>
          </div>

          {/* Category Pills */}
          <div className="category-pills">
            {categories.map((category) => (
              <button
                key={category}
                className={`category-pill ${category === 'All' ? 'active' : ''}`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="explore-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`explore-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label} {tab.count && `(${tab.count})`}
              </button>
            ))}
          </div>

          {/* Projects Grid */}
          <div className="explore-projects-grid">
            {projects.map((project) => (
              <Link 
                key={project.id} 
                to={`/project/${project.id}`} 
                className="explore-project-card clickable-card"
              >
                <div className="explore-project-header">
                  <span className="explore-category-badge">{project.category}</span>
                  <div className="explore-badges">
                    {project.active && (
                      <span className="explore-active-badge">Active</span>
                    )}
                    {!project.active && (
                      <span className="explore-completed-badge">Completed</span>
                    )}
                  </div>
                </div>
                
                <h3 className="explore-project-title">{project.title}</h3>
                <p className="explore-project-description">{project.description}</p>
                
                <div className="explore-project-progress">
                  <div className="explore-progress-header">
                    <span className="explore-progress-amount">${project.raised.toLocaleString()} raised</span>
                    <span className="explore-progress-goal">of ${project.goal.toLocaleString()}</span>
                  </div>
                  <div className="explore-progress-bar">
                    <div 
                      className="explore-progress-fill" 
                      style={{ width: `${Math.min((project.raised / project.goal) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="explore-project-meta">
                  <div className="explore-meta-item">
                    <HiUsers />
                    <span>{project.contributors} contributors</span>
                  </div>
                  <div className="explore-meta-item">
                    <HiChartBar />
                    <span>{project.milestones} milestones</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

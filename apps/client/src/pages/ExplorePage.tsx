import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AppNavbar from '../components/layout/AppNavbar'
import { HiMagnifyingGlass, HiUsers, HiChartBar } from 'react-icons/hi2'
import { apiFetch } from '../lib/api'

const CATEGORIES = ['All', 'DeFi', 'Gaming', 'NFT', 'DAO', 'Education', 'Infrastructure', 'Open Source']
const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'newest', label: 'Newest' },
  { value: 'most_funded', label: 'Most Funded' },
]
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'FUNDED', label: 'Funded' },
  { value: 'COMPLETED', label: 'Completed' },
]

interface Campaign {
  id: string
  title: string
  description: string
  category: string
  status: string
  raisedAmount: string
  goalAmount: string
  _count: { milestones: number; contributions: number }
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`

export default function ExplorePage() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('trending')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('All')
  const [projects, setProjects] = useState<Campaign[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (sort) params.set('sort', sort)
    if (status) params.set('status', status)
    if (category && category !== 'All') params.set('category', category)
    params.set('limit', '24')

    const res = await apiFetch(`/projects?${params}`)
    if (res.ok) {
      const data = await res.json()
      setProjects(data.items)
      setTotal(data.total)
    }
    setLoading(false)
  }, [search, sort, status, category])

  useEffect(() => {
    const timer = setTimeout(fetchProjects, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchProjects])

  return (
    <div className="app-container">
      <AppNavbar />

      <div className="explore-page">
        <div className="container">
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
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-dropdowns">
              <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="filter-select" value={sort} onChange={e => setSort(e.target.value)}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Category Pills */}
          <div className="category-pills">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`category-pill ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results count */}
          {!loading && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '1.5rem' }}>
              {total} project{total !== 1 ? 's' : ''} found
            </p>
          )}

          {/* Projects Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-secondary)' }}>
              Loading...
            </div>
          ) : projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--color-text-secondary)' }}>
              No projects found.
            </div>
          ) : (
            <div className="explore-projects-grid">
              {projects.map((project) => {
                const raised = Number(project.raisedAmount)
                const goal = Number(project.goalAmount)
                const isActive = project.status === 'ACTIVE' || project.status === 'FUNDED'
                return (
                  <Link
                    key={project.id}
                    to={`/project/${project.id}`}
                    className="explore-project-card clickable-card"
                  >
                    <div className="explore-project-header">
                      <span className="explore-category-badge">{project.category}</span>
                      <div className="explore-badges">
                        <span className={isActive ? 'explore-active-badge' : 'explore-completed-badge'}>
                          {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                    </div>
                    <h3 className="explore-project-title">{project.title}</h3>
                    <p className="explore-project-description">{project.description}</p>
                    <div className="explore-project-progress">
                      <div className="explore-progress-header">
                        <span className="explore-progress-amount">{fmt(raised)} raised</span>
                        <span className="explore-progress-goal">of {fmt(goal)}</span>
                      </div>
                      <div className="explore-progress-bar">
                        <div
                          className="explore-progress-fill"
                          style={{ width: `${Math.min(goal > 0 ? (raised / goal) * 100 : 0, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="explore-project-meta">
                      <div className="explore-meta-item"><HiUsers /><span>{project._count.contributions} contributors</span></div>
                      <div className="explore-meta-item"><HiChartBar /><span>{project._count.milestones} milestones</span></div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

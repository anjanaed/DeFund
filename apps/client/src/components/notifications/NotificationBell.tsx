import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HiBell,
  HiDocumentArrowUp,
  HiUserGroup,
  HiCheckCircle,
  HiXCircle,
  HiTrophy,
  HiExclamationCircle,
  HiCurrencyDollar,
} from 'react-icons/hi2'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'

interface NotificationMeta {
  campaignId: string
  campaignTitle: string
  milestoneId?: string
  milestoneTitle?: string
}

interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  metadata?: NotificationMeta
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  MILESTONE_PROOF_UPLOADED: { icon: HiDocumentArrowUp, color: 'var(--color-primary)' },
  MILESTONE_VOTING_STARTED: { icon: HiUserGroup, color: '#3B82F6' },
  MILESTONE_APPROVED: { icon: HiCheckCircle, color: 'var(--color-success)' },
  MILESTONE_REJECTED: { icon: HiXCircle, color: 'var(--color-error)' },
  CAMPAIGN_FULLY_FUNDED: { icon: HiTrophy, color: '#F59E0B' },
  REFUND_PROPOSED: { icon: HiExclamationCircle, color: '#F97316' },
  REFUND_APPROVED: { icon: HiCurrencyDollar, color: 'var(--color-success)' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const POLL_INTERVAL = 30_000

export default function NotificationBell() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await apiFetch('/notifications/unread-count')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count)
      }
    } catch {
      // silently ignore poll failures
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    fetchUnreadCount()
    const timer = setInterval(fetchUnreadCount, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [isAuthenticated, fetchUnreadCount])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const openDropdown = async () => {
    if (isOpen) { setIsOpen(false); return }
    setIsOpen(true)
    setLoading(true)
    try {
      const res = await apiFetch('/notifications?limit=20')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const markRead = async (n: Notification) => {
    if (!n.metadata?.campaignId) return
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))
      setUnreadCount((c) => Math.max(0, c - 1))
      apiFetch(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {})
    }
    navigate(`/projects/${n.metadata.campaignId}`)
    setIsOpen(false)
  }

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    apiFetch('/notifications/read-all', { method: 'PATCH' }).catch(() => {})
  }

  if (!isAuthenticated) return null

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={openDropdown}
        aria-label="Notifications"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--color-border)',
          background: isOpen ? 'var(--color-bg-purple-light)' : 'white',
          color: isOpen ? 'var(--color-primary)' : 'var(--color-text-secondary)',
          cursor: 'pointer',
          transition: 'var(--transition)',
          flexShrink: 0,
        }}
      >
        <HiBell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            minWidth: '16px',
            height: '16px',
            padding: '0 4px',
            background: 'var(--color-error)',
            color: 'white',
            borderRadius: 'var(--radius-full)',
            fontSize: '10px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '340px',
          maxHeight: '480px',
          background: 'white',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: '12px',
                  color: 'var(--color-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
                You're all caught up
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? { icon: HiBell, color: 'var(--color-text-secondary)' }
                const Icon = cfg.icon
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px 16px',
                      borderLeft: n.isRead ? '4px solid transparent' : '4px solid var(--color-primary)',
                      borderTop: 'none',
                      borderRight: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      background: n.isRead ? 'white' : 'var(--color-bg-purple-subtle)',
                      cursor: n.metadata?.campaignId ? 'pointer' : 'default',
                      textAlign: 'left',
                      transition: 'background var(--transition)',
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--radius-full)',
                      background: `${cfg.color}18`,
                      color: cfg.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '1px',
                    }}>
                      <Icon size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4, marginBottom: '4px' }}>
                        {n.body}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                        {timeAgo(n.createdAt)}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

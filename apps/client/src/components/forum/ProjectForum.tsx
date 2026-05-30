import { useEffect, useState } from 'react'
import { HiPaperAirplane, HiPencil, HiTrash, HiArrowUturnLeft, HiCheck, HiXMark, HiHandThumbUp, HiHandThumbDown } from 'react-icons/hi2'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'
import Spinner from '../common/Spinner'
import ConfirmModal from '../common/ConfirmModal'

type ReactionType = 'LIKE' | 'DISLIKE'

interface Reaction {
  id: string
  type: ReactionType
  userId: string
}

interface Message {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  isDeleted: boolean
  parentId: string | null
  user: { id: string; name: string | null; walletAddress: string; avatar?: string | null; isContributor?: boolean; isCreator?: boolean }
  reactions: Reaction[]
  replies?: Message[]
  _count: { replies: number }
}

interface ForumResponse {
  id: string
  messages: Message[]
  nextCursor: string | null
}

interface Props {
  projectId: string
}

const shortenAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const PAGE_SIZE = 20

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ProjectForum({ projectId }: Props) {
  const { isAuthenticated, user, isAdmin } = useAuth()

  const [messages, setMessages] = useState<Message[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const [composer, setComposer] = useState('')
  const [posting, setPosting] = useState(false)

  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const fetchPage = async (cursor: string | null) => {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (cursor) qs.set('cursor', cursor)
    const res = await apiFetch(`/projects/${projectId}/forum?${qs.toString()}`)
    if (!res.ok) throw new Error('Failed to load forum')
    return (await res.json()) as ForumResponse
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchPage(null)
      .then((data) => {
        if (cancelled) return
        setMessages(data.messages)
        setNextCursor(data.nextCursor)
      })
      .catch((e) => !cancelled && setError(e.message || 'Failed to load forum'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [projectId])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await fetchPage(nextCursor)
      setMessages((prev) => [...prev, ...data.messages])
      setNextCursor(data.nextCursor)
    } catch (e: any) {
      setError(e.message || 'Failed to load more')
    } finally {
      setLoadingMore(false)
    }
  }

  const upsertTopLevel = (msg: Message) => {
    setMessages((prev) => [msg, ...prev])
  }

  const replaceMessage = (msg: Message) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msg.id) return { ...msg, replies: m.replies }
        if (m.replies && m.replies.some((r) => r.id === msg.id)) {
          return { ...m, replies: m.replies.map((r) => (r.id === msg.id ? msg : r)) }
        }
        return m
      }),
    )
  }

  const addReply = (parentId: string, msg: Message) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === parentId
          ? { ...m, replies: [...(m.replies ?? []), msg], _count: { replies: m._count.replies + 1 } }
          : m,
      ),
    )
  }

  const handlePost = async () => {
    if (!composer.trim() || !isAuthenticated) return
    setPosting(true)
    setError('')
    try {
      const res = await apiFetch(`/projects/${projectId}/forum`, {
        method: 'POST',
        body: JSON.stringify({ content: composer.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Post failed')
      }
      const msg: Message = await res.json()
      upsertTopLevel({ ...msg, replies: [], _count: msg._count ?? { replies: 0 } })
      setComposer('')
    } catch (e: any) {
      setError(e.message || 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  const handleReplySubmit = async (parentId: string) => {
    if (!replyText.trim() || !isAuthenticated) return
    setBusyMessageId(parentId)
    setError('')
    try {
      const res = await apiFetch(`/projects/${projectId}/forum`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText.trim(), parentId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Reply failed')
      }
      const msg: Message = await res.json()
      addReply(parentId, msg)
      setReplyText('')
      setReplyTo(null)
    } catch (e: any) {
      setError(e.message || 'Failed to reply')
    } finally {
      setBusyMessageId(null)
    }
  }

  const handleEditSubmit = async (messageId: string) => {
    if (!editText.trim() || !isAuthenticated) return
    setBusyMessageId(messageId)
    setError('')
    try {
      const res = await apiFetch(`/projects/${projectId}/forum/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editText.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Edit failed')
      }
      const msg: Message = await res.json()
      replaceMessage(msg)
      setEditingId(null)
      setEditText('')
    } catch (e: any) {
      setError(e.message || 'Failed to edit')
    } finally {
      setBusyMessageId(null)
    }
  }

  const handleDelete = async (messageId: string) => {
    if (!isAuthenticated) return
    setBusyMessageId(messageId)
    setError('')
    try {
      const res = await apiFetch(`/projects/${projectId}/forum/${messageId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Delete failed')
      }
      const msg: Message = await res.json()
      replaceMessage(msg)
    } catch (e: any) {
      setError(e.message || 'Failed to delete')
    } finally {
      setBusyMessageId(null)
    }
  }

  const handleReact = async (messageId: string, type: ReactionType) => {
    if (!isAuthenticated || !user) return
    const flatten = [...messages, ...messages.flatMap((m) => m.replies ?? [])]
    const target = flatten.find((m) => m.id === messageId)
    if (!target) return
    const has = target.reactions.some((r) => r.userId === user.id && r.type === type)

    // Optimistic update
    const optimistic: Reaction[] = has
      ? target.reactions.filter((r) => !(r.userId === user.id && r.type === type))
      : [...target.reactions, { id: `tmp-${Date.now()}`, type, userId: user.id }]
    replaceMessage({ ...target, reactions: optimistic })

    try {
      const res = await apiFetch(`/projects/${projectId}/forum/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      })
      if (!res.ok) throw new Error('Reaction failed')
    } catch (e: any) {
      // Roll back
      replaceMessage(target)
      setError(e.message || 'Reaction failed')
    }
  }

  const renderMessage = (m: Message, isReply = false) => {
    const canEdit = !m.isDeleted && (user?.id === m.user.id || isAdmin)
    const canDelete = !m.isDeleted && (user?.id === m.user.id || isAdmin)
    const wasEdited = !m.isDeleted && new Date(m.updatedAt).getTime() - new Date(m.createdAt).getTime() > 1000
    const likeCount = m.reactions.filter((r) => r.type === 'LIKE').length
    const dislikeCount = m.reactions.filter((r) => r.type === 'DISLIKE').length
    const userLiked = !!user && m.reactions.some((r) => r.userId === user.id && r.type === 'LIKE')
    const userDisliked = !!user && m.reactions.some((r) => r.userId === user.id && r.type === 'DISLIKE')
    const busy = busyMessageId === m.id
    const isEditing = editingId === m.id
    const isReplying = replyTo === m.id

    return (
      <div
        key={m.id}
        className="forum-message"
        style={{
          marginLeft: isReply ? '32px' : 0,
          padding: '12px 16px',
          borderLeft: isReply ? '2px solid var(--color-border)' : 'none',
          borderTop: isReply ? 'none' : '1px solid var(--color-border)',
          opacity: m.isDeleted ? 0.6 : 1,
        }}
      >
        <div className="forum-message-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span className="forum-message-author" style={{ fontWeight: 600, fontSize: '14px' }}>
              {m.user.name || shortenAddress(m.user.walletAddress)}
            </span>
            {m.user.isCreator && (
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px', letterSpacing: '0.02em', background: 'rgba(99,102,241,0.12)', color: 'var(--color-primary)' }}>
                Creator
              </span>
            )}
            {m.user.isContributor && !m.user.isCreator && (
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px', letterSpacing: '0.02em', background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>
                Contributor
              </span>
            )}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
            {formatTimestamp(m.createdAt)}{wasEdited && <em style={{ marginLeft: 6 }}>(edited)</em>}
          </span>
        </div>

        {isEditing ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <textarea
              className="form-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              style={{ flex: 1, fontSize: '14px' }}
              maxLength={2000}
              autoFocus
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button
                className="btn"
                onClick={() => handleEditSubmit(m.id)}
                disabled={busy || !editText.trim()}
                style={{ padding: '6px 10px', fontSize: '12px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px' }}
              >
                <HiCheck />
              </button>
              <button
                className="btn"
                onClick={() => { setEditingId(null); setEditText('') }}
                style={{ padding: '6px 10px', fontSize: '12px', background: 'white', border: '1px solid var(--color-border)', borderRadius: '6px' }}
              >
                <HiXMark />
              </button>
            </div>
          </div>
        ) : (
          <p className="forum-message-content" style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap', color: m.isDeleted ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', fontStyle: m.isDeleted ? 'italic' : 'normal' }}>
            {m.isDeleted ? '[deleted]' : m.content}
          </p>
        )}

        {!m.isDeleted && !isEditing && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => handleReact(m.id, 'LIKE')}
              disabled={!isAuthenticated}
              title={isAuthenticated ? 'Like' : 'Sign in to react'}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px', fontSize: '12px',
                background: userLiked ? 'rgba(99,102,241,0.1)' : 'transparent',
                border: '1px solid var(--color-border)', borderRadius: '12px',
                color: userLiked ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                cursor: isAuthenticated ? 'pointer' : 'not-allowed',
              }}
            >
              <HiHandThumbUp size={14} /> {likeCount}
            </button>
            <button
              type="button"
              onClick={() => handleReact(m.id, 'DISLIKE')}
              disabled={!isAuthenticated}
              title={isAuthenticated ? 'Dislike' : 'Sign in to react'}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px', fontSize: '12px',
                background: userDisliked ? 'rgba(239,68,68,0.1)' : 'transparent',
                border: '1px solid var(--color-border)', borderRadius: '12px',
                color: userDisliked ? 'var(--color-error)' : 'var(--color-text-secondary)',
                cursor: isAuthenticated ? 'pointer' : 'not-allowed',
              }}
            >
              <HiHandThumbDown size={14} /> {dislikeCount}
            </button>

            {!isReply && isAuthenticated && (
              <button
                type="button"
                onClick={() => { setReplyTo(isReplying ? null : m.id); setReplyText('') }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '12px', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                <HiArrowUturnLeft size={14} /> Reply
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => { setEditingId(m.id); setEditText(m.content) }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '12px', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                <HiPencil size={14} /> Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteConfirmId(m.id)}
                disabled={busy}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '12px', background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                <HiTrash size={14} /> Delete
              </button>
            )}
          </div>
        )}

        {isReplying && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <textarea
              className="form-textarea"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              style={{ flex: 1, fontSize: '14px' }}
              maxLength={2000}
              autoFocus
            />
            <button
              className="btn btn-primary"
              onClick={() => handleReplySubmit(m.id)}
              disabled={busy || !replyText.trim()}
              style={{ alignSelf: 'flex-start' }}
            >
              <HiPaperAirplane /> Reply
            </button>
          </div>
        )}

        {m.replies && m.replies.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            {m.replies.map((r) => renderMessage(r, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="project-forum">
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-error)', marginBottom: '12px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div className="forum-messages" style={{ border: '1px solid var(--color-border)', borderRadius: '8px', background: 'white', marginBottom: '16px' }}>
        {loading ? (
          <Spinner label="Loading discussion…" />
        ) : messages.length === 0 ? (
          <p className="empty-state-text" style={{ padding: '24px' }}>No messages yet. Start the discussion!</p>
        ) : (
          messages.map((m) => renderMessage(m))
        )}

        {nextCursor && (
          <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid var(--color-border)' }}>
            <button
              className="btn"
              onClick={loadMore}
              disabled={loadingMore}
              style={{ padding: '6px 16px', fontSize: '13px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'white' }}
            >
              {loadingMore ? <Spinner size="sm" inline label="Loading…" /> : 'Load older'}
            </button>
          </div>
        )}
      </div>

      {isAuthenticated ? (
        <div className="forum-compose" style={{ display: 'flex', gap: '8px' }}>
          <textarea
            className="form-textarea"
            placeholder="Write a message…"
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handlePost() }
            }}
            rows={2}
            disabled={posting}
            maxLength={2000}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={handlePost}
            disabled={!composer.trim() || posting}
            style={{ alignSelf: 'flex-start' }}
          >
            <HiPaperAirplane /> {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      ) : (
        <p className="connect-wallet-note">Sign in to join the discussion.</p>
      )}

      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => { const id = deleteConfirmId!; setDeleteConfirmId(null); handleDelete(id) }}
        title="Delete Message"
        message="This message will be marked as deleted and hidden from the thread. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}

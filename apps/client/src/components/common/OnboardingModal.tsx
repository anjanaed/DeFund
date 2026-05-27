/**
 * U5 — Step-by-step onboarding modal that guides new users through the DeFund process.
 * Shows as a blur-backdrop overlay with pop-up cards. Skippable.
 * Shown once per browser session (persisted in localStorage).
 */
import { useState, useEffect } from 'react'
import { HiXMark, HiArrowRight, HiArrowLeft } from 'react-icons/hi2'

interface Step {
  emoji: string
  title: string
  description: string
  detail: string
}

const STEPS: Step[] = [
  {
    emoji: '🎯',
    title: 'Milestone-Based Funding',
    description: 'Your money is never handed over all at once.',
    detail:
      'Campaigns are broken into milestones. Funds are held in a smart contract and only released to creators when each milestone is completed and approved by voters — including you.',
  },
  {
    emoji: '🗳️',
    title: 'Your Vote Matters',
    description: 'Contributors vote on whether each milestone was achieved.',
    detail:
      'When a creator submits proof of completion, a 7-day voting period opens. Your voting weight is proportional to your contribution — the more you back, the more say you have.',
  },
  {
    emoji: '🛡️',
    title: 'Protected Investment',
    description: 'You can always reclaim your funds if things go wrong.',
    detail:
      'If a campaign is cancelled, flagged, or fails, you can claim 95% of your contribution back directly from the smart contract — no middlemen, no waiting for approvals.',
  },
  {
    emoji: '🔗',
    title: 'Fully On-Chain & Transparent',
    description: 'Every transaction is verifiable on the Ethereum blockchain.',
    detail:
      'DeFund is non-custodial. You hold your keys; the smart contract holds the escrow. Admins can flag suspicious campaigns but cannot move your funds without a dual-admin approval process.',
  },
]

const LS_KEY = 'defund_onboarding_seen_v1'

interface Props {
  /** Override visibility — pass true to force-show the modal (e.g. from a "How it works" button) */
  forceShow?: boolean
  onClose?: () => void
}

export default function OnboardingModal({ forceShow, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (forceShow) {
      setStep(0)
      setVisible(true)
      return
    }
    // Auto-show once per browser
    if (!localStorage.getItem(LS_KEY)) {
      setVisible(true)
    }
  }, [forceShow])

  const close = () => {
    localStorage.setItem(LS_KEY, '1')
    setVisible(false)
    setStep(0)
    onClose?.()
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Card — stop propagation so clicking inside doesn't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface, #1a1a2e)',
          border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '480px',
          width: '100%',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Close button */}
        <button
          onClick={close}
          aria-label="Skip onboarding"
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-secondary)', fontSize: '1.25rem', padding: '4px',
            display: 'flex', alignItems: 'center',
          }}
        >
          <HiXMark />
        </button>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem' }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: '4px',
                flex: 1,
                borderRadius: '2px',
                background: i <= step ? 'var(--color-primary, #6c63ff)' : 'var(--color-border, rgba(255,255,255,0.15))',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center', padding: '0.5rem 0 1.5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>{current.emoji}</div>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', color: 'var(--color-text)' }}>{current.title}</h2>
          <p style={{ margin: '0 0 1rem', color: 'var(--color-primary)', fontWeight: 600, fontSize: '1rem' }}>
            {current.description}
          </p>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
            {current.detail}
          </p>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
              color: 'var(--color-text)',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              opacity: step === 0 ? 0.4 : 1,
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.875rem',
            }}
          >
            <HiArrowLeft /> Back
          </button>

          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {step + 1} / {STEPS.length}
          </span>

          {isLast ? (
            <button
              onClick={close}
              style={{
                background: 'var(--color-primary, #6c63ff)',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '0.5rem 1.25rem',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Get Started 🚀
            </button>
          ) : (
            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              style={{
                background: 'var(--color-primary, #6c63ff)',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '0.5rem 1.25rem',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '0.875rem',
              }}
            >
              Next <HiArrowRight />
            </button>
          )}
        </div>

        {/* Skip link */}
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={close}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
          >
            Skip intro
          </button>
        </div>
      </div>
    </div>
  )
}

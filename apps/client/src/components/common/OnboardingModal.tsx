/**
 * U5 — Onboarding modal guiding new users through DeFund.
 * Shows once per user (persisted in localStorage); re-triggerable via forceShow.
 * localStorage key is set on first show — not just on close — so navigating away
 * without dismissing still prevents re-display on the next visit.
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
  forceShow?: boolean
  onClose?: () => void
}

export default function OnboardingModal({ forceShow, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward')

  useEffect(() => {
    if (forceShow) {
      setStep(0)
      setAnimDir('forward')
      setVisible(true)
      return
    }
    if (!localStorage.getItem(LS_KEY)) {
      localStorage.setItem(LS_KEY, '1')
      setVisible(true)
    }
  }, [forceShow])

  const close = () => {
    setVisible(false)
    setStep(0)
    onClose?.()
  }

  const goNext = () => {
    setAnimDir('forward')
    setStep(s => Math.min(STEPS.length - 1, s + 1))
  }

  const goBack = () => {
    setAnimDir('back')
    setStep(s => Math.max(0, s - 1))
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const animName = animDir === 'forward' ? 'ob-slide-in-right' : 'ob-slide-in-left'

  return (
    <>
      <style>{`
        @keyframes ob-modal-in {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes ob-slide-in-right {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        @keyframes ob-slide-in-left {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0);     }
        }
        .ob-card {
          animation: ob-modal-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .ob-step-content {
          animation: ${animName} 0.22s ease-out both;
        }
        .ob-btn-ghost {
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .ob-btn-ghost:not(:disabled):hover {
          border-color: var(--color-border-hover) !important;
          background: var(--color-bg-muted) !important;
        }
        .ob-btn-primary {
          transition: opacity 0.15s, box-shadow 0.15s;
        }
        .ob-btn-primary:hover {
          opacity: 0.92;
        }
        .ob-close-btn:hover {
          background: rgba(255,255,255,0.3) !important;
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(88, 28, 135, 0.1)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
      >
        {/* Card */}
        <div
          className="ob-card"
          onClick={e => e.stopPropagation()}
          style={{
            background: '#ffffff',
            border: '1px solid var(--color-border)',
            borderRadius: '20px',
            maxWidth: '460px',
            width: '100%',
            overflow: 'hidden',
            boxShadow:
              '0 4px 6px -2px rgba(91,33,182,0.06), 0 24px 56px -8px rgba(91,33,182,0.2)',
          }}
        >
          {/* Purple header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 60%, #8B5CF6 100%)',
              padding: '1.25rem 1.5rem 1.125rem',
              position: 'relative',
            }}
          >
            <button
              className="ob-close-btn"
              onClick={close}
              aria-label="Skip onboarding"
              style={{
                position: 'absolute', top: '0.75rem', right: '0.75rem',
                background: 'rgba(255,255,255,0.18)',
                border: 'none', cursor: 'pointer',
                color: '#fff', borderRadius: '50%',
                width: '28px', height: '28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              <HiXMark />
            </button>

            <p style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em',
              color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase',
              margin: '0 0 0.75rem',
            }}>
              How DeFund Works
            </p>

            {/* Step progress bar */}
            <div style={{ display: 'flex', gap: '5px' }}>
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: '3px', flex: 1, borderRadius: '99px',
                    background: i <= step ? '#fff' : 'rgba(255,255,255,0.28)',
                    transition: 'background 0.3s ease',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Step content — key forces remount so animation replays on step change */}
          <div
            key={step}
            className="ob-step-content"
            style={{ padding: '1.75rem 1.75rem 1.375rem' }}
          >
            {/* Emoji badge */}
            <div
              style={{
                width: '52px', height: '52px',
                background: 'var(--color-bg-purple-light)',
                borderRadius: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.625rem',
                marginBottom: '1.125rem',
                border: '1px solid var(--color-border-purple)',
              }}
            >
              {current.emoji}
            </div>

            <h2
              style={{
                margin: '0 0 0.3rem',
                fontSize: '1.175rem', fontWeight: 700,
                color: 'var(--color-text-primary)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                lineHeight: 1.3,
              }}
            >
              {current.title}
            </h2>

            <p
              style={{
                margin: '0 0 0.75rem',
                color: 'var(--color-primary)',
                fontWeight: 600, fontSize: '0.875rem',
              }}
            >
              {current.description}
            </p>

            <p
              style={{
                margin: 0,
                color: 'var(--color-text-secondary)',
                lineHeight: 1.65, fontSize: '0.9rem',
              }}
            >
              {current.detail}
            </p>
          </div>

          {/* Footer nav */}
          <div
            style={{
              padding: '0.875rem 1.75rem 1.375rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-subtle)',
            }}
          >
            <button
              className="ob-btn-ghost"
              onClick={goBack}
              disabled={step === 0}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: step === 0 ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
                borderRadius: '8px',
                padding: '0.45rem 0.875rem',
                cursor: step === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '0.8rem', fontWeight: 500,
              }}
            >
              <HiArrowLeft style={{ fontSize: '0.8rem' }} />
              Back
            </button>

            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-tertiary)',
                fontWeight: 500,
              }}
            >
              {step + 1} of {STEPS.length}
            </span>

            {isLast ? (
              <button
                className="ob-btn-primary"
                onClick={close}
                style={{
                  background: 'linear-gradient(135deg, #5B21B6, #7C3AED)',
                  border: 'none', color: '#fff',
                  borderRadius: '8px', padding: '0.45rem 1.125rem',
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  boxShadow: '0 2px 8px rgba(91,33,182,0.3)',
                }}
              >
                Get Started 🚀
              </button>
            ) : (
              <button
                className="ob-btn-primary"
                onClick={goNext}
                style={{
                  background: 'linear-gradient(135deg, #5B21B6, #7C3AED)',
                  border: 'none', color: '#fff',
                  borderRadius: '8px', padding: '0.45rem 1.125rem',
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  boxShadow: '0 2px 8px rgba(91,33,182,0.3)',
                }}
              >
                Next <HiArrowRight style={{ fontSize: '0.8rem' }} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

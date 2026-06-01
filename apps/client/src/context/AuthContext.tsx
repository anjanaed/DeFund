import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useDisconnect } from 'wagmi'
import { apiFetch } from '../lib/api'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

interface AuthUser {
  id: string
  walletAddress: string
  role: string
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (walletAddress: string, signFn: (message: string) => Promise<string>) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const { disconnect } = useDisconnect()

  // Restore session from HttpOnly cookie on page load
  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.user) setUser(data.user) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = async (walletAddress: string, signFn: (message: string) => Promise<string>) => {
    // Step 1: get nonce (apiFetch applies a request timeout so the UI can never
    // hang indefinitely if the server stalls)
    const nonceRes = await apiFetch('/auth/nonce', {
      method: 'POST',
      body: JSON.stringify({ walletAddress }),
    })
    if (!nonceRes.ok) throw new Error('Failed to get nonce')
    const { nonce } = await nonceRes.json()

    // Step 2: sign the nonce with the wallet
    const signature = await signFn(nonce)

    // Step 3: verify signature — server sets HttpOnly cookie, returns user info
    const verifyRes = await apiFetch('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ walletAddress, signature }),
    })
    if (!verifyRes.ok) throw new Error('Signature verification failed')
    const { user: authUser } = await verifyRes.json()
    setUser(authUser)
  }

  const logout = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    setUser(null)
    disconnect()
  }

  if (loading) return null

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isAdmin: user?.role === 'ADMIN',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

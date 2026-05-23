import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const STORAGE_KEY = 'defund_auth'

interface AuthUser {
  id: string
  walletAddress: string
  role: string
}

interface AuthState {
  token: string
  user: AuthUser
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (walletAddress: string, signFn: (message: string) => Promise<string>) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function parseJwt(token: string): Record<string, any> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [auth])

  const login = async (walletAddress: string, signFn: (message: string) => Promise<string>) => {
    // Step 1: get nonce
    const nonceRes = await fetch(`${API_BASE}/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    })
    if (!nonceRes.ok) throw new Error('Failed to get nonce')
    const { nonce } = await nonceRes.json()

    // Step 2: sign the nonce with the wallet
    const signature = await signFn(nonce)

    // Step 3: verify signature and receive JWT
    const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, signature }),
    })
    if (!verifyRes.ok) throw new Error('Signature verification failed')
    const { accessToken } = await verifyRes.json()

    // Step 4: decode and store
    const payload = parseJwt(accessToken)
    setAuth({
      token: accessToken,
      user: { id: payload.sub, walletAddress: payload.walletAddress, role: payload.role },
    })
  }

  const logout = () => setAuth(null)

  return (
    <AuthContext.Provider
      value={{
        user: auth?.user ?? null,
        token: auth?.token ?? null,
        isAuthenticated: auth !== null,
        isAdmin: auth?.user.role === 'ADMIN',
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

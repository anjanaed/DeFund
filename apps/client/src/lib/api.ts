const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

/**
 * Authenticated fetch wrapper.
 * Automatically attaches Authorization header when a token is supplied.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers })
}

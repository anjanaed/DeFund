const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const REQUEST_TIMEOUT_MS = 30_000

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

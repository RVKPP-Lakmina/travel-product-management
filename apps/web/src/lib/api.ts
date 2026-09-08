import { supabase } from './supabase'

// Versioned API base. The relative fallback matches nginx's same-origin
// proxy (docker/nginx/default.conf); VITE_API_URL overrides it for
// host-native / Docker dev.
const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors?: Record<string, string[]>

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'X-Request-Id': crypto.randomUUID(),
  }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(await authHeaders())
  if (options.body) headers.set('Content-Type', 'application/json')
  for (const [key, value] of new Headers(options.headers)) headers.set(key, value)

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const body = isJson ? await res.json() : null

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.code ?? 'ERROR',
      body?.message ?? `Request failed with status ${res.status}`,
      body?.fieldErrors,
    )
  }

  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /** For binary responses (Excel export) — bypasses the JSON body assumption above. */
  async downloadBlob(path: string, body?: unknown): Promise<{ blob: Blob; filename: string }> {
    const headers = new Headers(await authHeaders())
    if (body !== undefined) headers.set('Content-Type', 'application/json')
    const res = await fetch(`${API_URL}${path}`, {
      method: body !== undefined ? 'POST' : 'GET',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const body = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null
      throw new ApiError(res.status, body?.code ?? 'ERROR', body?.message ?? 'Export failed')
    }
    const disposition = res.headers.get('content-disposition') ?? ''
    const match = disposition.match(/filename="([^"]+)"/)
    return { blob: await res.blob(), filename: match?.[1] ?? 'export' }
  },
}

import { apiBaseUrl } from '../config/env'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  message?: string
}

const TOKEN_KEY = 'valeria.auth.token'

function storedToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
}

async function request<TResponse, TBody = never>(
  method: string,
  path: string,
  body?: TBody,
): Promise<TResponse> {
  let response: Response
  try {
    const token = storedToken()
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Unable to connect to the VALERIA server.', 0)
  }

  if (response.status === 204) return undefined as TResponse
  if (response.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(new Event('valeria:unauthorized'))
  }
  if (response.status === 502 || response.status === 503) {
    throw new ApiError('Unable to connect to the VALERIA server.', response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('The VALERIA server returned an unreadable response.', response.status)
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError('The VALERIA server returned an unreadable response.', response.status)
  }
  const envelope = payload as ApiEnvelope<TResponse>
  if (!response.ok || envelope.success !== true || !('data' in envelope)) {
    const message = response.status >= 500
      ? 'The VALERIA server could not complete the request.'
      : typeof envelope.message === 'string' ? envelope.message : 'The request could not be completed.'
    throw new ApiError(message, response.status)
  }
  return envelope.data as TResponse
}

export const authTokenStorage = {
  get: storedToken,
  set(token: string, remember: boolean): void {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    ;(remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
  },
}

export const api = {
  get: <TResponse>(path: string) => request<TResponse>('GET', path),
  post: <TResponse, TBody>(path: string, body: TBody) => request<TResponse, TBody>('POST', path, body),
  put: <TResponse, TBody>(path: string, body: TBody) => request<TResponse, TBody>('PUT', path, body),
  patch: <TResponse, TBody>(path: string, body: TBody) => request<TResponse, TBody>('PATCH', path, body),
  delete: <TResponse>(path: string) => request<TResponse>('DELETE', path),
}

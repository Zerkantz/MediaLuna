const PRODUCTION_BACKEND_URL = 'https://medialuna-backend.onrender.com'

const getDevelopmentBackendUrl = () => {
  if (!import.meta.env.DEV) return ''
  return ['http:', '//', 'localhost', ':', '4242'].join('')
}

const normalizeBackendUrl = (value) => {
  const normalized = String(value || '').trim().replace(/\/$/, '')
  if (!normalized || ['undefined', 'null'].includes(normalized.toLowerCase())) return ''
  if (import.meta.env.PROD) {
    try {
      const { hostname } = new URL(normalized)
      if (['localhost', '127.0.0.1', '::1'].includes(hostname)) return ''
    } catch {
      return ''
    }
  }
  return normalized
}

export const getBackendUrl = (...values) => (
  values
    .map(normalizeBackendUrl)
    .find(Boolean)
  || getDevelopmentBackendUrl()
  || PRODUCTION_BACKEND_URL
)

export const BACKEND_URL = getBackendUrl(import.meta.env.VITE_BACKEND_URL)

export const STRIPE_BACKEND_URL = getBackendUrl(
  import.meta.env.VITE_STRIPE_BACKEND_URL,
  import.meta.env.VITE_BACKEND_URL,
)

import { auth, firebaseConfigured } from './firebaseClient'

const getConfiguredBackendUrl = (...values) => values
  .map((value) => String(value || '').trim())
  .find((value) => value && !['undefined', 'null'].includes(value.toLowerCase()))

const BACKEND_URL = getConfiguredBackendUrl(
  import.meta.env.VITE_STRIPE_BACKEND_URL,
  import.meta.env.VITE_BACKEND_URL,
  'http://localhost:4242',
).replace(/\/$/, '')

export const getStripeBackendUrl = () => BACKEND_URL

const authenticatedRequest = async (path, options = {}) => {
  if (!firebaseConfigured || !auth?.currentUser) {
    throw new Error('Stripe requiere una sesión real de Firebase. Configura Firebase e inicia sesión.')
  }

  const token = await auth.currentUser.getIdToken()
  const url = `${BACKEND_URL}${path}`

  console.log('URL backend Stripe:', url)
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
    const body = await response.json().catch(() => ({}))
    console.log('Respuesta backend Stripe:', { ok: response.ok, status: response.status, body })
    if (!response.ok) throw new Error(body.error || 'No se pudo iniciar el pago. Revisa la conexión con Stripe.')
    return body
  } catch (error) {
    console.error('Error Stripe:', error)
    if (error instanceof TypeError || error.message === 'Failed to fetch') {
      throw new Error('No se pudo iniciar el pago. Revisa la conexión con Stripe.')
    }
    throw error
  }
}

export const createStripeCheckout = (payload) => authenticatedRequest('/stripe/checkout-session', {
  method: 'POST',
  body: JSON.stringify(payload),
})

export const syncStripeCheckout = (sessionId) => authenticatedRequest(`/stripe/checkout-session/${encodeURIComponent(sessionId)}`)

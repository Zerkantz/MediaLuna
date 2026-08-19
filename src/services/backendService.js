import { BACKEND_URL } from './backendConfig'

/**
 * Solicita a tu backend en Render un token de Stream Chat para el usuario actual.
 */
export async function getStreamToken(userId, userName) {
  if (!userId) throw new Error('userId es requerido para generar token de Stream.')

  const response = await fetch(`${BACKEND_URL}/stream/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userName }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Error al obtener token de Stream Chat desde el backend.')
  }

  return response.json() // { token, apiKey, userId }
}

/**
 * Solicita la creación o recuperación de un canal de Stream Chat para la reservación.
 */
export async function createStreamChannel(channelId, members, reservationData = {}) {
  if (!channelId || !Array.isArray(members)) {
    throw new Error('channelId y members son requeridos para crear canal en Stream.')
  }

  const response = await fetch(`${BACKEND_URL}/stream/channel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId, members, reservationData }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Error al crear/obtener canal de Stream Chat desde el backend.')
  }

  return response.json() // { channelId, channelType }
}

/**
 * Solicita a tu backend la creación/obtención de una sala privada en Daily.co.
 */
export async function getDailyRoom(roomName, expiryMinutes = 120) {
  if (!roomName) throw new Error('roomName es requerido para crear la sala en Daily.co.')

  const response = await fetch(`${BACKEND_URL}/daily/room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName, expiryMinutes }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Error al obtener sala de Daily.co desde el backend.')
  }

  return response.json() // { name, url, id }
}

/**
 * Solicita a tu backend un token privado de acceso para unirse a la sala de Daily.co.
 */
export async function getDailyToken(roomName, userName, userId, expiryMinutes = 120) {
  if (!roomName) throw new Error('roomName es requerido para generar token de Daily.co.')

  const response = await fetch(`${BACKEND_URL}/daily/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName, userName, userId, expiryMinutes }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Error al obtener token de reunión de Daily.co desde el backend.')
  }

  return response.json() // { token, roomUrl }
}

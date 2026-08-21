import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  actualizarDisponibilidad,
  actualizarNotificacion,
  actualizarPago,
  actualizarPagoPorReservacion,
  actualizarReservacion,
  actualizarSalon,
  actualizarServicio,
  actualizarUsuario,
  crearDisponibilidad,
  crearNotificacion,
  crearPago,
  crearReservacion,
  crearSalon,
  crearServicio,
  crearUsuario,
  getDatabaseSnapshot,
  getNotificaciones,
  getNotificacionesParaUsuario,
  getPagoPorReservacion,
  mergeAvailabilityIntoSalons,
} from '../services/firestoreService'
import { cloneMockDatabase } from '../data/mockData'
import { firebaseConfigured } from '../services/firebaseClient'
import {
  getFirebaseUserProfile,
  registerWithFirebase,
  reloadFirebaseUser,
  resendVerificationEmail as resendFirebaseVerificationEmail,
  signInWithFirebase,
  signOutFromFirebase,
  subscribeToAuthState,
} from '../services/authService'
import { createStripeCheckout, getStripeBackendUrl, syncStripeCheckout } from '../services/stripeService'
import { getWeekendSurcharge, isPastDateValue } from '../utils/formLimits'

/* The provider and its hook are intentionally colocated for the app shell. */
/* eslint-disable react-refresh/only-export-components */

const AppContext = createContext(null)
const mockPasswords = {
  'admin@medialuna.mx': 'medialuna',
  'mariana@aurora.mx': 'medialuna',
  'diego@nebulas.mx': 'medialuna',
  'lucia@email.com': 'medialuna',
  'fernando@email.com': 'medialuna',
}

const getInitialDate = () => format(addDays(new Date(), 7), 'yyyy-MM-dd')
const PENDING_IDENTIFIER = 'pendiente'
const STRIPE_PENDING_MESSAGE = 'Reservación creada. Pago pendiente de conexión con Stripe.'
const TERMS_VERSION = '2026-08-18'
const EMAIL_NOT_VERIFIED_MESSAGE = 'Tu correo aún no está verificado. Revisa tu correo antes de iniciar sesión.'

const syncSalonAvailability = (nextData) => ({
  ...nextData,
  salones: mergeAvailabilityIntoSalons(nextData.salones, nextData.disponibilidad),
})

const removeUndefinedFields = (record) => Object.fromEntries(
  Object.entries(record).filter(([, value]) => value !== undefined),
)

const findAvailabilityForSalonDate = (records, salonId, date) => records.find((item) => (
  item.fecha === date && item.salonesIds?.includes(salonId)
))

const findSalonOwner = (usuarios, salon) => usuarios.find((user) => (
  user.rol === 'dueno' && (user.id === salon?.duenoId || user.id === salon?.ownerId || user.salonesIds?.includes(salon?.id))
))
const getReservationOwnerId = (reservation, salones, usuarios) => {
  const explicitOwnerId = Array.isArray(reservation?.duenoId) ? reservation.duenoId[0] : reservation?.duenoId
  if (explicitOwnerId) return explicitOwnerId
  const salon = salones.find((item) => reservation?.salonesIds?.includes(item.id))
  return salon?.duenoId ?? salon?.ownerId ?? findSalonOwner(usuarios, salon)?.id ?? ''
}
const getReservationSalon = (reservation, salones) => salones.find((item) => reservation?.salonesIds?.includes(item.id))
const notificationBelongsToUser = (notification, user) => Boolean(user) && (
  notification.usuarioId === user.id || (!notification.usuarioId && notification.rolDestino === user.rol)
)
const getDateTime = (value) => {
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  const time = new Date(value ?? 0).getTime()
  return Number.isFinite(time) ? time : 0
}
const sortNotifications = (items) => [...items].sort((a, b) => getDateTime(b.fechaCreacion) - getDateTime(a.fechaCreacion))

const getAuthErrorMessage = (error) => {
  const messages = {
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/invalid-email': 'Escribe un correo electrónico válido.',
    'auth/user-disabled': 'Esta cuenta está desactivada. Contacta a MediaLuna.',
    'auth/user-not-found': 'No encontramos una cuenta con ese correo.',
    'auth/wrong-password': 'El correo o la contraseña no son correctos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
  }
  return messages[error?.code] ?? 'No pudimos completar la autenticación. Intenta de nuevo.'
}

export function AppProvider({ children }) {
  const [data, setData] = useState(cloneMockDatabase())
  const [dataSource, setDataSource] = useState(firebaseConfigured ? 'loading' : 'mock')
  const [dataError, setDataError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [authReady, setAuthReady] = useState(!firebaseConfigured)
  const [bookingDraft, setBookingDraft] = useState({ salonId: 'salon_aurora', date: getInitialDate(), servicesIds: [] })
  const [toast, setToast] = useState(null)
  const notificationDedupeRef = useRef(new Map())
  const verificationAuthFlowRef = useRef(false)
  const currentUserId = currentUser?.id
  const currentUserRole = currentUser?.rol

  const notify = (message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }

  const refreshData = (nextData) => setData(syncSalonAvailability(nextData))

  const markProfileEmailVerified = async (profile) => {
    if (!firebaseConfigured || !profile || profile.correoVerificado === true) return profile
    try {
      const updated = await actualizarUsuario(profile.id, { correoVerificado: true })
      setData((currentData) => syncSalonAvailability({
        ...currentData,
        usuarios: currentData.usuarios.map((item) => item.id === profile.id ? updated : item),
      }))
      return updated
    } catch (error) {
      console.warn('No se pudo sincronizar usuarios.correoVerificado:', error)
      return { ...profile, correoVerificado: true }
    }
  }

  useEffect(() => {
    if (!firebaseConfigured) return undefined
    let cancelled = false

    getDatabaseSnapshot()
      .then((nextData) => {
        if (cancelled) return
        setData(nextData)
        setDataSource('firebase')
        setDataError(null)
        setBookingDraft((draft) => ({
          ...draft,
          salonId: nextData.salones.some((salon) => salon.id === draft.salonId)
            ? draft.salonId
            : nextData.salones[0]?.id ?? draft.salonId,
          servicesIds: draft.servicesIds.filter((serviceId) => nextData.servicios.some((service) => service.id === serviceId)),
        }))
        setToast({ message: 'Datos cargados desde Firebase', tone: 'success' })
        window.setTimeout(() => setToast(null), 3200)
      })
      .catch((error) => {
        console.error('No se pudieron cargar las colecciones de Firebase:', error)
        if (cancelled) return
        setDataSource('mock-fallback')
        setDataError(error)
        setToast({ message: 'Firebase no permitió la lectura; se muestran datos demo.', tone: 'warning' })
        window.setTimeout(() => setToast(null), 4200)
      })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!firebaseConfigured) return undefined
    let cancelled = false

    const unsubscribe = subscribeToAuthState(async (authUser) => {
      if (cancelled) return
      if (!authUser) {
        setCurrentUser(null)
        setAuthReady(true)
        return
      }

      try {
        await reloadFirebaseUser(authUser)
        if (cancelled) return
        if (!authUser.emailVerified) {
          if (verificationAuthFlowRef.current) {
            setCurrentUser(null)
            return
          }
          await signOutFromFirebase()
          setCurrentUser(null)
          setToast({ message: EMAIL_NOT_VERIFIED_MESSAGE, tone: 'warning' })
          window.setTimeout(() => setToast(null), 4200)
          return
        }

        const profile = await getFirebaseUserProfile(authUser.uid)
        if (cancelled) return
        if (!profile) {
          setCurrentUser(null)
          setToast({ message: 'La cuenta no tiene un perfil en usuarios.', tone: 'warning' })
          window.setTimeout(() => setToast(null), 4200)
        } else if (!profile.activo) {
          await signOutFromFirebase()
          setCurrentUser(null)
          setToast({ message: 'Esta cuenta está desactivada.', tone: 'warning' })
          window.setTimeout(() => setToast(null), 4200)
        } else {
          const verifiedProfile = await markProfileEmailVerified(profile)
          if (!cancelled) setCurrentUser(verifiedProfile)
        }
      } catch (error) {
        console.error('No se pudo cargar el perfil autenticado:', error)
        setCurrentUser(null)
        setToast({ message: 'No se pudo cargar tu perfil de Firebase.', tone: 'warning' })
        window.setTimeout(() => setToast(null), 4200)
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!currentUserId) return undefined
    let cancelled = false
    getNotificacionesParaUsuario({ id: currentUserId, rol: currentUserRole })
      .then((notificaciones) => {
        if (cancelled) return
        setData((currentData) => ({ ...currentData, notificaciones }))
      })
      .catch((error) => {
        console.warn('No se pudieron cargar notificaciones del usuario:', error)
      })
    return () => { cancelled = true }
  }, [currentUserId, currentUserRole])

  const loginAs = (role) => {
    if (firebaseConfigured) {
      notify('El cambio de rol solo está disponible en el modo demo.', 'info')
      return currentUser
    }
    const user = data.usuarios.find((item) => item.rol === role && item.activo) ?? data.usuarios[0]
    if (!user) return null
    setCurrentUser(user)
    notify(`Sesión demo iniciada como ${user.nombre}`)
    return user
  }

  const loginWithCredentials = async (correo, password) => {
    const normalizedEmail = correo.trim().toLowerCase()

    if (firebaseConfigured) {
      try {
        const credential = await signInWithFirebase(normalizedEmail, password)
        await reloadFirebaseUser(credential.user)
        if (!credential.user.emailVerified) {
          await signOutFromFirebase()
          return {
            ok: false,
            code: 'email-not-verified',
            canResendVerification: true,
            message: EMAIL_NOT_VERIFIED_MESSAGE,
          }
        }

        const profile = await getFirebaseUserProfile(credential.user.uid)
        if (!profile) {
          await signOutFromFirebase()
          return { ok: false, message: 'La cuenta existe, pero no tiene un perfil en usuarios.' }
        }
        if (!profile.activo) {
          await signOutFromFirebase()
          return { ok: false, message: 'Esta cuenta está desactivada. Contacta a MediaLuna.' }
        }
        const verifiedProfile = await markProfileEmailVerified(profile)
        setCurrentUser(verifiedProfile)
        notify(`Bienvenido de vuelta, ${verifiedProfile.nombre.split(' ')[0]}`)
        return { ok: true, user: verifiedProfile }
      } catch (error) {
        return { ok: false, message: getAuthErrorMessage(error) }
      }
    }

    const user = data.usuarios.find((item) => item.correo.toLowerCase() === normalizedEmail)
    if (!user) return { ok: false, message: 'No encontramos una cuenta con ese correo.' }
    if (!user.activo) return { ok: false, message: 'Esta cuenta está desactivada. Contacta a MediaLuna.' }
    // Demo auth only: the password is intentionally not stored in the user document.
    if (password !== (mockPasswords[normalizedEmail] ?? 'medialuna')) return { ok: false, message: 'La contraseña no coincide con esta cuenta.' }
    setCurrentUser(user)
    notify(`Bienvenido de vuelta, ${user.nombre.split(' ')[0]}`)
    return { ok: true, user }
  }

  const registerClient = async ({ nombre, correo, telefono, password }) => {
    const normalizedEmail = correo.trim().toLowerCase()

    if (firebaseConfigured) {
      try {
        verificationAuthFlowRef.current = true
        const result = await registerWithFirebase({
          nombre: nombre.trim(),
          correo: normalizedEmail,
          telefono: telefono.trim(),
          password,
        })
        const usuarios = data.usuarios.some((item) => item.id === result.profile.id)
          ? data.usuarios.map((item) => item.id === result.profile.id ? result.profile : item)
          : [...data.usuarios, result.profile]
        refreshData({ ...data, usuarios })
        await signOutFromFirebase()
        setCurrentUser(null)
        notify('Te enviamos un correo de verificación.', 'info')
        return { ok: true, user: result.profile, verificationSent: true }
      } catch (error) {
        return { ok: false, message: getAuthErrorMessage(error) }
      } finally {
        verificationAuthFlowRef.current = false
      }
    }

    if (data.usuarios.some((item) => item.correo.toLowerCase() === normalizedEmail)) {
      return { ok: false, message: 'Ya existe una cuenta con ese correo.' }
    }
    const created = await crearUsuario({
      activo: true,
      correo: normalizedEmail,
      fechaCreacion: format(new Date(), 'yyyy-MM-dd'),
      nombre: nombre.trim(),
      rol: 'cliente',
      telefono: telefono.trim(),
    })
    mockPasswords[normalizedEmail] = password
    refreshData({ ...data, usuarios: [...data.usuarios, created] })
    setCurrentUser(created)
    notify('Cuenta creada. Bienvenido a MediaLuna.')
    return { ok: true, user: created }
  }

  const resendVerificationEmail = async (correo, password) => {
    if (!firebaseConfigured) return { ok: false, message: 'El reenvío de verificación requiere Firebase Authentication.' }
    const normalizedEmail = correo.trim().toLowerCase()
    try {
      verificationAuthFlowRef.current = true
      const result = await resendFirebaseVerificationEmail(normalizedEmail, password)
      return result.verified
        ? { ok: true, verified: true, message: 'Cuenta verificada. Ya puedes iniciar sesión.' }
        : { ok: true, message: 'Te enviamos otro correo de verificación.' }
    } catch (error) {
      return { ok: false, message: getAuthErrorMessage(error) }
    } finally {
      verificationAuthFlowRef.current = false
    }
  }

  const logout = async () => {
    if (firebaseConfigured) await signOutFromFirebase()
    setCurrentUser(null)
    notify('Sesión cerrada', 'info')
  }

  const createUser = async (userData) => {
    if (firebaseConfigured) {
      notify('Crear cuentas de dueño desde el panel requiere una función administrativa segura.', 'warning')
      return null
    }
    const created = await crearUsuario(userData)
    refreshData({ ...data, usuarios: [...data.usuarios, created] })
    notify(firebaseConfigured ? 'Usuario dueño creado en Firebase' : 'Usuario dueño creado en la capa mock')
    return created
  }

  const updateClientProfile = async (updates) => {
    if (!currentUser?.id) return { ok: false, message: 'Inicia sesión para editar tu perfil.' }
    const updated = await actualizarUsuario(currentUser.id, {
      nombre: updates.nombre.trim(),
      telefono: updates.telefono.trim(),
      correo: updates.correo.trim().toLowerCase(),
    })
    refreshData({ ...data, usuarios: data.usuarios.map((item) => item.id === currentUser.id ? updated : item) })
    setCurrentUser(updated)
    notify('Perfil actualizado')
    return { ok: true, user: updated }
  }

  const toggleUser = async (id) => {
    const user = data.usuarios.find((item) => item.id === id)
    if (!user) return
    const updated = await actualizarUsuario(id, { activo: !user.activo })
    refreshData({ ...data, usuarios: data.usuarios.map((item) => item.id === id ? updated : item) })
    notify(updated.activo ? 'Usuario activado' : 'Usuario desactivado', 'info')
  }

  const syncOwnerSalonIds = async (salonId, duenoId) => {
    const owners = data.usuarios.filter((user) => user.rol === 'dueno')
    const syncedOwners = await Promise.all(owners.map(async (owner) => {
      const currentIds = owner.salonesIds ?? []
      const shouldOwn = owner.id === duenoId
      const alreadyOwns = currentIds.includes(salonId)
      if (shouldOwn === alreadyOwns) return owner
      const salonesIds = shouldOwn
        ? [...currentIds, salonId]
        : currentIds.filter((id) => id !== salonId)
      return actualizarUsuario(owner.id, { salonesIds })
    }))
    return data.usuarios.map((user) => syncedOwners.find((owner) => owner.id === user.id) ?? user)
  }

  const createSalon = async (salonData) => {
    const exists = data.salones.some((salon) => salon.id === salonData.id)
    const normalized = {
      ...salonData,
      photos: salonData.photos?.length ? salonData.photos : (salonData.urlImagen ? [salonData.urlImagen] : []),
    }
    const created = exists ? await actualizarSalon(normalized.id, normalized) : await crearSalon(normalized)
    let usuarios = data.usuarios
    try {
      usuarios = await syncOwnerSalonIds(created.id, created.duenoId)
    } catch (error) {
      console.error('No se pudo sincronizar usuarios.salonesIds:', error)
      notify('Salón guardado, pero no se pudo sincronizar salonesIds del dueño.', 'warning')
    }
    refreshData({ ...data, usuarios, salones: exists ? data.salones.map((salon) => salon.id === created.id ? created : salon) : [...data.salones, created] })
    notify(firebaseConfigured ? (exists ? 'Salón actualizado en Firebase' : 'Salón creado en Firebase') : (exists ? 'Salón actualizado en la capa mock' : 'Salón preparado en la capa mock'))
    return created
  }

  const toggleSalon = async (id) => {
    const salon = data.salones.find((item) => item.id === id)
    if (!salon) return
    const updated = await actualizarSalon(id, { active: !salon.active })
    refreshData({ ...data, salones: data.salones.map((item) => item.id === id ? updated : item) })
    notify(updated.active ? 'Salón publicado' : 'Salón oculto', 'info')
  }

  const createService = async (serviceData) => {
    const payload = { ...serviceData }
    if (!payload.id) delete payload.id
    const exists = payload.id && data.servicios.some((service) => service.id === payload.id)
    const saved = exists ? await actualizarServicio(payload.id, payload) : await crearServicio(payload)
    refreshData({ ...data, servicios: exists ? data.servicios.map((service) => service.id === saved.id ? saved : service) : [...data.servicios, saved] })
    notify(firebaseConfigured ? (exists ? 'Servicio actualizado en Firebase' : 'Servicio agregado en Firebase') : (exists ? 'Servicio actualizado en la capa mock' : 'Servicio agregado en la capa mock'))
    return saved
  }

  const toggleServiceActive = async (id) => {
    const service = data.servicios.find((item) => item.id === id)
    if (!service) return null
    const updated = await actualizarServicio(id, { activo: !service.activo })
    refreshData({ ...data, servicios: data.servicios.map((item) => item.id === id ? updated : item) })
    notify(updated.activo ? 'Servicio activado' : 'Servicio desactivado', 'info')
    return updated
  }

  const createAvailability = async (availabilityData) => {
    const created = await crearDisponibilidad(availabilityData)
    refreshData({ ...data, disponibilidad: [...data.disponibilidad, created] })
    notify(firebaseConfigured ? 'Disponibilidad creada en Firebase' : 'Disponibilidad creada en la capa mock')
    return created
  }

  const updateAvailability = async (id, updates) => {
    const payload = typeof updates === 'string' ? { estado: updates } : updates
    const updated = await actualizarDisponibilidad(id, payload)
    refreshData({ ...data, disponibilidad: data.disponibilidad.map((item) => item.id === id ? updated : item) })
    notify(`Disponibilidad marcada como ${updated.estado}`, 'info')
    return updated
  }

  const refreshNotifications = async () => {
    try {
      const notificaciones = currentUser
        ? await getNotificacionesParaUsuario(currentUser)
        : await getNotificaciones()
      setData((currentData) => ({ ...currentData, notificaciones }))
      return notificaciones
    } catch (error) {
      console.warn('No se pudieron refrescar notificaciones:', error)
      return data.notificaciones ?? []
    }
  }

  const createNotification = async (notification, options = {}) => {
    const payload = {
      usuarioId: notification.usuarioId ?? '',
      rolDestino: notification.rolDestino ?? '',
      tipo: notification.tipo ?? 'general',
      titulo: notification.titulo ?? 'Notificación',
      mensaje: notification.mensaje ?? '',
      reservacionId: notification.reservacionId ?? '',
      salonId: notification.salonId ?? '',
      leida: false,
      fechaCreacion: format(new Date(), 'yyyy-MM-dd'),
    }
    if (!payload.usuarioId && !payload.rolDestino) return null

    const dedupeKey = options.dedupeKey ?? [
      payload.usuarioId,
      payload.rolDestino,
      payload.tipo,
      payload.reservacionId,
      payload.salonId,
      payload.titulo,
      payload.mensaje,
    ].join('|')
    const dedupeWindowMs = options.dedupeWindowMs ?? 4500
    const now = Date.now()
    const lastCreatedAt = notificationDedupeRef.current.get(dedupeKey)
    if (lastCreatedAt && now - lastCreatedAt < dedupeWindowMs) return null
    notificationDedupeRef.current.set(dedupeKey, now)

    try {
      const created = await crearNotificacion(payload)
      setData((currentData) => ({
        ...currentData,
        notificaciones: [created, ...(currentData.notificaciones ?? [])],
      }))
      return created
    } catch (error) {
      console.error('No se pudo crear la notificación:', error)
      return null
    }
  }

  const createAdminNotifications = async (notification, options = {}) => {
    const admins = data.usuarios.filter((user) => user.rol === 'administrador' && user.activo !== false)
    const recipients = admins.length ? admins : [{ id: '', rol: 'administrador' }]
    await Promise.all(recipients.map((admin) => createNotification({
      ...notification,
      usuarioId: admin.id,
      rolDestino: 'administrador',
    }, {
      ...options,
      dedupeKey: `${options.dedupeKey ?? notification.tipo}-${admin.id || 'rol-admin'}`,
    })))
  }

  const notifyReservationCreated = async (reservation, salon, client) => {
    const ownerId = getReservationOwnerId(reservation, data.salones, data.usuarios)
    const salonId = salon?.id ?? reservation.salonesIds?.[0] ?? ''
    const salonName = salon?.name ?? 'un salón'
    const clientName = client?.nombre ?? 'Un cliente'
    await Promise.all([
      ownerId ? createNotification({
        usuarioId: ownerId,
        rolDestino: 'dueno',
        tipo: 'reservacion_creada',
        titulo: 'Nueva reservación',
        mensaje: `${clientName} hizo una reservación para ${salonName}.`,
        reservacionId: reservation.id,
        salonId,
      }, { dedupeKey: `reservacion-creada-dueno-${reservation.id}` }) : Promise.resolve(null),
      createAdminNotifications({
        tipo: 'reservacion_creada',
        titulo: 'Nueva reservación',
        mensaje: `${clientName} hizo una reservación para ${salonName}.`,
        reservacionId: reservation.id,
        salonId,
      }, { dedupeKey: `reservacion-creada-admin-${reservation.id}` }),
    ])
  }

  const notifyReservationStatusChanged = async (reservation, previousStatus) => {
    const status = reservation.estadoReservacion ?? 'actualizada'
    if (previousStatus === status) return
    const salon = getReservationSalon(reservation, data.salones)
    const ownerId = getReservationOwnerId(reservation, data.salones, data.usuarios)
    const client = data.usuarios.find((user) => user.id === reservation.clienteId)
    const salonId = salon?.id ?? reservation.salonesIds?.[0] ?? ''
    const salonName = salon?.name ?? 'tu salón'
    const clientName = client?.nombre ?? 'Un cliente'
    const tasks = [
      reservation.clienteId ? createNotification({
        usuarioId: reservation.clienteId,
        rolDestino: 'cliente',
        tipo: 'estado_reservacion',
        titulo: `Tu reservación cambió a ${status}`,
        mensaje: `Tu reservación para ${salonName} cambió a ${status}.`,
        reservacionId: reservation.id,
        salonId,
      }, { dedupeKey: `estado-cliente-${reservation.id}-${status}` }) : Promise.resolve(null),
      createAdminNotifications({
        tipo: 'estado_reservacion',
        titulo: 'Estado de reservación actualizado',
        mensaje: `La reservación de ${clientName} para ${salonName} cambió de ${previousStatus ?? 'sin estado'} a ${status}.`,
        reservacionId: reservation.id,
        salonId,
      }, { dedupeKey: `estado-admin-${reservation.id}-${status}` }),
    ]

    if (status === 'cancelada' && ownerId) {
      tasks.push(createNotification({
        usuarioId: ownerId,
        rolDestino: 'dueno',
        tipo: 'reservacion_cancelada',
        titulo: 'Reservación cancelada',
        mensaje: `${clientName} canceló la reservación para ${salonName}.`,
        reservacionId: reservation.id,
        salonId,
      }, { dedupeKey: `cancelada-dueno-${reservation.id}` }))
    }

    await Promise.all(tasks)
  }

  const notifyMessageSent = async (reservation, text = '') => {
    if (!currentUser || !reservation) return null
    const ownerId = getReservationOwnerId(reservation, data.salones, data.usuarios)
    const salon = getReservationSalon(reservation, data.salones)
    const salonId = salon?.id ?? reservation.salonesIds?.[0] ?? ''
    const salonName = salon?.name ?? 'tu reservación'
    const isClientSender = currentUser.id === reservation.clienteId
    const isOwnerSender = currentUser.id === ownerId || currentUser.rol === 'dueno'
    if (!isClientSender && !isOwnerSender) return null

    const targetId = isClientSender ? ownerId : reservation.clienteId
    if (!targetId || targetId === currentUser.id) return null
    return createNotification({
      usuarioId: targetId,
      rolDestino: isClientSender ? 'dueno' : 'cliente',
      tipo: 'mensaje_chat',
      titulo: isClientSender ? 'Nuevo mensaje del cliente' : 'Nuevo mensaje del dueño',
      mensaje: `${currentUser.nombre ?? 'Un usuario'} te escribió sobre ${salonName}.`,
      reservacionId: reservation.id,
      salonId,
    }, {
      dedupeKey: `mensaje-${reservation.id}-${currentUser.id}-${targetId}-${text.trim()}`,
      dedupeWindowMs: 3500,
    })
  }

  const notifyVideoCallStarted = async (reservation) => {
    if (!currentUser || !reservation) return null
    const ownerId = getReservationOwnerId(reservation, data.salones, data.usuarios)
    const salon = getReservationSalon(reservation, data.salones)
    const salonId = salon?.id ?? reservation.salonesIds?.[0] ?? ''
    const salonName = salon?.name ?? 'tu reservación'
    const isClientStarter = currentUser.id === reservation.clienteId
    const isOwnerStarter = currentUser.id === ownerId || currentUser.rol === 'dueno'
    if (!isClientStarter && !isOwnerStarter) return null

    const targetId = isClientStarter ? ownerId : reservation.clienteId
    if (!targetId || targetId === currentUser.id) return null
    return createNotification({
      usuarioId: targetId,
      rolDestino: isClientStarter ? 'dueno' : 'cliente',
      tipo: 'videollamada',
      titulo: isClientStarter ? 'El cliente inició una videollamada' : 'El dueño inició una videollamada',
      mensaje: `${currentUser.nombre ?? 'Un usuario'} abrió la videollamada de ${salonName}.`,
      reservacionId: reservation.id,
      salonId,
    }, {
      dedupeKey: `video-${reservation.id}-${currentUser.id}-${targetId}`,
      dedupeWindowMs: 15000,
    })
  }

  const updateReservationStatus = async (id, estadoReservacion) => {
    const previous = data.reservaciones.find((item) => item.id === id)
    const updated = await actualizarReservacion(id, { estadoReservacion })
    refreshData({ ...data, reservaciones: data.reservaciones.map((item) => item.id === id ? updated : item) })
    await notifyReservationStatusChanged(updated, previous?.estadoReservacion)
    notify(`Reservación marcada como ${estadoReservacion}`, 'info')
    return updated
  }

  const cancelReservation = async (id) => {
    const reservation = data.reservaciones.find((item) => item.id === id)
    if (!reservation) return { ok: false, message: 'Reservación no encontrada.' }
    if (reservation.clienteId !== currentUser?.id) return { ok: false, message: 'Solo el cliente de la reservación puede cancelarla.' }
    if (reservation.estadoReservacion === 'cancelada') return { ok: true, reservation, message: 'La reservación ya estaba cancelada.' }

    const updated = await actualizarReservacion(id, { estadoReservacion: 'cancelada' })
    refreshData({ ...data, reservaciones: data.reservaciones.map((item) => item.id === id ? updated : item) })

    const salon = getReservationSalon(updated, data.salones)
    const ownerId = getReservationOwnerId(updated, data.salones, data.usuarios)
    const salonId = salon?.id ?? updated.salonesIds?.[0] ?? ''
    const salonName = salon?.name ?? 'tu salón'
    const clientName = currentUser?.nombre ?? 'Un cliente'
    await Promise.all([
      ownerId ? createNotification({
        usuarioId: ownerId,
        rolDestino: 'dueno',
        tipo: 'reservacion_cancelada',
        titulo: 'Reservación cancelada',
        mensaje: `${clientName} canceló la reservación para ${salonName}.`,
        reservacionId: updated.id,
        salonId,
      }, { dedupeKey: `cancelacion-cliente-dueno-${updated.id}` }) : Promise.resolve(null),
      createAdminNotifications({
        tipo: 'reservacion_cancelada',
        titulo: 'Reservación cancelada',
        mensaje: `${clientName} canceló la reservación para ${salonName}.`,
        reservacionId: updated.id,
        salonId,
      }, { dedupeKey: `cancelacion-cliente-admin-${updated.id}` }),
    ])

    const message = reservation.estadoPago === 'pagado'
      ? 'Reservación cancelada. El pago ya realizado no fue reembolsado automáticamente.'
      : 'Reservación cancelada.'
    notify(message, 'info')
    return { ok: true, reservation: updated, message }
  }

  const archiveOwnerChat = async (id) => {
    const reservation = data.reservaciones.find((item) => item.id === id)
    if (!reservation) return { ok: false, message: 'Reservación no encontrada.' }
    const ownerId = getReservationOwnerId(reservation, data.salones, data.usuarios)
    if (currentUser?.rol !== 'dueno' || ownerId !== currentUser.id) {
      return { ok: false, message: 'Solo el dueño de la reservación puede eliminar este chat.' }
    }
    if (reservation.chatEliminadoPorDueno) {
      return { ok: true, reservation, message: 'El chat ya estaba eliminado.' }
    }

    try {
      const updated = await actualizarReservacion(id, {
        chatEliminadoPorDueno: true,
        chatEliminadoPor: currentUser.id,
        fechaEliminacionChat: format(new Date(), 'yyyy-MM-dd'),
      })
      refreshData({ ...data, reservaciones: data.reservaciones.map((item) => item.id === id ? updated : item) })
      notify('Chat eliminado para esta reservación.', 'info')
      return { ok: true, reservation: updated, message: 'Chat eliminado.' }
    } catch (error) {
      console.error('No se pudo eliminar el chat:', error)
      notify('No se pudo eliminar el chat.', 'warning')
      return { ok: false, message: 'No se pudo eliminar el chat.' }
    }
  }

  const saveStripeSessionReference = async ({ reservationId, paymentId, sessionId }) => {
    if (!reservationId || !sessionId) return null

    try {
      const paymentUpdates = {
        identificadorPagoStripe: sessionId,
        identificadorSesionStripe: sessionId,
      }
      const [updatedReservation, updatedPayment] = await Promise.all([
        actualizarReservacion(reservationId, { identificadorPagoStripe: sessionId }),
        paymentId
          ? actualizarPago(paymentId, paymentUpdates).catch((error) => {
            console.warn('No se pudo guardar sessionId por pagoId; se intentará por reservacionId:', error)
            return actualizarPagoPorReservacion(reservationId, paymentUpdates)
          })
          : actualizarPagoPorReservacion(reservationId, paymentUpdates),
      ])

      setData((currentData) => syncSalonAvailability({
        ...currentData,
        pagos: updatedPayment
          ? currentData.pagos.some((item) => item.id === updatedPayment.id)
            ? currentData.pagos.map((item) => (item.id === updatedPayment.id ? updatedPayment : item))
            : [...currentData.pagos, updatedPayment]
          : currentData.pagos,
        reservaciones: currentData.reservaciones.map((item) => (
          item.id === updatedReservation.id ? { ...item, ...updatedReservation } : item
        )),
      }))

      return { reservation: updatedReservation, payment: updatedPayment }
    } catch (error) {
      console.warn('No se pudo guardar la referencia de la sesión de Stripe:', error)
      return null
    }
  }

  const selectSalon = (salonId) => setBookingDraft((draft) => ({ ...draft, salonId }))
  const selectDate = (date) => setBookingDraft((draft) => ({ ...draft, date }))
  const toggleService = (serviceId) => setBookingDraft((draft) => ({
    ...draft,
    servicesIds: draft.servicesIds.includes(serviceId)
      ? draft.servicesIds.filter((id) => id !== serviceId)
      : [...draft.servicesIds, serviceId],
  }))

  const createReservation = async () => {
    const salon = data.salones.find((item) => item.id === bookingDraft.salonId)
    if (!currentUser?.id || currentUser.rol !== 'cliente') return { ok: false, message: 'Inicia sesión como cliente para crear la reservación.' }
    if (!salon) return { ok: false, message: 'Selecciona un salón válido.' }
    if (isPastDateValue(bookingDraft.date)) return { ok: false, message: 'No puedes reservar fechas anteriores a hoy.' }

    const selectedAvailability = findAvailabilityForSalonDate(data.disponibilidad, salon.id, bookingDraft.date)
    if (!selectedAvailability) {
      return { ok: false, message: 'Selecciona una fecha disponible para este salón.' }
    }
    if (selectedAvailability.estado !== 'disponible') {
      return { ok: false, message: `La fecha seleccionada está ${selectedAvailability.estado}. Elige otra fecha.` }
    }

    const services = data.servicios.filter((service) => bookingDraft.servicesIds.includes(service.id))
    const serviceIds = services.map((service) => service.id)
    const totalServices = services.reduce((total, service) => total + Number(service.precio || 0), 0)
    const owner = findSalonOwner(data.usuarios, salon)
    const priceSalon = Number(salon.basePrice ?? selectedAvailability.precio ?? 0) || 0
    const extraFinDeSemana = getWeekendSurcharge(bookingDraft.date, salon.extraFinSemana)
    const salonIds = [salon.id]
    const total = priceSalon + extraFinDeSemana + totalServices
    const fechaCreacion = format(new Date(), 'yyyy-MM-dd')

    console.log('[reservaciones] creando reservacion')
    const reservation = await crearReservacion({
      clienteId: currentUser.id,
      duenoId: owner?.id ?? salon.duenoId ?? '',
      estadoPago: 'pendiente',
      estadoReservacion: 'pendiente',
      fecha: bookingDraft.date,
      fechaCreacion,
      identificadorChat: PENDING_IDENTIFIER,
      identificadorPagoStripe: PENDING_IDENTIFIER,
      identificadorSalaVideo: PENDING_IDENTIFIER,
      extraFinDeSemana,
      precioSalon: priceSalon,
      salonesIds: salonIds,
      serviciosIds: serviceIds,
      terminosAceptados: { version: TERMS_VERSION, fecha: fechaCreacion },
      total,
      totalServicios: totalServices,
    })
    console.log('[reservaciones] reservacion creada', reservation.id)

    console.log('[reservaciones] creando pago')
    const payment = await crearPago({
      clienteId: currentUser.id,
      estadoPago: 'pendiente',
      fechaCreacion,
      fechaPago: null,
      identificadorPagoStripe: PENDING_IDENTIFIER,
      metodoPago: 'stripe',
      monto: total,
      reservacionId: reservation.id,
      salonesIds: salonIds,
      tipoPago: 'apartado',
    })
    console.log('[reservaciones] pago creado', payment.id)

    console.log('[reservaciones] actualizando disponibilidad')
    const updatedAvailability = await actualizarDisponibilidad(selectedAvailability.id, {
      estado: 'reservada',
      reservacionId: reservation.id,
    })
    console.log('[reservaciones] disponibilidad actualizada', updatedAvailability.id)

    const disponibilidad = data.disponibilidad.map((item) => item.id === selectedAvailability.id ? updatedAvailability : item)
    refreshData({ ...data, disponibilidad, reservaciones: [...data.reservaciones, reservation], pagos: [...data.pagos, payment] })
    await notifyReservationCreated(reservation, salon, currentUser)

    if (!firebaseConfigured) {
      notify(STRIPE_PENDING_MESSAGE, 'warning')
      return { ok: true, reservation, payment, message: STRIPE_PENDING_MESSAGE }
    }

    console.log('[reservaciones] iniciando stripe')
    try {
      const checkout = await createStripeCheckout({
        reservationId: reservation.id,
        paymentId: payment.id,
        total,
      })
      if (!checkout.url) throw new Error('Stripe no devolvió una URL de pago válida.')
      await saveStripeSessionReference({
        reservationId: reservation.id,
        paymentId: payment.id,
        sessionId: checkout.sessionId,
      })
      return {
        ok: true,
        checkoutUrl: checkout.url,
        reservation,
        payment,
      }
    } catch (error) {
      console.warn('[reservaciones] stripe fallo', error)
      notify(STRIPE_PENDING_MESSAGE, 'warning')
      return {
        ok: true,
        reservation,
        payment,
        message: STRIPE_PENDING_MESSAGE,
        stripeError: error.message,
      }
    }
  }

  const startStripePayment = async (reservationId) => {
    try {
      const reservacion = data.reservaciones.find((item) => item.id === reservationId)
      if (!reservacion) return { ok: false, message: 'Reservación no encontrada.' }
      const reservationSalon = data.salones.find((salon) => reservacion.salonesIds?.includes(salon.id))
      const fallbackWeekendExtra = Number(reservacion.extraFinDeSemana ?? getWeekendSurcharge(reservacion.fecha, reservationSalon?.extraFinSemana)) || 0

      const pago = data.pagos.find((item) => item.reservacionId === reservacion.id)
        ?? await getPagoPorReservacion(reservacion.id)
      const total = Number(
        pago?.monto ?? reservacion.total ?? (Number(reservacion.precioSalon || 0) + fallbackWeekendExtra + Number(reservacion.totalServicios || 0)),
      )
      const payload = {
        reservationId: reservacion.id,
        paymentId: pago?.id,
        total,
      }

      console.log('Iniciando pago Stripe', { reservationId: reservacion.id })
      console.log('URL backend Stripe:', `${getStripeBackendUrl()}/stripe/checkout-session`)
      console.log('Reservacion para Stripe:', reservacion)
      console.log('Payload Stripe:', payload)

      if (!Number.isFinite(total) || total <= 0) {
        return { ok: false, message: 'Falta un total válido de la reservación en pesos mexicanos.' }
      }

      const checkout = await createStripeCheckout(payload)
      console.log('Respuesta backend Stripe:', checkout)
      if (checkout.status === 'paid') {
        const checkoutPayment = checkout.payment ?? checkout.pago
        const checkoutReservation = checkout.reservation ?? checkout.reservacion
        await markStripePaymentAsPaid({
          sessionId: checkout.sessionId ?? checkoutPayment?.identificadorSesionStripe ?? checkoutPayment?.identificadorPagoStripe ?? reservacion.identificadorPagoStripe,
          reservationId: reservacion.id,
          payment: checkoutPayment,
          reservation: checkoutReservation,
        })
        notify('Este pago ya fue confirmado por Stripe.')
        return { ok: true, paid: true }
      }
      if (checkout.status === 'processing') {
        notify('Stripe está procesando este pago. Te avisaremos cuando termine.', 'info')
        return { ok: true, processing: true }
      }
      if (!checkout.url) return { ok: false, message: 'Stripe no devolvió una URL de pago válida.' }
      await saveStripeSessionReference({
        reservationId: reservacion.id,
        paymentId: pago?.id ?? checkout.paymentId,
        sessionId: checkout.sessionId,
      })
      window.location.assign(checkout.url)
      return { ok: true }
    } catch (error) {
      console.error('Error Stripe:', error)
      return { ok: false, message: error.message }
    }
  }

  const markStripePaymentAsPaid = async ({ sessionId, reservationId, payment, reservation }) => {
    const resolvedReservationId = reservation?.id ?? payment?.reservacionId ?? reservationId
    if (!resolvedReservationId) return { ok: false, message: 'No se pudo identificar la reservación pagada.' }

    const explicitPaymentId = payment?.id && payment.id !== resolvedReservationId ? payment.id : null
    const currentPayment = data.pagos.find((item) => (
      item.id === explicitPaymentId || item.reservacionId === resolvedReservationId
    ))
    const storedPayment = currentPayment ?? await getPagoPorReservacion(resolvedReservationId)
    const paymentId = explicitPaymentId ?? storedPayment?.id
    const fechaPago = format(new Date(), 'yyyy-MM-dd')
    const stripeIdentifier = sessionId
      ?? payment?.identificadorSesionStripe
      ?? payment?.identificadorPagoStripe
      ?? reservation?.identificadorPagoStripe

    let updatedPayment = null
    const paymentUpdates = removeUndefinedFields({
      estadoPago: 'pagado',
      fechaPago,
      identificadorPagoStripe: stripeIdentifier,
      identificadorSesionStripe: sessionId ?? stripeIdentifier,
    })

    if (paymentId) {
      try {
        updatedPayment = await actualizarPago(paymentId, paymentUpdates)
      } catch (error) {
        console.warn('No se pudo actualizar pagos por pagoId; se intentará por reservacionId:', error)
        updatedPayment = await actualizarPagoPorReservacion(resolvedReservationId, paymentUpdates)
      }
    } else {
      updatedPayment = await actualizarPagoPorReservacion(resolvedReservationId, paymentUpdates)
    }

    if (!updatedPayment) {
      console.warn('No se encontró documento en pagos para la reservación pagada:', resolvedReservationId)
    }

    const updatedReservation = await actualizarReservacion(resolvedReservationId, removeUndefinedFields({
      estadoPago: 'pagado',
      identificadorPagoStripe: stripeIdentifier,
    }))

    setData((currentData) => syncSalonAvailability({
      ...currentData,
      pagos: updatedPayment
        ? currentData.pagos.some((item) => item.id === updatedPayment.id)
          ? currentData.pagos.map((item) => (
            item.id === updatedPayment.id ? { ...item, ...payment, ...updatedPayment } : item
          ))
          : [...currentData.pagos, updatedPayment]
        : currentData.pagos,
      reservaciones: currentData.reservaciones.map((item) => (
        item.id === updatedReservation.id ? { ...item, ...reservation, ...updatedReservation } : item
      )),
    }))
    return { ok: true }
  }

  const confirmStripePayment = async (sessionId, reservationId) => {
    try {
      const result = await syncStripeCheckout(sessionId).catch((error) => {
        console.warn('No se pudo consultar Stripe; se usará el session_id del redirect:', error)
        return null
      })
      const paidStatuses = ['paid', 'pagado', 'succeeded', 'complete']
      const resultPayment = result?.payment ?? result?.pago
      const resultReservation = result?.reservation ?? result?.reservacion
      const statusCandidates = [
        result?.status,
        result?.paymentStatus,
        result?.payment_status,
        result?.session?.payment_status,
        result?.session?.status,
        resultPayment?.estadoPago,
        resultReservation?.estadoPago,
      ].filter(Boolean).map((status) => String(status).toLowerCase())
      const isPaid = !result || statusCandidates.some((status) => paidStatuses.includes(status))

      if (!isPaid) {
        return { ok: false, message: 'Stripe todavía no confirma el pago.' }
      }
      return markStripePaymentAsPaid({
        sessionId,
        reservationId,
        payment: resultPayment,
        reservation: resultReservation,
      })
    } catch (error) {
      return { ok: false, message: error.message }
    }
  }

  const currentUserNotifications = sortNotifications((data.notificaciones ?? []).filter((notification) => (
    notificationBelongsToUser(notification, currentUser)
  )))
  const unreadNotificationsCount = currentUserNotifications.filter((notification) => !notification.leida).length

  const markNotificationRead = async (id) => {
    const notification = (data.notificaciones ?? []).find((item) => item.id === id)
    if (!notification || notification.leida) return null
    try {
      const updated = await actualizarNotificacion(id, { leida: true })
      setData((currentData) => ({
        ...currentData,
        notificaciones: (currentData.notificaciones ?? []).map((item) => item.id === id ? updated : item),
      }))
      return updated
    } catch (error) {
      console.error('No se pudo marcar la notificación como leída:', error)
      notify('No se pudo marcar la notificación como leída.', 'warning')
      return null
    }
  }

  const markAllNotificationsRead = async () => {
    const unread = currentUserNotifications.filter((notification) => !notification.leida)
    await Promise.all(unread.map((notification) => markNotificationRead(notification.id)))
  }

  const value = {
    data,
    dataSource,
    dataError,
    authMode: firebaseConfigured ? 'firebase' : 'demo',
    authReady,
    currentUser,
    setCurrentUser,
    bookingDraft,
    setBookingDraft,
    toast,
    notify,
    loginAs,
    loginWithCredentials,
    registerClient,
    resendVerificationEmail,
    logout,
    createUser,
    toggleUser,
    updateClientProfile,
    createSalon,
    toggleSalon,
    createService,
    toggleServiceActive,
    createAvailability,
    updateAvailability,
    updateReservationStatus,
    cancelReservation,
    archiveOwnerChat,
    selectSalon,
    selectDate,
    toggleService,
    createReservation,
    startStripePayment,
    confirmStripePayment,
    currentUserNotifications,
    unreadNotificationsCount,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    notifyMessageSent,
    notifyVideoCallStarted,
    dateLocale: es,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)

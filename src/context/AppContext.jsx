import { createContext, useContext, useEffect, useState } from 'react'
import { addDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  actualizarDisponibilidad,
  actualizarReservacion,
  actualizarSalon,
  actualizarServicio,
  actualizarUsuario,
  crearDisponibilidad,
  crearPago,
  crearReservacion,
  crearSalon,
  crearServicio,
  crearUsuario,
  getDatabaseSnapshot,
  mergeAvailabilityIntoSalons,
} from '../services/firestoreService'
import { cloneMockDatabase } from '../data/mockData'
import { firebaseConfigured } from '../services/firebaseClient'
import {
  getFirebaseUserProfile,
  registerWithFirebase,
  signInWithFirebase,
  signOutFromFirebase,
  subscribeToAuthState,
} from '../services/authService'

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

const syncSalonAvailability = (nextData) => ({
  ...nextData,
  salones: mergeAvailabilityIntoSalons(nextData.salones, nextData.disponibilidad),
})

const findAvailabilityForSalonDate = (records, salonId, date) => records.find((item) => (
  item.fecha === date && item.salonesIds?.includes(salonId)
))

const findSalonOwner = (usuarios, salon) => usuarios.find((user) => (
  user.rol === 'dueno' && (user.id === salon?.duenoId || user.id === salon?.ownerId || user.salonesIds?.includes(salon?.id))
))

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

  const notify = (message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }

  const refreshData = (nextData) => setData(syncSalonAvailability(nextData))

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
          setCurrentUser(profile)
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
        const profile = await getFirebaseUserProfile(credential.user.uid)
        if (!profile) {
          await signOutFromFirebase()
          return { ok: false, message: 'La cuenta existe, pero no tiene un perfil en usuarios.' }
        }
        if (!profile.activo) {
          await signOutFromFirebase()
          return { ok: false, message: 'Esta cuenta está desactivada. Contacta a MediaLuna.' }
        }
        setCurrentUser(profile)
        notify(`Bienvenido de vuelta, ${profile.nombre.split(' ')[0]}`)
        return { ok: true, user: profile }
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
        const result = await registerWithFirebase({
          nombre: nombre.trim(),
          correo: normalizedEmail,
          telefono: telefono.trim(),
          password,
        })
        refreshData({ ...data, usuarios: [...data.usuarios, result.profile] })
        setCurrentUser(result.profile)
        notify('Cuenta creada. Bienvenido a MediaLuna.')
        return { ok: true, user: result.profile }
      } catch (error) {
        return { ok: false, message: getAuthErrorMessage(error) }
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

  const updateReservationStatus = async (id, estadoReservacion) => {
    const updated = await actualizarReservacion(id, { estadoReservacion })
    refreshData({ ...data, reservaciones: data.reservaciones.map((item) => item.id === id ? updated : item) })
    notify(`Reservación marcada como ${estadoReservacion}`, 'info')
    return updated
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
    if (!currentUser) return { ok: false, message: 'Inicia sesión como cliente para crear la reservación.' }
    if (!salon) return { ok: false, message: 'Selecciona un salón válido.' }

    const salonAvailability = data.disponibilidad.filter((item) => item.salonesIds?.includes(salon.id))
    const selectedAvailability = findAvailabilityForSalonDate(data.disponibilidad, salon.id, bookingDraft.date)
    if (selectedAvailability && selectedAvailability.estado !== 'disponible') {
      return { ok: false, message: `La fecha seleccionada está ${selectedAvailability.estado}. Elige otra fecha.` }
    }
    if (salonAvailability.length && !selectedAvailability) {
      return { ok: false, message: 'Selecciona una fecha disponible para este salón.' }
    }

    const services = data.servicios.filter((service) => bookingDraft.servicesIds.includes(service.id))
    const totalServices = services.reduce((total, service) => total + service.precio, 0)
    const owner = findSalonOwner(data.usuarios, salon)
    const priceSalon = selectedAvailability?.precio ?? salon.basePrice ?? 0
    const salonIds = [salon.id]
    const reservation = await crearReservacion({
      clienteId: currentUser.id,
      duenoId: owner?.id ?? salon.duenoId ?? '',
      estadoPago: 'pendiente',
      estadoReservacion: 'pendiente',
      fecha: bookingDraft.date,
      fechaCreacion: format(new Date(), 'yyyy-MM-dd'),
      identificadorChat: null,
      identificadorPagoStripe: null,
      identificadorSalaVideo: null,
      precioSalon: priceSalon,
      salonesIds: salonIds,
      serviciosIds: bookingDraft.servicesIds,
      total: priceSalon + totalServices,
      totalServicios: totalServices,
    })
    const payment = await crearPago({
      clienteId: currentUser.id,
      estadoPago: 'pendiente',
      fechaCreacion: format(new Date(), 'yyyy-MM-dd'),
      fechaPago: null,
      identificadorPagoStripe: null,
      metodoPago: 'stripe',
      monto: reservation.total,
      reservacionId: reservation.id,
      salonesIds: salonIds,
      tipoPago: 'total',
    })
    let disponibilidad = data.disponibilidad
    if (selectedAvailability) {
      const updatedAvailability = await actualizarDisponibilidad(selectedAvailability.id, { estado: 'reservada' })
      disponibilidad = data.disponibilidad.map((item) => item.id === selectedAvailability.id ? updatedAvailability : item)
    }
    refreshData({ ...data, disponibilidad, reservaciones: [...data.reservaciones, reservation], pagos: [...data.pagos, payment] })
    notify('Reservación creada. El pago queda pendiente de conexión.')
    return { ok: true, reservation }
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
    selectSalon,
    selectDate,
    toggleService,
    createReservation,
    dateLocale: es,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)

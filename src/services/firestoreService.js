import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { format, isValid, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import * as mockDb from './mockDb'
import { db, firebaseConfigured } from './firebaseClient'

export const COLLECTIONS = {
  usuarios: 'usuarios',
  salones: 'salones',
  servicios: 'servicios',
  disponibilidad: 'disponibilidad',
  reservaciones: 'reservaciones',
  pagos: 'pagos',
}

const asArray = (value) => Array.isArray(value) ? value : []

const normalizeDateOnly = (value) => {
  if (!value || typeof value !== 'string') return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = parse(value.replaceAll('.', ''), 'd MMM yyyy', new Date(), { locale: es })
  return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : value
}

const normalizeRecord = (collectionName, id, rawData) => {
  const record = { id, ...rawData }

  if (collectionName === COLLECTIONS.usuarios) {
    record.salonesIds = asArray(record.salonesIds)
  }

  if (collectionName === COLLECTIONS.salones) {
    record.availableDates = asArray(record.availableDates).map(normalizeDateOnly)
    record.photos = asArray(record.photos)
    record.serviciosIds = asArray(record.serviciosIds)
    record.locationLabel = Array.isArray(record.location)
      ? record.location.join(', ')
      : record.location ?? ''
    if (!record.photos.length && record.urlImagen) record.photos = [record.urlImagen]
  }

  if (collectionName === COLLECTIONS.disponibilidad) {
    record.salonesIds = asArray(record.salonesIds)
    record.fecha = normalizeDateOnly(record.fecha)
  }

  if (collectionName === COLLECTIONS.reservaciones) {
    record.salonesIds = asArray(record.salonesIds)
    record.serviciosIds = asArray(record.serviciosIds)
    record.duenoId = Array.isArray(record.duenoId) ? record.duenoId : (record.duenoId ? [record.duenoId] : [])
    record.fecha = normalizeDateOnly(record.fecha)
  }

  if (collectionName === COLLECTIONS.pagos) {
    record.salonesIds = asArray(record.salonesIds)
  }

  return record
}

const readCollection = async (collectionName) => {
  if (!firebaseConfigured || !db) return mockDb.getCollection(collectionName)
  const snapshot = await getDocs(collection(db, collectionName))
  return snapshot.docs.map((item) => normalizeRecord(collectionName, item.id, item.data()))
}

export const getUsuarios = () => readCollection(COLLECTIONS.usuarios)
export const getSalones = () => readCollection(COLLECTIONS.salones)
export const getServicios = () => readCollection(COLLECTIONS.servicios)
export const getDisponibilidad = () => readCollection(COLLECTIONS.disponibilidad)
export const getReservaciones = () => readCollection(COLLECTIONS.reservaciones)
export const getPagos = () => readCollection(COLLECTIONS.pagos)

export async function getDatabaseSnapshot() {
  const [usuarios, salones, servicios, disponibilidad, reservaciones, pagos] = await Promise.all([
    getUsuarios(),
    getSalones(),
    getServicios(),
    getDisponibilidad(),
    getReservaciones(),
    getPagos(),
  ])

  return { usuarios, salones, servicios, disponibilidad, reservaciones, pagos }
}

export const getUsuarioActual = async () => {
  const usuarios = await getUsuarios()
  return usuarios.find((usuario) => usuario.rol === 'cliente' && usuario.activo) ?? null
}

const removeUndefined = (data) => Object.fromEntries(
  Object.entries(data).filter(([, value]) => value !== undefined),
)

const toFirestoreData = (collectionName, input, isCreate = false) => {
  const data = { ...input }
  delete data.id
  delete data.locationLabel
  // ownerId existed only in the original mock. Owners relate through usuarios.salonesIds.
  delete data.ownerId

  if (collectionName === COLLECTIONS.usuarios) {
    data.salonesIds = asArray(data.salonesIds)
    if (isCreate || typeof data.fechaCreacion === 'string') data.fechaCreacion = Timestamp.now()
  }

  if (collectionName === COLLECTIONS.salones) {
    data.availableDates = asArray(data.availableDates).map(normalizeDateOnly)
    data.photos = asArray(data.photos)
    data.serviciosIds = asArray(data.serviciosIds)
    if (data.urlImagen === '') data.urlImagen = null
    if (data.idPublicoCloudinary === '') data.idPublicoCloudinary = null
  }

  if (collectionName === COLLECTIONS.disponibilidad) {
    data.salonesIds = asArray(data.salonesIds)
    data.fecha = normalizeDateOnly(data.fecha)
  }

  if (collectionName === COLLECTIONS.reservaciones) {
    data.salonesIds = asArray(data.salonesIds)
    data.serviciosIds = asArray(data.serviciosIds)
    data.duenoId = Array.isArray(data.duenoId) ? data.duenoId : (data.duenoId ? [data.duenoId] : [])
    if (isCreate || typeof data.fechaCreacion === 'string') data.fechaCreacion = Timestamp.now()
    for (const key of ['identificadorChat', 'identificadorPagoStripe', 'identificadorSalaVideo']) {
      if (data[key] === '') data[key] = null
    }
  }

  if (collectionName === COLLECTIONS.pagos) {
    data.salonesIds = asArray(data.salonesIds)
    if (isCreate || typeof data.fechaCreacion === 'string') data.fechaCreacion = Timestamp.now()
    if (data.fechaPago === '') data.fechaPago = null
    if (data.identificadorPagoStripe === '') data.identificadorPagoStripe = null
  }

  return removeUndefined(data)
}

const createDocument = async (collectionName, input) => {
  if (!firebaseConfigured || !db) return mockDb.createDocument(collectionName, input)

  const data = toFirestoreData(collectionName, input, true)
  if (input.id) {
    await setDoc(doc(db, collectionName, input.id), data)
    return normalizeRecord(collectionName, input.id, data)
  }

  const reference = await addDoc(collection(db, collectionName), data)
  return normalizeRecord(collectionName, reference.id, data)
}

const updateDocument = async (collectionName, id, updates) => {
  if (!firebaseConfigured || !db) return mockDb.updateDocument(collectionName, id, updates)

  await updateDoc(doc(db, collectionName, id), toFirestoreData(collectionName, updates))
  const updated = await getDoc(doc(db, collectionName, id))
  return normalizeRecord(collectionName, updated.id, updated.data())
}

export const crearReservacion = (data) => createDocument(COLLECTIONS.reservaciones, data)
export const actualizarReservacion = (id, updates) => updateDocument(COLLECTIONS.reservaciones, id, updates)
export const actualizarSalon = (id, updates) => updateDocument(COLLECTIONS.salones, id, updates)
export const crearUsuario = (data) => createDocument(COLLECTIONS.usuarios, data)
export const crearSalon = (data) => createDocument(COLLECTIONS.salones, data)
export const actualizarUsuario = (id, updates) => updateDocument(COLLECTIONS.usuarios, id, updates)
export const crearServicio = (data) => createDocument(COLLECTIONS.servicios, data)
export const actualizarDisponibilidad = (id, updates) => updateDocument(COLLECTIONS.disponibilidad, id, updates)
export const crearPago = (data) => createDocument(COLLECTIONS.pagos, data)


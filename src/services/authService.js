import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { auth, db, firebaseConfigured } from './firebaseClient'

const USERS_COLLECTION = 'usuarios'

const normalizeProfile = (snapshot) => {
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return {
    id: snapshot.id,
    ...data,
    salonesIds: data.rol === 'dueno' && Array.isArray(data.salonesIds) ? data.salonesIds : [],
  }
}

export const subscribeToAuthState = (callback) => {
  if (!firebaseConfigured || !auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}

export const signInWithFirebase = (correo, password) => {
  if (!firebaseConfigured || !auth) throw new Error('Firebase Authentication no está configurado.')
  return signInWithEmailAndPassword(auth, correo, password)
}

export const signOutFromFirebase = () => {
  if (!firebaseConfigured || !auth) return Promise.resolve()
  return signOut(auth)
}

export async function getFirebaseUserProfile(uid) {
  if (!firebaseConfigured || !db) return null
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid))
  return normalizeProfile(snapshot)
}

export async function registerWithFirebase({ nombre, correo, telefono, password }) {
  if (!firebaseConfigured || !auth || !db) throw new Error('Firebase Authentication no está configurado.')

  const credential = await createUserWithEmailAndPassword(auth, correo, password)
  const profile = {
    activo: true,
    correo,
    fechaCreacion: Timestamp.now(),
    nombre,
    rol: 'cliente',
    telefono,
  }

  await setDoc(doc(db, USERS_COLLECTION, credential.user.uid), profile)
  return { authUser: credential.user, profile: { id: credential.user.uid, ...profile } }
}


import { cloneMockDatabase } from '../data/mockData'

let database = cloneMockDatabase()

const wait = (value) => Promise.resolve(structuredClone(value))

export const resetMockDb = () => {
  database = cloneMockDatabase()
}

export const getCollection = async (collectionName) => wait(database[collectionName] ?? [])

export const getDocument = async (collectionName, id) => {
  const document = database[collectionName]?.find((item) => item.id === id)
  return wait(document ?? null)
}

export const createDocument = async (collectionName, data) => {
  const document = { ...data, id: data.id || `${collectionName.slice(0, -1)}_${Date.now()}` }
  database[collectionName] = [...(database[collectionName] ?? []), document]
  return wait(document)
}

export const updateDocument = async (collectionName, id, updates) => {
  database[collectionName] = (database[collectionName] ?? []).map((item) => (
    item.id === id ? { ...item, ...updates } : item
  ))
  return getDocument(collectionName, id)
}

export const deleteDocument = async (collectionName, id) => {
  database[collectionName] = (database[collectionName] ?? []).filter((item) => item.id !== id)
  return wait({ id })
}

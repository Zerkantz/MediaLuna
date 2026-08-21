export const TEXT_MAX_LENGTH = 50
export const SALON_DESCRIPTION_MAX_LENGTH = 300
export const NUMBER_MAX_VALUE = 9999
export const PRICE_MAX_VALUE = 999999
export const WEEKEND_SURCHARGE = 1500
export const PHONE_MAX_LENGTH = 13
export const PHONE_NATIONAL_DIGITS = 10

export const limitText = (value, max = TEXT_MAX_LENGTH) => String(value ?? '').slice(0, max)

export const normalizeNumberInput = (value, { min = 0, max = NUMBER_MAX_VALUE } = {}) => {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  const numeric = Math.min(max, Math.max(min, Number(digits)))
  return String(numeric)
}

export const toBoundedNumber = (value, { min = 0, max = NUMBER_MAX_VALUE, fallback = 0 } = {}) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

export const normalizePriceInput = (value) => normalizeNumberInput(value, { min: 0, max: PRICE_MAX_VALUE })

export const toBoundedPrice = (value, options = {}) => toBoundedNumber(value, {
  min: 0,
  max: PRICE_MAX_VALUE,
  fallback: 0,
  ...options,
})

export const normalizePhoneInput = (value) => {
  const raw = String(value ?? '').replace(/[^\d+]/g, '')
  const hasInternationalPrefix = raw.startsWith('+')
  const digits = raw.replace(/\D/g, '')
  if (hasInternationalPrefix) return `+${digits.slice(0, PHONE_MAX_LENGTH - 1)}`
  return digits.slice(0, PHONE_NATIONAL_DIGITS)
}

export const isValidPhoneInput = (value) => {
  const phone = String(value ?? '').trim()
  if (!phone) return false
  if (phone.startsWith('+')) return /^\+\d{1,12}$/.test(phone) && phone.length <= PHONE_MAX_LENGTH
  return /^\d{1,10}$/.test(phone)
}

const parseDateInput = (value) => {
  const [year, month, day] = String(value ?? '').split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

export const getTodayDateInputValue = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const isPastDateValue = (value) => {
  const date = parseDateInput(value)
  const today = parseDateInput(getTodayDateInputValue())
  if (!date || !today) return false
  return date < today
}

export const isWeekendDate = (value) => {
  const date = parseDateInput(value)
  if (!date) return false
  const day = date.getDay()
  return day === 0 || day === 6
}

export const getWeekendSurcharge = (value) => isWeekendDate(value) ? WEEKEND_SURCHARGE : 0

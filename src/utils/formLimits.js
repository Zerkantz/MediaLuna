export const TEXT_MAX_LENGTH = 300
export const NUMBER_MAX_VALUE = 9999
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

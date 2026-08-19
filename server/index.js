import cors from 'cors'
import { randomUUID } from 'crypto'
import dotenv from 'dotenv'
import express from 'express'
import Stripe from 'stripe'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

dotenv.config()
dotenv.config({ path: '.env.local', override: true })

const LOCAL_FRONTEND_URL = 'http://localhost:5173'
const normalizeOrigin = (origin = '') => origin.trim().replace(/\/$/, '')
const parseOriginList = (value) => String(value || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean)

const requiredEnvironment = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name])

if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) missingEnvironment.push('APP_URL')

if (missingEnvironment.length) {
  throw new Error(`Faltan variables de entorno: ${missingEnvironment.join(', ')}`)
}

const parseServiceAccount = () => {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountJson) return null

  let account
  try {
    account = JSON.parse(serviceAccountJson)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON debe contener un JSON valido de cuenta de servicio.')
  }

  if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, '\n')
  return account
}

const serviceAccount = parseServiceAccount()
if (!getApps().length) {
  initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id,
  })
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const db = getFirestore()
const app = express()
const port = Number(process.env.PORT) || 4242
const appUrls = parseOriginList(process.env.APP_URL || LOCAL_FRONTEND_URL)
const appUrl = appUrls[0] || LOCAL_FRONTEND_URL
const allowedOrigins = [
  LOCAL_FRONTEND_URL,
  'http://127.0.0.1:5173',
  ...appUrls,
  ...parseOriginList(process.env.CORS_ORIGINS),
].filter((origin, index, origins) => origin && origins.indexOf(origin) === index)

const isLocalDevOrigin = (origin) => {
  if (process.env.NODE_ENV === 'production' || !origin) return false
  try {
    const { hostname } = new URL(origin)
    return ['localhost', '127.0.0.1', '::1'].includes(hostname)
  } catch {
    return false
  }
}
const isAllowedOrigin = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin)
  return !normalizedOrigin || allowedOrigins.includes(normalizedOrigin) || isLocalDevOrigin(normalizedOrigin)
}
const getAppUrl = () => appUrl
const asDateOnly = (value) => typeof value === 'string' ? value : value?.toDate?.().toISOString().slice(0, 10)
const TERMS_VERSION = '2026-08-18'

const formatPaymentMethod = async (paymentIntentId) => {
  if (!paymentIntentId) return 'Stripe'
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] })
  const details = intent.latest_charge?.payment_method_details
  if (details?.card) {
    const brand = details.card.brand.charAt(0).toUpperCase() + details.card.brand.slice(1)
    return `${brand} •••• ${details.card.last4}`
  }
  return details?.type || 'Stripe'
}

const authenticate = async (request, response, next) => {
  const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return response.status(401).json({ error: 'Inicia sesión para realizar el pago.' })

  try {
    request.user = await getAuth().verifyIdToken(token)
    const profile = await db.collection('usuarios').doc(request.user.uid).get()
    if (!profile.exists || profile.data().activo === false) {
      return response.status(403).json({ error: 'La cuenta no tiene permiso para realizar pagos.' })
    }
    return next()
  } catch {
    return response.status(401).json({ error: 'La sesión expiró. Inicia sesión nuevamente.' })
  }
}

const getPaymentForReservation = async (reservationId) => {
  const snapshot = await db.collection('pagos').where('reservacionId', '==', reservationId).limit(1).get()
  return snapshot.empty ? null : snapshot.docs[0]
}

const getAvailabilityForReservation = async (reservation) => {
  const snapshot = await db.collection('disponibilidad')
    .where('salonesIds', 'array-contains', reservation.salonesIds?.[0])
    .get()
  return snapshot.docs.find((item) => asDateOnly(item.data().fecha) === asDateOnly(reservation.fecha)) || null
}

const updateLedgerByPaymentIntent = async (paymentIntentId, updates) => {
  if (!paymentIntentId) return
  const snapshot = await db.collection('pagos')
    .where('identificadorPagoStripe', '==', paymentIntentId)
    .limit(1)
    .get()
  let paymentDocument = snapshot.docs[0]
  if (!paymentDocument) {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (intent.metadata?.paymentId) paymentDocument = await db.collection('pagos').doc(intent.metadata.paymentId).get()
  }
  if (!paymentDocument?.exists) return
  const reservationId = paymentDocument.data().reservacionId
  const reservationReference = reservationId ? db.collection('reservaciones').doc(reservationId) : null
  await db.runTransaction(async (transaction) => {
    const currentPayment = await transaction.get(paymentDocument.ref)
    const currentStatus = currentPayment.data()?.estadoPago
    const incomingStatus = updates.payment.estadoPago
    const refundedStatuses = ['reembolsado', 'reembolso_parcial']
    if (refundedStatuses.includes(currentStatus) && !refundedStatuses.includes(incomingStatus)) return
    transaction.update(paymentDocument.ref, updates.payment)
    if (reservationReference) transaction.update(reservationReference, updates.reservation)
  })
}

const getCheckoutData = async ({ salonId, date, serviceIds = [], requireAvailable = true }) => {
  if (!salonId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Array.isArray(serviceIds)) {
    throw Object.assign(new Error('Los datos de la reservación no son válidos.'), { status: 400 })
  }
  const uniqueServiceIds = [...new Set(serviceIds.filter((serviceId) => typeof serviceId === 'string'))]
  if (uniqueServiceIds.length !== serviceIds.length || uniqueServiceIds.length > 20) {
    throw Object.assign(new Error('La selección de servicios no es válida.'), { status: 400 })
  }

  const [salonDocument, availabilitySnapshot, ...serviceDocuments] = await Promise.all([
    db.collection('salones').doc(salonId).get(),
    db.collection('disponibilidad').where('salonesIds', 'array-contains', salonId).get(),
    ...uniqueServiceIds.map((serviceId) => db.collection('servicios').doc(serviceId).get()),
  ])
  const salon = salonDocument.data()
  const availabilityDocument = availabilitySnapshot.docs.find((item) => asDateOnly(item.data().fecha) === date)
  const availability = availabilityDocument?.data()

  if (!salonDocument.exists || salon.active === false || salon.estado === 'archivado') {
    throw Object.assign(new Error('El salón ya no está disponible.'), { status: 404 })
  }
  if (!availabilityDocument || (requireAvailable && availability.estado !== 'disponible')) {
    throw Object.assign(new Error('La fecha seleccionada ya no está disponible.'), { status: 409 })
  }
  if (serviceDocuments.some((item) => !item.exists || item.data().activo === false)) {
    throw Object.assign(new Error('Uno de los servicios seleccionados ya no está disponible.'), { status: 409 })
  }
  if (uniqueServiceIds.some((serviceId) => !salon.serviciosIds?.includes(serviceId))) {
    throw Object.assign(new Error('Uno de los servicios no pertenece al salón seleccionado.'), { status: 409 })
  }

  const services = serviceDocuments.map((item) => ({ id: item.id, ...item.data() }))
  const priceSalon = Number(availability.precio ?? salon.basePrice ?? 0)
  const totalServices = services.reduce((total, service) => total + Number(service.precio || 0), 0)
  const total = priceSalon + totalServices
  if (!Number.isFinite(total) || total <= 0) {
    throw Object.assign(new Error('No se pudo determinar un importe válido.'), { status: 409 })
  }

  return {
    salon: { id: salonDocument.id, ...salon },
    availabilityDocument,
    services,
    priceSalon,
    totalServices,
    total,
  }
}

const createCheckoutSession = ({ appUrl, amount, salonName, reservationId, paymentId, user, attemptId = 'initial' }) => {
  const amountInCents = Math.round(Number(amount) * 100)
  if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
    throw Object.assign(new Error('El importe de la reservación no es válido para Stripe.'), { status: 409 })
  }
  console.log('Creando Stripe Checkout Session:', {
    reservationId,
    paymentId,
    amount,
    amountInCents,
    currency: 'mxn',
  })

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email,
    client_reference_id: reservationId,
    expires_at: Math.floor(Date.now() / 1000) + (31 * 60),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'mxn',
        unit_amount: amountInCents,
        product_data: { name: `Reservación: ${salonName}` },
      },
    }],
    metadata: { reservationId, paymentId, firebaseUid: user.uid },
    payment_intent_data: {
      metadata: { reservationId, paymentId, firebaseUid: user.uid },
    },
    success_url: `${appUrl}/cliente/reservaciones/${reservationId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/cliente/reservaciones/${reservationId}?payment=cancelled`,
  }, { idempotencyKey: `checkout-${paymentId}-${attemptId}` })
}

const refundInvalidCheckout = async (session, paymentReference, reservationReference, updateLedger) => {
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntentId) throw new Error('No se encontró el PaymentIntent para devolver el cobro inválido.')
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    reason: 'requested_by_customer',
    metadata: { checkoutSessionId: session.id, motivo: 'reservacion_no_pagable' },
  }, { idempotencyKey: `refund-invalid-${session.id}` })

  if (updateLedger) {
    const reservationDocument = await reservationReference.get()
    const reservation = reservationDocument.data()
    const availabilitySnapshot = await db.collection('disponibilidad')
      .where('salonesIds', 'array-contains', reservation.salonesIds?.[0])
      .get()
    const availabilityDocument = availabilitySnapshot.docs.find((item) => asDateOnly(item.data().fecha) === asDateOnly(reservation.fecha))

    await db.runTransaction(async (transaction) => {
      const [currentPayment, currentAvailability] = await Promise.all([
        transaction.get(paymentReference),
        availabilityDocument ? transaction.get(availabilityDocument.ref) : Promise.resolve(null),
      ])
      if (currentPayment.data()?.identificadorSesionStripe !== session.id) return
      const estadoPago = refund.status === 'succeeded' ? 'reembolsado' : 'reembolso_pendiente'
      transaction.update(paymentReference, {
        estadoPago,
        identificadorPagoStripe: paymentIntentId,
        identificadorSesionStripe: session.id,
        identificadorReembolsoStripe: refund.id,
      })
      transaction.update(reservationReference, {
        estadoPago,
        identificadorPagoStripe: paymentIntentId,
      })
      if (
        currentAvailability?.data()?.reservacionId === reservationReference.id
        && currentAvailability.data().identificadorSesionStripe === session.id
      ) {
        transaction.update(availabilityDocument.ref, {
          estado: 'disponible',
          reservacionId: null,
          identificadorSesionStripe: null,
        })
      }
    })
  }
}

const fulfillCheckout = async (session) => {
  if (session.payment_status !== 'paid') return null

  const { reservationId, paymentId, firebaseUid } = session.metadata || {}
  if (!reservationId || !paymentId || !firebaseUid) throw new Error('La sesión de Stripe no contiene metadata válida.')

  const reservationReference = db.collection('reservaciones').doc(reservationId)
  const paymentReference = db.collection('pagos').doc(paymentId)
  const [reservationDocument, paymentDocument] = await Promise.all([
    reservationReference.get(),
    paymentReference.get(),
  ])

  if (!reservationDocument.exists || !paymentDocument.exists) throw new Error('No se encontró la reservación asociada al pago.')
  if (reservationDocument.data().clienteId !== firebaseUid || paymentDocument.data().clienteId !== firebaseUid) {
    throw new Error('El propietario del pago no coincide con la reservación.')
  }

  const reservation = reservationDocument.data()
  const payment = paymentDocument.data()
  if (payment.estadoPago === 'pagado') {
    return {
      payment: { id: paymentId, ...payment },
      reservation: { id: reservationId, estadoPago: 'pagado', identificadorPagoStripe: reservation.identificadorPagoStripe || null },
    }
  }
  if (payment.estadoPago !== 'pendiente') return { ignored: true }
  const availabilityDocument = await getAvailabilityForReservation(reservation)
  const availability = availabilityDocument?.data()
  const invalidSession = payment.identificadorSesionStripe !== session.id
  const cancelledReservation = reservation.estadoReservacion === 'cancelada'
  const invalidAvailability = (
    availability?.estado !== 'reservada'
    || availability?.reservacionId !== reservationId
    || availability?.identificadorSesionStripe !== session.id
  )
  if (invalidSession || cancelledReservation || invalidAvailability) {
    await refundInvalidCheckout(session, paymentReference, reservationReference, !invalidSession)
    return { refunded: true }
  }

  const expectedAmount = Math.round(Number(payment.monto) * 100)
  if (session.amount_total !== expectedAmount || session.currency !== 'mxn') {
    await refundInvalidCheckout(session, paymentReference, reservationReference, true)
    return { refunded: true }
  }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  const paymentMethod = await formatPaymentMethod(paymentIntentId)
  await db.runTransaction(async (transaction) => {
    const [currentPayment, currentReservation, currentAvailability] = await Promise.all([
      transaction.get(paymentReference),
      transaction.get(reservationReference),
      transaction.get(availabilityDocument.ref),
    ])
    if (currentPayment.data()?.estadoPago === 'pagado') return
    if (
      currentPayment.data()?.identificadorSesionStripe !== session.id
      || currentReservation.data()?.estadoReservacion === 'cancelada'
      || currentAvailability.data()?.estado !== 'reservada'
      || currentAvailability.data()?.reservacionId !== reservationId
      || currentAvailability.data()?.identificadorSesionStripe !== session.id
    ) throw new Error('La reservación dejó de ser pagable durante la confirmación.')
    transaction.update(paymentReference, {
      estadoPago: 'pagado',
      fechaPago: Timestamp.now(),
      identificadorPagoStripe: paymentIntentId || null,
      identificadorSesionStripe: session.id,
      metodoPago: paymentMethod,
    })
    transaction.update(reservationReference, {
      estadoPago: 'pagado',
      identificadorPagoStripe: paymentIntentId || null,
    })
  })

  return {
    payment: {
      id: paymentId,
      estadoPago: 'pagado',
      identificadorPagoStripe: paymentIntentId || null,
      identificadorSesionStripe: session.id,
      metodoPago: paymentMethod,
    },
    reservation: {
      id: reservationId,
      estadoPago: 'pagado',
      identificadorPagoStripe: paymentIntentId || null,
    },
  }
}

const expireCheckout = async (session, paymentStatus = 'expirado') => {
  const { reservationId, paymentId } = session.metadata || {}
  if (!reservationId || !paymentId) return

  const reservationReference = db.collection('reservaciones').doc(reservationId)
  const paymentReference = db.collection('pagos').doc(paymentId)
  const reservationDocument = await reservationReference.get()
  if (!reservationDocument.exists) return
  const reservation = reservationDocument.data()
  const availabilitySnapshot = await db.collection('disponibilidad')
    .where('salonesIds', 'array-contains', reservation.salonesIds?.[0])
    .get()
  const availabilityDocument = availabilitySnapshot.docs.find((item) => asDateOnly(item.data().fecha) === asDateOnly(reservation.fecha))

  await db.runTransaction(async (transaction) => {
    const [currentPayment, currentAvailability] = await Promise.all([
      transaction.get(paymentReference),
      availabilityDocument ? transaction.get(availabilityDocument.ref) : Promise.resolve(null),
    ])
    if (
      !currentPayment.exists
      || currentPayment.data().estadoPago === 'pagado'
      || currentPayment.data().identificadorSesionStripe !== session.id
    ) return
    transaction.update(paymentReference, { estadoPago: paymentStatus })
    transaction.update(reservationReference, { estadoPago: paymentStatus, estadoReservacion: 'cancelada' })
    if (
      currentAvailability?.data()?.reservacionId === reservationId
      && currentAvailability.data().identificadorSesionStripe === session.id
    ) {
      transaction.update(availabilityDocument.ref, {
        estado: 'disponible',
        reservacionId: null,
        identificadorSesionStripe: null,
      })
    }
  })
}

// Stripe needs the untouched request body to verify the webhook signature.
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  let event
  try {
    event = stripe.webhooks.constructEvent(
      request.body,
      request.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (error) {
    return response.status(400).send(`Webhook inválido: ${error.message}`)
  }

  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      await fulfillCheckout(event.data.object)
    }
    if (event.type === 'checkout.session.expired') await expireCheckout(event.data.object)
    if (event.type === 'checkout.session.async_payment_failed') await expireCheckout(event.data.object, 'fallido')
    if (event.type === 'charge.refunded') {
      const charge = event.data.object
      const fullyRefunded = charge.amount_refunded >= charge.amount
      const estadoPago = fullyRefunded ? 'reembolsado' : 'reembolso_parcial'
      await updateLedgerByPaymentIntent(charge.payment_intent, {
        payment: { estadoPago, montoReembolsado: charge.amount_refunded / 100 },
        reservation: { estadoPago },
      })
    }
    if (['refund.updated', 'refund.failed'].includes(event.type)) {
      const refund = event.data.object
      const estadoPago = refund.status === 'succeeded'
        ? 'reembolsado'
        : refund.status === 'failed' ? 'reembolso_fallido' : 'reembolso_pendiente'
      await updateLedgerByPaymentIntent(refund.payment_intent, {
        payment: { estadoPago, identificadorReembolsoStripe: refund.id },
        reservation: { estadoPago },
      })
    }
    if (event.type === 'charge.dispute.created') {
      await updateLedgerByPaymentIntent(event.data.object.payment_intent, {
        payment: { estadoPago: 'disputado' },
        reservation: { estadoPago: 'disputado' },
      })
    }
    if (event.type === 'charge.dispute.closed') {
      const estadoPago = event.data.object.status === 'won' ? 'pagado' : 'disputado'
      await updateLedgerByPaymentIntent(event.data.object.payment_intent, {
        payment: { estadoPago },
        reservation: { estadoPago },
      })
    }
    return response.json({ received: true })
  } catch (error) {
    console.error(`No se pudo procesar ${event.type}:`, error)
    return response.status(500).json({ error: 'No se pudo procesar el evento.' })
  }
})

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true)
    return callback(new Error(`Origen no permitido por CORS: ${origin}`))
  },
}))
app.use(express.json())

app.get('/health', (_request, response) => response.json({ ok: true }))

app.post('/stripe/checkout-session', authenticate, async (request, response) => {
  try {
    const { reservationId, salonId, date, serviceIds, termsAccepted, termsVersion } = request.body
    if (!reservationId && (termsAccepted !== true || termsVersion !== TERMS_VERSION)) {
      return response.status(400).json({ error: 'Debes aceptar los términos antes de reservar.' })
    }
    const appUrl = getAppUrl()
    let reservationReference
    let paymentReference
    let amount
    let salonName
    let session

    if (reservationId) {
      reservationReference = db.collection('reservaciones').doc(reservationId)
      const reservationDocument = await reservationReference.get()
      const reservation = reservationDocument.data()
      if (!reservationDocument.exists || reservation.clienteId !== request.user.uid) {
        return response.status(404).json({ error: 'No se encontró la reservación.' })
      }
      const paymentDocument = await getPaymentForReservation(reservationId)
      if (!paymentDocument) return response.status(404).json({ error: 'No se encontró el registro de pago.' })
      paymentReference = paymentDocument.ref
      const payment = paymentDocument.data()
      if (reservation.estadoPago === 'pagado') {
        return response.json({
          status: 'paid',
          reservationId,
          payment: {
            id: paymentDocument.id,
            estadoPago: 'pagado',
            identificadorPagoStripe: payment.identificadorPagoStripe || null,
            identificadorSesionStripe: payment.identificadorSesionStripe || null,
            metodoPago: payment.metodoPago || 'Stripe',
          },
          reservation: {
            id: reservationId,
            estadoPago: 'pagado',
            identificadorPagoStripe: reservation.identificadorPagoStripe || null,
          },
        })
      }
      if (payment.estadoPago !== 'pendiente') {
        return response.status(409).json({ error: `El pago está ${payment.estadoPago} y no admite un nuevo cobro.` })
      }
      if (reservation.estadoReservacion === 'cancelada') {
        return response.status(409).json({ error: 'La reservación está cancelada y ya no puede pagarse.' })
      }
      if (!reservation.terminosAceptados) {
        return response.status(409).json({ error: 'Esta reservación anterior no tiene un cobro seguro asociado. Crea una nueva reservación.' })
      }

      const previousIdentifier = String(payment.identificadorPagoStripe || '')
      const previousSessionId = payment.identificadorSesionStripe || (previousIdentifier.startsWith('cs_') ? previousIdentifier : '')
      if (previousSessionId) {
        const previousSession = await stripe.checkout.sessions.retrieve(previousSessionId)
        if (previousSession.payment_status === 'paid') {
          const result = await fulfillCheckout(previousSession)
          return response.json({ status: 'paid', reservationId, ...result })
        }
        if (previousSession.status === 'open') {
          return response.json({ status: 'open', reservationId, url: previousSession.url })
        }
        if (previousSession.status === 'complete' && previousSession.payment_status === 'unpaid') {
          return response.json({ status: 'processing', reservationId })
        }
      }

      const salonIdForReservation = reservation.salonesIds?.[0]
      const [salonDocument, availabilitySnapshot] = await Promise.all([
        db.collection('salones').doc(salonIdForReservation).get(),
        db.collection('disponibilidad').where('salonesIds', 'array-contains', salonIdForReservation).get(),
      ])
      const availabilityDocument = availabilitySnapshot.docs.find((item) => asDateOnly(item.data().fecha) === asDateOnly(reservation.fecha))
      if (!availabilityDocument || availabilityDocument.data().reservacionId !== reservationReference.id) {
        return response.status(409).json({ error: 'La reservación no conserva el bloqueo de esta fecha.' })
      }
      amount = Number(payment.monto)
      if (!Number.isFinite(amount) || amount <= 0 || amount !== Number(reservation.total)) {
        return response.status(409).json({ error: 'El importe guardado para la reservación no es válido.' })
      }
      salonName = salonDocument.data()?.name || 'Reservación MediaLuna'
      const attemptId = randomUUID()
      await db.runTransaction(async (transaction) => {
        const currentPayment = await transaction.get(paymentReference)
        const lease = currentPayment.data()?.creandoSesionStripe
        const leaseCreatedAt = lease?.fecha?.toMillis?.() || 0
        if (lease && Date.now() - leaseCreatedAt < 60_000) {
          throw Object.assign(new Error('Ya se está preparando el pago. Intenta nuevamente en un momento.'), { status: 409 })
        }
        transaction.update(paymentReference, {
          creandoSesionStripe: { id: attemptId, fecha: Timestamp.now() },
        })
      })
      session = await createCheckoutSession({
        appUrl,
        amount,
        salonName,
        reservationId: reservationReference.id,
        paymentId: paymentReference.id,
        user: request.user,
        attemptId,
      })
      await db.runTransaction(async (transaction) => {
        const [currentPayment, currentAvailability] = await Promise.all([
          transaction.get(paymentReference),
          transaction.get(availabilityDocument.ref),
        ])
        if (currentPayment.data()?.creandoSesionStripe?.id !== attemptId) {
          throw new Error('El intento de pago fue reemplazado.')
        }
        if (currentAvailability.data()?.reservacionId !== reservationReference.id) {
          throw Object.assign(new Error('La reservación no conserva el bloqueo de esta fecha.'), { status: 409 })
        }
        transaction.update(paymentReference, {
          identificadorPagoStripe: session.id,
          identificadorSesionStripe: session.id,
          creandoSesionStripe: null,
        })
        transaction.update(reservationReference, {
          identificadorPagoStripe: session.id,
        })
        transaction.update(availabilityDocument.ref, { identificadorSesionStripe: session.id })
      })
    } else {
      const checkout = await getCheckoutData({ salonId, date, serviceIds })
      reservationReference = db.collection('reservaciones').doc()
      paymentReference = db.collection('pagos').doc()
      amount = checkout.total
      salonName = checkout.salon.name

      session = await createCheckoutSession({
        appUrl,
        amount,
        salonName,
        reservationId: reservationReference.id,
        paymentId: paymentReference.id,
        user: request.user,
      })

      await db.runTransaction(async (transaction) => {
        const currentAvailability = await transaction.get(checkout.availabilityDocument.ref)
        if (currentAvailability.data()?.estado !== 'disponible') throw Object.assign(new Error('La fecha acaba de ser reservada.'), { status: 409 })
        transaction.update(checkout.availabilityDocument.ref, {
          estado: 'reservada',
          reservacionId: reservationReference.id,
          identificadorSesionStripe: session.id,
        })
        transaction.create(reservationReference, {
          clienteId: request.user.uid,
          duenoId: checkout.salon.duenoId || '',
          estadoPago: 'pendiente',
          estadoReservacion: 'pendiente',
          fecha: date,
          fechaCreacion: Timestamp.now(),
          identificadorChat: 'pendiente',
          identificadorPagoStripe: session.id,
          identificadorSalaVideo: 'pendiente',
          precioSalon: checkout.priceSalon,
          salonesIds: [checkout.salon.id],
          serviciosIds: checkout.services.map((service) => service.id),
          total: amount,
          totalServicios: checkout.totalServices,
          terminosAceptados: { version: termsVersion, fecha: Timestamp.now() },
        })
        transaction.create(paymentReference, {
          clienteId: request.user.uid,
          estadoPago: 'pendiente',
          fechaCreacion: Timestamp.now(),
          fechaPago: null,
          identificadorPagoStripe: session.id,
          identificadorSesionStripe: session.id,
          metodoPago: 'stripe',
          monto: amount,
          reservacionId: reservationReference.id,
          salonesIds: [checkout.salon.id],
          tipoPago: 'apartado',
        })
      })
    }

    return response.status(201).json({
      status: 'open',
      reservationId: reservationReference.id,
      paymentId: paymentReference.id,
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('No se pudo crear Stripe Checkout:', error)
    return response.status(error.status || 500).json({ error: error.message || 'No se pudo iniciar el pago.' })
  }
})

app.get('/stripe/checkout-session/:sessionId', authenticate, async (request, response) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(request.params.sessionId)
    if (session.metadata?.firebaseUid !== request.user.uid) {
      return response.status(403).json({ error: 'No tienes acceso a este pago.' })
    }
    const result = await fulfillCheckout(session)
    return response.json({ status: session.payment_status, ...result })
  } catch (error) {
    console.error('No se pudo sincronizar Stripe Checkout:', error)
    return response.status(500).json({ error: 'No se pudo verificar el pago con Stripe.' })
  }
})

app.listen(port, () => {
  console.log(`Servidor MediaLuna escuchando en http://localhost:${port}`)
})

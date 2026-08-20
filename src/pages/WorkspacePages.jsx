import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Check,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Eye,
  Filter,
  ImagePlus,
  LockKeyhole,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UserPlus,
  Users,
  Video,
  WalletCards,
} from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { useApp } from '../context/AppContext'
import { CLOUDINARY_CONFIG, cloudinaryUploadNote, uploadSalonImage } from '../services/cloudinaryService'
import { subscribeReservacion } from '../services/firestoreService'
import { StreamChatWidget } from '../components/StreamChatWidget'
import { DailyVideoCallModal } from '../components/DailyVideoCallModal'
import {
  NUMBER_MAX_VALUE,
  TEXT_MAX_LENGTH,
  isValidPhoneInput,
  limitText,
  normalizeNumberInput,
  normalizePhoneInput,
  toBoundedNumber,
} from '../utils/formLimits'
import {
  AnimatedPage,
  Badge,
  Breadcrumbs,
  Button,
  EmptyState,
  formatCurrency,
  formatDate,
  getSalonLocation,
  InfoNote,
  MetricCard,
  PageHeader,
  SectionTitle,
  StatusBadge,
  Table,
} from '../components/ui'

const roleLabel = { cliente: 'cliente', dueno: 'dueño', administrador: 'administrador' }
const reservationBelongsToOwner = (reservation, ownerId, ownerSalonIds = []) => {
  const ownedByReservation = Array.isArray(reservation.duenoId)
    ? reservation.duenoId.includes(ownerId)
    : reservation.duenoId === ownerId
  return ownedByReservation || reservation.salonesIds?.some((salonId) => ownerSalonIds.includes(salonId))
}
const isVisibleSalon = (salon) => salon?.estado !== 'archivado' && salon?.active !== false
const reservationStatusOptions = ['pendiente', 'cancelada', 'confirmada']
const normalizeReservationStatus = (status) => reservationStatusOptions.includes(status) ? status : 'pendiente'
const emptyAdminData = { usuarios: [], salones: [], servicios: [], reservaciones: [], pagos: [], disponibilidad: [] }
const getFirestoreOnlyData = (data, dataSource) => dataSource === 'firebase' ? data : emptyAdminData
const pendingReservationStates = ['pendiente', 'por confirmar']
const paymentStatusOptions = ['todos', 'pendiente', 'pagado', 'cancelado']
const normalizeText = (value) => String(value ?? '').toLowerCase().trim()
const matchesSearch = (query, values) => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return true
  return values.some((value) => normalizeText(value).includes(normalizedQuery))
}
const getReservationSalons = (data, reservation) => data.salones.filter((salon) => reservation.salonesIds?.includes(salon.id))
const getReservationSalonNames = (data, reservation) => getReservationSalons(data, reservation).map((salon) => salon.name).filter(Boolean).join(', ')
const getUserById = (data, id) => data.usuarios.find((user) => user.id === id)
const getReservationClient = (data, reservation) => getUserById(data, reservation.clienteId)
const getPaymentReservation = (data, payment) => data.reservaciones.find((reservation) => reservation.id === payment.reservacionId)
const getPaymentStatus = (status) => ['cancelado', 'cancelada'].includes(status) ? 'cancelado' : (status ?? 'pendiente')
const STRIPE_VERIFYING_MESSAGE = 'Verificando pago...'
const STRIPE_CONFIRMATION_PENDING_MESSAGE = 'El pago fue recibido. Estamos confirmándolo; puedes recargar o volver al historial.'
const pickStripeCheckoutSessionId = (...values) => values
  .map((value) => String(value ?? '').trim())
  .find((value) => value.startsWith('cs_'))
const isPendingReservation = (reservation) => pendingReservationStates.includes(normalizeText(reservation.estadoReservacion))
const getTimeValue = (value) => {
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  const time = new Date(value ?? 0).getTime()
  return Number.isFinite(time) ? time : 0
}
const sortByDateDesc = (items) => [...items].sort((a, b) => {
  const dateA = getTimeValue(a.date)
  const dateB = getTimeValue(b.date)
  return dateB - dateA
})
const buildAdminActivities = (data) => {
  const paymentActivities = data.pagos
    .filter((payment) => payment.estadoPago)
    .map((payment) => {
      const reservation = getPaymentReservation(data, payment)
      const client = getUserById(data, payment.clienteId) ?? getReservationClient(data, reservation ?? {})
      const salonNames = reservation ? getReservationSalonNames(data, reservation) : ''
      return {
        id: `pago-${payment.id}`,
        icon: CreditCard,
        title: `Pago ${getPaymentStatus(payment.estadoPago)}`,
        detail: [client?.nombre, salonNames, formatCurrency(payment.monto)].filter(Boolean).join(' · ') || payment.id,
        time: formatDate(payment.fechaPago ?? payment.fechaCreacion, 'd MMM yyyy'),
        date: payment.fechaPago ?? payment.fechaCreacion,
        tone: payment.estadoPago === 'pagado' ? 'gold' : 'rose',
      }
    })
  const reservationActivities = data.reservaciones.map((reservation) => {
    const client = getReservationClient(data, reservation)
    const salonNames = getReservationSalonNames(data, reservation)
    return {
      id: `reservacion-${reservation.id}`,
      icon: CalendarDays,
      title: `Reservación ${reservation.estadoReservacion ?? 'registrada'}`,
      detail: [client?.nombre, salonNames, reservation.fecha && formatDate(reservation.fecha, 'd MMM yyyy')].filter(Boolean).join(' · ') || reservation.id,
      time: formatDate(reservation.fechaCreacion ?? reservation.fecha, 'd MMM yyyy'),
      date: reservation.fechaCreacion ?? reservation.fecha,
      tone: 'lilac',
    }
  })
  const userActivities = data.usuarios
    .filter((user) => user.rol === 'dueno' || user.rol === 'administrador')
    .map((user) => ({
      id: `usuario-${user.id}`,
      icon: UserPlus,
      title: `Usuario ${roleLabel[user.rol] ?? user.rol}`,
      detail: [user.nombre, user.correo].filter(Boolean).join(' · ') || user.id,
      time: formatDate(user.fechaCreacion, 'd MMM yyyy'),
      date: user.fechaCreacion,
      tone: user.rol === 'administrador' ? 'sage' : 'gold',
    }))
  const serviceActivities = data.servicios.map((service) => ({
    id: `servicio-${service.id}`,
    icon: Sparkles,
    title: service.activo ? 'Servicio activo' : 'Servicio inactivo',
    detail: [service.nombre, formatCurrency(service.precio)].filter(Boolean).join(' · ') || service.id,
    time: 'Sin fecha',
    date: null,
    tone: 'sage',
  }))

  return sortByDateDesc([...paymentActivities, ...reservationActivities, ...userActivities, ...serviceActivities]).slice(0, 6)
}

function PanelIntro({ eyebrow = 'MediaLuna', title, description, actions, crumbs = [] }) {
  return <><Breadcrumbs items={crumbs.length ? crumbs : [{ label: title }]} /><PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} /></>
}

function ReservationList({ reservations, data, showClient = false }) {
  return (
    <div className="reservation-list">
      {reservations.map((reservation) => {
        const salon = data.salones.find((item) => reservation.salonesIds.includes(item.id))
        const client = data.usuarios.find((item) => item.id === reservation.clienteId)
        return (
          <Link to={`/cliente/reservaciones/${reservation.id}`} className="reservation-row" key={reservation.id}>
            <img src={salon?.photos?.[0]} alt={salon?.name} />
            <div className="reservation-row__main">
              <div>
                <strong>{salon?.name ?? 'Salón'}</strong>
                <span className="reservation-row__badges">
                  <StatusBadge status={reservation.estadoReservacion} />
                </span>
              </div>
              <p><CalendarDays size={14} /> {formatDate(reservation.fecha, 'EEE d MMM yyyy')} {showClient && <>· {client?.nombre}</>}</p>
            </div>
            <div className="reservation-row__total">
              <small>Total</small>
              <strong>{formatCurrency(reservation.total)}</strong>
              <ArrowRight size={16} />
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export function ClientDashboard() {
  const { data, currentUser } = useApp()
  const reservations = data.reservaciones.filter((reservation) => reservation.clienteId === currentUser?.id)
  const upcoming = reservations.filter((reservation) => reservation.estadoReservacion !== 'cancelada').slice(0, 2)
  return (
    <AnimatedPage className="panel-page">
      <PanelIntro
        eyebrow="Tu espacio"
        title={`Hola, ${currentUser?.nombre?.split(' ')[0] ?? 'Lucía'}.`}
        description="Todo lo que necesitas para que tu próxima celebración fluya."
        actions={<Button to="/salones" icon={Plus}>Nueva reservación</Button>}
        crumbs={[{ label: 'Resumen' }]}
      />
      <div className="metric-grid">
        <MetricCard label="Reservaciones" value={reservations.length} helper="en tu historial" icon={CalendarCheck2} accent="lilac" />
        <MetricCard label="Próximo evento" value={upcoming[0] ? formatDate(upcoming[0].fecha, 'd MMM') : '—'} helper={upcoming[0] ? 'tu fecha elegida' : 'sin fechas'} icon={CalendarDays} accent="gold" />
        <MetricCard label="Pagado" value={formatCurrency(reservations.filter((item) => item.estadoPago === 'pagado').reduce((total, item) => total + item.total, 0))} helper="en MediaLuna" icon={CircleDollarSign} accent="rose" />
      </div>
      <div className="workspace-grid workspace-grid--single">
        <section className="workspace-card">
          <SectionTitle
            title="Próximos momentos"
            description="Tus reservaciones más cercanas."
            action={<Button to="/cliente/reservaciones" variant="ghost" size="sm">Ver todas <ArrowRight size={14} /></Button>}
          />
          {upcoming.length ? (
            <ReservationList reservations={upcoming} data={data} />
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Tu calendario está abierto"
              description="Encuentra un espacio para empezar a llenarlo."
              action={<Button to="/salones">Explorar salones</Button>}
            />
          )}
        </section>
      </div>
      <section className="workspace-card">
        <SectionTitle title="Atajos para tu celebración" />
        <div className="shortcut-grid shortcut-grid--two">
          <Link to="/salones" className="shortcut-card">
            <span><CompassIcon /></span>
            <strong>Buscar espacios</strong>
            <small>Encuentra tu próximo escenario</small>
            <ArrowRight size={15} />
          </Link>
          <Link to="/cliente/perfil" className="shortcut-card">
            <span><Users size={17} /></span>
            <strong>Completa tu perfil</strong>
            <small>Para reservar más rápido</small>
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </AnimatedPage>
  )
}

export function ClientReservationsPage() {
  const { data, currentUser } = useApp()
  const [tab, setTab] = useState('todas')
  const reservations = data.reservaciones.filter((reservation) => reservation.clienteId === currentUser?.id)
  const upcoming = reservations.filter((item) => item.estadoReservacion !== 'cancelada')
  const confirmed = reservations.filter((item) => item.estadoReservacion === 'confirmada')
  const visibleReservations = tab === 'proximas' ? upcoming : tab === 'confirmadas' ? confirmed : reservations
  return (
    <AnimatedPage className="panel-page">
      <PanelIntro
        eyebrow="Tu historial"
        title="Mis reservaciones"
        description="Revisa estados, fechas y detalles de cada momento."
        actions={<Button to="/salones" icon={Plus}>Nueva reservación</Button>}
        crumbs={[{ label: 'Cliente', to: '/cliente' }, { label: 'Mis reservaciones' }]}
      />
      <div className="workspace-card">
        <div className="card-tabs">
          <button className={clsx('card-tab', tab === 'todas' && 'card-tab--active')} type="button" onClick={() => setTab('todas')}>Todas <span>{reservations.length}</span></button>
          <button className={clsx('card-tab', tab === 'proximas' && 'card-tab--active')} type="button" onClick={() => setTab('proximas')}>Próximas <span>{upcoming.length}</span></button>
          <button className={clsx('card-tab', tab === 'confirmadas' && 'card-tab--active')} type="button" onClick={() => setTab('confirmadas')}>Confirmadas <span>{confirmed.length}</span></button>
        </div>
        <ReservationList reservations={visibleReservations} data={data} />
      </div>
      <InfoNote tone="lilac"><strong>Pagos seguros:</strong> las reservaciones pendientes pueden pagarse con Stripe desde su detalle.</InfoNote>
    </AnimatedPage>
  )
}

export function ClientReservationDetailPage() {
  const { id } = useParams()
  const { data, currentUser, startStripePayment, confirmStripePayment, cancelReservation, notifyMessageSent, notifyVideoCallStarted } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showVideoCall, setShowVideoCall] = useState(false)
  const [paymentState, setPaymentState] = useState({ loading: false, message: '', tone: 'lilac', awaitingConfirmation: false })
  const [liveReservation, setLiveReservation] = useState(null)
  const [refreshingPayment, setRefreshingPayment] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelMessage, setCancelMessage] = useState('')
  const stripeReturnRef = useRef({ active: false, paid: false })
  const paymentResult = searchParams.get('payment')
  const stripeSessionId = searchParams.get('session_id')

  const reservationFromData = data.reservaciones.find((item) => item.id === id && item.clienteId === currentUser?.id)
  const liveReservationBelongsToUser = liveReservation?.id === id && (!currentUser?.id || liveReservation.clienteId === currentUser.id)
  const reservation = liveReservationBelongsToUser ? { ...reservationFromData, ...liveReservation } : reservationFromData
  const reservationPayment = data.pagos.find((item) => item.reservacionId === id)
  const knownStripeSessionId = pickStripeCheckoutSessionId(
    stripeSessionId,
    reservation?.identificadorSesionStripe,
    reservation?.identificadorPagoStripe,
    reservationPayment?.identificadorSesionStripe,
    reservationPayment?.identificadorPagoStripe,
  )
  const hasSuccessfulStripeReturn = paymentResult === 'success' && Boolean(stripeSessionId)
  const awaitingStripeConfirmation = reservation?.estadoPago === 'pendiente' && paymentState.awaitingConfirmation

  const clearStripeReturnParams = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('payment')
    nextParams.delete('session_id')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const markPaymentConfirmedOnScreen = useCallback(() => {
    stripeReturnRef.current.paid = true
    setPaymentState({
      loading: false,
      message: 'Pago confirmado correctamente por Stripe.',
      tone: 'lilac',
      awaitingConfirmation: false,
    })
    clearStripeReturnParams()
  }, [clearStripeReturnParams])

  const syncReturnedPayment = useCallback(async () => {
    const sessionId = knownStripeSessionId || stripeSessionId
    if (!sessionId) return

    const result = await confirmStripePayment(sessionId, id)
    if (!result.ok) {
      console.warn('Stripe todavía no confirma el pago:', result.message)
      return
    }

    markPaymentConfirmedOnScreen()
  }, [confirmStripePayment, id, knownStripeSessionId, markPaymentConfirmedOnScreen, stripeSessionId])

  useEffect(() => {
    return subscribeReservacion(
      id,
      (nextReservation) => {
        if (!nextReservation) return
        if (currentUser?.id && nextReservation.clienteId !== currentUser.id) return

        setLiveReservation(nextReservation)
        if (nextReservation.estadoPago === 'pagado') markPaymentConfirmedOnScreen()
      },
      (error) => {
        console.warn('No se pudo escuchar la reservación en tiempo real:', error)
      },
    )
  }, [id, currentUser?.id, markPaymentConfirmedOnScreen])

  useEffect(() => {
    if (paymentResult === 'cancelled') {
      const timeout = window.setTimeout(() => {
        setPaymentState({
          loading: false,
          message: 'El pago fue cancelado. Puedes intentarlo nuevamente.',
          tone: 'warning',
          awaitingConfirmation: false,
        })
        clearStripeReturnParams()
      }, 0)
      return () => window.clearTimeout(timeout)
    }

    if (!hasSuccessfulStripeReturn) return undefined

    stripeReturnRef.current = { active: true, paid: reservation?.estadoPago === 'pagado' }

    if (reservation?.estadoPago === 'pagado') {
      const timeout = window.setTimeout(() => markPaymentConfirmedOnScreen(), 0)
      return () => {
        stripeReturnRef.current.active = false
        window.clearTimeout(timeout)
      }
    }

    const loadingTimeout = window.setTimeout(() => {
      setPaymentState({
        loading: true,
        message: STRIPE_VERIFYING_MESSAGE,
        tone: 'lilac',
        awaitingConfirmation: true,
      })
    }, 0)

    const timeout = window.setTimeout(() => {
      if (!stripeReturnRef.current.paid) {
        setPaymentState({
          loading: false,
          message: STRIPE_CONFIRMATION_PENDING_MESSAGE,
          tone: 'warning',
          awaitingConfirmation: true,
        })
      }
    }, 10000)

    const syncTimeout = window.setTimeout(() => {
      syncReturnedPayment()
    }, 0)

    return () => {
      stripeReturnRef.current.active = false
      window.clearTimeout(loadingTimeout)
      window.clearTimeout(syncTimeout)
      window.clearTimeout(timeout)
    }
  }, [clearStripeReturnParams, hasSuccessfulStripeReturn, id, markPaymentConfirmedOnScreen, paymentResult, reservation?.estadoPago, stripeSessionId, syncReturnedPayment])

  const payReservation = async () => {
    setPaymentState({ loading: true, message: '', tone: 'lilac', awaitingConfirmation: false })
    const result = await startStripePayment(id)
    if (!result.ok) setPaymentState({ loading: false, message: result.message, tone: 'warning', awaitingConfirmation: false })
    if (result.paid) setPaymentState({ loading: false, message: 'Este pago ya fue confirmado por Stripe.', tone: 'lilac', awaitingConfirmation: false })
    if (result.processing) setPaymentState({ loading: false, message: 'Stripe está procesando este pago.', tone: 'lilac', awaitingConfirmation: false })
  }

  const updatePaymentStatus = async () => {
    if (reservation?.estadoPago === 'pagado') {
      markPaymentConfirmedOnScreen()
      return
    }

    setRefreshingPayment(true)
    setPaymentState({
      loading: true,
      message: STRIPE_VERIFYING_MESSAGE,
      tone: 'lilac',
      awaitingConfirmation: true,
    })

    if (!knownStripeSessionId) {
      setRefreshingPayment(false)
      setPaymentState({
        loading: false,
        message: STRIPE_CONFIRMATION_PENDING_MESSAGE,
        tone: 'warning',
        awaitingConfirmation: true,
      })
      return
    }

    const result = await confirmStripePayment(knownStripeSessionId, id)
    setRefreshingPayment(false)

    if (result.ok) {
      markPaymentConfirmedOnScreen()
      return
    }

    setPaymentState({
      loading: false,
      message: STRIPE_CONFIRMATION_PENDING_MESSAGE,
      tone: 'warning',
      awaitingConfirmation: true,
    })
  }

  const cancelCurrentReservation = async () => {
    const paidNote = reservation?.estadoPago === 'pagado'
      ? '\n\nEsta reservación ya está pagada. No se hará reembolso automático desde MediaLuna.'
      : ''
    const confirmed = window.confirm(`¿Seguro que quieres cancelar esta reservación? La reservación seguirá guardada y solo cambiará a estado cancelada.${paidNote}`)
    if (!confirmed) return
    setCancelling(true)
    setCancelMessage('')
    const result = await cancelReservation(id)
    setCancelling(false)
    setCancelMessage(result.message ?? (result.ok ? 'Reservación cancelada.' : 'No se pudo cancelar la reservación.'))
  }

  if (!reservation) {
    return (
      <AnimatedPage className="panel-page">
        <EmptyState
          title="Reservación no encontrada"
          description="El registro no existe en el sistema."
          action={<Button to="/cliente/reservaciones">Volver a reservaciones</Button>}
        />
      </AnimatedPage>
    )
  }

  const salon = data.salones.find((item) => reservation.salonesIds.includes(item.id))
  const services = data.servicios.filter((service) => reservation.serviciosIds.includes(service.id))
  const ownerId = Array.isArray(reservation.duenoId) ? reservation.duenoId[0] : (reservation.duenoId || salon?.duenoId || salon?.ownerId)
  const owner = data.usuarios.find((u) => u.id === ownerId) || { nombre: 'Mariana Castañeda', rol: 'dueño' }

  return (
    <AnimatedPage className="panel-page">
      <PanelIntro
        eyebrow="Detalle de reservación"
        title={salon?.name ?? 'Tu reservación'}
        description={`Creada el ${formatDate(reservation.fechaCreacion, 'd MMMM yyyy')}.`}
        crumbs={[{ label: 'Cliente', to: '/cliente' }, { label: 'Mis reservaciones', to: '/cliente/reservaciones' }, { label: 'Detalle' }]}
        actions={<Button to="/cliente/reservaciones" variant="secondary" icon={ArrowRight}>Volver al historial</Button>}
      />

      <div className="detail-status-banner">
        <div>
          <StatusBadge status={reservation.estadoReservacion} />
          <h2>{formatDate(reservation.fecha, 'EEEE d MMMM yyyy')}</h2>
          <p><MapPinIcon /> {salon?.direccion}</p>
        </div>
        <div className="detail-status-banner__payment">
          <span>Estado de pago</span>
          <StatusBadge status={reservation.estadoPago} />
          {reservation.estadoPago === 'pendiente' && !awaitingStripeConfirmation && <Button variant="secondary" size="sm" icon={CreditCard} disabled={paymentState.loading} onClick={payReservation}>{paymentState.loading ? 'Procesando…' : 'Pagar con Stripe'}</Button>}
          {reservation.estadoPago === 'pendiente' && awaitingStripeConfirmation && <Button variant="secondary" size="sm" icon={RefreshCw} disabled={paymentState.loading || refreshingPayment} onClick={updatePaymentStatus}>{refreshingPayment ? 'Actualizando…' : 'Actualizar estado'}</Button>}
          {reservation.estadoReservacion !== 'cancelada' && <Button variant="danger" size="sm" disabled={cancelling} onClick={cancelCurrentReservation}>{cancelling ? 'Cancelando…' : 'Cancelar reservación'}</Button>}
        </div>
      </div>

      {paymentState.message && <InfoNote tone={paymentState.tone} icon={paymentState.tone === 'warning' ? CircleAlert : ShieldCheck}>{paymentState.message}</InfoNote>}
      {cancelMessage && <InfoNote tone="warning" icon={CircleAlert}>{cancelMessage}</InfoNote>}

      <div className="workspace-grid workspace-grid--detail">
        <section className="workspace-card">
          <SectionTitle title="Resumen de tu reservación" />
          <div className="reservation-detail-image">
            <img src={salon?.photos?.[0]} alt={salon?.name} />
            <div>
              <span className="eyebrow">Salón reservado</span>
              <h3>{salon?.name}</h3>
              <p>{salon?.type} · Hasta {salon?.capacity} personas</p>
            </div>
          </div>
          <div className="detail-breakdown">
            <div><span>Precio del salón</span><strong>{formatCurrency(reservation.precioSalon)}</strong></div>
            <div><span>Servicios extra</span><strong>{formatCurrency(reservation.totalServicios)}</strong></div>
            <div className="detail-breakdown__total"><span>Total</span><strong>{formatCurrency(reservation.total)}</strong></div>
          </div>
          {services.length > 0 && (
            <div className="selected-service-list">
              <span className="eyebrow">Extras incluidos</span>
              {services.map((service) => (
                <div key={service.id}><Sparkles size={14} /> {service.nombre}<strong>{formatCurrency(service.precio)}</strong></div>
              ))}
            </div>
          )}
        </section>

        <aside className="workspace-card chat-card reservation-chat-card">
          <div className="reservation-chat-header">
            <span className="eyebrow">Comunicación en vivo</span>
            <Button
              variant="ghost"
              size="sm"
              icon={Video}
              onClick={() => setShowVideoCall(true)}
            >
              Videollamada
            </Button>
          </div>

          <StreamChatWidget
            reservation={reservation}
            currentUser={currentUser}
            counterpartName={owner.nombre}
            counterpartRole="Dueño del espacio"
            onMessageSent={(text) => notifyMessageSent(reservation, text)}
          />
        </aside>
      </div>

      {showVideoCall && (
        <DailyVideoCallModal
          reservation={reservation}
          currentUser={currentUser}
          onClose={() => setShowVideoCall(false)}
          onCallStarted={() => notifyVideoCallStarted(reservation)}
        />
      )}
    </AnimatedPage>
  )
}

export function ClientProfilePage() {
  const { currentUser, updateClientProfile } = useApp()
  const [form, setForm] = useState({ nombre: currentUser?.nombre ?? '', telefono: currentUser?.telefono ?? '', correo: currentUser?.correo ?? '' })
  const [error, setError] = useState('')
  const update = (field) => (event) => {
    const value = field === 'telefono' ? normalizePhoneInput(event.target.value) : limitText(event.target.value)
    setForm({ ...form, [field]: value })
    setError('')
  }
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!isValidPhoneInput(form.telefono)) {
      setError('Escribe un teléfono válido, sin letras.')
      return
    }
    const result = await updateClientProfile(form)
    if (!result.ok) setError(result.message)
  }
  return (
    <AnimatedPage className="panel-page">
      <PanelIntro
        eyebrow="Tu cuenta"
        title="Mi perfil"
        description="Mantén tus datos listos para cada reservación."
        crumbs={[{ label: 'Cliente', to: '/cliente' }, { label: 'Mi perfil' }]}
      />
      <div className="profile-layout">
        <section className="workspace-card profile-card">
          <div className="profile-card__avatar avatar avatar--large">
            {currentUser?.nombre?.split(' ').map((part) => part[0]).join('').slice(0, 2)}
          </div>
          <h2>{currentUser?.nombre}</h2>
          <p>{currentUser?.correo}</p>
          <Badge tone="lilac">Cliente</Badge>
          <div className="profile-meta">
            <span><Phone size={15} /> {currentUser?.telefono}</span>
            <span><CalendarDays size={15} /> Miembro desde {formatDate(currentUser?.fechaCreacion, 'MMMM yyyy')}</span>
          </div>
        </section>
        <section className="workspace-card">
          <SectionTitle title="Datos personales" description="Estos campos se guardan en usuarios/{uid}." />
          <form onSubmit={submit}>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input required maxLength={TEXT_MAX_LENGTH} value={form.nombre} onChange={update('nombre')} />
              </label>
              <label className="field">
                <span>Teléfono</span>
                <input required type="tel" inputMode="tel" maxLength="13" value={form.telefono} onChange={update('telefono')} />
              </label>
              <label className="field field--full">
                <span>Correo electrónico</span>
                <input required maxLength={TEXT_MAX_LENGTH} value={form.correo} type="email" onChange={update('correo')} />
              </label>
            </div>
            {error && <InfoNote tone="warning">{error}</InfoNote>}
            <Button variant="secondary" type="submit" icon={Check}>Guardar cambios</Button>
          </form>
        </section>
      </div>
    </AnimatedPage>
  )
}

export function OwnerDashboard() {
  const { data, currentUser } = useApp()
  const salons = data.salones.filter((salon) => isVisibleSalon(salon) && (currentUser?.salonesIds?.includes(salon.id) || salon.duenoId === currentUser?.id))
  const reservations = data.reservaciones.filter((reservation) => reservationBelongsToOwner(reservation, currentUser?.id, currentUser?.salonesIds))
  const pending = reservations.filter((reservation) => reservation.estadoReservacion !== 'confirmada')
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Espacio del dueño" title={`Hola, ${currentUser?.nombre?.split(' ')[0] ?? 'Mariana'}.`} description="Una vista clara de tus espacios y lo que viene." crumbs={[{ label: 'Resumen' }]} /><InfoNote tone="lilac"><ShieldCheck size={16} /> <strong>Vista de solo lectura.</strong> Tus datos se muestran desde Firestore cuando la conexión está disponible.</InfoNote><div className="metric-grid"><MetricCard label="Salones asignados" value={salons.length} helper="espacios activos" icon={Store} accent="gold" /><MetricCard label="Por confirmar" value={pending.length} helper="requieren atención" icon={Clock3} accent="rose" /><MetricCard label="Este mes" value={formatCurrency(reservations.reduce((sum, item) => sum + item.total, 0))} helper="valor reservado" icon={CircleDollarSign} accent="lilac" /></div><div className="workspace-grid"><section className="workspace-card"><SectionTitle title="Reservaciones pendientes" description="Clientes que esperan tu confirmación." action={<Button to="/dueno/reservaciones" variant="ghost" size="sm">Ver todas <ArrowRight size={14} /></Button>} />{pending.length ? <ReservationList reservations={pending} data={data} showClient /> : <EmptyState icon={CalendarCheck2} title="Todo en calma" description="No tienes solicitudes pendientes." />}</section><section className="workspace-card"><SectionTitle title="Tus espacios" action={<Button to="/dueno/salones" variant="ghost" size="sm">Ver salones <ArrowRight size={14} /></Button>} /><div className="owner-salon-mini-list">{salons.map((salon) => <Link to="/dueno/salones" className="owner-salon-mini" key={salon.id}><img src={salon.photos?.[0]} alt={salon.name} /><span><strong>{salon.name}</strong><small>{salon.capacity} personas · <StatusBadge status={salon.active ? 'activo' : 'inactivo'} /></small></span><ArrowRight size={15} /></Link>)}</div></section></div></AnimatedPage>
}

export function OwnerSalonsPage() {
  const { data, currentUser } = useApp()
  const salons = data.salones.filter((salon) => isVisibleSalon(salon) && (currentUser?.salonesIds?.includes(salon.id) || salon.duenoId === currentUser?.id))
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Tu inventario" title="Salones asignados" description="Consulta la información publicada de tus espacios." crumbs={[{ label: 'Dueño', to: '/dueno' }, { label: 'Mis salones' }]} /><div className="owner-salon-grid">{salons.map((salon) => <article className="owner-salon-card workspace-card" key={salon.id}><img src={salon.photos?.[0]} alt={salon.name} /><div className="owner-salon-card__body"><div className="owner-salon-card__head"><div><Badge tone="success" dot>Publicado</Badge><h2>{salon.name}</h2><p><MapPinIcon /> {getSalonLocation(salon)}</p></div></div><p className="muted-copy">{salon.description}</p><div className="owner-salon-card__meta"><span><Users size={15} /> {salon.capacity} personas</span><span><CircleDollarSign size={15} /> {formatCurrency(salon.basePrice)}</span></div><InfoNote>Solo lectura · las actualizaciones las gestiona administración.</InfoNote></div></article>)}</div></AnimatedPage>
}

export function OwnerReservationsPage() {
  const { data, currentUser } = useApp()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todas')
  const reservations = data.reservaciones.filter((reservation) => reservationBelongsToOwner(reservation, currentUser?.id, currentUser?.salonesIds))
  const rows = reservations.filter((reservation) => {
    const salon = data.salones.find((item) => reservation.salonesIds?.includes(item.id))
    const client = data.usuarios.find((item) => item.id === reservation.clienteId)
    const normalizedStatus = normalizeReservationStatus(reservation.estadoReservacion)
    const matchesStatus = statusFilter === 'todas' || normalizedStatus === statusFilter
    return matchesStatus && matchesSearch(query, [
      salon?.name,
      client?.nombre,
      client?.correo,
      reservation.fecha,
      reservation.estadoReservacion,
      reservation.estadoPago,
      reservation.total,
    ])
  })
  const columns = [{ key: 'salon', label: 'Salón', render: (row) => { const salon = data.salones.find((item) => row.salonesIds.includes(item.id)); return <span className="table-person"><img src={salon?.photos?.[0]} alt="" /><strong>{salon?.name}</strong></span> } }, { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.fecha, 'd MMM yyyy') }, { key: 'cliente', label: 'Cliente', render: (row) => data.usuarios.find((item) => item.id === row.clienteId)?.nombre }, { key: 'total', label: 'Total', render: (row) => <strong>{formatCurrency(row.total)}</strong> }, { key: 'estadoReservacion', label: 'Estado', render: (row) => <StatusBadge status={row.estadoReservacion} /> }, { key: 'actions', label: '', render: (row) => <Link className="icon-button" title="Abrir chat de la reservación" to={`/dueno/chats?reservacion=${row.id}`}><Eye size={16} /></Link> }]
  return (
    <AnimatedPage className="panel-page">
      <PanelIntro
        eyebrow="Agenda compartida"
        title="Reservaciones"
        description="Revisa las solicitudes y la agenda de tus espacios."
        crumbs={[{ label: 'Dueño', to: '/dueno' }, { label: 'Reservaciones' }]}
        actions={<Button to="/dueno/chats" variant="secondary" icon={MessageCircle}>Ver chats</Button>}
      />
      <div className="workspace-card">
        <div className="table-toolbar table-toolbar--stack">
          <div className="listing-search">
            <Search size={16} />
            <input value={query} maxLength={TEXT_MAX_LENGTH} onChange={(event) => setQuery(limitText(event.target.value))} placeholder="Buscar por cliente, salón, fecha o estado" />
          </div>
          <div className="table-toolbar__filters">
            {['todas', ...reservationStatusOptions].map((status) => (
              <button type="button" key={status} className={clsx('toolbar-chip', statusFilter === status && 'toolbar-chip--active')} onClick={() => setStatusFilter(status)}>
                <Filter size={14} /> {status === 'todas' ? 'Todas' : status}
              </button>
            ))}
          </div>
        </div>
        <Table columns={columns} rows={rows} />
      </div>
    </AnimatedPage>
  )
}

export function OwnerChatsPage() {
  const { data, currentUser, notifyMessageSent, notifyVideoCallStarted } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const reservations = data.reservaciones.filter((reservation) => reservationBelongsToOwner(reservation, currentUser?.id, currentUser?.salonesIds))
  const [showVideoCall, setShowVideoCall] = useState(false)
  const requestedReservationId = searchParams.get('reservacion')

  const selectedReservation = reservations.find((r) => r.id === requestedReservationId) || reservations[0]
  const client = selectedReservation ? data.usuarios.find((user) => user.id === selectedReservation.clienteId) : null
  const salon = selectedReservation ? data.salones.find((item) => selectedReservation.salonesIds.includes(item.id)) : null

  return (
    <AnimatedPage className="panel-page">
      <PanelIntro
        eyebrow="Comunicación"
        title="Chats con clientes"
        description="Mantén cerca las conversaciones importantes de cada evento."
        crumbs={[{ label: 'Dueño', to: '/dueno' }, { label: 'Chats' }]}
      />

      <div className="chat-list-page">
        <div className="chat-threads workspace-card">
          {reservations.length === 0 ? (
            <p className="muted-copy" style={{ padding: '16px' }}>No tienes reservaciones ni chats activos.</p>
          ) : (
            reservations.map((reservation) => {
              const resClient = data.usuarios.find((user) => user.id === reservation.clienteId)
              const resSalon = data.salones.find((item) => reservation.salonesIds.includes(item.id))
              const isActive = reservation.id === selectedReservation?.id
              return (
                <button
                  className={clsx('chat-thread', isActive && 'chat-thread--active')}
                  type="button"
                  key={reservation.id}
                  onClick={() => setSearchParams({ reservacion: reservation.id })}
                >
                  <span className="avatar">
                    {resClient?.nombre?.split(' ').map((part) => part[0]).join('').slice(0, 2) || 'CL'}
                  </span>
                  <span>
                    <strong>{resClient?.nombre || 'Cliente'}</strong>
                    <small>{resSalon?.name} · {formatDate(reservation.fecha, 'd MMM')}</small>
                  </span>
                  <span className="chat-thread__right">
                    <Badge tone={isActive ? 'success' : 'neutral'} dot>{isActive ? 'Activo' : 'Chat'}</Badge>
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="workspace-card owner-chat-card">
          {selectedReservation && client ? (
            <>
              <div className="owner-chat-header">
                <div>
                  <h3>{client.nombre}</h3>
                  <small>{salon?.name} ({formatDate(selectedReservation.fecha, 'd MMM yyyy')})</small>
                </div>
                <Button variant="secondary" size="sm" icon={Video} onClick={() => setShowVideoCall(true)}>
                  Videollamada con cliente
                </Button>
              </div>

              <div className="owner-chat-widget">
                <StreamChatWidget
                  reservation={selectedReservation}
                  currentUser={currentUser}
                  counterpartName={client.nombre}
                  counterpartRole="Cliente"
                  onMessageSent={(text) => notifyMessageSent(selectedReservation, text)}
                />
              </div>
            </>
          ) : (
            <div className="chat-empty-panel">
              <MessageCircle size={28} />
              <h2>Selecciona una conversación</h2>
              <p>Los mensajes del chat aparecerán aquí cuando selecciones una reservación.</p>
            </div>
          )}
        </div>
      </div>

      {showVideoCall && selectedReservation && (
        <DailyVideoCallModal
          reservation={selectedReservation}
          currentUser={currentUser}
          onClose={() => setShowVideoCall(false)}
          onCallStarted={() => notifyVideoCallStarted(selectedReservation)}
        />
      )}
    </AnimatedPage>
  )
}


export function AdminDashboard() {
  const { data, dataSource } = useApp()
  const adminData = getFirestoreOnlyData(data, dataSource)
  const pending = adminData.reservaciones.filter(isPendingReservation).length
  const activeUsers = adminData.usuarios.filter((item) => item.activo !== false).length
  const activities = buildAdminActivities(adminData)

  return (
    <AnimatedPage className="panel-page">
      <PanelIntro
        eyebrow="Centro de control"
        title="Dashboard general"
        description="La operación de MediaLuna, con datos reales de Firestore."
        crumbs={[{ label: 'Dashboard' }]}
      />
      <div className="metric-grid metric-grid--admin">
        <MetricCard label="Reservaciones" value={adminData.reservaciones.length} helper="registros en Firestore" icon={CalendarCheck2} accent="lilac" />
        <MetricCard label="Usuarios activos" value={activeUsers} helper="cuentas activas" icon={Users} accent="rose" />
        <MetricCard label="Por revisar" value={pending} helper="solicitudes pendientes" icon={Clock3} accent="sage" />
      </div>
      <section className="workspace-card">
        <SectionTitle
          title="Actividad reciente"
          description="Últimos movimientos reales de reservaciones, pagos, usuarios y servicios."
          action={<Button to="/admin/reportes" variant="ghost" size="sm">Ver reportes <ArrowRight size={14} /></Button>}
        />
        {activities.length ? (
          <div className="activity-list">
            {activities.map((activity) => (
              <ActivityRow
                key={activity.id}
                icon={activity.icon}
                title={activity.title}
                detail={activity.detail}
                time={activity.time}
                tone={activity.tone}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={CalendarDays} title="Sin datos todavía" description="Cuando Firestore tenga registros, la actividad reciente aparecerá aquí." />
        )}
      </section>
    </AnimatedPage>
  )
}

function ActivityRow({ icon: Icon, title, detail, time, tone }) { return <div className="activity-row"><span className={clsx('activity-icon', `activity-icon--${tone}`)}><Icon size={16} /></span><span><strong>{title}</strong><small>{detail}</small></span><time>{time}</time></div> }

export function AdminUsersPage() {
  const { data, createUser, toggleUser, notify } = useApp()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ nombre: '', correo: '', telefono: '' })
  const owners = data.usuarios.filter((user) => user.rol === 'dueno')
  const adminUsers = data.usuarios.filter((user) => user.rol === 'dueno' || user.rol === 'administrador')
  const rows = adminUsers.filter((user) => matchesSearch(query, [
    user.nombre,
    user.correo,
    user.telefono,
    roleLabel[user.rol],
    user.activo === false ? 'inactivo' : 'activo',
  ]))
  const updateForm = (field) => (event) => {
    const value = field === 'telefono' ? normalizePhoneInput(event.target.value) : limitText(event.target.value)
    setForm({ ...form, [field]: value })
  }
  const submit = async (event) => {
    event.preventDefault()
    if (!isValidPhoneInput(form.telefono)) {
      notify('Escribe un teléfono válido, sin letras.', 'warning')
      return
    }
    const created = await createUser({
      ...form,
      nombre: limitText(form.nombre).trim(),
      correo: limitText(form.correo).trim().toLowerCase(),
      telefono: normalizePhoneInput(form.telefono),
      activo: true,
      fechaCreacion: format(new Date(), 'yyyy-MM-dd'),
      rol: 'dueno',
      salonesIds: [],
    })
    if (!created) return
    setForm({ nombre: '', correo: '', telefono: '' })
    setOpen(false)
  }
  const columns = [{ key: 'nombre', label: 'Usuario', render: (row) => <span className="table-person"><span className="avatar avatar--small">{row.nombre[0]}</span><span><strong>{row.nombre}</strong><small>{row.correo}</small></span></span> }, { key: 'rol', label: 'Rol', render: (row) => <Badge tone={row.rol === 'administrador' ? 'lilac' : row.rol === 'dueno' ? 'gold' : 'neutral'}>{roleLabel[row.rol]}</Badge> }, { key: 'fechaCreacion', label: 'Alta', render: (row) => formatDate(row.fechaCreacion, 'd MMM yyyy') }, { key: 'activo', label: 'Estado', render: (row) => <StatusBadge status={row.activo ? 'activo' : 'inactivo'} /> }, { key: 'actions', label: '', render: (row) => <div className="table-actions"><button className="icon-button" type="button" title="La contraseña se gestiona desde Firebase Auth" disabled><LockKeyhole size={15} /></button><button className="icon-button" type="button" title={row.activo ? 'Desactivar' : 'Activar'} onClick={() => toggleUser(row.id)}>{row.activo ? <Trash2 size={15} /> : <Check size={15} />}</button></div> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Personas" title="Gestión de usuarios" description="Controla accesos de dueños y administradores." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Usuarios' }]} actions={<Button icon={UserPlus} onClick={() => setOpen((value) => !value)}>Crear usuario dueño</Button>} />{open && <div className="workspace-card inline-form-card" data-reveal><div><span className="eyebrow">Nuevo acceso</span><h2>Crear usuario dueño</h2><p>La contraseña temporal será gestionada cuando se conecte Firebase Auth.</p></div><form className="inline-form" onSubmit={submit}><input required maxLength={TEXT_MAX_LENGTH} placeholder="Nombre completo" value={form.nombre} onChange={updateForm('nombre')} /><input required type="email" maxLength={TEXT_MAX_LENGTH} placeholder="Correo" value={form.correo} onChange={updateForm('correo')} /><input required type="tel" inputMode="tel" maxLength="13" placeholder="Teléfono" value={form.telefono} onChange={updateForm('telefono')} /><Button type="submit" size="sm">Guardar dueño</Button></form><InfoNote tone="warning"><LockKeyhole size={15} /> Contraseña temporal: placeholder de conexión.</InfoNote></div>}<div className="workspace-card"><div className="table-toolbar"><div className="listing-search"><Search size={16} /><input value={query} maxLength={TEXT_MAX_LENGTH} onChange={(event) => setQuery(limitText(event.target.value))} placeholder="Buscar por nombre, correo, rol o estado" /></div><Badge tone="neutral">{rows.length} usuarios</Badge></div><Table columns={columns} rows={rows} /></div><InfoNote><CircleAlert size={15} /> {owners.length} dueños tienen salones asignados. Los permisos se basan en el campo rol.</InfoNote></AnimatedPage>
}

export function AdminSalonsPage() {
  const { data, createSalon, toggleSalon, notify } = useApp()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const emptyForm = { name: '', type: '', location: '', phone: '', capacity: '', basePrice: '', description: '', duenoId: '', active: true, serviciosIds: [], urlImagen: '', idPublicoCloudinary: '' }
  const [form, setForm] = useState(emptyForm)
  const owners = data.usuarios.filter((user) => user.rol === 'dueno' && user.activo)
  const update = (field) => (event) => {
    const { type, checked, value } = event.target
    const nextValue = type === 'checkbox'
      ? checked
      : field === 'phone'
        ? normalizePhoneInput(value)
        : ['capacity', 'basePrice'].includes(field)
          ? normalizeNumberInput(value, { min: field === 'capacity' ? 1 : 0 })
          : limitText(value)
    setForm({ ...form, [field]: nextValue })
  }
  const resetForm = () => { setForm(emptyForm); setEditingId(null); setOpen(false); setUploading(false) }
  const startCreate = () => { setForm(emptyForm); setEditingId(null); setOpen(true) }
  const startEdit = (salon) => {
    setForm({
      name: salon.name ?? '',
      type: salon.type ?? '',
      location: Array.isArray(salon.location) ? salon.location.join(', ') : salon.location ?? '',
      phone: salon.phone ?? '',
      capacity: salon.capacity ?? '',
      basePrice: salon.basePrice ?? '',
      description: salon.description ?? '',
      duenoId: salon.duenoId ?? salon.ownerId ?? owners.find((owner) => owner.salonesIds?.includes(salon.id))?.id ?? '',
      active: salon.active ?? true,
      serviciosIds: salon.serviciosIds ?? [],
      urlImagen: salon.urlImagen ?? salon.photos?.[0] ?? '',
      idPublicoCloudinary: salon.idPublicoCloudinary ?? '',
    })
    setEditingId(salon.id)
    setOpen(true)
  }
  const toggleServiceId = (serviceId) => setForm((current) => ({
    ...current,
    serviciosIds: current.serviciosIds.includes(serviceId)
      ? current.serviciosIds.filter((id) => id !== serviceId)
      : [...current.serviciosIds, serviceId],
  }))
  const uploadImage = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const upload = await uploadSalonImage(file)
      setForm((current) => ({ ...current, urlImagen: upload.secure_url, idPublicoCloudinary: upload.public_id }))
      notify(upload.pending ? 'Imagen en preview local. Configura Cloudinary para subirla.' : 'Imagen subida a Cloudinary')
    } catch (error) {
      console.error('Cloudinary upload failed:', error)
      notify('No se pudo subir la imagen a Cloudinary.', 'warning')
    } finally {
      setUploading(false)
    }
  }
  const submit = async (event) => {
    event.preventDefault()
    const id = editingId ?? `salon_${Date.now()}`
    const currentSalon = data.salones.find((salon) => salon.id === id)
    await createSalon({
      ...currentSalon,
      id,
      accent: currentSalon?.accent ?? '#8e7ab5',
      active: form.active,
      availableDates: currentSalon?.availableDates ?? [],
      basePrice: toBoundedNumber(form.basePrice),
      capacity: toBoundedNumber(form.capacity, { min: 1, fallback: 1 }),
      description: form.description.trim(),
      direccion: currentSalon?.direccion ?? form.location.trim(),
      location: form.location.trim(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      photos: form.urlImagen ? [form.urlImagen] : [],
      serviciosIds: form.serviciosIds,
      type: form.type.trim(),
      urlImagen: form.urlImagen,
      idPublicoCloudinary: form.idPublicoCloudinary,
      duenoId: form.duenoId,
    })
    resetForm()
  }
  const archiveSalon = async () => {
    if (!editingId) return
    const salon = data.salones.find((item) => item.id === editingId)
    if (!salon) return
    await createSalon({ ...salon, estado: 'archivado', active: false })
    resetForm()
  }
  const rows = data.salones.filter(isVisibleSalon).filter((salon) => {
    const owner = data.usuarios.find((user) => user.id === salon.duenoId || user.salonesIds?.includes(salon.id))
    return matchesSearch(query, [
      salon.name,
      salon.type,
      salon.location,
      salon.locationLabel,
      salon.direccion,
      salon.capacity,
      salon.basePrice,
      owner?.nombre,
      salon.active === false ? 'inactivo' : 'activo',
    ])
  })
  const columns = [{ key: 'name', label: 'Salón', render: (row) => <span className="table-person"><img src={row.urlImagen || row.photos?.[0]} alt="" /><span><strong>{row.name}</strong><small>{getSalonLocation(row)}</small></span></span> }, { key: 'duenoId', label: 'Dueño', render: (row) => data.usuarios.find((user) => user.id === row.duenoId || user.salonesIds?.includes(row.id))?.nombre ?? 'Sin asignar' }, { key: 'type', label: 'Tipo' }, { key: 'capacity', label: 'Capacidad', render: (row) => `${row.capacity} personas` }, { key: 'basePrice', label: 'Precio base', render: (row) => formatCurrency(row.basePrice) }, { key: 'active', label: 'Estado', render: (row) => <StatusBadge status={row.active ? 'activo' : 'inactivo'} /> }, { key: 'actions', label: '', render: (row) => <div className="table-actions"><button className="icon-button" type="button" title="Editar salón" onClick={() => startEdit(row)}><Pencil size={15} /></button><button className="icon-button" type="button" onClick={() => toggleSalon(row.id)} title={row.active ? 'Ocultar' : 'Publicar'}>{row.active ? <Eye size={15} /> : <Check size={15} />}</button></div> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Catálogo" title="Gestión de salones" description="Administra espacios, precios, fotos y publicación." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Salones' }]} actions={<Button icon={Plus} onClick={startCreate}>Nuevo salón</Button>} />{open && <div className="workspace-card inline-form-card" data-reveal><div><span className="eyebrow">{editingId ? 'Editar salón' : 'Alta de salón'}</span><h2>{editingId ? 'Actualizar espacio' : 'Agregar un nuevo espacio'}</h2><p>El formulario guarda los campos de salones, asigna dueño con duenoId y usa Cloudinary para la imagen principal.</p></div><form className="inline-form inline-form--salon" onSubmit={submit}><input required maxLength={TEXT_MAX_LENGTH} placeholder="Nombre del salón" value={form.name} onChange={update('name')} /><input required maxLength={TEXT_MAX_LENGTH} placeholder="Tipo de salón" value={form.type} onChange={update('type')} /><input required maxLength={TEXT_MAX_LENGTH} placeholder="Ciudad / zona" value={form.location} onChange={update('location')} /><input type="tel" inputMode="tel" maxLength="13" placeholder="Teléfono" value={form.phone} onChange={update('phone')} /><input required type="number" min="1" max={NUMBER_MAX_VALUE} placeholder="Capacidad" value={form.capacity} onChange={update('capacity')} /><input required type="number" min="0" max={NUMBER_MAX_VALUE} placeholder="Precio base" value={form.basePrice} onChange={update('basePrice')} /><select required value={form.duenoId} onChange={update('duenoId')}><option value="">Asignar dueño</option>{owners.map((owner) => <option value={owner.id} key={owner.id}>{owner.nombre}</option>)}</select><textarea required maxLength={TEXT_MAX_LENGTH} placeholder="Descripción" value={form.description} onChange={update('description')} /><div className="checkbox-grid">{data.servicios.map((service) => <label key={service.id}><input type="checkbox" checked={form.serviciosIds.includes(service.id)} onChange={() => toggleServiceId(service.id)} />{service.nombre}</label>)}</div><label className="toggle-line"><input type="checkbox" checked={form.active} onChange={update('active')} /> Publicado</label><label className="upload-field"><ImagePlus size={16} />{uploading ? 'Subiendo...' : 'Subir imagen'}<input type="file" accept="image/*" onChange={uploadImage} /></label>{form.urlImagen && <span className="form-preview"><img src={form.urlImagen} alt="Preview del salón" />Imagen principal lista</span>}<div className="form-actions"><Button type="submit" size="sm" disabled={uploading}>{editingId ? 'Guardar cambios' : 'Guardar salón'}</Button>{editingId && <Button type="button" variant="danger" size="sm" onClick={archiveSalon}>Archivar salón</Button>}<Button type="button" variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button></div></form><InfoNote tone="lilac"><ImagePlus size={15} /> Cloudinary · cloud_name: {CLOUDINARY_CONFIG.cloudName || 'pendiente'} · upload_preset: {CLOUDINARY_CONFIG.uploadPreset}. {cloudinaryUploadNote}</InfoNote></div>}<div className="workspace-card"><div className="table-toolbar"><div className="listing-search"><Search size={16} /><input value={query} maxLength={TEXT_MAX_LENGTH} onChange={(event) => setQuery(limitText(event.target.value))} placeholder="Buscar por salón, dueño, tipo, ciudad o estado" /></div><Badge tone="neutral">{rows.length} salones</Badge></div><Table columns={columns} rows={rows} /></div></AnimatedPage>
}

export function AdminServicesPage() {
  const { data, createService, toggleServiceActive, notify } = useApp()
  const emptyForm = { id: '', nombre: '', descripcion: '', precio: '', urlImagen: '', idPublicoCloudinary: '', activo: true }
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [uploading, setUploading] = useState(false)
  const editing = Boolean(form.id)
  const update = (field) => (event) => {
    const { type, checked, value } = event.target
    const nextValue = type === 'checkbox'
      ? checked
      : field === 'precio'
        ? normalizeNumberInput(value)
        : limitText(value)
    setForm({ ...form, [field]: nextValue })
  }
  const resetServiceForm = () => { setForm(emptyForm); setUploading(false); setOpen(false) }
  const startCreateService = () => { setForm(emptyForm); setUploading(false); setOpen(true) }
  const editService = (service) => {
    setForm({
    id: service.id,
    nombre: service.nombre ?? '',
    descripcion: service.descripcion ?? '',
    precio: service.precio ?? '',
    urlImagen: service.urlImagen ?? '',
    idPublicoCloudinary: service.idPublicoCloudinary ?? '',
    activo: service.activo ?? true,
    })
    setOpen(true)
  }
  const uploadImage = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const upload = await uploadSalonImage(file)
      setForm((current) => ({ ...current, urlImagen: upload.secure_url, idPublicoCloudinary: upload.public_id }))
      notify(upload.pending ? 'Imagen en preview local. Configura Cloudinary para subirla.' : 'Imagen subida a Cloudinary')
    } catch (error) {
      console.error('Cloudinary service image upload failed:', error)
      notify('No se pudo subir la imagen del servicio a Cloudinary.', 'warning')
    } finally {
      setUploading(false)
    }
  }
  const submit = async (event) => {
    event.preventDefault()
    await createService({
      ...form,
      precio: toBoundedNumber(form.precio),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      urlImagen: form.urlImagen.trim(),
      idPublicoCloudinary: form.idPublicoCloudinary.trim(),
    })
    resetServiceForm()
  }
  const rows = data.servicios.filter((service) => matchesSearch(query, [
    service.nombre,
    service.descripcion,
    service.precio,
    service.activo ? 'activo' : 'inactivo',
  ]))
  const columns = [{ key: 'nombre', label: 'Servicio', render: (row) => <span className="table-person">{row.urlImagen ? <img src={row.urlImagen} alt="" /> : <span className="service-table-icon"><Sparkles size={15} /></span>}<span><strong>{row.nombre}</strong><small>{row.descripcion}</small></span></span> }, { key: 'precio', label: 'Precio', render: (row) => formatCurrency(row.precio) }, { key: 'activo', label: 'Estado', render: (row) => <StatusBadge status={row.activo ? 'activo' : 'inactivo'} /> }, { key: 'actions', label: '', render: (row) => <div className="table-actions"><button type="button" className="icon-button" title="Editar servicio" onClick={() => editService(row)}><Pencil size={15} /></button><button type="button" className="icon-button" title={row.activo ? 'Desactivar' : 'Activar'} onClick={() => toggleServiceActive(row.id)}>{row.activo ? <Trash2 size={15} /> : <Check size={15} />}</button></div> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Catálogo" title="Gestión de servicios" description="Crea extras que los clientes pueden sumar a su reservación." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Servicios' }]} actions={<Button icon={Plus} onClick={startCreateService}>Agregar</Button>} />{open && <><div className="workspace-card quick-create"><div><span className="eyebrow">{editing ? 'Editar servicio' : 'Nuevo servicio'}</span><h2>{editing ? 'Actualizar opción' : 'Sumar una opción'}</h2><p>El precio se guarda en pesos mexicanos y sólo los servicios activos aparecen al reservar.</p></div><form className="inline-form service-form" onSubmit={submit}><input required maxLength={TEXT_MAX_LENGTH} placeholder="Nombre del servicio" value={form.nombre} onChange={update('nombre')} /><input required min="0" max={NUMBER_MAX_VALUE} type="number" placeholder="Precio" value={form.precio} onChange={update('precio')} /><label className="upload-field"><ImagePlus size={16} />{uploading ? 'Subiendo...' : 'Subir imagen del servicio'}<input type="file" accept="image/*" onChange={uploadImage} /></label>{form.urlImagen && <span className="form-preview"><img src={form.urlImagen} alt="Preview del servicio" />Imagen lista</span>}<textarea required maxLength={TEXT_MAX_LENGTH} placeholder="Descripción" value={form.descripcion} onChange={update('descripcion')} /><label className="toggle-line"><input type="checkbox" checked={form.activo} onChange={update('activo')} /> Activo</label><div className="form-actions"><Button type="submit" icon={Plus} disabled={uploading}>{editing ? 'Guardar cambios' : 'Agregar'}</Button><Button type="button" variant="ghost" onClick={resetServiceForm}>Cancelar</Button></div></form></div><InfoNote tone="lilac"><ImagePlus size={15} /> Cloudinary · cloud_name: {CLOUDINARY_CONFIG.cloudName || 'pendiente'} · upload_preset: {CLOUDINARY_CONFIG.uploadPreset}. {cloudinaryUploadNote}</InfoNote></>}<div className="workspace-card"><div className="table-toolbar"><div className="listing-search"><Search size={16} /><input value={query} maxLength={TEXT_MAX_LENGTH} onChange={(event) => setQuery(limitText(event.target.value))} placeholder="Buscar por servicio, descripción, precio o estado" /></div><Badge tone="neutral">{rows.length} servicios</Badge></div><Table columns={columns} rows={rows} /></div></AnimatedPage>
}

export function AdminAvailabilityPage() {
  const { data, createAvailability, updateAvailability } = useApp()
  const activeSalons = data.salones.filter(isVisibleSalon)
  const activeSalonIds = activeSalons.map((salon) => salon.id)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('todas')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ salonId: activeSalons[0]?.id ?? '', fecha: '', precio: '', estado: 'disponible' })
  const selectedSalon = activeSalons.find((salon) => salon.id === form.salonId)
  const submit = async (event) => {
    event.preventDefault()
    await createAvailability({
      estado: form.estado,
      fecha: form.fecha,
      precio: toBoundedNumber(form.precio || selectedSalon?.basePrice || 0),
      salonesIds: [form.salonId],
    })
    setForm({ salonId: activeSalons[0]?.id ?? '', fecha: '', precio: '', estado: 'disponible' })
    setOpen(false)
  }
  const rows = data.disponibilidad
    .filter((item) => item.salonesIds?.some((salonId) => activeSalonIds.includes(salonId)))
    .filter((item) => filter === 'todas' || item.estado === filter || (filter === 'bloqueada' && item.estado === 'bloqueado'))
    .filter((item) => {
      const salonNames = data.salones.filter((salon) => item.salonesIds?.includes(salon.id)).map((salon) => salon.name).join(', ')
      return matchesSearch(query, [item.fecha, item.estado, item.precio, salonNames])
    })
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  const columns = [{ key: 'fecha', label: 'Fecha', render: (row) => <strong>{formatDate(row.fecha, 'd MMM yyyy')}</strong> }, { key: 'salon', label: 'Salón', render: (row) => data.salones.filter((salon) => row.salonesIds.includes(salon.id)).map((salon) => salon.name).join(', ') }, { key: 'precio', label: 'Precio', render: (row) => formatCurrency(row.precio) }, { key: 'estado', label: 'Estado', render: (row) => <select className="status-select" value={row.estado === 'bloqueado' ? 'bloqueada' : row.estado} onChange={(event) => updateAvailability(row.id, event.target.value)}><option value="disponible">disponible</option><option value="reservada">reservada</option><option value="bloqueada">bloqueada</option></select> }, { key: 'actions', label: '', render: (row) => <button className="icon-button" type="button" title="Bloquear fecha" onClick={() => updateAvailability(row.id, 'bloqueada')}><Eye size={15} /></button> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Calendario" title="Gestión de disponibilidad" description="Define qué fechas pueden reservarse y bajo qué precio." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Disponibilidad' }]} actions={<Button variant="secondary" icon={Plus} onClick={() => setOpen((value) => !value)}>Nueva fecha</Button>} />{open && <div className="workspace-card inline-form-card" data-reveal><div><span className="eyebrow">Nueva disponibilidad</span><h2>Crear fecha reservable</h2><p>La fecha se guarda en disponibilidad con salonesIds como array.</p></div><form className="inline-form" onSubmit={submit}><select required value={form.salonId} onChange={(event) => setForm({ ...form, salonId: event.target.value, precio: normalizeNumberInput(activeSalons.find((salon) => salon.id === event.target.value)?.basePrice ?? form.precio) })}>{activeSalons.map((salon) => <option key={salon.id} value={salon.id}>{salon.name}</option>)}</select><input required type="date" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} /><input type="number" min="0" max={NUMBER_MAX_VALUE} placeholder={`Precio sugerido ${formatCurrency(selectedSalon?.basePrice ?? 0)}`} value={form.precio} onChange={(event) => setForm({ ...form, precio: normalizeNumberInput(event.target.value) })} /><select value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}><option value="disponible">disponible</option><option value="reservada">reservada</option><option value="bloqueada">bloqueada</option></select><Button type="submit" size="sm">Guardar fecha</Button></form></div>}<div className="workspace-card"><div className="table-toolbar table-toolbar--stack"><div className="listing-search"><Search size={16} /><input value={query} maxLength={TEXT_MAX_LENGTH} onChange={(event) => setQuery(limitText(event.target.value))} placeholder="Buscar por salón, fecha, precio o estado" /></div><div className="table-toolbar__filters">{['todas', 'disponible', 'reservada', 'bloqueada'].map((state) => <button type="button" key={state} className={clsx('toolbar-chip', filter === state && 'toolbar-chip--active')} onClick={() => setFilter(state)}><CalendarDays size={14} /> {state === 'todas' ? 'Todas las fechas' : state}</button>)}</div><span className="table-date-note"><CalendarDays size={14} /> Fechas desde Firestore</span></div><Table columns={columns} rows={rows} /></div><InfoNote tone="lilac"><CalendarDays size={15} /> Los clientes sólo pueden reservar fechas en estado disponible. Al reservar, la fecha cambia a reservada.</InfoNote></AnimatedPage>
}

export function AdminReservationsPage() {
  const { data, updateReservationStatus } = useApp()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todas')
  const rows = data.reservaciones.filter((reservation) => {
    const client = getReservationClient(data, reservation)
    const salonNames = getReservationSalonNames(data, reservation)
    const matchesStatus = statusFilter === 'todas' || normalizeReservationStatus(reservation.estadoReservacion) === statusFilter
    return matchesStatus && matchesSearch(query, [
      reservation.id,
      client?.nombre,
      client?.correo,
      salonNames,
      reservation.fecha,
      reservation.estadoReservacion,
      reservation.estadoPago,
      reservation.total,
    ])
  })
  const columns = [{ key: 'id', label: 'ID', render: (row) => <code className="id-code">{row.id}</code> }, { key: 'salon', label: 'Salón', render: (row) => data.salones.find((salon) => row.salonesIds.includes(salon.id))?.name }, { key: 'cliente', label: 'Cliente', render: (row) => data.usuarios.find((user) => user.id === row.clienteId)?.nombre }, { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.fecha, 'd MMM yyyy') }, { key: 'estadoReservacion', label: 'Reservación', render: (row) => <select className="status-select" value={normalizeReservationStatus(row.estadoReservacion)} onChange={(event) => updateReservationStatus(row.id, event.target.value)}>{reservationStatusOptions.map((status) => <option value={status} key={status}>{status}</option>)}</select> }, { key: 'estadoPago', label: 'Pago', render: (row) => <StatusBadge status={row.estadoPago} /> }, { key: 'total', label: 'Total', render: (row) => <strong>{formatCurrency(row.total)}</strong> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Operación" title="Gestión de reservaciones" description="Consulta, filtra y da seguimiento a cada solicitud." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Reservaciones' }]} /><div className="workspace-card"><div className="table-toolbar"><div className="listing-search"><Search size={16} /><input value={query} maxLength={TEXT_MAX_LENGTH} onChange={(event) => setQuery(limitText(event.target.value))} placeholder="Buscar por ID, cliente, salón, fecha, pago o total" /></div><select className="status-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="todas">Todas</option>{reservationStatusOptions.map((status) => <option value={status} key={status}>{status}</option>)}</select></div><Table columns={columns} rows={rows} /></div></AnimatedPage>
}

export function AdminPaymentsPage() {
  const { data } = useApp()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const rows = data.pagos.filter((payment) => {
    const reservation = getPaymentReservation(data, payment)
    const client = getUserById(data, payment.clienteId) ?? getReservationClient(data, reservation ?? {})
    const salonNames = reservation ? getReservationSalonNames(data, reservation) : ''
    const normalizedStatus = getPaymentStatus(payment.estadoPago)
    const matchesStatus = statusFilter === 'todos' || normalizedStatus === statusFilter
    return matchesStatus && matchesSearch(query, [
      payment.id,
      payment.identificadorPagoStripe,
      payment.identificadorSesionStripe,
      payment.metodoPago,
      payment.monto,
      normalizedStatus,
      client?.nombre,
      client?.correo,
      salonNames,
      reservation?.id,
    ])
  })
  const columns = [{ key: 'id', label: 'Pago', render: (row) => <span className="table-person"><span className="service-table-icon service-table-icon--gold"><CreditCard size={15} /></span><span><strong>{row.id}</strong><small>{row.identificadorPagoStripe || 'Stripe pendiente'}</small></span></span> }, { key: 'cliente', label: 'Cliente', render: (row) => data.usuarios.find((user) => user.id === row.clienteId)?.nombre }, { key: 'monto', label: 'Monto', render: (row) => <strong>{formatCurrency(row.monto)}</strong> }, { key: 'fechaCreacion', label: 'Fecha', render: (row) => formatDate(row.fechaCreacion, 'd MMM yyyy') }, { key: 'estadoPago', label: 'Estado', render: (row) => <StatusBadge status={getPaymentStatus(row.estadoPago)} /> }, { key: 'metodoPago', label: 'Método' }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Finanzas" title="Gestión de pagos" description="Todos los movimientos ligados a reservaciones." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Pagos' }]} actions={<Button variant="secondary" icon={WalletCards} onClick={() => window.open('https://dashboard.stripe.com/payments', '_blank', 'noopener,noreferrer')}>Abrir Stripe</Button>} /><div className="metric-grid metric-grid--compact"><MetricCard label="Pagado" value={formatCurrency(data.pagos.filter((item) => getPaymentStatus(item.estadoPago) === 'pagado').reduce((sum, item) => sum + Number(item.monto || 0), 0))} helper="confirmado" icon={Check} accent="sage" /><MetricCard label="Pendiente" value={formatCurrency(data.pagos.filter((item) => getPaymentStatus(item.estadoPago) === 'pendiente').reduce((sum, item) => sum + Number(item.monto || 0), 0))} helper="por cobrar" icon={Clock3} accent="gold" /></div><div className="workspace-card"><div className="table-toolbar"><div className="listing-search"><Search size={16} /><input value={query} maxLength={TEXT_MAX_LENGTH} onChange={(event) => setQuery(limitText(event.target.value))} placeholder="Buscar por cliente, salón, pago o Stripe" /></div><select className="status-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{paymentStatusOptions.map((status) => <option value={status} key={status}>{status === 'todos' ? 'Todos los estados' : status}</option>)}</select></div><Table columns={columns} rows={rows} /></div><InfoNote tone="lilac" icon={ShieldCheck}>Los estados pagados se confirman exclusivamente mediante el webhook firmado de Stripe.</InfoNote></AnimatedPage>
}

export function AdminReportsPage() {
  const { data, dataSource } = useApp()
  const [query, setQuery] = useState('')
  const adminData = getFirestoreOnlyData(data, dataSource)
  const visibleSalons = adminData.salones.filter(isVisibleSalon)
  const reportRows = visibleSalons
    .map((salon) => {
      const reservations = adminData.reservaciones.filter((reservation) => reservation.salonesIds?.includes(salon.id))
      const paidReservations = reservations.filter((reservation) => reservation.estadoPago === 'pagado')
      return {
        ...salon,
        reservations: reservations.length,
        paidReservations: paidReservations.length,
        revenue: paidReservations.reduce((sum, reservation) => sum + Number(reservation.total || 0), 0),
      }
    })
    .filter((row) => matchesSearch(query, [
      row.name,
      getSalonLocation(row),
      row.type,
      row.reservations,
      row.paidReservations,
      row.revenue,
    ]))
    .sort((a, b) => b.paidReservations - a.paidReservations || b.reservations - a.reservations)
  const confirmed = adminData.reservaciones.filter((item) => item.estadoReservacion === 'confirmada').length
  const pending = adminData.reservaciones.filter(isPendingReservation).length
  const cancelled = adminData.reservaciones.filter((item) => item.estadoReservacion === 'cancelada').length
  const paid = adminData.reservaciones.filter((item) => item.estadoPago === 'pagado').length

  return (
    <AnimatedPage className="panel-page">
      <PanelIntro
        eyebrow="Lecturas del negocio"
        title="Reportes simples"
        description="Una lectura rápida del rendimiento real de espacios y reservas."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Reportes' }]}
      />
      <div className="report-hero">
        <div>
          <span className="eyebrow">Resumen de operación</span>
          <h2>Datos conectados a Firestore.</h2>
          <p>{adminData.reservaciones.length} reservaciones reales · {visibleSalons.length} salones en catálogo · {paid} pagos confirmados.</p>
        </div>
        <BarChart3 size={58} strokeWidth={1} />
      </div>
      <div className="report-grid">
        <div className="workspace-card">
          <SectionTitle title="Rendimiento por salón" description="Reservaciones y pagos confirmados desde Firestore." />
          <div className="table-toolbar table-toolbar--stack">
            <div className="listing-search">
              <Search size={16} />
              <input value={query} maxLength={TEXT_MAX_LENGTH} onChange={(event) => setQuery(limitText(event.target.value))} placeholder="Buscar por salón, ubicación, tipo o monto" />
            </div>
            <Badge tone="neutral">{reportRows.length} salones</Badge>
          </div>
          {reportRows.length ? (
            reportRows.map((row) => (
              <div className="report-row" key={row.id}>
                <img src={row.photos?.[0] || row.urlImagen} alt="" />
                <span><strong>{row.name}</strong><small>{row.reservations} reservaciones · {row.paidReservations} pagadas</small></span>
                <div className="report-progress"><i style={{ width: `${Math.min(100, Math.max(12, row.paidReservations * 28 || row.reservations * 18))}%` }} /></div>
                <strong>{formatCurrency(row.revenue)}</strong>
              </div>
            ))
          ) : (
            <EmptyState title="Sin datos todavía" description="Cuando existan salones o reservaciones reales, aparecerán aquí." />
          )}
        </div>
        <div className="workspace-card">
          <SectionTitle title="Distribución" description="Estado real de reservaciones." />
          {adminData.reservaciones.length ? (
            <div className="donut-wrap">
              <div className="donut"><strong>{adminData.reservaciones.length}</strong><small>total</small></div>
              <div className="donut-legend">
                <span><i className="legend-dot legend-dot--gold" /> Confirmadas <strong>{confirmed}</strong></span>
                <span><i className="legend-dot legend-dot--lilac" /> Pendientes <strong>{pending}</strong></span>
                <span><i className="legend-dot legend-dot--muted" /> Canceladas <strong>{cancelled}</strong></span>
              </div>
            </div>
          ) : (
            <EmptyState title="Sin datos todavía" description="No hay reservaciones reales para graficar." />
          )}
        </div>
      </div>
    </AnimatedPage>
  )
}

function CompassIcon() { return <span className="compass-icon"><span /></span> }
function MapPinIcon() { return <span className="map-pin-icon" /> }

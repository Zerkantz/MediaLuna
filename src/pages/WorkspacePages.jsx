import { useEffect, useEffectEvent, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  Eye,
  Filter,
  ImagePlus,
  LockKeyhole,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
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
import { StreamChatWidget } from '../components/StreamChatWidget'
import { DailyVideoCallModal } from '../components/DailyVideoCallModal'
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

function PanelIntro({ eyebrow = 'MediaLuna', title, description, actions, crumbs = [] }) {
  return <><Breadcrumbs items={crumbs.length ? crumbs : [{ label: title }]} /><PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} /></>
}

function ReservationList({ reservations, data, showClient = false }) {
  return <div className="reservation-list">{reservations.map((reservation) => { const salon = data.salones.find((item) => reservation.salonesIds.includes(item.id)); const client = data.usuarios.find((item) => item.id === reservation.clienteId); return <Link to={`/cliente/reservaciones/${reservation.id}`} className="reservation-row" key={reservation.id}><img src={salon?.photos?.[0]} alt={salon?.name} /><div className="reservation-row__main"><div><strong>{salon?.name ?? 'Salón'}</strong><StatusBadge status={reservation.estadoReservacion} /></div><p><CalendarDays size={14} /> {formatDate(reservation.fecha, 'EEE d MMM yyyy')} {showClient && <>· {client?.nombre}</>}</p></div><div className="reservation-row__total"><small>Total</small><strong>{formatCurrency(reservation.total)}</strong><ArrowRight size={16} /></div></Link> })}</div>
}

export function ClientDashboard() {
  const { data, currentUser } = useApp()
  const reservations = data.reservaciones.filter((reservation) => reservation.clienteId === currentUser?.id)
  const upcoming = reservations.filter((reservation) => reservation.estadoReservacion !== 'cancelada').slice(0, 2)
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Tu espacio" title={`Hola, ${currentUser?.nombre?.split(' ')[0] ?? 'Lucía'}.`} description="Todo lo que necesitas para que tu próxima celebración fluya." actions={<Button to="/salones" icon={Plus}>Nueva reservación</Button>} crumbs={[{ label: 'Resumen' }]} /><div className="metric-grid"><MetricCard label="Reservaciones" value={reservations.length} helper="en tu historial" icon={CalendarCheck2} accent="lilac" /><MetricCard label="Próximo evento" value={upcoming[0] ? formatDate(upcoming[0].fecha, 'd MMM') : '—'} helper={upcoming[0] ? 'tu fecha elegida' : 'sin fechas'} icon={CalendarDays} accent="gold" /><MetricCard label="Pagado" value={formatCurrency(reservations.filter((item) => item.estadoPago === 'pagado').reduce((total, item) => total + item.total, 0))} helper="en MediaLuna" icon={CircleDollarSign} accent="rose" /></div><div className="workspace-grid"><section className="workspace-card"><SectionTitle title="Próximos momentos" description="Tus reservaciones más cercanas." action={<Button to="/cliente/reservaciones" variant="ghost" size="sm">Ver todas <ArrowRight size={14} /></Button>} />{upcoming.length ? <ReservationList reservations={upcoming} data={data} /> : <EmptyState icon={CalendarDays} title="Tu calendario está abierto" description="Encuentra un espacio para empezar a llenarlo." action={<Button to="/salones">Explorar salones</Button>} />}</section><section className="workspace-card workspace-card--dark"><div className="dark-orb" /><span className="eyebrow">Tu asistente MediaLuna</span><h3>¿Listos para<br />hacerlo especial?</h3><p>Explora nuevos espacios y arma un plan a tu medida.</p><Button to="/salones" variant="light" size="sm" icon={ArrowRight}>Explorar</Button></section></div><section className="workspace-card"><SectionTitle title="Atajos para tu celebración" /><div className="shortcut-grid"><Link to="/salones" className="shortcut-card"><span><CompassIcon /></span><strong>Buscar espacios</strong><small>Encuentra tu próximo escenario</small><ArrowRight size={15} /></Link><Link to="/cliente/perfil" className="shortcut-card"><span><Users size={17} /></span><strong>Completa tu perfil</strong><small>Para reservar más rápido</small><ArrowRight size={15} /></Link><button type="button" className="shortcut-card" onClick={() => alert('Centro de ayuda pendiente de conexión')}><span><MessageCircle size={17} /></span><strong>Habla con nosotros</strong><small>Estamos para acompañarte</small><ArrowRight size={15} /></button></div></section></AnimatedPage>
}

export function ClientReservationsPage() {
  const { data, currentUser } = useApp()
  const reservations = data.reservaciones.filter((reservation) => reservation.clienteId === currentUser?.id)
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Tu historial" title="Mis reservaciones" description="Revisa estados, fechas y detalles de cada momento." actions={<Button to="/salones" icon={Plus}>Nueva reservación</Button>} crumbs={[{ label: 'Cliente', to: '/cliente' }, { label: 'Mis reservaciones' }]} /><div className="workspace-card"><div className="card-tabs"><button className="card-tab card-tab--active" type="button">Todas <span>{reservations.length}</span></button><button className="card-tab" type="button">Próximas <span>{reservations.filter((item) => item.estadoReservacion !== 'cancelada').length}</span></button><button className="card-tab" type="button">Completadas</button></div><ReservationList reservations={reservations} data={data} /></div><InfoNote tone="lilac"><strong>Pagos seguros:</strong> las reservaciones pendientes pueden pagarse con Stripe desde su detalle.</InfoNote></AnimatedPage>
}

export function ClientReservationDetailPage() {
  const { id } = useParams()
  const { data, currentUser, startStripePayment, confirmStripePayment } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showVideoCall, setShowVideoCall] = useState(false)
  const [paymentState, setPaymentState] = useState({ loading: false, message: '', tone: 'lilac' })
  const paymentResult = searchParams.get('payment')
  const stripeSessionId = searchParams.get('session_id')

  const reservation = data.reservaciones.find((item) => item.id === id && item.clienteId === currentUser?.id)

  const syncReturnedPayment = useEffectEvent(async () => {
    setPaymentState({ loading: true, message: 'Verificando el pago con Stripe…', tone: 'lilac' })
    const result = await confirmStripePayment(stripeSessionId)
    setPaymentState({
      loading: false,
      message: result.ok ? 'Pago confirmado correctamente por Stripe.' : result.message,
      tone: result.ok ? 'lilac' : 'warning',
    })
    setSearchParams({}, { replace: true })
  })

  useEffect(() => {
    if (!paymentResult) return undefined
    const timeout = window.setTimeout(() => {
      if (paymentResult === 'success' && stripeSessionId) syncReturnedPayment()
      if (paymentResult === 'cancelled') {
        setPaymentState({ loading: false, message: 'El pago fue cancelado. Puedes intentarlo nuevamente.', tone: 'warning' })
        setSearchParams({}, { replace: true })
      }
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [paymentResult, stripeSessionId, setSearchParams])

  const payReservation = async () => {
    setPaymentState({ loading: true, message: '', tone: 'lilac' })
    const result = await startStripePayment(id)
    if (!result.ok) setPaymentState({ loading: false, message: result.message, tone: 'warning' })
    if (result.paid) setPaymentState({ loading: false, message: 'Este pago ya fue confirmado por Stripe.', tone: 'lilac' })
    if (result.processing) setPaymentState({ loading: false, message: 'Stripe está procesando este pago.', tone: 'lilac' })
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
          {reservation.estadoPago === 'pendiente' && <Button variant="secondary" size="sm" icon={CreditCard} disabled={paymentState.loading} onClick={payReservation}>{paymentState.loading ? 'Procesando…' : 'Pagar con Stripe'}</Button>}
        </div>
      </div>

      {paymentState.message && <InfoNote tone={paymentState.tone} icon={paymentState.tone === 'warning' ? CircleAlert : ShieldCheck}>{paymentState.message}</InfoNote>}

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

        <aside className="workspace-card chat-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="eyebrow" style={{ margin: 0 }}>Comunicación en vivo</span>
            <Button
              variant="ghost"
              size="sm"
              icon={Video}
              onClick={() => setShowVideoCall(true)}
              style={{ background: 'rgba(39, 34, 49, 0.08)' }}
            >
              Videollamada
            </Button>
          </div>

          <StreamChatWidget
            reservation={reservation}
            currentUser={currentUser}
            counterpartName={owner.nombre}
            counterpartRole="Dueño del espacio"
          />
        </aside>
      </div>

      {showVideoCall && (
        <DailyVideoCallModal
          reservation={reservation}
          currentUser={currentUser}
          onClose={() => setShowVideoCall(false)}
        />
      )}
    </AnimatedPage>
  )
}

export function ClientProfilePage() {
  const { currentUser, updateClientProfile } = useApp()
  const [form, setForm] = useState({ nombre: currentUser?.nombre ?? '', telefono: currentUser?.telefono ?? '', correo: currentUser?.correo ?? '' })
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const result = await updateClientProfile(form)
    if (!result.ok) setError(result.message)
  }
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Tu cuenta" title="Mi perfil" description="Mantén tus datos listos para cada reservación." crumbs={[{ label: 'Cliente', to: '/cliente' }, { label: 'Mi perfil' }]} /><div className="profile-layout"><section className="workspace-card profile-card"><div className="profile-card__avatar avatar avatar--large">{currentUser?.nombre?.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><h2>{currentUser?.nombre}</h2><p>{currentUser?.correo}</p><Badge tone="lilac">Cliente</Badge><div className="profile-meta"><span><Phone size={15} /> {currentUser?.telefono}</span><span><CalendarDays size={15} /> Miembro desde {formatDate(currentUser?.fechaCreacion, 'MMMM yyyy')}</span></div></section><section className="workspace-card"><SectionTitle title="Datos personales" description="Estos campos se guardan en usuarios/{uid}." /><form onSubmit={submit}><div className="form-grid"><label className="field"><span>Nombre</span><input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label><label className="field"><span>Teléfono</span><input required value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} /></label><label className="field field--full"><span>Correo electrónico</span><input required value={form.correo} type="email" onChange={(event) => setForm({ ...form, correo: event.target.value })} /></label></div>{error && <InfoNote tone="warning">{error}</InfoNote>}<Button variant="secondary" type="submit" icon={Check}>Guardar cambios</Button></form></section></div></AnimatedPage>
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
  const reservations = data.reservaciones.filter((reservation) => reservationBelongsToOwner(reservation, currentUser?.id, currentUser?.salonesIds))
  const columns = [{ key: 'salon', label: 'Salón', render: (row) => { const salon = data.salones.find((item) => row.salonesIds.includes(item.id)); return <span className="table-person"><img src={salon?.photos?.[0]} alt="" /><strong>{salon?.name}</strong></span> } }, { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.fecha, 'd MMM yyyy') }, { key: 'cliente', label: 'Cliente', render: (row) => data.usuarios.find((item) => item.id === row.clienteId)?.nombre }, { key: 'total', label: 'Total', render: (row) => <strong>{formatCurrency(row.total)}</strong> }, { key: 'estadoReservacion', label: 'Estado', render: (row) => <StatusBadge status={row.estadoReservacion} /> }, { key: 'actions', label: '', render: () => <button className="icon-button" type="button" title="Ver detalle" onClick={() => alert('Detalle de reservación: pendiente de conexión')}><Eye size={16} /></button> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Agenda compartida" title="Reservaciones" description="Revisa las solicitudes y la agenda de tus espacios." crumbs={[{ label: 'Dueño', to: '/dueno' }, { label: 'Reservaciones' }]} actions={<Button to="/dueno/chats" variant="secondary" icon={MessageCircle}>Ver chats</Button>} /><div className="workspace-card"><div className="table-toolbar"><div className="table-toolbar__filters"><button type="button" className="toolbar-chip toolbar-chip--active"><Filter size={14} /> Todas</button><button type="button" className="toolbar-chip">Pendientes</button><button type="button" className="toolbar-chip">Confirmadas</button></div><button type="button" className="icon-button" title="Actualizar" onClick={() => alert('Datos mock actualizados')}><RefreshCcw size={16} /></button></div><Table columns={columns} rows={reservations} /></div></AnimatedPage>
}

export function OwnerChatsPage() {
  const { data, currentUser } = useApp()
  const reservations = data.reservaciones.filter((reservation) => reservationBelongsToOwner(reservation, currentUser?.id, currentUser?.salonesIds))
  const [selectedResId, setSelectedResId] = useState(reservations[0]?.id || null)
  const [showVideoCall, setShowVideoCall] = useState(false)

  const selectedReservation = reservations.find((r) => r.id === selectedResId) || reservations[0]
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
                  onClick={() => setSelectedResId(reservation.id)}
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

        <div className="workspace-card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '520px', padding: '16px' }}>
          {selectedReservation && client ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{client.nombre}</h3>
                  <small style={{ color: '#64748b' }}>{salon?.name} ({formatDate(selectedReservation.fecha, 'd MMM yyyy')})</small>
                </div>
                <Button variant="secondary" size="sm" icon={Video} onClick={() => setShowVideoCall(true)}>
                  Videollamada con cliente
                </Button>
              </div>

              <div style={{ flex: 1 }}>
                <StreamChatWidget
                  reservation={selectedReservation}
                  currentUser={currentUser}
                  counterpartName={client.nombre}
                  counterpartRole="Cliente"
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
        />
      )}
    </AnimatedPage>
  )
}


export function AdminDashboard() {
  const { data } = useApp()
  const revenue = data.pagos.filter((payment) => payment.estadoPago === 'pagado').reduce((total, payment) => total + payment.monto, 0)
  const pending = data.reservaciones.filter((reservation) => reservation.estadoReservacion !== 'confirmada').length
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Centro de control" title="Dashboard general" description="La operación de MediaLuna, en una sola mirada." crumbs={[{ label: 'Dashboard' }]} actions={<Button variant="secondary" icon={Download} onClick={() => alert('Exportación de reporte pendiente de conexión')}>Exportar reporte</Button>} /><div className="metric-grid metric-grid--admin"><MetricCard label="Ingresos registrados" value={formatCurrency(revenue)} helper="pagos confirmados" icon={CircleDollarSign} trend="+12.5%" accent="gold" /><MetricCard label="Reservaciones" value={data.reservaciones.length} helper="total histórico" icon={CalendarCheck2} trend="+8.2%" accent="lilac" /><MetricCard label="Usuarios activos" value={data.usuarios.filter((item) => item.activo).length} helper="en la plataforma" icon={Users} icon2={Users} accent="rose" /><MetricCard label="Por revisar" value={pending} helper="solicitudes pendientes" icon={Clock3} accent="sage" /></div><div className="workspace-grid workspace-grid--admin"><section className="workspace-card"><SectionTitle title="Actividad reciente" description="Últimos movimientos de la operación." action={<Button to="/admin/reportes" variant="ghost" size="sm">Ver reportes <ArrowRight size={14} /></Button>} /><div className="activity-list"><ActivityRow icon={CreditCard} title="Pago confirmado" detail="Lucía Ramírez · Aurora Gran Salón" time="Hace 2 h" tone="gold" /><ActivityRow icon={UserPlus} title="Nuevo dueño registrado" detail="Diego Navarro · 2 salones asignados" time="Ayer" tone="lilac" /><ActivityRow icon={CalendarDays} title="Nueva reservación" detail="Terraza Cobre · 30 ago 2026" time="Ayer" tone="rose" /><ActivityRow icon={Sparkles} title="Servicio actualizado" detail="Barra de autor · $6,800 MXN" time="12 ago" tone="sage" /></div></section><section className="workspace-card chart-card"><SectionTitle title="Ingresos" description="Últimos 6 meses" action={<button type="button" className="select-button">2026 <ChevronDown size={14} /></button>} /><div className="chart-value"><strong>{formatCurrency(revenue)}</strong><Badge tone="success">+12.5%</Badge></div><div className="bar-chart">{[42, 58, 47, 78, 64, 92].map((height, index) => <div className="bar-chart__item" key={index}><span style={{ height: `${height}%` }} /><small>{['Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'][index]}</small></div>)}</div></section></div></AnimatedPage>
}

function ActivityRow({ icon: Icon, title, detail, time, tone }) { return <div className="activity-row"><span className={clsx('activity-icon', `activity-icon--${tone}`)}><Icon size={16} /></span><span><strong>{title}</strong><small>{detail}</small></span><time>{time}</time></div> }

export function AdminUsersPage() {
  const { data, createUser, toggleUser } = useApp()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', correo: '', telefono: '' })
  const owners = data.usuarios.filter((user) => user.rol === 'dueno')
  const submit = async (event) => { event.preventDefault(); const created = await createUser({ ...form, activo: true, fechaCreacion: format(new Date(), 'yyyy-MM-dd'), rol: 'dueno', salonesIds: [] }); if (!created) return; setForm({ nombre: '', correo: '', telefono: '' }); setOpen(false) }
  const columns = [{ key: 'nombre', label: 'Usuario', render: (row) => <span className="table-person"><span className="avatar avatar--small">{row.nombre[0]}</span><span><strong>{row.nombre}</strong><small>{row.correo}</small></span></span> }, { key: 'rol', label: 'Rol', render: (row) => <Badge tone={row.rol === 'administrador' ? 'lilac' : row.rol === 'dueno' ? 'gold' : 'neutral'}>{roleLabel[row.rol]}</Badge> }, { key: 'fechaCreacion', label: 'Alta', render: (row) => formatDate(row.fechaCreacion, 'd MMM yyyy') }, { key: 'activo', label: 'Estado', render: (row) => <StatusBadge status={row.activo ? 'activo' : 'inactivo'} /> }, { key: 'actions', label: '', render: (row) => <div className="table-actions"><button className="icon-button" type="button" title="Cambiar contraseña temporal" onClick={() => alert('Cambio de contraseña temporal: pendiente de conexión')}><LockKeyhole size={15} /></button><button className="icon-button" type="button" title={row.activo ? 'Desactivar' : 'Activar'} onClick={() => toggleUser(row.id)}>{row.activo ? <Trash2 size={15} /> : <Check size={15} />}</button></div> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Personas" title="Gestión de usuarios" description="Controla accesos, roles y estado de cada cuenta." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Usuarios' }]} actions={<Button icon={UserPlus} onClick={() => setOpen((value) => !value)}>Crear usuario dueño</Button>} />{open && <div className="workspace-card inline-form-card" data-reveal><div><span className="eyebrow">Nuevo acceso</span><h2>Crear usuario dueño</h2><p>La contraseña temporal será gestionada cuando se conecte Firebase Auth.</p></div><form className="inline-form" onSubmit={submit}><input required placeholder="Nombre completo" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /><input required type="email" placeholder="Correo" value={form.correo} onChange={(event) => setForm({ ...form, correo: event.target.value })} /><input required placeholder="Teléfono" value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} /><Button type="submit" size="sm">Guardar dueño</Button></form><InfoNote tone="warning"><LockKeyhole size={15} /> Contraseña temporal: placeholder de conexión.</InfoNote></div>}<div className="workspace-card"><div className="table-toolbar"><div className="listing-search"><Search size={16} /><input placeholder="Buscar por nombre o correo" /></div><Badge tone="neutral">{data.usuarios.length} usuarios</Badge></div><Table columns={columns} rows={data.usuarios} /></div><InfoNote><CircleAlert size={15} /> {owners.length} dueños tienen salones asignados. Los permisos se basan en el campo rol.</InfoNote></AnimatedPage>
}

export function AdminSalonsPage() {
  const { data, createSalon, toggleSalon, notify } = useApp()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const emptyForm = { name: '', type: '', location: '', phone: '', capacity: '', basePrice: '', description: '', duenoId: '', active: true, serviciosIds: [], urlImagen: '', idPublicoCloudinary: '' }
  const [form, setForm] = useState(emptyForm)
  const owners = data.usuarios.filter((user) => user.rol === 'dueno' && user.activo)
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })
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
      basePrice: Number(form.basePrice),
      capacity: Number(form.capacity),
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
  const rows = data.salones.filter(isVisibleSalon)
  const columns = [{ key: 'name', label: 'Salón', render: (row) => <span className="table-person"><img src={row.urlImagen || row.photos?.[0]} alt="" /><span><strong>{row.name}</strong><small>{getSalonLocation(row)}</small></span></span> }, { key: 'duenoId', label: 'Dueño', render: (row) => data.usuarios.find((user) => user.id === row.duenoId || user.salonesIds?.includes(row.id))?.nombre ?? 'Sin asignar' }, { key: 'type', label: 'Tipo' }, { key: 'capacity', label: 'Capacidad', render: (row) => `${row.capacity} personas` }, { key: 'basePrice', label: 'Precio base', render: (row) => formatCurrency(row.basePrice) }, { key: 'active', label: 'Estado', render: (row) => <StatusBadge status={row.active ? 'activo' : 'inactivo'} /> }, { key: 'actions', label: '', render: (row) => <div className="table-actions"><button className="icon-button" type="button" title="Editar salón" onClick={() => startEdit(row)}><Pencil size={15} /></button><button className="icon-button" type="button" onClick={() => toggleSalon(row.id)} title={row.active ? 'Ocultar' : 'Publicar'}>{row.active ? <Eye size={15} /> : <Check size={15} />}</button></div> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Catálogo" title="Gestión de salones" description="Administra espacios, precios, fotos y publicación." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Salones' }]} actions={<Button icon={Plus} onClick={startCreate}>Nuevo salón</Button>} />{open && <div className="workspace-card inline-form-card" data-reveal><div><span className="eyebrow">{editingId ? 'Editar salón' : 'Alta de salón'}</span><h2>{editingId ? 'Actualizar espacio' : 'Agregar un nuevo espacio'}</h2><p>El formulario guarda los campos de salones, asigna dueño con duenoId y usa Cloudinary para la imagen principal.</p></div><form className="inline-form inline-form--salon" onSubmit={submit}><input required placeholder="Nombre del salón" value={form.name} onChange={update('name')} /><input required placeholder="Tipo de salón" value={form.type} onChange={update('type')} /><input required placeholder="Ciudad / zona" value={form.location} onChange={update('location')} /><input placeholder="Teléfono" value={form.phone} onChange={update('phone')} /><input required type="number" min="1" placeholder="Capacidad" value={form.capacity} onChange={update('capacity')} /><input required type="number" min="0" placeholder="Precio base" value={form.basePrice} onChange={update('basePrice')} /><select required value={form.duenoId} onChange={update('duenoId')}><option value="">Asignar dueño</option>{owners.map((owner) => <option value={owner.id} key={owner.id}>{owner.nombre}</option>)}</select><textarea required placeholder="Descripción" value={form.description} onChange={update('description')} /><div className="checkbox-grid">{data.servicios.map((service) => <label key={service.id}><input type="checkbox" checked={form.serviciosIds.includes(service.id)} onChange={() => toggleServiceId(service.id)} />{service.nombre}</label>)}</div><label className="toggle-line"><input type="checkbox" checked={form.active} onChange={update('active')} /> Publicado</label><label className="upload-field"><ImagePlus size={16} />{uploading ? 'Subiendo...' : 'Subir imagen'}<input type="file" accept="image/*" onChange={uploadImage} /></label>{form.urlImagen && <span className="form-preview"><img src={form.urlImagen} alt="Preview del salón" />Imagen principal lista</span>}<div className="form-actions"><Button type="submit" size="sm" disabled={uploading}>{editingId ? 'Guardar cambios' : 'Guardar salón'}</Button>{editingId && <Button type="button" variant="danger" size="sm" onClick={archiveSalon}>Archivar salón</Button>}<Button type="button" variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button></div></form><InfoNote tone="lilac"><ImagePlus size={15} /> Cloudinary · cloud_name: {CLOUDINARY_CONFIG.cloudName || 'pendiente'} · upload_preset: {CLOUDINARY_CONFIG.uploadPreset}. {cloudinaryUploadNote}</InfoNote></div>}<div className="workspace-card"><Table columns={columns} rows={rows} /></div></AnimatedPage>
}

export function AdminServicesPage() {
  const { data, createService, toggleServiceActive, notify } = useApp()
  const emptyForm = { id: '', nombre: '', descripcion: '', precio: '', urlImagen: '', idPublicoCloudinary: '', activo: true }
  const [form, setForm] = useState(emptyForm)
  const [uploading, setUploading] = useState(false)
  const editing = Boolean(form.id)
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })
  const resetServiceForm = () => { setForm(emptyForm); setUploading(false) }
  const editService = (service) => setForm({
    id: service.id,
    nombre: service.nombre ?? '',
    descripcion: service.descripcion ?? '',
    precio: service.precio ?? '',
    urlImagen: service.urlImagen ?? '',
    idPublicoCloudinary: service.idPublicoCloudinary ?? '',
    activo: service.activo ?? true,
  })
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
      precio: Number(form.precio),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      urlImagen: form.urlImagen.trim(),
      idPublicoCloudinary: form.idPublicoCloudinary.trim(),
    })
    resetServiceForm()
  }
  const columns = [{ key: 'nombre', label: 'Servicio', render: (row) => <span className="table-person">{row.urlImagen ? <img src={row.urlImagen} alt="" /> : <span className="service-table-icon"><Sparkles size={15} /></span>}<span><strong>{row.nombre}</strong><small>{row.descripcion}</small></span></span> }, { key: 'precio', label: 'Precio', render: (row) => formatCurrency(row.precio) }, { key: 'activo', label: 'Estado', render: (row) => <StatusBadge status={row.activo ? 'activo' : 'inactivo'} /> }, { key: 'actions', label: '', render: (row) => <div className="table-actions"><button type="button" className="icon-button" title="Editar servicio" onClick={() => editService(row)}><Pencil size={15} /></button><button type="button" className="icon-button" title={row.activo ? 'Desactivar' : 'Activar'} onClick={() => toggleServiceActive(row.id)}>{row.activo ? <Trash2 size={15} /> : <Check size={15} />}</button></div> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Catálogo" title="Gestión de servicios" description="Crea extras que los clientes pueden sumar a su reservación." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Servicios' }]} /><div className="workspace-card quick-create"><div><span className="eyebrow">{editing ? 'Editar servicio' : 'Nuevo servicio'}</span><h2>{editing ? 'Actualizar opción' : 'Sumar una opción'}</h2><p>El precio se guarda en pesos mexicanos y sólo los servicios activos aparecen al reservar.</p></div><form className="inline-form service-form" onSubmit={submit}><input required placeholder="Nombre del servicio" value={form.nombre} onChange={update('nombre')} /><input required min="0" type="number" placeholder="Precio" value={form.precio} onChange={update('precio')} /><label className="upload-field"><ImagePlus size={16} />{uploading ? 'Subiendo...' : 'Subir imagen del servicio'}<input type="file" accept="image/*" onChange={uploadImage} /></label>{form.urlImagen && <span className="form-preview"><img src={form.urlImagen} alt="Preview del servicio" />Imagen lista</span>}<textarea required placeholder="Descripción" value={form.descripcion} onChange={update('descripcion')} /><label className="toggle-line"><input type="checkbox" checked={form.activo} onChange={update('activo')} /> Activo</label><div className="form-actions"><Button type="submit" icon={Plus} disabled={uploading}>{editing ? 'Guardar cambios' : 'Agregar'}</Button>{editing && <Button type="button" variant="ghost" onClick={resetServiceForm}>Cancelar</Button>}</div></form></div><InfoNote tone="lilac"><ImagePlus size={15} /> Cloudinary · cloud_name: {CLOUDINARY_CONFIG.cloudName || 'pendiente'} · upload_preset: {CLOUDINARY_CONFIG.uploadPreset}. {cloudinaryUploadNote}</InfoNote><div className="workspace-card"><Table columns={columns} rows={data.servicios} /></div></AnimatedPage>
}

export function AdminAvailabilityPage() {
  const { data, createAvailability, updateAvailability } = useApp()
  const activeSalons = data.salones.filter(isVisibleSalon)
  const activeSalonIds = activeSalons.map((salon) => salon.id)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('todas')
  const [form, setForm] = useState({ salonId: activeSalons[0]?.id ?? '', fecha: '', precio: '', estado: 'disponible' })
  const selectedSalon = activeSalons.find((salon) => salon.id === form.salonId)
  const submit = async (event) => {
    event.preventDefault()
    await createAvailability({
      estado: form.estado,
      fecha: form.fecha,
      precio: Number(form.precio || selectedSalon?.basePrice || 0),
      salonesIds: [form.salonId],
    })
    setForm({ salonId: activeSalons[0]?.id ?? '', fecha: '', precio: '', estado: 'disponible' })
    setOpen(false)
  }
  const rows = data.disponibilidad
    .filter((item) => item.salonesIds?.some((salonId) => activeSalonIds.includes(salonId)))
    .filter((item) => filter === 'todas' || item.estado === filter)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  const columns = [{ key: 'fecha', label: 'Fecha', render: (row) => <strong>{formatDate(row.fecha, 'd MMM yyyy')}</strong> }, { key: 'salon', label: 'Salón', render: (row) => data.salones.filter((salon) => row.salonesIds.includes(salon.id)).map((salon) => salon.name).join(', ') }, { key: 'precio', label: 'Precio', render: (row) => formatCurrency(row.precio) }, { key: 'estado', label: 'Estado', render: (row) => <select className="status-select" value={row.estado} onChange={(event) => updateAvailability(row.id, event.target.value)}><option value="disponible">disponible</option><option value="reservada">reservada</option><option value="bloqueada">bloqueada</option></select> }, { key: 'actions', label: '', render: (row) => <button className="icon-button" type="button" title="Bloquear fecha" onClick={() => updateAvailability(row.id, 'bloqueada')}><Eye size={15} /></button> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Calendario" title="Gestión de disponibilidad" description="Define qué fechas pueden reservarse y bajo qué precio." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Disponibilidad' }]} actions={<Button variant="secondary" icon={Plus} onClick={() => setOpen((value) => !value)}>Nueva fecha</Button>} />{open && <div className="workspace-card inline-form-card" data-reveal><div><span className="eyebrow">Nueva disponibilidad</span><h2>Crear fecha reservable</h2><p>La fecha se guarda en disponibilidad con salonesIds como array.</p></div><form className="inline-form" onSubmit={submit}><select required value={form.salonId} onChange={(event) => setForm({ ...form, salonId: event.target.value, precio: activeSalons.find((salon) => salon.id === event.target.value)?.basePrice ?? form.precio })}>{activeSalons.map((salon) => <option key={salon.id} value={salon.id}>{salon.name}</option>)}</select><input required type="date" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} /><input type="number" min="0" placeholder={`Precio sugerido ${formatCurrency(selectedSalon?.basePrice ?? 0)}`} value={form.precio} onChange={(event) => setForm({ ...form, precio: event.target.value })} /><select value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}><option value="disponible">disponible</option><option value="reservada">reservada</option><option value="bloqueada">bloqueada</option></select><Button type="submit" size="sm">Guardar fecha</Button></form></div>}<div className="workspace-card"><div className="table-toolbar"><div className="table-toolbar__filters">{['todas', 'disponible', 'reservada', 'bloqueada'].map((state) => <button type="button" key={state} className={clsx('toolbar-chip', filter === state && 'toolbar-chip--active')} onClick={() => setFilter(state)}><CalendarDays size={14} /> {state === 'todas' ? 'Todas las fechas' : state}</button>)}</div><span className="table-date-note"><CalendarDays size={14} /> Fechas desde Firestore</span></div><Table columns={columns} rows={rows} /></div><InfoNote tone="lilac"><CalendarDays size={15} /> Los clientes sólo pueden reservar fechas en estado disponible. Al reservar, la fecha cambia a reservada.</InfoNote></AnimatedPage>
}

export function AdminReservationsPage() {
  const { data, updateReservationStatus } = useApp()
  const columns = [{ key: 'id', label: 'ID', render: (row) => <code className="id-code">{row.id}</code> }, { key: 'salon', label: 'Salón', render: (row) => data.salones.find((salon) => row.salonesIds.includes(salon.id))?.name }, { key: 'cliente', label: 'Cliente', render: (row) => data.usuarios.find((user) => user.id === row.clienteId)?.nombre }, { key: 'fecha', label: 'Fecha', render: (row) => formatDate(row.fecha, 'd MMM yyyy') }, { key: 'estadoReservacion', label: 'Reservación', render: (row) => <select className="status-select" value={normalizeReservationStatus(row.estadoReservacion)} onChange={(event) => updateReservationStatus(row.id, event.target.value)}>{reservationStatusOptions.map((status) => <option value={status} key={status}>{status}</option>)}</select> }, { key: 'estadoPago', label: 'Pago', render: (row) => <StatusBadge status={row.estadoPago} /> }, { key: 'total', label: 'Total', render: (row) => <strong>{formatCurrency(row.total)}</strong> }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Operación" title="Gestión de reservaciones" description="Consulta, filtra y da seguimiento a cada solicitud." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Reservaciones' }]} actions={<Button variant="secondary" icon={Download} onClick={() => alert('Exportación de reservaciones pendiente de conexión')}>Exportar</Button>} /><div className="workspace-card"><div className="table-toolbar"><div className="listing-search"><Search size={16} /><input placeholder="Buscar por ID, cliente o salón" /></div><button className="toolbar-chip" type="button"><Filter size={14} /> Filtros <ChevronDown size={13} /></button></div><Table columns={columns} rows={data.reservaciones} /></div></AnimatedPage>
}

export function AdminPaymentsPage() {
  const { data } = useApp()
  const columns = [{ key: 'id', label: 'Pago', render: (row) => <span className="table-person"><span className="service-table-icon service-table-icon--gold"><CreditCard size={15} /></span><span><strong>{row.id}</strong><small>{row.identificadorPagoStripe || 'Stripe pendiente'}</small></span></span> }, { key: 'cliente', label: 'Cliente', render: (row) => data.usuarios.find((user) => user.id === row.clienteId)?.nombre }, { key: 'monto', label: 'Monto', render: (row) => <strong>{formatCurrency(row.monto)}</strong> }, { key: 'fechaCreacion', label: 'Fecha', render: (row) => formatDate(row.fechaCreacion, 'd MMM yyyy') }, { key: 'estadoPago', label: 'Estado', render: (row) => <StatusBadge status={row.estadoPago} /> }, { key: 'metodoPago', label: 'Método' }]
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Finanzas" title="Gestión de pagos" description="Todos los movimientos ligados a reservaciones." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Pagos' }]} actions={<Button variant="secondary" icon={WalletCards} onClick={() => window.open('https://dashboard.stripe.com/payments', '_blank', 'noopener,noreferrer')}>Abrir Stripe</Button>} /><div className="metric-grid metric-grid--compact"><MetricCard label="Pagado" value={formatCurrency(data.pagos.filter((item) => item.estadoPago === 'pagado').reduce((sum, item) => sum + item.monto, 0))} helper="confirmado" icon={Check} accent="sage" /><MetricCard label="Pendiente" value={formatCurrency(data.pagos.filter((item) => item.estadoPago === 'pendiente').reduce((sum, item) => sum + item.monto, 0))} helper="por cobrar" icon={Clock3} accent="gold" /></div><div className="workspace-card"><Table columns={columns} rows={data.pagos} /></div><InfoNote tone="lilac" icon={ShieldCheck}>Los estados pagados se confirman exclusivamente mediante el webhook firmado de Stripe.</InfoNote></AnimatedPage>
}

export function AdminReportsPage() {
  const { data } = useApp()
  const visibleSalons = data.salones.filter(isVisibleSalon)
  const reportRows = visibleSalons.map((salon) => ({ ...salon, reservations: data.reservaciones.filter((item) => item.salonesIds.includes(salon.id)).length, revenue: data.reservaciones.filter((item) => item.salonesIds.includes(salon.id)).reduce((sum, item) => sum + item.total, 0) }))
  return <AnimatedPage className="panel-page"><PanelIntro eyebrow="Lecturas del negocio" title="Reportes simples" description="Una lectura rápida del rendimiento de espacios y reservas." crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Reportes' }]} actions={<Button variant="secondary" icon={Download} onClick={() => alert('Descarga de reporte pendiente de conexión')}>Descargar CSV</Button>} /><div className="report-hero"><div><span className="eyebrow">Resumen de operación</span><h2>La noche se está moviendo.</h2><p>{data.reservaciones.length} reservaciones creadas · {visibleSalons.length} salones en catálogo · {data.servicios.length} servicios activos.</p></div><BarChart3 size={58} strokeWidth={1} /></div><div className="report-grid"><div className="workspace-card"><SectionTitle title="Rendimiento por salón" description="Reservaciones creadas en el periodo." />{reportRows.map((row) => <div className="report-row" key={row.id}><img src={row.photos?.[0]} alt="" /><span><strong>{row.name}</strong><small>{row.reservations} reservaciones</small></span><div className="report-progress"><i style={{ width: `${Math.min(100, Math.max(12, row.reservations * 28))}%` }} /></div><strong>{formatCurrency(row.revenue)}</strong></div>)}</div><div className="workspace-card"><SectionTitle title="Distribución" description="Estado de reservaciones." /><div className="donut-wrap"><div className="donut"><strong>{data.reservaciones.length}</strong><small>total</small></div><div className="donut-legend"><span><i className="legend-dot legend-dot--gold" /> Confirmadas <strong>{data.reservaciones.filter((item) => item.estadoReservacion === 'confirmada').length}</strong></span><span><i className="legend-dot legend-dot--lilac" /> Pendientes <strong>{data.reservaciones.filter((item) => item.estadoReservacion !== 'confirmada').length}</strong></span><span><i className="legend-dot legend-dot--muted" /> Canceladas <strong>0</strong></span></div></div></div></div></AnimatedPage>
}

function CompassIcon() { return <span className="compass-icon"><span /></span> }
function MapPinIcon() { return <span className="map-pin-icon" /> }

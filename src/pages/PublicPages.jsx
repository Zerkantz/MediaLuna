import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleAlert,
  Compass,
  CreditCard,
  MapPin,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '../context/AppContext'
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
  PageHeader,
  ProgressSteps,
  SalonCard,
  SectionTitle,
  TinyCalendar,
} from '../components/ui'
import {
  NUMBER_MAX_VALUE,
  SEARCH_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  getTodayDateInputValue,
  getWeekendSurcharge,
  isPastDateValue,
  isValidPhoneInput,
  limitText,
  normalizeNumberInput,
  normalizePhoneInput,
} from '../utils/formLimits'

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid site-footer__grid--simple">
        <div>
          <Link to="/" className="footer-brand">media<em>luna</em></Link>
          <p>Espacios con intención para celebrar lo que importa.</p>
        </div>
        <div>
          <strong>Explora</strong>
          <Link to="/salones">Salones</Link>
          <Link to="/#como-funciona">Cómo funciona</Link>
        </div>
        <div>
          <strong>Soporte</strong>
          <a href="mailto:medialunasalones@gmail.com">medialunasalones@gmail.com</a>
          <span>San Luis Río Colorado, Sonora</span>
        </div>
      </div>
      <div className="container site-footer__legal">
        <span>© 2026 MediaLuna</span>
        <span>Privacidad · Términos</span>
      </div>
    </footer>
  )
}

const isVisibleSalon = (salon) => salon?.estado !== 'archivado' && salon?.active !== false
const isAvailableRecord = (item) => Boolean(item?.fecha) && item?.estado === 'disponible' && !isPastDateValue(item.fecha)
const availabilityBelongsToSalon = (item, salonId) => item.salonesIds?.includes(salonId)
const salonHasAvailableDates = (data, salonId) => data.disponibilidad.some((item) => (
  availabilityBelongsToSalon(item, salonId) && isAvailableRecord(item)
))
const salonIsAvailableOnDate = (data, salonId, date) => data.disponibilidad.some((item) => (
  availabilityBelongsToSalon(item, salonId) && item.fecha === date && isAvailableRecord(item)
))
const extractCityFromText = (value) => {
  const parts = String(value ?? '').split(',').map((part) => part.trim()).filter(Boolean)
  return parts[0] ?? ''
}
const normalizeCity = (value) => String(value ?? '').trim().toLowerCase()
const getSalonCity = (salon) => {
  const explicitCity = salon?.ciudad ?? salon?.city ?? salon?.municipio ?? salon?.localidad
  if (explicitCity) return String(explicitCity).trim()
  const locationValue = Array.isArray(salon?.location) ? salon.location.join(', ') : salon?.location ?? salon?.ubicacion ?? salon?.locationLabel
  return extractCityFromText(locationValue) || extractCityFromText(salon?.direccion)
}
const getSalonCityOptions = (salons) => [...new Set(salons.map(getSalonCity).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
const salonMatchesCity = (salon, city) => {
  const normalizedCity = normalizeCity(city)
  if (!normalizedCity) return true
  const salonCity = normalizeCity(getSalonCity(salon))
  const searchableLocation = normalizeCity(`${getSalonLocation(salon)} ${salon.direccion ?? ''} ${salon.name ?? ''}`)
  return salonCity === normalizedCity || searchableLocation.includes(normalizedCity)
}
const getPaidReservationsForSalon = (data, salonId) => data.reservaciones.filter((reservation) => (
  reservation.estadoPago === 'pagado' && reservation.salonesIds?.includes(salonId)
))
const getFeaturedSalons = (data) => {
  const visibleSalons = data.salones.filter(isVisibleSalon)
  const rankedByPaidReservations = visibleSalons
    .map((salon) => ({ salon, paidCount: getPaidReservationsForSalon(data, salon.id).length }))
    .filter((item) => item.paidCount > 0)
    .sort((a, b) => b.paidCount - a.paidCount)
    .slice(0, 3)
    .map((item) => item.salon)

  return rankedByPaidReservations.length
    ? rankedByPaidReservations
    : visibleSalons.filter((salon) => salonHasAvailableDates(data, salon.id)).slice(0, 3)
}

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data } = useApp()
  const [search, setSearch] = useState({ location: '', date: '', guests: '' })
  const featured = getFeaturedSalons(data)
  const cityOptions = getSalonCityOptions(data.salones.filter(isVisibleSalon))
  const todayInputDate = getTodayDateInputValue()
  useEffect(() => {
    if (!location.hash) return undefined
    const targetId = location.hash.slice(1)
    const frame = window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash])
  const submitSearch = (event) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (search.location) params.set('location', search.location)
    if (search.date && !isPastDateValue(search.date)) params.set('date', search.date)
    if (search.guests) params.set('guests', search.guests)
    navigate(`/salones?${params.toString()}`)
  }
  return <AnimatedPage className="home-page">
    <section className="hero-section"><img className="hero-background" src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1800&q=88" alt="Salón de eventos preparado para celebración" /><div className="hero-overlay" /><div className="container hero-grid"><div className="hero-copy" data-reveal><div className="hero-kicker"><span className="kicker-dot" /> Salones, jardines y terrazas <Sparkles size={16} /></div><h1>Encuentra el espacio ideal para tu evento.</h1><p>MediaLuna reúne salones con personalidad, fechas disponibles y servicios para que organizar tu celebración sea claro desde el primer clic.</p><div className="hero-actions"><Button to="/salones" icon={ArrowRight}>Ver salones</Button><a className="text-link" href="#buscador-home"><CalendarDays size={18} /> Buscar fecha</a></div></div></div><div className="container hero-search-wrap" id="buscador-home" data-reveal><form className="hero-search" onSubmit={submitSearch}><div className="hero-search__field"><MapPin size={22} /><label>¿Dónde?</label><select value={search.location} onChange={(event) => setSearch({ ...search, location: event.target.value })}><option value="">Todas las ciudades</option>{cityOptions.map((city) => <option value={city} key={city}>{city}</option>)}</select></div><div className="hero-search__field"><CalendarDays size={22} /><label>¿Cuándo?</label><input type="date" min={todayInputDate} value={search.date} onChange={(event) => setSearch({ ...search, date: event.target.value })} /></div><div className="hero-search__field"><UsersRound size={22} /><label>Invitados</label><input type="number" min="1" max={NUMBER_MAX_VALUE} value={search.guests} onChange={(event) => setSearch({ ...search, guests: normalizeNumberInput(event.target.value, { min: 1 }) })} placeholder="Número de personas" /></div><button type="submit" className="search-submit"><Search size={20} /><span>Buscar salones</span></button></form></div></section>
    <section className="home-intro container" id="como-funciona"><div className="home-intro__aside" data-reveal><span className="eyebrow">Una nueva forma de celebrar</span><h2>Menos pendientes.<br /><em>Más momentos.</em></h2></div><div className="home-intro__text" data-reveal><p>MediaLuna reúne espacios con personalidad y servicios que hacen que organizar tu evento se sienta tan bien como vivirlo.</p><div className="mini-points"><span><Check size={14} /> Espacios verificados</span><span><Check size={14} /> Reserva sin vueltas</span><span><Check size={14} /> Acompañamiento humano</span></div></div></section>
    <section className="section container" id="inspiracion"><SectionTitle title="Inspiración" description="Los salones con más reservas pagadas; si aún no hay ventas, mostramos salones con fechas abiertas." action={<Button to="/salones" variant="ghost" icon={ArrowRight}>Ver todos</Button>} /><div className="salon-grid salon-grid--featured">{featured.map((salon) => <SalonCard key={salon.id} salon={salon} featured />)}</div></section>
    <section className="ritual-section"><div className="container ritual-grid"><div className="ritual-copy" data-reveal><span className="eyebrow">El ritual MediaLuna</span><h2>Tu evento,<br /><em>a tu ritmo.</em></h2><p>Busca, guarda, compara y reserva desde un mismo lugar. Sin correos perdidos, sin llamadas de ida y vuelta.</p><Button to="/registro" variant="light" icon={ArrowRight}>Crear mi cuenta</Button></div><div className="ritual-list" data-reveal><div><span>01</span><div><strong>Inspírate</strong><p>Descubre salones que se sienten como tu evento.</p></div></div><div><span>02</span><div><strong>Arma tu plan</strong><p>Elige fecha y suma los detalles que hacen la diferencia.</p></div></div><div><span>03</span><div><strong>Hazlo realidad</strong><p>Confirma tu reservación y disfruta el camino.</p></div></div></div></div></section>
    <SiteFooter />
  </AnimatedPage>
}

export function SalonesPage() {
  const { data } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const homeLocation = params.get('location') ?? ''
  const homeDate = params.get('date') ?? ''
  const homeGuests = params.get('guests') ?? ''
  const [filters, setFilters] = useState({
    capacity: homeGuests || params.get('capacity') || '',
    onlyAvailable: params.get('available') === 'true',
  })
  const [nameQuery, setNameQuery] = useState('')
  const visibleSalons = data.salones.filter(isVisibleSalon)
  const hasHomeFilters = Boolean(homeLocation || homeDate || homeGuests)
  const clearFilters = () => {
    setFilters({ capacity: '', onlyAvailable: false })
    setNameQuery('')
    navigate('/salones', { replace: true })
  }
  const salons = visibleSalons.filter((salon) => {
    const matchesName = !nameQuery || String(salon.name ?? '').toLowerCase().includes(nameQuery.toLowerCase())
    const matchesLocation = salonMatchesCity(salon, homeLocation)
    const matchesCapacity = !filters.capacity || salon.capacity >= Number(filters.capacity)
    const matchesDate = !homeDate || (!isPastDateValue(homeDate) && salonIsAvailableOnDate(data, salon.id, homeDate))
    const matchesAvailability = !filters.onlyAvailable || salonHasAvailableDates(data, salon.id)
    return matchesName && matchesLocation && matchesCapacity && matchesDate && matchesAvailability
  })

  return (
    <AnimatedPage>
      <div className="container internal-page">
        <Breadcrumbs items={[{ label: 'Salones' }]} />
        <PageHeader
          eyebrow="Encuentra tu lugar"
          title="Espacios que hacen memoria."
          description="Explora salones con personalidad para bodas, cenas, lanzamientos y noches que no necesitan explicación."
        />
        <div className="listing-toolbar listing-toolbar--simple" data-reveal>
          <div className="listing-search listing-name-search">
            <Search size={16} />
            <input
              value={nameQuery}
              maxLength={SEARCH_MAX_LENGTH}
              onChange={(event) => setNameQuery(limitText(event.target.value, SEARCH_MAX_LENGTH))}
              placeholder="Buscar salón por nombre"
            />
          </div>
          <select
            aria-label="Filtrar por capacidad"
            value={filters.capacity}
            onChange={(event) => setFilters({ ...filters, capacity: event.target.value })}
          >
            <option value="">Cualquier capacidad</option>
            <option value="50">50+ personas</option>
            <option value="100">100+ personas</option>
            <option value="150">150+ personas</option>
            <option value="200">200+ personas</option>
          </select>
          <label className="availability-toggle">
            <input
              type="checkbox"
              checked={filters.onlyAvailable}
              onChange={(event) => setFilters({ ...filters, onlyAvailable: event.target.checked })}
            />
            <span>Solo con fechas disponibles</span>
          </label>
        </div>
        {hasHomeFilters && (
          <div className="active-search-note" data-reveal>
            <span>
              Búsqueda del home
              {homeDate && <> · {formatDate(homeDate, 'd MMM yyyy')}</>}
              {homeGuests && <> · {homeGuests}+ invitados</>}
              {homeLocation && <> · {homeLocation}</>}
            </span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpiar búsqueda</Button>
          </div>
        )}
        {salons.length ? (
          <div className="salon-grid">
            {salons.map((salon) => <SalonCard salon={salon} key={salon.id} />)}
          </div>
        ) : (
          <EmptyState
            icon={Compass}
            title={nameQuery ? 'No encontramos salones con ese nombre.' : 'No hay salones disponibles con esos filtros.'}
            description={nameQuery ? 'Prueba con otro nombre o limpia la búsqueda.' : 'Prueba con otra fecha o capacidad para ver más espacios.'}
            action={<Button variant="secondary" onClick={clearFilters}>Limpiar filtros</Button>}
          />
        )}
      </div>
    </AnimatedPage>
  )
}

export function SalonDetailPage() {
  const { id } = useParams()
  const { data, selectSalon } = useApp()
  const salon = data.salones.find((item) => item.id === id && isVisibleSalon(item))
  const [activePhoto, setActivePhoto] = useState(0)
  if (!salon) return <AnimatedPage><div className="container internal-page"><EmptyState title="Salón no encontrado" description="Este espacio no está disponible." action={<Button to="/salones">Volver a salones</Button>} /></div></AnimatedPage>
  return <AnimatedPage><div className="container internal-page"><Breadcrumbs items={[{ label: 'Salones', to: '/salones' }, { label: salon.name }]} /><section className="detail-hero"><div className="detail-gallery" data-reveal><div className="detail-gallery__main"><img src={salon.photos?.[activePhoto] || salon.urlImagen} alt={salon.name} /><span className="detail-gallery__count"><CameraIcon /> {activePhoto + 1} / {salon.photos?.length ?? 1}</span></div><div className="detail-gallery__thumbs">{salon.photos?.map((photo, index) => <button type="button" className={clsx(activePhoto === index && 'thumb--active')} key={photo} onClick={() => setActivePhoto(index)}><img src={photo} alt={`${salon.name} vista ${index + 1}`} /></button>)}</div></div><div className="detail-copy" data-reveal><div className="detail-copy__top"><Badge tone="dark">{salon.type}</Badge><span><BadgeCheck size={16} /> Espacio verificado</span></div><h1>{salon.name}</h1><p className="detail-location"><MapPin size={16} /> {salon.direccion} · {getSalonLocation(salon)}</p><p className="detail-description">{salon.description}</p><div className="detail-highlights"><span><UsersRound size={17} /><strong>{salon.capacity}</strong><small>personas</small></span><span><Sparkles size={17} /><strong>{salon.serviciosIds?.length ?? 0}</strong><small>servicios</small></span><span><BadgeCheck size={17} /><strong>Verificado</strong><small>por MediaLuna</small></span></div><div className="detail-price"><div><small>Desde</small><strong>{formatCurrency(salon.basePrice)}</strong><span>/ evento</span></div><Button to={`/reservar/${salon.id}/fecha`} onClick={() => selectSalon(salon.id)} icon={ArrowRight}>Elegir este salón</Button></div><p className="detail-note"><ShieldCheck size={15} /> Reserva protegida · Respuesta del dueño en menos de 24 h</p></div></section></div></AnimatedPage>
}

function CameraIcon() { return <span className="camera-icon"><span /></span> }

const getAvailabilityForSalon = (data, salonId) => data.disponibilidad.filter((item) => item.salonesIds?.includes(salonId))
const getAvailabilityDatesForSalon = (availability) => availability
  .filter((item) => item.fecha)
  .map((item) => ({ fecha: item.fecha, estado: item.estado }))
  .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))

export function BookingDatePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, bookingDraft, selectSalon, selectDate } = useApp()
  const salon = data.salones.find((item) => item.id === id && isVisibleSalon(item))
  const salonAvailability = getAvailabilityForSalon(data, id)
  const availabilityDates = getAvailabilityDatesForSalon(salonAvailability).filter(isAvailableRecord)
  const availableDates = availabilityDates.map((item) => item.fecha)
  const initialSelected = bookingDraft.salonId === id && availableDates.includes(bookingDraft.date)
    ? bookingDraft.date
    : availableDates[0] ?? ''
  const [selectedDate, setSelectedDate] = useState('')
  const selected = availableDates.includes(selectedDate) ? selectedDate : initialSelected
  const [dateError, setDateError] = useState('')
  if (!salon) return <AnimatedPage><EmptyState title="Salón no encontrado" description="Regresa a la lista de espacios para continuar." action={<Button to="/salones">Ver salones</Button>} /></AnimatedPage>
  const selectedAvailability = salonAvailability.find((item) => item.fecha === selected)
  const selectedPrice = Number(salon.basePrice ?? selectedAvailability?.precio ?? 0) || 0
  const weekendSurcharge = getWeekendSurcharge(selected, salon.extraFinSemana)
  const choose = (date) => {
    if (isPastDateValue(date) || !availableDates.includes(date)) {
      const state = salonAvailability.find((item) => item.fecha === date)?.estado
      setDateError(isPastDateValue(date) ? 'No puedes seleccionar fechas anteriores a hoy.' : state ? `La fecha seleccionada está ${state}.` : 'Elige una fecha marcada como disponible.')
      return
    }
    setDateError('')
    setSelectedDate(date)
    selectSalon(id)
    selectDate(date)
  }
  const goNext = () => {
    if (!selected || isPastDateValue(selected) || !availableDates.includes(selected)) return
    selectSalon(id)
    selectDate(selected)
    navigate(`/reservar/${id}/servicios`)
  }
  return <AnimatedPage><div className="container booking-page"><Breadcrumbs items={[{ label: 'Salones', to: '/salones' }, { label: salon.name, to: `/salones/${id}` }, { label: 'Fecha' }]} /><div className="booking-heading"><div><span className="eyebrow">Reserva tu espacio</span><h1>¿Cuándo lo celebramos?</h1><p>Elige una fecha disponible para <strong>{salon.name}</strong>.</p></div><ProgressSteps active={1} /></div><div className="booking-layout"><section className="booking-main"><div className="booking-card"><div className="booking-card__header"><span className="step-number">01</span><div><h2>Selecciona una fecha</h2><p>Las fechas mostradas vienen de Firestore para este salón.</p></div></div>{availabilityDates.length ? <><TinyCalendar dates={availabilityDates} selected={selected} onSelect={choose} />{!availableDates.length && <InfoNote tone="warning">No hay fechas disponibles para seleccionar en este momento.</InfoNote>}</> : <EmptyState icon={CalendarDays} title="Sin disponibilidad cargada" description="Administración debe cargar fechas disponibles para este salón antes de reservar." />}{dateError && <InfoNote tone="warning">{dateError}</InfoNote>}</div><div className="booking-card booking-card--muted"><div className="booking-card__header"><span className="step-number">02</span><div><h2>Tu celebración</h2><p>Cuéntanos un poco más para preparar la experiencia.</p></div></div><div className="form-grid"><label className="field"><span>Tipo de evento</span><select><option>Boda / celebración social</option><option>Cena privada</option><option>Evento corporativo</option><option>Otro</option></select></label><label className="field"><span>Número de invitados</span><input type="number" min="1" max={NUMBER_MAX_VALUE} defaultValue={Math.min(salon.capacity > 100 ? 100 : 40, NUMBER_MAX_VALUE)} onInput={(event) => { event.currentTarget.value = normalizeNumberInput(event.currentTarget.value, { min: 1 }) }} /></label></div></div></section><aside className="booking-aside"><div className="booking-summary-card"><img src={salon.photos?.[0]} alt={salon.name} /><div className="booking-summary-card__body"><span className="eyebrow">Tu selección</span><h3>{salon.name}</h3><p><MapPin size={14} /> {getSalonLocation(salon)}</p><div className="summary-line"><span>Precio base del salón</span><strong>{formatCurrency(selectedPrice)}</strong></div>{weekendSurcharge > 0 && <div className="summary-line"><span>Extra por fin de semana</span><strong>{formatCurrency(weekendSurcharge)}</strong></div>}<div className="summary-line"><span>Fecha</span><strong>{selected ? formatDate(selected, 'd MMM yyyy') : 'Sin seleccionar'}</strong></div><div className="summary-divider" /><div className="summary-total"><span>Subtotal</span><strong>{formatCurrency(selectedPrice + weekendSurcharge)}</strong></div></div></div><Button className="full-button" onClick={goNext} disabled={!selected} icon={ArrowRight}>Continuar con extras</Button><p className="secure-copy"><ShieldCheck size={14} /> No se realizará ningún cargo todavía</p></aside></div></div></AnimatedPage>
}

export function BookingServicesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, bookingDraft, toggleService } = useApp()
  const salon = data.salones.find((item) => item.id === id && isVisibleSalon(item))
  const services = data.servicios.filter((service) => service.activo && salon?.serviciosIds?.includes(service.id))
  const totalServices = services.filter((service) => bookingDraft.servicesIds.includes(service.id)).reduce((sum, service) => sum + Number(service.precio || 0), 0)
  const selectedAvailability = getAvailabilityForSalon(data, id).find((item) => item.fecha === bookingDraft.date)
  const priceSalon = Number(salon?.basePrice ?? selectedAvailability?.precio ?? 0) || 0
  const weekendSurcharge = getWeekendSurcharge(bookingDraft.date, salon?.extraFinSemana)
  const total = priceSalon + weekendSurcharge + totalServices
  if (!salon) return <AnimatedPage><EmptyState title="Salón no encontrado" description="Regresa a la lista de espacios para continuar." action={<Button to="/salones">Ver salones</Button>} /></AnimatedPage>
  return <AnimatedPage><div className="container booking-page"><Breadcrumbs items={[{ label: 'Salones', to: '/salones' }, { label: salon.name, to: `/salones/${id}` }, { label: 'Extras' }]} /><div className="booking-heading"><div><span className="eyebrow">Personaliza la noche</span><h1>Los detalles hacen la diferencia.</h1><p>Selecciona los servicios que quieres sumar a tu reservación.</p></div><ProgressSteps active={2} /></div><div className="booking-layout"><section className="booking-main"><div className="service-select-grid">{services.map((service) => { const active = bookingDraft.servicesIds.includes(service.id); return <button type="button" className={clsx('service-select-card', active && 'service-select-card--active')} onClick={() => toggleService(service.id)} key={service.id}><div className="service-select-card__image"><img src={service.urlImagen} alt={service.nombre} />{active && <span className="service-check"><Check size={14} /></span>}</div><div className="service-select-card__body"><div><h3>{service.nombre}</h3><p>{service.descripcion}</p></div><div className="service-select-card__price"><strong>{formatCurrency(service.precio)}</strong><small>por evento</small></div></div></button> })}</div><InfoNote tone="lilac"><strong>¿Tienes algo especial en mente?</strong> El equipo puede ayudarte a armar una propuesta a la medida.</InfoNote></section><aside className="booking-aside"><div className="booking-summary-card booking-summary-card--plain"><div className="booking-summary-card__body"><span className="eyebrow">Tu selección</span><h3>{salon.name}</h3><p><CalendarDays size={14} /> {formatDate(bookingDraft.date, 'd MMMM yyyy')}</p><div className="summary-line"><span>Precio base del salón</span><strong>{formatCurrency(priceSalon)}</strong></div>{weekendSurcharge > 0 && <div className="summary-line"><span>Extra por fin de semana</span><strong>{formatCurrency(weekendSurcharge)}</strong></div>}<div className="summary-line"><span>Servicios extra</span><strong>{formatCurrency(totalServices)}</strong></div><div className="summary-divider" /><div className="summary-total"><span>Total estimado</span><strong>{formatCurrency(total)}</strong></div></div></div><Button className="full-button" to={`/reservar/${id}/resumen`} icon={ArrowRight}>Ver resumen</Button><Button className="full-button" variant="ghost" onClick={() => navigate(`/reservar/${id}/fecha`)} icon={ChevronLeft}>Cambiar fecha</Button></aside></div></div></AnimatedPage>
}

export function BookingSummaryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, bookingDraft, createReservation, currentUser, notify } = useApp()
  const salon = data.salones.find((item) => item.id === id && isVisibleSalon(item))
  const services = data.servicios.filter((service) => bookingDraft.servicesIds.includes(service.id))
  const totalServices = services.reduce((sum, service) => sum + Number(service.precio || 0), 0)
  const selectedAvailability = getAvailabilityForSalon(data, id).find((item) => item.fecha === bookingDraft.date)
  const priceSalon = Number(salon?.basePrice ?? selectedAvailability?.precio ?? 0) || 0
  const weekendSurcharge = getWeekendSurcharge(bookingDraft.date, salon?.extraFinSemana)
  const total = priceSalon + weekendSurcharge + totalServices
  const [terms, setTerms] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  if (!salon) return <AnimatedPage><EmptyState title="Salón no encontrado" description="Regresa a la lista de espacios para continuar." action={<Button to="/salones">Ver salones</Button>} /></AnimatedPage>
  const confirm = async () => {
    if (!terms) return
    if (!currentUser) {
      notify('Inicia sesión para terminar tu reservación.', 'warning')
      navigate(`/login?next=/reservar/${id}/resumen`)
      return
    }
    if (isPastDateValue(bookingDraft.date) || selectedAvailability?.estado !== 'disponible') {
      setError('Selecciona una fecha disponible y futura para continuar.')
      return
    }
    setCreating(true)
    setError('')
    const result = await createReservation()
    setCreating(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    if (result.checkoutUrl) {
      window.location.assign(result.checkoutUrl)
      return
    }
    navigate(`/cliente/reservaciones/${result.reservation.id}`)
  }
  return <AnimatedPage><div className="container booking-page"><Breadcrumbs items={[{ label: 'Salones', to: '/salones' }, { label: salon.name, to: `/salones/${id}` }, { label: 'Resumen' }]} /><div className="booking-heading"><div><span className="eyebrow">Casi está</span><h1>Revisa tu reservación.</h1><p>Todo listo para empezar a crear una noche especial.</p></div><ProgressSteps active={3} /></div><div className="booking-layout"><section className="booking-main"><div className="review-card"><div className="review-card__top"><img src={salon.photos?.[0]} alt={salon.name} /><div><Badge tone="dark">{salon.type}</Badge><h2>{salon.name}</h2><p><MapPin size={14} /> {getSalonLocation(salon)}</p></div><Link to={`/reservar/${id}/fecha`} className="edit-link">Editar <ArrowRight size={14} /></Link></div><div className="review-grid"><div><span className="review-label">Fecha</span><strong><CalendarDays size={15} /> {formatDate(bookingDraft.date, 'EEEE d MMMM yyyy')}</strong></div><div><span className="review-label">Capacidad</span><strong><UsersRound size={15} /> Hasta {salon.capacity} personas</strong></div><div><span className="review-label">Dirección</span><strong><MapPin size={15} /> {salon.direccion}</strong></div><div><span className="review-label">Estado</span><strong><Badge tone="warning" dot>Pendiente de confirmación</Badge></strong></div></div></div><div className="review-card"><div className="review-section-heading"><div><span className="step-number">+</span><h2>Extras seleccionados</h2></div><Link to={`/reservar/${id}/servicios`} className="edit-link">Editar <ArrowRight size={14} /></Link></div>{services.length ? services.map((service) => <div className="review-service" key={service.id}><span><Sparkles size={15} /></span><strong>{service.nombre}</strong><span>{formatCurrency(service.precio)}</span></div>) : <p className="muted-copy">No agregaste servicios extra.</p>}</div>{error && <InfoNote tone="warning">{error}</InfoNote>}<InfoNote tone="warning"><strong>Pago seguro con Stripe.</strong> Al confirmar se creará la reservación y el pago quedará pendiente de conexión.</InfoNote></section><aside className="booking-aside"><div className="total-card"><span className="eyebrow">Resumen de inversión</span><div className="total-card__line"><span>Precio base del salón</span><strong>{formatCurrency(priceSalon)}</strong></div>{weekendSurcharge > 0 && <div className="total-card__line"><span>Extra por fin de semana</span><strong>{formatCurrency(weekendSurcharge)}</strong></div>}<div className="total-card__line"><span>Servicios extra</span><strong>{formatCurrency(totalServices)}</strong></div><div className="total-card__line total-card__grand"><span>Total</span><strong>{formatCurrency(total)}</strong></div><label className="terms-check"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span>He leído y acepto las condiciones de reservación.</span></label><Button className="full-button" onClick={confirm} disabled={!terms || creating} icon={CreditCard}>{creating ? 'Creando reservación…' : 'Confirmar reservación'}</Button><p className="stripe-placeholder"><WalletCards size={14} /> Pagar: Pendiente de conexión con Stripe</p></div></aside></div></div></AnimatedPage>
}

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const validateLoginForm = ({ email, password }) => {
  if (!email.trim()) return 'Escribe tu correo electrónico.'
  if (!isValidEmail(email)) return 'Escribe un correo electrónico válido.'
  if (!password) return 'Escribe tu contraseña.'
  return ''
}

const validateRegisterForm = ({ nombre, telefono, correo, password }, acceptedTerms) => {
  if (!nombre.trim()) return 'Escribe tu nombre.'
  if (!telefono.trim()) return 'Escribe tu teléfono.'
  if (!isValidPhoneInput(telefono)) return 'Escribe un teléfono válido, sin letras.'
  if (!correo.trim()) return 'Escribe tu correo electrónico.'
  if (!isValidEmail(correo)) return 'Escribe un correo electrónico válido.'
  if (!password) return 'Crea una contraseña.'
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
  if (!acceptedTerms) return 'Acepta los términos y el aviso de privacidad.'
  return ''
}

function AuthStatusView({ register = false, eyebrow, title, description }) {
  return <AnimatedPage className="auth-page"><div className="auth-layout"><div className={clsx('auth-art', register && 'auth-art--register')}><BrandPanel register={register} /></div><div className="auth-form-wrap"><Link to="/" className="auth-back"><ChevronLeft size={15} /> Volver a MediaLuna</Link><div className="auth-form auth-status" data-reveal><span className="auth-status__icon"><ShieldCheck size={24} /></span><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p><div className="auth-status__actions"><Button to="/" variant="secondary">Ir al inicio</Button><Button to="/login" icon={ArrowRight}>Iniciar sesión</Button></div></div></div></div></AnimatedPage>
}

export function LoginPage() {
  const navigate = useNavigate()
  const { loginWithCredentials, resendVerificationEmail, authMode } = useApp()
  const [params] = useSearchParams()
  const [role, setRole] = useState('cliente')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const [canResend, setCanResend] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const demoEmails = { cliente: 'lucia@email.com', dueno: 'mariana@aurora.mx', administrador: 'admin@medialuna.mx' }
  const verified = params.get('verified') === 'true'
  const submit = async (event) => {
    event.preventDefault()
    const validation = validateLoginForm({ email, password })
    if (validation) {
      setError(validation)
      setCanResend(false)
      return
    }
    setSubmitting(true)
    setError('')
    setResendMessage('')
    setCanResend(false)
    const result = await loginWithCredentials(email, password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.message)
      setCanResend(Boolean(result.canResendVerification))
      return
    }
    const roleRoute = result.user.rol === 'administrador' ? '/admin' : result.user.rol === 'dueno' ? '/dueno' : '/cliente'
    navigate(params.get('next') || roleRoute)
  }
  const resendVerification = async () => {
    const validation = validateLoginForm({ email, password })
    if (validation) {
      setError(validation)
      return
    }
    setResending(true)
    setError('')
    setResendMessage('')
    const result = await resendVerificationEmail(email, password)
    setResending(false)
    if (!result.ok) {
      setError(result.message)
      setCanResend(true)
      return
    }
    setCanResend(false)
    setResendMessage(result.message)
  }
  const updateEmail = (event) => { setEmail(limitText(event.target.value)); setError(''); setResendMessage(''); setCanResend(false) }
  const updatePassword = (event) => { setPassword(limitText(event.target.value)); setError(''); setResendMessage(''); setCanResend(false) }
  const selectDemoRole = (nextRole) => { setRole(nextRole); setEmail(demoEmails[nextRole]); setPassword('medialuna'); setError(''); setResendMessage(''); setCanResend(false) }
  if (verified) {
    return <AuthStatusView
      eyebrow="Verificación lista"
      title="Cuenta verificada."
      description="Ya puedes iniciar sesión y entrar a tu espacio en MediaLuna."
    />
  }
  return <AnimatedPage className="auth-page"><div className="auth-layout"><div className="auth-art"><BrandPanel /></div><div className="auth-form-wrap"><Link to="/" className="auth-back"><ChevronLeft size={15} /> Volver a MediaLuna</Link><div className="auth-form" data-reveal><span className="eyebrow">Qué bueno verte</span><h1>Entra a tu espacio.</h1><p>Continúa donde lo dejaste o explora algo nuevo.</p><form onSubmit={submit} noValidate><label className="field"><span>Correo electrónico</span><input type="email" maxLength={TEXT_MAX_LENGTH} placeholder="tu@correo.com" value={email} onChange={updateEmail} /></label><label className="field"><span>Contraseña</span><input type="password" maxLength={TEXT_MAX_LENGTH} placeholder="••••••••" value={password} onChange={updatePassword} /></label>{error && <InfoNote tone="warning"><CircleAlert size={15} /> {error}</InfoNote>}{resendMessage && <InfoNote tone="lilac" icon={ShieldCheck}>{resendMessage}</InfoNote>}{canResend && <Button className="full-button" type="button" variant="secondary" onClick={resendVerification} disabled={resending}>{resending ? 'Reenviando…' : 'Reenviar correo de verificación'}</Button>}{authMode === 'demo' && <div className="demo-role"><span>Entrar como demo</span><div>{['cliente', 'dueno', 'administrador'].map((item) => <button type="button" key={item} className={clsx(role === item && 'demo-role--active')} onClick={() => selectDemoRole(item)}>{item}</button>)}</div></div>}<Button className="full-button" type="submit" icon={ArrowRight} disabled={submitting}>{submitting ? 'Verificando…' : 'Iniciar sesión'}</Button></form><p className="auth-switch">¿Aún no tienes cuenta? <Link to="/registro">Regístrate</Link></p></div></div></div></AnimatedPage>
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { registerClient } = useApp()
  const [form, setForm] = useState({ nombre: '', telefono: '', correo: '', password: '' })
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    const validation = validateRegisterForm(form, acceptedTerms)
    if (validation) {
      setError(validation)
      return
    }
    setSubmitting(true)
    setError('')
    const result = await registerClient(form)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    if (result.verificationSent) {
      setVerificationSent(true)
      return
    }
    navigate('/cliente')
  }
  const update = (field) => (event) => {
    const value = field === 'telefono' ? normalizePhoneInput(event.target.value) : limitText(event.target.value)
    setForm({ ...form, [field]: value })
    setError('')
  }
  const updateTerms = (event) => { setAcceptedTerms(event.target.checked); setError('') }
  if (verificationSent) {
    return <AuthStatusView
      register
      eyebrow="Revisa tu correo"
      title="Te enviamos un correo de verificación."
      description="Revisa tu bandeja de entrada. Si ya verificaste tu cuenta, ve a iniciar sesión."
    />
  }
  return <AnimatedPage className="auth-page"><div className="auth-layout"><div className="auth-art auth-art--register"><BrandPanel register /></div><div className="auth-form-wrap"><Link to="/" className="auth-back"><ChevronLeft size={15} /> Volver a MediaLuna</Link><div className="auth-form" data-reveal><span className="eyebrow">Tu próxima historia</span><h1>Crea tu cuenta.</h1><p>Guarda favoritos, reserva en minutos y lleva todo en un solo lugar.</p><form onSubmit={submit} noValidate><div className="form-grid"><label className="field"><span>Nombre</span><input maxLength={TEXT_MAX_LENGTH} placeholder="Tu nombre" value={form.nombre} onChange={update('nombre')} /></label><label className="field"><span>Teléfono</span><input type="tel" inputMode="tel" maxLength="13" placeholder="+52 662 …" value={form.telefono} onChange={update('telefono')} /></label></div><label className="field"><span>Correo electrónico</span><input type="email" maxLength={TEXT_MAX_LENGTH} placeholder="tu@correo.com" value={form.correo} onChange={update('correo')} /></label><label className="field"><span>Contraseña</span><input type="password" maxLength={TEXT_MAX_LENGTH} placeholder="Mínimo 6 caracteres" value={form.password} onChange={update('password')} /></label>{error && <InfoNote tone="warning"><CircleAlert size={15} /> {error}</InfoNote>}<label className="terms-check"><input type="checkbox" checked={acceptedTerms} onChange={updateTerms} /><span>Acepto los términos y el aviso de privacidad.</span></label><Button className="full-button" type="submit" icon={ArrowRight} disabled={submitting}>{submitting ? 'Creando cuenta…' : 'Crear cuenta'}</Button></form><p className="auth-switch">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p></div></div></div></AnimatedPage>
}

function BrandPanel({ register = false }) {
  return <div className="brand-panel"><div className="brand-panel__moon"><Moon size={58} strokeWidth={1} /></div><div className="brand-panel__copy"><span className="eyebrow">{register ? 'Haz espacio para lo bueno' : 'Bienvenido de vuelta'}</span><h2>{register ? 'Lo especial comienza con una decisión.' : 'Donde tus planes encuentran lugar.'}</h2><div className="brand-panel__quote"><span className="avatar">ML</span><span>“Hay noches que merecen un escenario a la altura.”</span></div></div></div>
}

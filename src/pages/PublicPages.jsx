import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleAlert,
  Clock3,
  Compass,
  CreditCard,
  Heart,
  MapPin,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UsersRound,
  Volume2,
  WalletCards,
} from 'lucide-react'
import { format, startOfToday } from 'date-fns'
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

function SiteFooter() {
  return <footer className="site-footer"><div className="container site-footer__grid"><div><Link to="/" className="footer-brand">media<em>luna</em></Link><p>Espacios con intención para celebrar lo que importa.</p></div><div><strong>Explora</strong><Link to="/salones">Salones</Link><Link to="/#como-funciona">Cómo funciona</Link></div><div><strong>Soporte</strong><a href="mailto:hola@medialuna.mx">hola@medialuna.mx</a><span>Hermosillo · Sonora</span></div><div><strong>Seguimos cerca</strong><div className="footer-social"><span>ig</span><span>in</span><span>f</span></div></div></div><div className="container site-footer__legal"><span>© 2026 MediaLuna</span><span>Privacidad · Términos</span></div></footer>
}

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data } = useApp()
  const [search, setSearch] = useState({ location: '', date: '', guests: '' })
  const featured = data.salones.filter((salon) => salon.active).slice(0, 3)
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
    if (search.date) params.set('date', search.date)
    if (search.guests) params.set('guests', search.guests)
    navigate(`/salones?${params.toString()}`)
  }
  return <AnimatedPage className="home-page">
    <section className="hero-section"><div className="hero-orbit hero-orbit--one" /><div className="hero-orbit hero-orbit--two" /><div className="container hero-grid"><div className="hero-copy" data-reveal><div className="hero-kicker"><span className="kicker-dot" /> Reservaciones con otra luz <Sparkles size={14} /></div><h1>Tu celebración<br /><em>empieza aquí.</em></h1><p>Encuentra el salón que le dé forma a tu próxima historia. Curamos espacios memorables para noches que se quedan contigo.</p><div className="hero-actions"><Button to="/salones" icon={ArrowRight}>Explorar salones</Button><a className="text-link" href="#como-funciona">Conoce MediaLuna <ArrowRight size={16} /></a></div></div><div className="hero-art" data-reveal><div className="hero-art__image"><img src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=85" alt="Salón de eventos iluminado" /></div><div className="hero-art__moon"><span>ML</span></div><div className="hero-art__caption"><span className="status-live"><i /> espacios verificados</span><strong>La noche<br />tiene su lugar.</strong></div><div className="hero-art__stat"><strong>4.9</strong><div><span>★★★★★</span><small>+120 celebraciones</small></div></div></div></div><div className="container hero-search-wrap" data-reveal><form className="hero-search" onSubmit={submitSearch}><div className="hero-search__field"><MapPin size={18} /><label>¿Dónde?</label><input value={search.location} onChange={(event) => setSearch({ ...search, location: event.target.value })} placeholder="Ciudad o zona" /></div><div className="hero-search__field"><CalendarDays size={18} /><label>¿Cuándo?</label><input type="date" value={search.date} onChange={(event) => setSearch({ ...search, date: event.target.value })} /></div><div className="hero-search__field"><UsersRound size={18} /><label>¿Cuántas personas?</label><input type="number" min="1" value={search.guests} onChange={(event) => setSearch({ ...search, guests: event.target.value })} placeholder="Invitados" /></div><button type="submit" className="search-submit"><Search size={18} /><span>Buscar espacios</span></button></form></div></section>
    <section className="home-intro container" id="como-funciona"><div className="home-intro__aside" data-reveal><span className="eyebrow">Una nueva forma de celebrar</span><h2>Menos pendientes.<br /><em>Más momentos.</em></h2></div><div className="home-intro__text" data-reveal><p>MediaLuna reúne espacios con personalidad y servicios que hacen que organizar tu evento se sienta tan bien como vivirlo.</p><div className="mini-points"><span><Check size={14} /> Espacios verificados</span><span><Check size={14} /> Reserva sin vueltas</span><span><Check size={14} /> Acompañamiento humano</span></div></div></section>
    <section className="section container" id="inspiracion"><SectionTitle title="Espacios para tu momento" description="Una selección para empezar a imaginarlo." action={<Button to="/salones" variant="ghost" icon={ArrowRight}>Ver todos</Button>} /><div className="salon-grid salon-grid--featured">{featured.map((salon) => <SalonCard key={salon.id} salon={salon} featured />)}</div></section>
    <section className="ritual-section"><div className="container ritual-grid"><div className="ritual-copy" data-reveal><span className="eyebrow">El ritual MediaLuna</span><h2>Tu evento,<br /><em>a tu ritmo.</em></h2><p>Busca, guarda, compara y reserva desde un mismo lugar. Sin correos perdidos, sin llamadas de ida y vuelta.</p><Button to="/registro" variant="light" icon={ArrowRight}>Crear mi cuenta</Button></div><div className="ritual-list" data-reveal><div><span>01</span><div><strong>Inspírate</strong><p>Descubre salones que se sienten como tu evento.</p></div></div><div><span>02</span><div><strong>Arma tu plan</strong><p>Elige fecha y suma los detalles que hacen la diferencia.</p></div></div><div><span>03</span><div><strong>Hazlo realidad</strong><p>Confirma tu reservación y disfruta el camino.</p></div></div></div></div></section>
    <section className="testimonial-section container"><div className="quote-mark">“</div><blockquote data-reveal>Encontramos un espacio que se sentía exactamente como queríamos. Todo lo demás fluyó.</blockquote><div className="quote-author" data-reveal><span className="avatar">LR</span><span><strong>Lucía Ramírez</strong><small>Celebró su cena de compromiso en Aurora</small></span></div></section>
    <SiteFooter />
  </AnimatedPage>
}

export function SalonesPage() {
  const { data } = useApp()
  const [params] = useSearchParams()
  const [filters, setFilters] = useState({ location: params.get('location') ?? '', capacity: '', type: 'Todos' })
  const [saved, setSaved] = useState([])
  const types = ['Todos', ...new Set(data.salones.map((salon) => salon.type.split(' & ')[0]))]
  const salons = data.salones.filter((salon) => salon.active && (!filters.location || `${getSalonLocation(salon)} ${salon.name}`.toLowerCase().includes(filters.location.toLowerCase())) && (!filters.capacity || salon.capacity >= Number(filters.capacity)) && (filters.type === 'Todos' || salon.type.startsWith(filters.type)))
  return <AnimatedPage><div className="container internal-page"><Breadcrumbs items={[{ label: 'Salones' }]} /><PageHeader eyebrow="Encuentra tu lugar" title="Espacios que hacen memoria." description="Explora salones con personalidad para bodas, cenas, lanzamientos y noches que no necesitan explicación." /><div className="listing-toolbar" data-reveal><div className="listing-search"><Search size={17} /><input value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} placeholder="Buscar por nombre o ciudad" /></div><select value={filters.capacity} onChange={(event) => setFilters({ ...filters, capacity: event.target.value })}><option value="">Cualquier capacidad</option><option value="50">50+ personas</option><option value="100">100+ personas</option><option value="150">150+ personas</option></select><div className="filter-chips">{types.map((type) => <button type="button" className={clsx(filters.type === type && 'filter-chip--active')} onClick={() => setFilters({ ...filters, type })} key={type}>{type}</button>)}</div></div><div className="listing-summary"><span><strong>{salons.length}</strong> espacios disponibles</span><span>Ordenar: <strong>Recomendados</strong> <ChevronLeft size={14} className="rotate-270" /></span></div>{salons.length ? <div className="salon-grid">{salons.map((salon) => <div className="salon-card-wrap" key={salon.id}><SalonCard salon={salon} /><button type="button" className={clsx('save-button', saved.includes(salon.id) && 'save-button--active')} onClick={() => setSaved((items) => items.includes(salon.id) ? items.filter((id) => id !== salon.id) : [...items, salon.id])}><Heart size={15} fill={saved.includes(salon.id) ? 'currentColor' : 'none'} />{saved.includes(salon.id) ? 'Guardado' : 'Guardar'}</button></div>)}</div> : <EmptyState icon={Compass} title="No encontramos ese match" description="Prueba con otra zona o ajusta la capacidad para ver más espacios." action={<Button variant="secondary" onClick={() => setFilters({ location: '', capacity: '', type: 'Todos' })}>Limpiar filtros</Button>} />}</div></AnimatedPage>
}

export function SalonDetailPage() {
  const { id } = useParams()
  const { data, selectSalon } = useApp()
  const salon = data.salones.find((item) => item.id === id)
  const [activePhoto, setActivePhoto] = useState(0)
  if (!salon) return <AnimatedPage><div className="container internal-page"><EmptyState title="Salón no encontrado" description="Este espacio no está disponible en la capa mock." action={<Button to="/salones">Volver a salones</Button>} /></div></AnimatedPage>
  return <AnimatedPage><div className="container internal-page"><Breadcrumbs items={[{ label: 'Salones', to: '/salones' }, { label: salon.name }]} /><section className="detail-hero"><div className="detail-gallery" data-reveal><div className="detail-gallery__main"><img src={salon.photos?.[activePhoto] || salon.urlImagen} alt={salon.name} /><span className="detail-gallery__count"><CameraIcon /> {activePhoto + 1} / {salon.photos?.length ?? 1}</span></div><div className="detail-gallery__thumbs">{salon.photos?.map((photo, index) => <button type="button" className={clsx(activePhoto === index && 'thumb--active')} key={photo} onClick={() => setActivePhoto(index)}><img src={photo} alt={`${salon.name} vista ${index + 1}`} /></button>)}</div></div><div className="detail-copy" data-reveal><div className="detail-copy__top"><Badge tone="dark">{salon.type}</Badge><span><Star size={14} fill="currentColor" /> 4.9 · 28 reseñas</span></div><h1>{salon.name}</h1><p className="detail-location"><MapPin size={16} /> {salon.direccion} · {getSalonLocation(salon)}</p><p className="detail-description">{salon.description}</p><div className="detail-highlights"><span><UsersRound size={17} /><strong>{salon.capacity}</strong><small>personas</small></span><span><Sparkles size={17} /><strong>4.9</strong><small>valoración</small></span><span><BadgeCheck size={17} /><strong>Verificado</strong><small>por MediaLuna</small></span></div><div className="detail-price"><div><small>Desde</small><strong>{formatCurrency(salon.basePrice)}</strong><span>/ evento</span></div><Button to={`/reservar/${salon.id}/fecha`} onClick={() => selectSalon(salon.id)} icon={ArrowRight}>Elegir este salón</Button></div><p className="detail-note"><ShieldCheck size={15} /> Reserva protegida · Respuesta del dueño en menos de 24 h</p></div></section><section className="detail-lower"><div><SectionTitle title="Un espacio con intención" description="Todo lo que necesitas saber antes de reservar." /><div className="detail-info-grid"><div><MapPin size={18} /><span><strong>Ubicación</strong>{salon.direccion}<br />{getSalonLocation(salon)}</span></div><div><Clock3 size={18} /><span><strong>Horarios</strong>Evento de 8 horas<br />Montaje desde 10:00</span></div><div><Volume2 size={18} /><span><strong>Incluye</strong>Espacio base, limpieza<br />y mobiliario esencial</span></div><div><ShieldCheck size={18} /><span><strong>Condiciones</strong>Reserva flexible<br />hasta 14 días antes</span></div></div></div><aside className="detail-aside"><div className="aside-card"><span className="eyebrow">Servicios que combinan</span><h3>Hazlo tuyo.</h3>{data.servicios.filter((service) => salon.serviciosIds.includes(service.id)).slice(0, 3).map((service) => <div className="aside-service" key={service.id}><span><Sparkles size={15} /></span><div><strong>{service.nombre}</strong><small>Desde {formatCurrency(service.precio)}</small></div></div>)}<Button to={`/reservar/${salon.id}/fecha`} variant="secondary" size="sm">Ver disponibilidad</Button></div></aside></section></div></AnimatedPage>
}

function CameraIcon() { return <span className="camera-icon"><span /></span> }

export function BookingDatePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, bookingDraft, selectSalon, selectDate } = useApp()
  const salon = data.salones.find((item) => item.id === id)
  const [selected, setSelected] = useState(bookingDraft.salonId === id ? bookingDraft.date : salon?.availableDates?.[0])
  if (!salon) return <AnimatedPage><EmptyState title="Salón no encontrado" description="Regresa a la lista de espacios para continuar." action={<Button to="/salones">Ver salones</Button>} /></AnimatedPage>
  const choose = (date) => { setSelected(date); selectSalon(id); selectDate(date) }
  const goNext = () => { if (!selected) return; selectSalon(id); selectDate(selected); navigate(`/reservar/${id}/servicios`) }
  return <AnimatedPage><div className="container booking-page"><Breadcrumbs items={[{ label: 'Salones', to: '/salones' }, { label: salon.name, to: `/salones/${id}` }, { label: 'Fecha' }]} /><div className="booking-heading"><div><span className="eyebrow">Reserva tu espacio</span><h1>¿Cuándo lo celebramos?</h1><p>Elige una fecha disponible para <strong>{salon.name}</strong>.</p></div><ProgressSteps active={1} /></div><div className="booking-layout"><section className="booking-main"><div className="booking-card"><div className="booking-card__header"><span className="step-number">01</span><div><h2>Selecciona una fecha</h2><p>Las fechas mostradas vienen de Firestore.</p></div></div><TinyCalendar dates={salon.availableDates} selected={selected} onSelect={choose} /><div className="date-picker-row"><label>O elige una fecha exacta<input type="date" min={format(startOfToday(), 'yyyy-MM-dd')} value={selected ?? ''} onChange={(event) => choose(event.target.value)} /></label><InfoNote tone="lilac">La disponibilidad final será confirmada por el dueño.</InfoNote></div></div><div className="booking-card booking-card--muted"><div className="booking-card__header"><span className="step-number">02</span><div><h2>Tu celebración</h2><p>Cuéntanos un poco más para preparar la experiencia.</p></div></div><div className="form-grid"><label className="field"><span>Tipo de evento</span><select><option>Boda / celebración social</option><option>Cena privada</option><option>Evento corporativo</option><option>Otro</option></select></label><label className="field"><span>Número de invitados</span><input type="number" min="1" defaultValue={salon.capacity > 100 ? 100 : 40} /></label></div></div></section><aside className="booking-aside"><div className="booking-summary-card"><img src={salon.photos?.[0]} alt={salon.name} /><div className="booking-summary-card__body"><span className="eyebrow">Tu selección</span><h3>{salon.name}</h3><p><MapPin size={14} /> {getSalonLocation(salon)}</p><div className="summary-line"><span>Precio del salón</span><strong>{formatCurrency(salon.basePrice)}</strong></div><div className="summary-line"><span>Fecha</span><strong>{selected ? formatDate(selected, 'd MMM yyyy') : 'Sin seleccionar'}</strong></div><div className="summary-divider" /><div className="summary-total"><span>Subtotal</span><strong>{formatCurrency(salon.basePrice)}</strong></div></div></div><Button className="full-button" onClick={goNext} disabled={!selected} icon={ArrowRight}>Continuar con extras</Button><p className="secure-copy"><ShieldCheck size={14} /> No se realizará ningún cargo todavía</p></aside></div></div></AnimatedPage>
}

export function BookingServicesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, bookingDraft, toggleService } = useApp()
  const salon = data.salones.find((item) => item.id === id)
  const services = data.servicios.filter((service) => service.activo)
  const totalServices = services.filter((service) => bookingDraft.servicesIds.includes(service.id)).reduce((sum, service) => sum + service.precio, 0)
  if (!salon) return <AnimatedPage><EmptyState title="Salón no encontrado" description="Regresa a la lista de espacios para continuar." action={<Button to="/salones">Ver salones</Button>} /></AnimatedPage>
  return <AnimatedPage><div className="container booking-page"><Breadcrumbs items={[{ label: 'Salones', to: '/salones' }, { label: salon.name, to: `/salones/${id}` }, { label: 'Extras' }]} /><div className="booking-heading"><div><span className="eyebrow">Personaliza la noche</span><h1>Los detalles hacen la diferencia.</h1><p>Selecciona los servicios que quieres sumar a tu reservación.</p></div><ProgressSteps active={2} /></div><div className="booking-layout"><section className="booking-main"><div className="service-select-grid">{services.map((service) => { const active = bookingDraft.servicesIds.includes(service.id); return <button type="button" className={clsx('service-select-card', active && 'service-select-card--active')} onClick={() => toggleService(service.id)} key={service.id}><div className="service-select-card__image"><img src={service.urlImagen} alt={service.nombre} />{active && <span className="service-check"><Check size={14} /></span>}</div><div className="service-select-card__body"><div><h3>{service.nombre}</h3><p>{service.descripcion}</p></div><div className="service-select-card__price"><strong>{formatCurrency(service.precio)}</strong><small>por evento</small></div></div></button> })}</div><InfoNote tone="lilac"><strong>¿Tienes algo especial en mente?</strong> El equipo puede ayudarte a armar una propuesta a la medida.</InfoNote></section><aside className="booking-aside"><div className="booking-summary-card booking-summary-card--plain"><div className="booking-summary-card__body"><span className="eyebrow">Tu selección</span><h3>{salon.name}</h3><p><CalendarDays size={14} /> {formatDate(bookingDraft.date, 'd MMMM yyyy')}</p><div className="summary-line"><span>Precio del salón</span><strong>{formatCurrency(salon.basePrice)}</strong></div><div className="summary-line"><span>Extras ({bookingDraft.servicesIds.length})</span><strong>{formatCurrency(totalServices)}</strong></div><div className="summary-divider" /><div className="summary-total"><span>Total estimado</span><strong>{formatCurrency(salon.basePrice + totalServices)}</strong></div></div></div><Button className="full-button" to={`/reservar/${id}/resumen`} icon={ArrowRight}>Ver resumen</Button><Button className="full-button" variant="ghost" onClick={() => navigate(`/reservar/${id}/fecha`)} icon={ChevronLeft}>Cambiar fecha</Button></aside></div></div></AnimatedPage>
}

export function BookingSummaryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, bookingDraft, createReservation } = useApp()
  const salon = data.salones.find((item) => item.id === id)
  const services = data.servicios.filter((service) => bookingDraft.servicesIds.includes(service.id))
  const totalServices = services.reduce((sum, service) => sum + service.precio, 0)
  const [terms, setTerms] = useState(false)
  const [creating, setCreating] = useState(false)
  if (!salon) return <AnimatedPage><EmptyState title="Salón no encontrado" description="Regresa a la lista de espacios para continuar." action={<Button to="/salones">Ver salones</Button>} /></AnimatedPage>
  const confirm = async () => { if (!terms) return; setCreating(true); const reservation = await createReservation(); setCreating(false); navigate(`/cliente/reservaciones/${reservation.id}`) }
  return <AnimatedPage><div className="container booking-page"><Breadcrumbs items={[{ label: 'Salones', to: '/salones' }, { label: salon.name, to: `/salones/${id}` }, { label: 'Resumen' }]} /><div className="booking-heading"><div><span className="eyebrow">Casi está</span><h1>Revisa tu reservación.</h1><p>Todo listo para empezar a crear una noche especial.</p></div><ProgressSteps active={3} /></div><div className="booking-layout"><section className="booking-main"><div className="review-card"><div className="review-card__top"><img src={salon.photos?.[0]} alt={salon.name} /><div><Badge tone="dark">{salon.type}</Badge><h2>{salon.name}</h2><p><MapPin size={14} /> {getSalonLocation(salon)}</p></div><Link to={`/reservar/${id}/fecha`} className="edit-link">Editar <ArrowRight size={14} /></Link></div><div className="review-grid"><div><span className="review-label">Fecha</span><strong><CalendarDays size={15} /> {formatDate(bookingDraft.date, 'EEEE d MMMM yyyy')}</strong></div><div><span className="review-label">Capacidad</span><strong><UsersRound size={15} /> Hasta {salon.capacity} personas</strong></div><div><span className="review-label">Dirección</span><strong><MapPin size={15} /> {salon.direccion}</strong></div><div><span className="review-label">Estado</span><strong><Badge tone="warning" dot>Pendiente de confirmación</Badge></strong></div></div></div><div className="review-card"><div className="review-section-heading"><div><span className="step-number">+</span><h2>Extras seleccionados</h2></div><Link to={`/reservar/${id}/servicios`} className="edit-link">Editar <ArrowRight size={14} /></Link></div>{services.length ? services.map((service) => <div className="review-service" key={service.id}><span><Sparkles size={15} /></span><strong>{service.nombre}</strong><span>{formatCurrency(service.precio)}</span></div>) : <p className="muted-copy">No agregaste servicios extra.</p>}</div><InfoNote tone="warning"><strong>Pago seguro con Stripe.</strong> Al confirmar se abrirá el checkout cuando la integración esté conectada.</InfoNote></section><aside className="booking-aside"><div className="total-card"><span className="eyebrow">Resumen de inversión</span><div className="total-card__line"><span>Precio del salón</span><strong>{formatCurrency(salon.basePrice)}</strong></div><div className="total-card__line"><span>Servicios extra</span><strong>{formatCurrency(totalServices)}</strong></div><div className="total-card__line total-card__grand"><span>Total</span><strong>{formatCurrency(salon.basePrice + totalServices)}</strong></div><label className="terms-check"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span>He leído y acepto las condiciones de reservación.</span></label><Button className="full-button" onClick={confirm} disabled={!terms || creating} icon={CreditCard}>{creating ? 'Creando reservación…' : 'Continuar a pago'}</Button><p className="stripe-placeholder"><WalletCards size={14} /> Stripe: pendiente de conexión</p></div></aside></div></div></AnimatedPage>
}

export function LoginPage() {
  const navigate = useNavigate()
  const { loginWithCredentials, authMode } = useApp()
  const [role, setRole] = useState('cliente')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const demoEmails = { cliente: 'lucia@email.com', dueno: 'mariana@aurora.mx', administrador: 'admin@medialuna.mx' }
  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    const result = await loginWithCredentials(email, password)
    setSubmitting(false)
    if (!result.ok) { setError(result.message); return }
    navigate(result.user.rol === 'administrador' ? '/admin' : result.user.rol === 'dueno' ? '/dueno' : '/cliente')
  }
  const selectDemoRole = (nextRole) => { setRole(nextRole); setEmail(demoEmails[nextRole]); setPassword('medialuna'); setError('') }
  return <AnimatedPage className="auth-page"><div className="auth-layout"><div className="auth-art"><BrandPanel /></div><div className="auth-form-wrap"><Link to="/" className="auth-back"><ChevronLeft size={15} /> Volver a MediaLuna</Link><div className="auth-form" data-reveal><span className="eyebrow">Qué bueno verte</span><h1>Entra a tu espacio.</h1><p>Continúa donde lo dejaste o explora algo nuevo.</p><form onSubmit={submit}><label className="field"><span>Correo electrónico</span><input type="email" required placeholder="tu@correo.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field"><span>Contraseña</span><input type="password" required minLength="6" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <InfoNote tone="warning"><CircleAlert size={15} /> {error}</InfoNote>}{authMode === 'demo' ? <div className="demo-role"><span>Entrar como demo</span><div>{['cliente', 'dueno', 'administrador'].map((item) => <button type="button" key={item} className={clsx(role === item && 'demo-role--active')} onClick={() => selectDemoRole(item)}>{item}</button>)}</div></div> : <InfoNote tone="lilac">Usa una cuenta registrada en Firebase Authentication.</InfoNote>}<Button className="full-button" type="submit" icon={ArrowRight} disabled={submitting}>{submitting ? 'Verificando…' : 'Iniciar sesión'}</Button></form><p className="auth-switch">¿Aún no tienes cuenta? <Link to="/registro">Regístrate</Link></p></div></div></div></AnimatedPage>
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { registerClient } = useApp()
  const [form, setForm] = useState({ nombre: '', telefono: '', correo: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => { event.preventDefault(); setSubmitting(true); const result = await registerClient(form); setSubmitting(false); if (!result.ok) { setError(result.message); return }; navigate('/cliente') }
  const update = (field) => (event) => { setForm({ ...form, [field]: event.target.value }); setError('') }
  return <AnimatedPage className="auth-page"><div className="auth-layout"><div className="auth-art auth-art--register"><BrandPanel register /></div><div className="auth-form-wrap"><Link to="/" className="auth-back"><ChevronLeft size={15} /> Volver a MediaLuna</Link><div className="auth-form" data-reveal><span className="eyebrow">Tu próxima historia</span><h1>Crea tu cuenta.</h1><p>Guarda favoritos, reserva en minutos y lleva todo en un solo lugar.</p><form onSubmit={submit}><div className="form-grid"><label className="field"><span>Nombre</span><input required placeholder="Tu nombre" value={form.nombre} onChange={update('nombre')} /></label><label className="field"><span>Teléfono</span><input required type="tel" placeholder="+52 662 …" value={form.telefono} onChange={update('telefono')} /></label></div><label className="field"><span>Correo electrónico</span><input type="email" required placeholder="tu@correo.com" value={form.correo} onChange={update('correo')} /></label><label className="field"><span>Contraseña</span><input type="password" required minLength="6" placeholder="Mínimo 6 caracteres" value={form.password} onChange={update('password')} /></label>{error && <InfoNote tone="warning"><CircleAlert size={15} /> {error}</InfoNote>}<label className="terms-check"><input type="checkbox" required /><span>Acepto los términos y el aviso de privacidad.</span></label><Button className="full-button" type="submit" icon={ArrowRight} disabled={submitting}>{submitting ? 'Creando cuenta…' : 'Crear cuenta'}</Button></form><p className="auth-switch">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p></div></div></div></AnimatedPage>
}

function BrandPanel({ register = false }) {
  return <div className="brand-panel"><div className="brand-panel__moon"><Moon size={58} strokeWidth={1} /></div><div className="brand-panel__copy"><span className="eyebrow">{register ? 'Haz espacio para lo bueno' : 'Bienvenido de vuelta'}</span><h2>{register ? 'Lo especial comienza con una decisión.' : 'Donde tus planes encuentran lugar.'}</h2><div className="brand-panel__quote"><span className="avatar">ML</span><span>“Hay noches que merecen un escenario a la altura.”</span></div></div></div>
}

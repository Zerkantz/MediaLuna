import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import clsx from 'clsx'
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Minus,
  Sparkles,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/* Shared display helpers intentionally live beside the UI primitives. */
/* eslint-disable react-refresh/only-export-components */

gsap.registerPlugin(useGSAP)

export const formatCurrency = (value = 0) => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
}).format(value)

export const formatDate = (value, pattern = 'd MMM yyyy') => {
  if (!value) return '—'
  try {
    const date = typeof value?.toDate === 'function' ? value.toDate() : parseISO(value)
    return format(date, pattern, { locale: es })
  } catch { return value }
}

export const getSalonLocation = (salon) => salon?.locationLabel
  || (Array.isArray(salon?.location) ? salon.location.join(', ') : salon?.location || 'Ubicación pendiente')

export function BrandMark({ compact = false }) {
  return <Link to="/" className={clsx('brand-mark', compact && 'brand-mark--compact')} aria-label="MediaLuna, inicio">
    <span className="brand-mark__moon" aria-hidden="true"><span /></span>
    <span><strong>media</strong><em>luna</em><small>espacios que celebran</small></span>
  </Link>
}

export function Button({ children, to, variant = 'primary', size = 'md', className, icon: Icon, pending = false, ...props }) {
  const classes = clsx('button', `button--${variant}`, `button--${size}`, className)
  const content = <>{Icon && <Icon size={16} strokeWidth={1.8} />}{children}{pending && <span className="button__pending">Pendiente de conexión</span>}</>
  return to ? <Link to={to} className={classes} {...props}>{content}</Link> : <button className={classes} {...props}>{content}</button>
}

export function Badge({ children, tone = 'neutral', dot = false }) {
  return <span className={clsx('badge', `badge--${tone}`)}>{dot && <i className="badge__dot" />}{children}</span>
}

export function StatusBadge({ status }) {
  const tone = ['pagado', 'confirmada', 'disponible', 'activo'].includes(status) ? 'success'
    : ['pendiente', 'por confirmar', 'reservado'].includes(status) ? 'warning'
      : ['bloqueado', 'cancelada', 'inactivo'].includes(status) ? 'danger' : 'neutral'
  return <Badge tone={tone} dot>{status}</Badge>
}

export function Breadcrumbs({ items = [] }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb">
    <Link to="/">Inicio</Link><ChevronRight size={13} />
    {items.map((item, index) => <span className="breadcrumbs__item" key={`${item.label}-${index}`}>
      {item.to ? <Link to={item.to}>{item.label}</Link> : <strong>{item.label}</strong>}
      {index < items.length - 1 && <ChevronRight size={13} />}
    </span>)}
  </nav>
}

export function AnimatedPage({ children, className }) {
  const scope = useRef(null)
  useGSAP(() => {
    const items = scope.current?.querySelectorAll('[data-reveal]')
    if (!items?.length) return
    gsap.fromTo(items, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, ease: 'power2.out' })
  }, { scope })
  return <main ref={scope} className={clsx('page', className)}>{children}</main>
}

export function PageHeader({ eyebrow, title, description, actions, children }) {
  return <div className="page-header" data-reveal>
    <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}{children}</div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </div>
}

export function SalonCard({ salon, featured = false }) {
  return <article className={clsx('salon-card', featured && 'salon-card--featured')} data-reveal>
    <Link to={`/salones/${salon.id}`} className="salon-card__image-wrap">
      <img src={salon.urlImagen || salon.photos?.[0]} alt={salon.name} className="salon-card__image" />
      <span className="salon-card__type">{salon.type}</span>
      <span className="salon-card__arrow"><ArrowUpRight size={17} /></span>
    </Link>
    <div className="salon-card__body">
      <div className="salon-card__title"><div><h3>{salon.name}</h3><p>{getSalonLocation(salon)}</p></div><span className="accent-dot" style={{ background: salon.accent }} /></div>
      <div className="salon-card__meta"><span>{salon.capacity} personas</span><span>Desde <strong>{formatCurrency(salon.basePrice)}</strong></span></div>
    </div>
  </article>
}

export function MetricCard({ label, value, helper, icon: Icon, trend, accent = 'lilac' }) {
  return <div className={clsx('metric-card', `metric-card--${accent}`)} data-reveal>
    <div className="metric-card__top"><span>{label}</span>{Icon && <span className="metric-card__icon"><Icon size={17} /></span>}</div>
    <strong>{value}</strong>
    <div className="metric-card__bottom">{trend ? <Badge tone="success">{trend}</Badge> : <span>{helper}</span>}</div>
  </div>
}

export function EmptyState({ icon: Icon = Sparkles, title, description, action }) {
  return <div className="empty-state" data-reveal><span className="empty-state__icon"><Icon size={22} /></span><h3>{title}</h3><p>{description}</p>{action}</div>
}

export function InfoNote({ children, tone = 'neutral', icon: Icon = CircleAlert }) {
  return <div className={clsx('info-note', `info-note--${tone}`)}><Icon size={16} /><span>{children}</span></div>
}

export function SectionTitle({ title, description, action }) {
  return <div className="section-title"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>
}

export function ProgressSteps({ active = 1 }) {
  const steps = ['Fecha', 'Extras', 'Resumen']
  return <div className="progress-steps">{steps.map((step, index) => <div className={clsx('progress-step', index + 1 <= active && 'progress-step--active')} key={step}><span>{index + 1 < active ? <Check size={13} /> : index + 1}</span><small>{step}</small>{index < steps.length - 1 && <i />}</div>)}</div>
}

export function Table({ columns, rows, empty = 'No hay registros disponibles.' }) {
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}</tr>) : <tr><td colSpan={columns.length}><div className="table-empty">{empty}</div></td></tr>}</tbody></table></div>
}

export function TinyCalendar({ dates = [], selected, onSelect }) {
  return <div className="date-chip-grid">{dates.map((date) => <button type="button" className={clsx('date-chip', selected === date && 'date-chip--selected')} key={date} onClick={() => onSelect(date)}><strong>{formatDate(date, 'dd')}</strong><span>{formatDate(date, 'MMM')}</span><small>{formatDate(date, 'EEE')}</small></button>)}</div>
}

export function PendingButton({ children, ...props }) {
  return <Button variant="secondary" pending {...props}>{children}</Button>
}

export function LoadingLine() {
  return <span className="loading-line"><Minus size={14} /><Clock3 size={14} /> Pendiente de conexión</span>
}

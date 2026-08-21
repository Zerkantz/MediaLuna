import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCheck,
  CircleUserRound,
  ClipboardList,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Store,
  Users,
  X,
} from 'lucide-react'
import { BrandMark, formatDate } from './ui'
import { useApp } from '../context/AppContext'

const panelConfig = {
  cliente: {
    label: 'Mi espacio',
    title: 'Cliente',
    links: [
      { to: '/cliente', label: 'Resumen', icon: LayoutDashboard, end: true },
      { to: '/cliente/reservaciones', label: 'Mis reservaciones', icon: CalendarDays },
      { to: '/cliente/perfil', label: 'Mi perfil', icon: CircleUserRound },
    ],
  },
  dueno: {
    label: 'Espacio del dueño',
    title: 'Dueño',
    links: [
      { to: '/dueno', label: 'Resumen', icon: LayoutDashboard, end: true },
      { to: '/dueno/salones', label: 'Mis salones', icon: Store },
      { to: '/dueno/reservaciones', label: 'Reservaciones', icon: CalendarDays },
      { to: '/dueno/chats', label: 'Chats con clientes', icon: MessageCircle },
    ],
  },
  administrador: {
    label: 'Centro de control',
    title: 'Admin',
    links: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
      { to: '/admin/salones', label: 'Salones', icon: Store },
      { to: '/admin/servicios', label: 'Servicios', icon: Sparkles },
      { to: '/admin/disponibilidad', label: 'Disponibilidad', icon: CalendarDays },
      { to: '/admin/reservaciones', label: 'Reservaciones', icon: ClipboardList },
      { to: '/admin/pagos', label: 'Pagos', icon: CreditCard },
      { to: '/admin/reportes', label: 'Reportes', icon: BarChart3 },
    ],
  },
}

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { currentUser } = useApp()
  const accountPath = currentUser ? (currentUser.rol === 'administrador' ? '/admin' : currentUser.rol === 'dueno' ? '/dueno' : '/cliente') : '/login'
  const accountLabel = currentUser?.nombre?.split(' ')[0] ?? 'Entrar'
  return <div className="site-shell">
    <header className="public-header">
      <div className="container public-header__inner"><BrandMark />
        <nav className={clsx('public-nav', menuOpen && 'public-nav--open')}>
          <NavLink to="/salones" onClick={() => setMenuOpen(false)}>Explorar salones</NavLink>
          <Link to="/#como-funciona" onClick={() => setMenuOpen(false)}>Cómo funciona</Link>
          <Link to="/#inspiracion" onClick={() => setMenuOpen(false)}>Inspiración</Link>
        </nav>
        <div className="public-header__actions"><Link to={accountPath} className="user-pill"><span><CircleUserRound size={16} /></span><strong>{accountLabel}</strong></Link>{!currentUser && <Link to="/registro" className="header-register-link">Crear cuenta</Link>}</div>
        <button type="button" className="mobile-menu" aria-label="Abrir menú" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </header>
    <Outlet />
  </div>
}

export function PanelLayout({ role }) {
  const config = panelConfig[role]
  const {
    currentUser,
    loginAs,
    logout,
    authMode,
    authReady,
    currentUserNotifications,
    unreadNotificationsCount,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (!authReady) return
    if (authMode === 'firebase') {
      if (!currentUser) navigate('/login', { replace: true })
      else if (currentUser.rol !== role) navigate(currentUser.rol === 'administrador' ? '/admin' : currentUser.rol === 'dueno' ? '/dueno' : '/cliente', { replace: true })
      return
    }
    if (currentUser?.rol !== role) loginAs(role)
  }, [authMode, authReady, currentUser, loginAs, navigate, role])
  if (!authReady) return <div className="auth-loading">Verificando tu sesión…</div>
  if (authMode === 'firebase' && !currentUser) return null
  const switchRole = (nextRole) => {
    if (authMode === 'firebase') return
    loginAs(nextRole)
    setMobileOpen(false)
    navigate(nextRole === 'administrador' ? '/admin' : nextRole === 'dueno' ? '/dueno' : '/cliente')
  }
  const toggleNotifications = async () => {
    const nextOpen = !notificationsOpen
    setNotificationsOpen(nextOpen)
    if (nextOpen) await refreshNotifications()
  }
  return <div className={clsx('panel-shell', collapsed && 'panel-shell--collapsed')}>
    <aside className={clsx('panel-sidebar', mobileOpen && 'panel-sidebar--open')}>
      <div className="panel-sidebar__top"><BrandMark compact /><button className="sidebar-close" type="button" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="panel-switcher"><span className="panel-switcher__label">{config.label}</span><div className="panel-switcher__current"><span className="avatar avatar--small">{currentUser?.nombre?.[0] ?? 'M'}</span><span><strong>{currentUser?.nombre ?? 'Usuario demo'}</strong><small>{config.title}</small></span></div>{authMode === 'demo' && <div className="role-switcher"><button type="button" onClick={() => switchRole('cliente')}>Ver como cliente</button><button type="button" onClick={() => switchRole('dueno')}>Ver como dueño</button><button type="button" onClick={() => switchRole('administrador')}>Ver como admin</button></div>}</div>
      <nav className="panel-nav">{config.links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => clsx('panel-nav__link', isActive && 'panel-nav__link--active')} onClick={() => setMobileOpen(false)}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
      <div className="panel-sidebar__bottom"><Link to="/" className="panel-nav__link"><Home size={17} /><span>Volver al sitio</span></Link><button type="button" className="panel-nav__link panel-nav__button panel-nav__button--danger" onClick={async () => { await logout(); setMobileOpen(false); navigate('/login') }}><LogOut size={17} /><span>Cerrar sesión</span></button><div className="sidebar-help"><Moon size={16} /><span><strong>MediaLuna</strong><small>Tu noche, bien cuidada.</small></span></div></div>
    </aside>
    {mobileOpen && <button className="sidebar-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}
    <div className="panel-main"><header className="panel-topbar"><button className="panel-mobile-menu" type="button" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="panel-topbar__crumb">{location.pathname.split('/').filter(Boolean).slice(-1)[0]?.replaceAll('-', ' ') ?? 'resumen'}</div><div className="panel-topbar__actions"><div className="notifications-wrap"><button className={clsx('icon-button notification-button', unreadNotificationsCount > 0 && 'notification-button--unread')} type="button" onClick={toggleNotifications} title="Notificaciones" aria-expanded={notificationsOpen}><Bell size={18} />{unreadNotificationsCount > 0 && <span className="notification-count">{unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}</span>}</button>{notificationsOpen && <div className="notifications-popover"><div className="notifications-popover__head"><div><strong>Notificaciones</strong><small>{unreadNotificationsCount ? `${unreadNotificationsCount} sin leer` : 'Todo leído'}</small></div><button type="button" onClick={markAllNotificationsRead} disabled={!unreadNotificationsCount}><CheckCheck size={14} /> Marcar leídas</button></div><div className="notifications-list">{currentUserNotifications.length ? currentUserNotifications.map((item) => <button type="button" key={item.id} className={clsx('notification-item', !item.leida && 'notification-item--unread')} onClick={() => markNotificationRead(item.id)}><span><strong>{item.titulo}</strong><small>{item.mensaje}</small></span><time>{formatDate(item.fechaCreacion, 'd MMM yyyy')}</time></button>) : <p className="notification-empty">No tienes notificaciones</p>}</div></div>}</div><span className="topbar-divider" /><Link to="/" className="topbar-user"><span className="avatar avatar--small">{currentUser?.nombre?.[0] ?? 'M'}</span><span>{currentUser?.nombre?.split(' ')[0] ?? 'Usuario'}</span></Link><button type="button" className="collapse-button" onClick={() => setCollapsed((value) => !value)} title="Contraer menú">{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div></header><div className="panel-content"><Outlet /></div></div>
  </div>
}

export function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  return <div className={clsx('toast', `toast--${toast.tone}`)}><Sparkles size={16} />{toast.message}</div>
}

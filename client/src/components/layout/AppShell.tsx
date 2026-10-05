import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useSystemStatus } from '../../hooks/useValeriaData'
import { RealtimeProvider } from '../../realtime/RealtimeProvider'

const navigation = [
  { label: 'Overview', to: '/dashboard', icon: '⌂' },
  { label: 'Live Monitor', to: '/live', icon: '◉' },
  { label: 'Analytics', to: '/analytics', icon: '⌁' },
  { label: 'Sensors', to: '/sensors', icon: '⌗' },
  { label: 'Alerts', to: '/alerts', icon: '♧' },
  { label: 'System', to: '/system', icon: '⌘' },
  { label: 'Settings', to: '/settings', icon: '⚙' },
]

const pageNames: Record<string, string> = {
  '/dashboard': 'Greenhouse overview',
  '/live': 'Live environmental monitor',
  '/analytics': 'Historical analytics',
  '/sensors': 'Sensor inventory',
  '/alerts': 'Alerts & notifications',
  '/system': 'System architecture',
  '/settings': 'Settings',
  '/logout': 'Return to the greenhouse',
}

export default function AppShell() {
  const { user } = useAuth()
  return <RealtimeProvider key={user?.id ?? 'unauthenticated'}><AppShellLayout /></RealtimeProvider>
}

function AppShellLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const { user } = useAuth()
  const system = useSystemStatus()
  const connection = system.data?.overallStatus

  return (
    <div className="application">
      <button
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
        className="mobile-menu-toggle"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? ' sidebar-open' : ''}`}>
        <NavLink className="app-brand" to="/dashboard" onClick={() => setMenuOpen(false)}>
          <span className="brand-word">VALERIA</span>
          <span className="brand-subtitle">GREENHOUSE INTELLIGENCE</span>
        </NavLink>
        <div className="sidebar-caption">WORKSPACE</div>
        <nav className="side-navigation" aria-label="Greenhouse application">
          {navigation.map(({ label, to, icon }) => (
            <NavLink
              key={to}
              className={({ isActive }) => `side-link${isActive ? ' side-link-active' : ''}`}
              to={to}
              onClick={() => setMenuOpen(false)}
            >
              <span aria-hidden="true" className="side-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <span className="profile-avatar" aria-hidden="true">{user?.name.split(' ').map((part) => part[0]).join('') ?? 'V'}</span>
            <span className="profile-copy"><strong>{user?.name ?? 'VALERIA user'}</strong><small>{user?.role ?? 'Greenhouse manager'}</small></span>
          </div>
          <NavLink to="/logout" className="side-link logout-link" onClick={() => setMenuOpen(false)}>
            <span aria-hidden="true" className="side-icon">↗</span>
            <span>Logout</span>
          </NavLink>
        </div>
      </aside>
      <div className="application-main">
        <header className="app-header">
          <div className="header-context">
            <span className="header-kicker">VALERIA</span>
            <strong>{pageNames[pathname] ?? 'Greenhouse overview'}</strong>
          </div>
          <div className="header-meta">
            <span className={`connection-state${connection ? ` connection-${connection}` : ' connection-unavailable'}`}><i /> {connection ? `System ${connection}` : system.loading ? 'Checking system' : 'System unavailable'}</span>
            <span className="last-update">{system.data ? `Updated ${system.data.lastSync}` : 'Status not updated'}</span>
            <span className="header-avatar" aria-label={user?.name ?? 'VALERIA user'}>{user?.name.split(' ').map((part) => part[0]).join('') ?? 'V'}</span>
          </div>
        </header>
        <main className="workspace-content"><Outlet /></main>
        <footer className="app-footer">
          <span>VALERIA · Smart Greenhouse Environmental Intelligence</span>
          {pathname !== '/logout' && <span>Simulated greenhouse intelligence</span>}
        </footer>
      </div>
    </div>
  )
}

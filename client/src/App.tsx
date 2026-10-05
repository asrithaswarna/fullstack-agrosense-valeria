import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { GuestOnly, RequireAuth } from './auth/RouteGuards'
import './App.css'
import './pages.css'
import Home from './pages/public/Home'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Dashboard from './pages/app/Dashboard'
import LiveMonitor from './pages/app/LiveMonitor'
import Analytics from './pages/app/Analytics'
import Sensors from './pages/app/Sensors'
import Alerts from './pages/app/Alerts'
import System from './pages/app/System'
import Settings from './pages/app/Settings'
import Logout from './pages/app/Logout'
import AppShell from './components/layout/AppShell'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/live" element={<LiveMonitor />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/sensors" element={<Sensors />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/system" element={<System />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="/logout" element={<Logout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ChannelDetail from './pages/ChannelDetail'
import Assets from './pages/Assets'
import Schedule from './pages/Schedule'
import Admin from './pages/Admin'
import Playlists from './pages/Playlists'
import PlaylistDetail from './pages/PlaylistDetail'
import Tenants from './pages/Tenants'
import WatchTenant from './pages/WatchTenant'
import WatchChannel from './pages/WatchChannel'
import TenantDashboard from './pages/TenantDashboard'
import { useAuthStore } from './store/auth'

function PrivateRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.accessToken)
  return token ? children : <Navigate to="/login" replace />
}

function SuperAdminRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.accessToken)
  const role = useAuthStore((s) => s.role)
  if (!token) return <Navigate to="/login" replace />
  if (role !== 'super_admin') return <Navigate to="/" replace />
  return children
}

function HomeRoute() {
  const role = useAuthStore((s) => s.role)
  return role === 'super_admin' ? <Dashboard /> : <TenantDashboard />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><HomeRoute /></PrivateRoute>} />
        <Route path="/channels/:id" element={<PrivateRoute><ChannelDetail /></PrivateRoute>} />
        <Route path="/channels/:id/assets" element={<PrivateRoute><Assets /></PrivateRoute>} />
        <Route path="/channels/:id/schedule" element={<PrivateRoute><Schedule /></PrivateRoute>} />
        <Route path="/playlists" element={<PrivateRoute><Playlists /></PrivateRoute>} />
        <Route path="/playlists/:id" element={<PrivateRoute><PlaylistDetail /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
        <Route path="/tenants" element={<SuperAdminRoute><Tenants /></SuperAdminRoute>} />
        <Route path="/watch/:tenantSlug" element={<WatchTenant />} />
        <Route path="/watch/:tenantSlug/:channelSlug" element={<WatchChannel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

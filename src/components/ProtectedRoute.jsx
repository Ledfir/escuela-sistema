import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ allowedRoles }) {
  const { session, loading, configured, hasRole } = useAuth()
  if (loading) return <main className="centered">Cargando…</main>
  if (!configured) return <Navigate to="/configuracion" replace />
  if (!session) return <Navigate to="/ingresar" replace />
  if (allowedRoles && !hasRole(...allowedRoles)) return <Navigate to="/sin-acceso" replace />
  return <Outlet />
}

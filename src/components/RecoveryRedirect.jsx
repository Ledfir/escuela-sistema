import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RecoveryRedirect() {
  const { passwordRecovery } = useAuth()
  const location = useLocation()
  if (passwordRecovery && location.pathname !== '/reset-password') return <Navigate to="/reset-password" replace />
  return null
}

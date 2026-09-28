import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AuthCard } from './LoginPage'

export default function RegisterPage() {
  const { signUp, session, configured } = useAuth(); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [sending, setSending] = useState(false)
  if (!configured) return <Navigate to="/configuracion" replace />
  if (session) return <Navigate to="/" replace />
  async function submit(event) { event.preventDefault(); setSending(true); setError(''); const f = new FormData(event.currentTarget); const { error: authError } = await signUp(f.get('email'), f.get('password'), f.get('fullName')); if (authError) setError(authError.message); else setNotice('Cuenta creada. Revisa tu correo para confirmar tu acceso.'); setSending(false) }
  return <AuthCard title="Solicita acceso" subtitle="Tu perfil quedará pendiente de asignación de rol."><form onSubmit={submit}><label>Nombre completo<input name="fullName" required autoComplete="name" /></label><label>Correo electrónico<input name="email" type="email" required autoComplete="email" /></label><label>Contraseña<input name="password" type="password" minLength="8" required autoComplete="new-password" /></label>{error && <p className="error">{error}</p>}{notice && <p className="notice">{notice}</p>}<button disabled={sending}>{sending ? 'Creando…' : 'Crear cuenta'}</button></form><p>¿Ya tienes cuenta? <Link to="/ingresar">Ingresar</Link></p></AuthCard>
}

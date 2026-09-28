import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signIn, session, configured } = useAuth()
  const [error, setError] = useState(''); const [sending, setSending] = useState(false)
  if (!configured) return <Navigate to="/configuracion" replace />
  if (session) return <Navigate to="/" replace />
  async function submit(event) { event.preventDefault(); setSending(true); setError(''); const form = new FormData(event.currentTarget); const { error: authError } = await signIn(form.get('email'), form.get('password')); if (authError) setError(authError.message); setSending(false) }
  return <AuthCard title="Accede al sistema" subtitle="Usa las credenciales proporcionadas por la escuela"><form onSubmit={submit}><label>Correo electrónico<input name="email" type="email" required autoComplete="email" /></label><label>Contraseña<input name="password" type="password" required autoComplete="current-password" /></label>{error && <p className="error">{error}</p>}<button disabled={sending}>{sending ? 'Ingresando…' : 'Ingresar'}</button></form><p>¿Aún no tienes cuenta? <Link to="/registro">Solicita acceso</Link></p></AuthCard>
}
export function AuthCard({ title, subtitle, children }) { return <main className="auth-page"><section className="auth-card"><div className="logo">CE</div><h1>{title}</h1><p className="muted">{subtitle}</p>{children}</section></main> }

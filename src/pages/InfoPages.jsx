import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
export function ConfigurationPage() { return <main className="auth-page"><section className="auth-card"><div className="logo">CE</div><h1>Configura Supabase</h1><p className="muted">Copia <code>.env.example</code> como <code>.env</code> y agrega la URL y clave anónima de tu proyecto. Después reinicia el servidor.</p></section></main> }
export function AccessDeniedPage() { return <main className="centered"><div><h1>Sin acceso</h1><p>Tu cuenta no tiene el permiso necesario. Solicita a dirección que te asigne un rol.</p><Link to="/">Volver al inicio</Link></div></main> }
export function ProfilePage() {
  const { session } = useAuth()
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [saving, setSaving] = useState(false)
  async function changePassword(event) {
    event.preventDefault(); setError(''); setNotice('')
    const form = new FormData(event.currentTarget); const currentPassword = form.get('current_password'); const newPassword = form.get('new_password'); const confirmation = form.get('confirmation')
    if (newPassword.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres.')
    if (newPassword !== confirmation) return setError('La confirmación no coincide con la nueva contraseña.')
    if (newPassword === currentPassword) return setError('La nueva contraseña debe ser diferente de la actual.')
    setSaving(true)
    const { error: authenticationError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword })
    if (authenticationError) { setSaving(false); return setError('La contraseña actual no es correcta.') }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (updateError) return setError(updateError.message)
    event.currentTarget.reset(); const message = 'Contraseña actualizada correctamente.'; setNotice(message); window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message } }))
  }
  return <><section className="page-heading"><p className="eyebrow">Cuenta</p><h2>Mi perfil</h2><p>Administra la seguridad de tu acceso al sistema.</p></section><section className="form-card profile-card"><h3>Cambiar contraseña</h3><p className="muted">Cuenta: {session?.user?.email}</p><form className="wide-form" onSubmit={changePassword}><label>Contraseña actual<input name="current_password" type="password" autoComplete="current-password" required /></label><label>Nueva contraseña<input name="new_password" type="password" minLength="8" autoComplete="new-password" required /></label><label>Confirmar nueva contraseña<input name="confirmation" type="password" minLength="8" autoComplete="new-password" required /></label>{error && <p className="error">{error}</p>}{notice && <p className="notice">{notice}</p>}<button disabled={saving}>{saving ? 'Actualizando…' : 'Actualizar contraseña'}</button></form></section></>
}

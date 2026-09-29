import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AuthCard } from './LoginPage'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const recoveryFromUrl = () => new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery' || new URLSearchParams(window.location.search).get('type') === 'recovery'

export default function ResetPasswordPage() {
  const { configured, session, passwordRecovery, clearPasswordRecovery, signOut } = useAuth()
  const [isRecovery, setIsRecovery] = useState(() => passwordRecovery || recoveryFromUrl())
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!configured) return undefined
    if (passwordRecovery) setIsRecovery(true)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [configured, passwordRecovery])

  async function requestReset(event) {
    event.preventDefault(); setError(''); setNotice(''); setSending(true)
    const email = new FormData(event.currentTarget).get('email').trim()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    setSending(false)
    if (resetError) return setError(resetError.message)
    setNotice('Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.')
    event.currentTarget.reset()
  }

  async function updatePassword(event) {
    event.preventDefault(); setError(''); setNotice('')
    if (!session) return setError('El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.')
    const form = new FormData(event.currentTarget); const password = form.get('password'); const confirmation = form.get('confirmation')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== confirmation) return setError('Las contraseñas no coinciden.')
    setSending(true); const { error: updateError } = await supabase.auth.updateUser({ password }); setSending(false)
    if (updateError) return setError(updateError.message)
    event.currentTarget.reset(); clearPasswordRecovery(); await signOut(); setNotice('Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.')
  }

  if (!configured) return <Navigate to="/configuracion" replace />
  if (isRecovery) return <AuthCard title="Restablecer contraseña" subtitle="Crea una nueva contraseña para tu cuenta."><form onSubmit={updatePassword}><label>Nueva contraseña<input name="password" type="password" minLength="8" autoComplete="new-password" required /></label><label>Confirmar nueva contraseña<input name="confirmation" type="password" minLength="8" autoComplete="new-password" required /></label>{error && <p className="error">{error}</p>}{notice && <p className="notice">{notice}</p>}<button disabled={sending}>{sending ? 'Actualizando…' : 'Cambiar contraseña'}</button></form><p><Link to="/ingresar">Volver a iniciar sesión</Link></p></AuthCard>
  return <AuthCard title="Recuperar contraseña" subtitle="Escribe tu correo y te enviaremos un enlace para recuperar el acceso."><form onSubmit={requestReset}><label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>{error && <p className="error">{error}</p>}{notice && <p className="notice">{notice}</p>}<button disabled={sending}>{sending ? 'Enviando…' : 'Enviar enlace de recuperación'}</button></form><p><Link to="/ingresar">Volver a iniciar sesión</Link></p></AuthCard>
}

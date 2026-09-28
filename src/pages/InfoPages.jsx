import { Link } from 'react-router-dom'
export function ConfigurationPage() { return <main className="auth-page"><section className="auth-card"><div className="logo">CE</div><h1>Configura Supabase</h1><p className="muted">Copia <code>.env.example</code> como <code>.env</code> y agrega la URL y clave anónima de tu proyecto. Después reinicia el servidor.</p></section></main> }
export function AccessDeniedPage() { return <main className="centered"><div><h1>Sin acceso</h1><p>Tu cuenta no tiene el permiso necesario. Solicita a dirección que te asigne un rol.</p><Link to="/">Volver al inicio</Link></div></main> }
export function ProfilePage() { return <section className="welcome"><h2>Mi perfil</h2><p>La gestión detallada de perfiles se agregará con los expedientes en la Fase 3.</p></section> }

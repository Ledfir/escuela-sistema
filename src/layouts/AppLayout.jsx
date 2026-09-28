import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import InstallAppButton from '../components/InstallAppButton'

export default function AppLayout() {
  const { session, roles, signOut } = useAuth()
  const canManageAcademic = roles.some(({ code }) => ['superadmin', 'administrator', 'school_control'].includes(code))
  const canTakeAttendance = roles.some(({ code }) => ['superadmin', 'administrator', 'school_control', 'teacher'].includes(code))
  const canManageFinance = roles.some(({ code }) => ['superadmin', 'administrator', 'finance'].includes(code))
  const isGuardian = roles.some(({ code }) => code === 'guardian')
  const canManageCommunications = roles.some(({ code }) => ['superadmin', 'administrator', 'school_control'].includes(code))
  const canViewReports = roles.some(({ code }) => ['superadmin', 'administrator', 'school_control', 'finance'].includes(code))
  const isSuperadmin = roles.some(({ code }) => code === 'superadmin')
  return <div className="app-shell">
    <aside><div className="brand">Colegio<br /><strong>Portal interno</strong></div>
      <nav><NavLink to="/">Inicio</NavLink>{canManageAcademic && <><NavLink to="/estructura-academica">Estructura académica</NavLink><NavLink to="/alumnos">Alumnos y tutores</NavLink><NavLink to="/inscripciones">Inscripciones</NavLink><NavLink to="/carga-academica">Docentes y materias</NavLink></>}{canTakeAttendance && <><NavLink to="/asistencia">Asistencia</NavLink><NavLink to="/calificaciones">Calificaciones</NavLink></>}{canManageFinance && <NavLink to="/finanzas">Finanzas</NavLink>}{canViewReports && <NavLink to="/reportes">Reportes</NavLink>}{isGuardian && <NavLink to="/familia">Mis hijos</NavLink>}<NavLink to="/avisos">Avisos y calendario</NavLink>{canManageCommunications && <NavLink to="/comunicados">Gestionar avisos</NavLink>}{isSuperadmin && <NavLink to="/auditoria">Auditoría</NavLink>}<NavLink to="/perfil">Mi perfil</NavLink></nav>
      <button className="link-button" onClick={signOut}>Cerrar sesión</button>
    </aside>
    <main className="content"><header><div><p className="eyebrow">Sesión activa</p><h1>Bienvenido</h1></div><div className="header-actions"><InstallAppButton /><div className="identity"><strong>{session.user.user_metadata.full_name || session.user.email}</strong><span>{roles.map(r => r.name).join(', ') || 'Sin rol asignado'}</span></div></div></header><Outlet /></main>
  </div>
}

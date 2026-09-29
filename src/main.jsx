import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import AcademicStructurePage from './pages/AcademicStructurePage'
import StudentsPage from './pages/StudentsPage'
import EnrollmentsPage from './pages/EnrollmentsPage'
import AcademicLoadPage from './pages/AcademicLoadPage'
import AttendancePage from './pages/AttendancePage'
import GradesPage from './pages/GradesPage'
import FinancePage from './pages/FinancePage'
import GuardianPortalPage from './pages/GuardianPortalPage'
import CommunicationsPage from './pages/CommunicationsPage'
import UpdatesPage from './pages/UpdatesPage'
import ReportsPage from './pages/ReportsPage'
import AuditPage from './pages/AuditPage'
import GlobalToast from './components/GlobalToast'
import { AccessDeniedPage, ConfigurationPage, ProfilePage } from './pages/InfoPages'
import './styles.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/service-worker.js').catch((error) => console.error('No fue posible activar el modo sin conexión.', error)) })
}

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><AuthProvider><GlobalToast /><Routes>
  <Route path="/ingresar" element={<LoginPage />} /><Route path="/registro" element={<RegisterPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/configuracion" element={<ConfigurationPage />} /><Route path="/sin-acceso" element={<AccessDeniedPage />} />
  <Route element={<ProtectedRoute />}><Route element={<AppLayout />}><Route index element={<DashboardPage />} /><Route path="perfil" element={<ProfilePage />} /><Route path="avisos" element={<UpdatesPage />} /><Route element={<ProtectedRoute allowedRoles={['superadmin', 'administrator', 'school_control']} />}><Route path="estructura-academica" element={<AcademicStructurePage />} /><Route path="alumnos" element={<StudentsPage />} /><Route path="inscripciones" element={<EnrollmentsPage />} /><Route path="carga-academica" element={<AcademicLoadPage />} /><Route path="comunicados" element={<CommunicationsPage />} /></Route><Route element={<ProtectedRoute allowedRoles={['superadmin', 'administrator', 'school_control', 'teacher']} />}><Route path="asistencia" element={<AttendancePage />} /><Route path="calificaciones" element={<GradesPage />} /></Route><Route element={<ProtectedRoute allowedRoles={['superadmin', 'administrator', 'finance']} />}><Route path="finanzas" element={<FinancePage />} /></Route><Route element={<ProtectedRoute allowedRoles={['superadmin', 'administrator', 'school_control', 'finance']} />}><Route path="reportes" element={<ReportsPage />} /></Route><Route element={<ProtectedRoute allowedRoles={['superadmin']} />}><Route path="auditoria" element={<AuditPage />} /></Route><Route element={<ProtectedRoute allowedRoles={['guardian']} />}><Route path="familia" element={<GuardianPortalPage />} /></Route></Route></Route>
</Routes></AuthProvider></BrowserRouter></StrictMode>)

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './GuardianPortalPage.css'

const studentName = (student) => [student?.first_names, student?.paternal_surname, student?.maternal_surname].filter(Boolean).join(' ')
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const attendanceLabel = { present: 'Presente', absent: 'Ausente', late: 'Retardo', excused: 'Justificado' }

export default function GuardianPortalPage() {
  const { session } = useAuth()
  const [children, setChildren] = useState([]); const [selectedId, setSelectedId] = useState(''); const [tab, setTab] = useState('summary')
  const [enrollments, setEnrollments] = useState([]); const [attendance, setAttendance] = useState([]); const [grades, setGrades] = useState([]); const [charges, setCharges] = useState([]); const [payments, setPayments] = useState([]); const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true); const [detailLoading, setDetailLoading] = useState(false); const [error, setError] = useState('')
  const selected = children.find(item => item.student_id === selectedId)?.students

  async function loadChildren() {
    setLoading(true); setError('')
    const { data: guardian, error: guardianError } = await supabase.from('guardians').select('id').eq('user_id', session.user.id).maybeSingle()
    if (guardianError) { setError(guardianError.message); setLoading(false); return }
    if (!guardian) { setChildren([]); setLoading(false); return }
    const { data, error: queryError } = await supabase.from('student_guardians').select('student_id, relationship, students(*)').eq('guardian_id', guardian.id)
    if (queryError) setError(queryError.message); else { setChildren(data ?? []); setSelectedId(data?.[0]?.student_id || '') }
    setLoading(false)
  }
  useEffect(() => { void loadChildren() }, [])
  useEffect(() => { if (selectedId) void loadDetails(selectedId) }, [selectedId])
  async function loadDetails(studentId) {
    setDetailLoading(true); setError('')
    const [enrollmentResult, attendanceResult, chargeResult, paymentResult, documentResult] = await Promise.all([
      supabase.from('student_enrollments').select('*, school_years(name), grades(name, education_levels(name)), school_groups!student_enrollments_group_id_grade_id_fkey(name)').eq('student_id', studentId).order('created_at', { ascending: false }),
      supabase.from('attendance_records').select('*, attendance_sessions(attendance_date)').eq('student_id', studentId).order('recorded_at', { ascending: false }).limit(20),
      supabase.from('student_charges').select('*, billing_concepts(name)').eq('student_id', studentId).order('due_date', { ascending: false }),
      supabase.from('payments').select('*, student_charges(billing_concepts(name))').eq('student_id', studentId).order('paid_on', { ascending: false }),
      supabase.from('student_documents').select('*').eq('student_id', studentId).order('uploaded_at', { ascending: false })
    ])
    const enrollmentIds = enrollmentResult.data?.map(item => item.id) || []
    const gradeResult = enrollmentIds.length ? await supabase.from('period_grades').select('*, grading_periods(name), group_subjects(subjects(name))').in('student_enrollment_id', enrollmentIds).order('created_at', { ascending: false }) : { data: [], error: null }
    const issue = [enrollmentResult, attendanceResult, chargeResult, paymentResult, documentResult, gradeResult].map(item => item.error).find(Boolean)
    if (issue) setError(issue.message)
    else { setEnrollments(enrollmentResult.data); setAttendance(attendanceResult.data); setCharges(chargeResult.data); setPayments(paymentResult.data); setDocuments(documentResult.data); setGrades(gradeResult.data) }
    setDetailLoading(false)
  }
  async function openDocument(document) { const { data, error: urlError } = await supabase.storage.from('student-documents').createSignedUrl(document.storage_path, 60); if (urlError) setError(urlError.message); else window.open(data.signedUrl, '_blank', 'noopener,noreferrer') }
  const balance = charges.reduce((sum, item) => sum + Number(item.amount) - Number(item.discount_amount) + Number(item.surcharge_amount) - Number(item.paid_amount), 0)
  if (loading) return <main className="centered">Cargando portal familiar…</main>
  if (!children.length) return <section className="portal-empty"><h2>Aún no hay hijos vinculados</h2><p>Para activar este portal, la escuela debe vincular tu cuenta con tu expediente de tutor y relacionarlo con tus hijos.</p></section>
  return <><section className="page-heading"><p className="eyebrow">Portal de familias</p><h2>Hola, consulta la información de tus hijos</h2></section>{error && <p className="error banner">{error}</p>}
    <section className="children-selector">{children.map(item => <button key={item.student_id} onClick={() => setSelectedId(item.student_id)} className={selectedId === item.student_id ? 'child-card selected-child' : 'child-card'}><strong>{studentName(item.students)}</strong><span>{item.relationship}</span></button>)}</section>
    {selected && <><div className="portal-header"><div><h3>{studentName(selected)}</h3><p>{enrollments[0] ? `${enrollments[0].grades?.education_levels?.name} · ${enrollments[0].grades?.name} ${enrollments[0].school_groups?.name || ''}` : 'Sin inscripción activa'}</p></div><span>{detailLoading ? 'Actualizando…' : `Saldo pendiente: ${money.format(balance)}`}</span></div><div className="module-tabs"><button className={tab === 'summary' ? 'tab active-tab' : 'tab'} onClick={() => setTab('summary')}>Resumen</button><button className={tab === 'grades' ? 'tab active-tab' : 'tab'} onClick={() => setTab('grades')}>Calificaciones</button><button className={tab === 'attendance' ? 'tab active-tab' : 'tab'} onClick={() => setTab('attendance')}>Asistencia</button><button className={tab === 'payments' ? 'tab active-tab' : 'tab'} onClick={() => setTab('payments')}>Pagos</button><button className={tab === 'documents' ? 'tab active-tab' : 'tab'} onClick={() => setTab('documents')}>Documentos</button></div>
      {tab === 'summary' && <section className="portal-grid"><InfoCard title="Inscripción actual" content={enrollments[0] ? `${enrollments[0].school_years?.name} · ${enrollments[0].grades?.name} ${enrollments[0].school_groups?.name || ''}` : 'No disponible'} /><InfoCard title="Saldo pendiente" content={money.format(balance)} /><InfoCard title="Asistencias recientes" content={`${attendance.length} registros`} /><InfoCard title="Calificaciones" content={`${grades.length} registradas`} /></section>}
      {tab === 'grades' && <PortalList title="Calificaciones"><table><thead><tr><th>Materia</th><th>Período</th><th>Calificación</th><th>Observaciones</th></tr></thead><tbody>{grades.length ? grades.map(item => <tr key={item.id}><td>{item.group_subjects?.subjects?.name}</td><td>{item.grading_periods?.name}</td><td>{item.score}</td><td>{item.remarks || '—'}</td></tr>) : <tr><td colSpan="4">No hay calificaciones publicadas.</td></tr>}</tbody></table></PortalList>}
      {tab === 'attendance' && <PortalList title="Asistencia reciente"><table><thead><tr><th>Fecha</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody>{attendance.length ? attendance.map(item => <tr key={item.id}><td>{item.attendance_sessions?.attendance_date}</td><td>{attendanceLabel[item.status]}</td><td>{item.notes || '—'}</td></tr>) : <tr><td colSpan="3">No hay asistencias registradas.</td></tr>}</tbody></table></PortalList>}
      {tab === 'payments' && <section className="portal-two-columns"><PortalList title="Estado de cuenta"><table><thead><tr><th>Concepto</th><th>Vencimiento</th><th>Saldo</th></tr></thead><tbody>{charges.length ? charges.map(item => <tr key={item.id}><td>{item.billing_concepts?.name}</td><td>{item.due_date}</td><td>{money.format(Number(item.amount) - Number(item.discount_amount) + Number(item.surcharge_amount) - Number(item.paid_amount))}</td></tr>) : <tr><td colSpan="3">No hay cargos.</td></tr>}</tbody></table></PortalList><PortalList title="Pagos recientes"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th></tr></thead><tbody>{payments.length ? payments.map(item => <tr key={item.id}><td>{item.paid_on}</td><td>{item.student_charges?.billing_concepts?.name}</td><td>{money.format(item.amount)}</td></tr>) : <tr><td colSpan="3">No hay pagos.</td></tr>}</tbody></table></PortalList></section>}
      {tab === 'documents' && <PortalList title="Documentos"><ul className="portal-documents">{documents.length ? documents.map(item => <li key={item.id}><span><strong>{item.document_type}</strong><small>{item.file_name}</small></span><button className="small-button" onClick={() => openDocument(item)}>Abrir</button></li>) : <li>No hay documentos disponibles.</li>}</ul></PortalList>}
    </>}
  </>
}
function InfoCard({ title, content }) { return <article className="portal-info"><span>{title}</span><strong>{content}</strong></article> }
function PortalList({ title, children }) { return <section className="portal-list"><h3>{title}</h3><div className="portal-table-wrap">{children}</div></section> }

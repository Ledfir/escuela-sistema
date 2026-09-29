import SearchableSelect from '../components/SearchableSelect'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './EnrollmentsPage.css'

const fullName = (person) => [person?.first_names, person?.paternal_surname, person?.maternal_surname].filter(Boolean).join(' ')
const enrollmentStatus = { preinscribed: 'Preinscrito', enrolled: 'Inscrito', active: 'Activo', withdrawn: 'Baja', completed: 'Concluido' }

export default function EnrollmentsPage() {
  const { session } = useAuth()
  const [students, setStudents] = useState([]); const [years, setYears] = useState([]); const [grades, setGrades] = useState([]); const [groups, setGroups] = useState([]); const [enrollments, setEnrollments] = useState([])
  const [schoolYearId, setSchoolYearId] = useState(''); const [gradeId, setGradeId] = useState(''); const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const allowedGroups = groups.filter(group => group.school_year_id === schoolYearId && group.grade_id === gradeId)
  const visibleEnrollments = useMemo(() => enrollments.filter(item => fullName(item.students).toLowerCase().includes(search.toLowerCase()) || item.students?.enrollment_number?.toLowerCase().includes(search.toLowerCase())), [enrollments, search])

  async function load(showLoader = false) {
    if (showLoader) setLoading(true); setError('')
    const [studentResult, yearResult, gradeResult, groupResult, enrollmentResult] = await Promise.all([
      supabase.from('students').select('*').order('paternal_surname'),
      supabase.from('school_years').select('*').order('starts_on', { ascending: false }),
      supabase.from('grades').select('*, education_levels(name)').order('sort_order'),
      supabase.from('school_groups').select('*').order('name'),
      supabase.from('student_enrollments').select('*, students(first_names, paternal_surname, maternal_surname, enrollment_number), school_years(name), grades(name, education_levels(name)), school_groups!student_enrollments_group_id_grade_id_fkey(name)').order('created_at', { ascending: false })
    ])
    const issue = [studentResult, yearResult, gradeResult, groupResult, enrollmentResult].map(result => result.error).find(Boolean)
    if (issue) setError(issue.message)
    else { setStudents(studentResult.data); setYears(yearResult.data); setGrades(gradeResult.data); setGroups(groupResult.data); setEnrollments(enrollmentResult.data); if (!schoolYearId) setSchoolYearId(yearResult.data.find(year => year.is_current)?.id || yearResult.data[0]?.id || '') }
    setLoading(false)
  }
  useEffect(() => { load(true) }, [])

  async function submit(event) {
    event.preventDefault(); setError(''); setNotice(''); const form = new FormData(event.currentTarget)
    const { data, error: insertError } = await supabase.from('student_enrollments').insert({ student_id: form.get('student_id'), school_year_id: schoolYearId, grade_id: gradeId, group_id: form.get('group_id') || null, enrollment_date: form.get('enrollment_date'), status: form.get('status'), notes: form.get('notes')?.trim() || null, created_by: session.user.id }).select('*, students(first_names, paternal_surname, maternal_surname, enrollment_number), school_years(name), grades(name, education_levels(name)), school_groups!student_enrollments_group_id_grade_id_fkey(name)').single()
    if (insertError) return setError(insertError.message)
    setEnrollments(previous => [data, ...previous]); event.currentTarget.reset(); setGradeId(''); setNotice('Inscripción creada. Si el alumno no tenía matrícula, se generó automáticamente.'); await load()
  }

  if (loading) return <main className="centered">Cargando inscripciones…</main>
  return <><section className="page-heading"><p className="eyebrow">Fase 4</p><h2>Inscripciones y asignación de grupos</h2><p>Cada inscripción enlaza al alumno con un ciclo, grado y grupo, preservando su historial escolar.</p></section>
    {error && <p className="error banner">{error}</p>}{notice && <p className="notice banner">{notice}</p>}
    {!years.length || !groups.length ? <p className="warning-banner">Primero crea un ciclo escolar y sus grupos en <strong>Estructura académica</strong> para poder completar una inscripción.</p> : null}
    <section className="enrollment-grid"><section className="form-card"><h3>Nueva inscripción</h3><form className="wide-form" onSubmit={submit}><label>Alumno<SearchableSelect name="student_id" required defaultValue=""><option value="" disabled>Selecciona un alumno</option>{students.map(student => <option key={student.id} value={student.id}>{fullName(student)}{student.enrollment_number ? ` · ${student.enrollment_number}` : ''}</option>)}</SearchableSelect></label><div className="form-row"><label>Ciclo escolar<SearchableSelect value={schoolYearId} onChange={event => { setSchoolYearId(event.target.value); setGradeId('') }} required><option value="" disabled>Selecciona un ciclo</option>{years.map(year => <option key={year.id} value={year.id}>{year.name}{year.is_current ? ' · Actual' : ''}</option>)}</SearchableSelect></label><label>Grado<SearchableSelect value={gradeId} onChange={event => setGradeId(event.target.value)} required><option value="" disabled>Selecciona un grado</option>{grades.map(grade => <option key={grade.id} value={grade.id}>{grade.education_levels?.name} · {grade.name}</option>)}</SearchableSelect></label></div><div className="form-row"><label>Grupo<SearchableSelect name="group_id" disabled={!gradeId} defaultValue=""><option value="">Sin asignar por ahora</option>{allowedGroups.map(group => <option key={group.id} value={group.id}>{group.name}{group.capacity ? ` · cupo ${group.capacity}` : ''}</option>)}</SearchableSelect></label><label>Fecha de inscripción<input name="enrollment_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label></div><label>Estatus<SearchableSelect name="status" defaultValue="enrolled">{Object.entries(enrollmentStatus).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</SearchableSelect></label><label>Observaciones<textarea name="notes" rows="3" placeholder="Opcional" /></label><button disabled={!students.length || !schoolYearId || !gradeId}>Crear inscripción</button></form></section>
      <section className="enrollment-summary"><h3>Historial de inscripciones</h3><input aria-label="Buscar inscripción" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar alumno o matrícula" /><ul className="enrollment-list">{visibleEnrollments.length ? visibleEnrollments.map(enrollment => <li key={enrollment.id}><div><strong>{fullName(enrollment.students)}</strong><span>{enrollment.students?.enrollment_number || 'Matrícula pendiente'}</span><span>{enrollment.school_years?.name} · {enrollment.grades?.education_levels?.name} · {enrollment.grades?.name}{enrollment.school_groups?.name ? ` ${enrollment.school_groups.name}` : ' · sin grupo'}</span></div><span className="status-pill">{enrollmentStatus[enrollment.status]}</span></li>) : <li className="empty">Aún no hay inscripciones.</li>}</ul></section></section>
  </>
}

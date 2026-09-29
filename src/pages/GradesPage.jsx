import SearchableSelect from '../components/SearchableSelect'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './GradesPage.css'

const personName = (person) => [person?.first_names, person?.paternal_surname, person?.maternal_surname].filter(Boolean).join(' ')

export default function GradesPage() {
  const { session, roles } = useAuth()
  const [years, setYears] = useState([]); const [periods, setPeriods] = useState([]); const [groupSubjects, setGroupSubjects] = useState([]); const [evaluations, setEvaluations] = useState([])
  const [tab, setTab] = useState('capture'); const [groupSubjectId, setGroupSubjectId] = useState(''); const [periodId, setPeriodId] = useState(''); const [roster, setRoster] = useState([]); const [scores, setScores] = useState({}); const [selectedStudent, setSelectedStudent] = useState('')
  const [loading, setLoading] = useState(true); const [captureLoading, setCaptureLoading] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const isManager = roles.some(role => ['superadmin', 'administrator', 'school_control'].includes(role.code))
  const selectedAssignment = groupSubjects.find(item => item.id === groupSubjectId)
  const currentPeriods = useMemo(() => periods.filter(period => period.school_year_id === selectedAssignment?.school_groups?.school_year_id), [periods, selectedAssignment])
  const studentReport = roster.find(item => item.enrollment_id === selectedStudent)

  async function load(showLoader = false) {
    if (showLoader) setLoading(true); setError('')
    const [yearResult, periodResult, assignmentResult, evaluationResult] = await Promise.all([
      supabase.from('school_years').select('*').order('starts_on', { ascending: false }),
      supabase.from('grading_periods').select('*, school_years(name)').order('sort_order'),
      supabase.from('group_subjects').select('*, subjects(name, code), teachers(first_names, paternal_surname, maternal_surname), school_groups(id, name, school_year_id, school_years(name), grades(name, education_levels(name)) )'),
      supabase.from('evaluations').select('*, group_subjects(subjects(name), school_groups(name))').order('created_at', { ascending: false })
    ])
    const issue = [yearResult, periodResult, assignmentResult, evaluationResult].map(result => result.error).find(Boolean)
    if (issue) setError(issue.message)
    else { setYears(yearResult.data); setPeriods(periodResult.data); setGroupSubjects(assignmentResult.data); setEvaluations(evaluationResult.data) }
    setLoading(false)
  }
  useEffect(() => { void load(true) }, [])
  function clearMessage() { setError(''); setNotice('') }
  async function createPeriod(event) {
    event.preventDefault(); clearMessage(); const form = new FormData(event.currentTarget); const active = form.get('is_active') === 'on'; const yearId = form.get('school_year_id')
    if (active) await supabase.from('grading_periods').update({ is_active: false }).eq('school_year_id', yearId).eq('is_active', true)
    const { data, error: insertError } = await supabase.from('grading_periods').insert({ school_year_id: yearId, name: form.get('name'), sort_order: Number(form.get('sort_order')), starts_on: form.get('starts_on') || null, ends_on: form.get('ends_on') || null, is_active: active }).select('*, school_years(name)').single()
    if (insertError) return setError(insertError.message)
    setPeriods(previous => [...previous.filter(item => !(active && item.school_year_id === yearId)), data].sort((a, b) => a.sort_order - b.sort_order)); event.currentTarget.reset(); setNotice('Período de evaluación creado.')
  }
  async function createEvaluation(event) {
    event.preventDefault(); clearMessage(); const form = new FormData(event.currentTarget)
    const { data, error: insertError } = await supabase.from('evaluations').insert({ group_subject_id: form.get('group_subject_id'), grading_period_id: form.get('grading_period_id'), name: form.get('name'), weight: Number(form.get('weight')), max_score: Number(form.get('max_score')) }).select('*, group_subjects(subjects(name), school_groups(name))').single()
    if (insertError) return setError(insertError.message)
    setEvaluations(previous => [data, ...previous]); event.currentTarget.reset(); setNotice('Evaluación configurada.')
  }
  async function loadCapture(event) {
    event.preventDefault(); clearMessage(); if (!selectedAssignment || !periodId) return; setCaptureLoading(true)
    const [{ data: enrollments, error: enrollmentError }, { data: existingGrades, error: gradeError }] = await Promise.all([
      supabase.from('student_enrollments').select('id, students(id, first_names, paternal_surname, maternal_surname, enrollment_number)').eq('group_id', selectedAssignment.group_id).eq('school_year_id', selectedAssignment.school_groups.school_year_id).in('status', ['enrolled', 'active']),
      supabase.from('period_grades').select('*').eq('group_subject_id', groupSubjectId).eq('grading_period_id', periodId)
    ])
    if (enrollmentError || gradeError) { setError(enrollmentError?.message || gradeError?.message); setCaptureLoading(false); return }
    const nextRoster = (enrollments ?? []).map(item => ({ ...item, ...item.students, enrollment_id: item.id }))
    setRoster(nextRoster); setScores(Object.fromEntries(nextRoster.map(item => { const grade = existingGrades.find(record => record.student_enrollment_id === item.enrollment_id); return [item.enrollment_id, { score: grade?.score ?? '', remarks: grade?.remarks || '' }] }))); setSelectedStudent(nextRoster[0]?.enrollment_id || ''); setCaptureLoading(false)
  }
  async function saveGrades() {
    if (!roster.length) return; clearMessage(); setCaptureLoading(true)
    const invalid = roster.some(item => scores[item.enrollment_id]?.score === '' || Number(scores[item.enrollment_id]?.score) < 0 || Number(scores[item.enrollment_id]?.score) > 100)
    if (invalid) { setError('Captura una calificación entre 0 y 100 para cada alumno.'); setCaptureLoading(false); return }
    const entries = roster.map(item => ({ student_enrollment_id: item.enrollment_id, group_subject_id: groupSubjectId, grading_period_id: periodId, score: Number(scores[item.enrollment_id].score), remarks: scores[item.enrollment_id].remarks.trim() || null, recorded_by: session.user.id }))
    const { error: saveError } = await supabase.from('period_grades').upsert(entries, { onConflict: 'student_enrollment_id,group_subject_id,grading_period_id' })
    if (saveError) setError(saveError.message); else setNotice('Calificaciones guardadas correctamente.')
    setCaptureLoading(false)
  }
  const assignmentLabel = (item) => `${item.school_groups?.school_years?.name} · ${item.school_groups?.grades?.education_levels?.name} ${item.school_groups?.grades?.name} ${item.school_groups?.name} · ${item.subjects?.name}`
  if (loading) return <main className="centered">Cargando calificaciones…</main>
  return <><section className="page-heading"><p className="eyebrow">Fase 7</p><h2>Calificaciones y boletas</h2><p>Configura períodos, define evaluaciones y captura la calificación final de cada materia.</p></section>{error && <p className="error banner">{error}</p>}{notice && <p className="notice banner">{notice}</p>}
    <div className="module-tabs">{isManager && <button className={tab === 'periods' ? 'tab active-tab' : 'tab'} onClick={() => setTab('periods')}>Períodos</button>}<button className={tab === 'evaluations' ? 'tab active-tab' : 'tab'} onClick={() => setTab('evaluations')}>Evaluaciones</button><button className={tab === 'capture' ? 'tab active-tab' : 'tab'} onClick={() => setTab('capture')}>Capturar calificaciones</button><button className={tab === 'report' ? 'tab active-tab' : 'tab'} onClick={() => setTab('report')}>Boleta</button></div>
    {tab === 'periods' && isManager && <section className="grades-layout"><section className="form-card"><h3>Nuevo período</h3><form className="wide-form" onSubmit={createPeriod}><label>Ciclo<SearchableSelect name="school_year_id" required defaultValue=""><option value="" disabled>Selecciona ciclo</option>{years.map(year => <option key={year.id} value={year.id}>{year.name}</option>)}</SearchableSelect></label><div className="form-row"><label>Nombre<input name="name" placeholder="Periodo 1" required /></label><label>Orden<input name="sort_order" type="number" min="1" required /></label></div><div className="form-row"><label>Inicio<input name="starts_on" type="date" /></label><label>Fin<input name="ends_on" type="date" /></label></div><label className="check"><input name="is_active" type="checkbox" /> Período activo</label><button>Crear período</button></form></section><PeriodList periods={periods} /></section>}
    {tab === 'evaluations' && <section className="grades-layout"><section className="form-card"><h3>Configurar evaluación</h3><form className="wide-form" onSubmit={createEvaluation}><label>Materia y grupo<SearchableSelect name="group_subject_id" required defaultValue=""><option value="" disabled>Selecciona una carga</option>{groupSubjects.map(item => <option key={item.id} value={item.id}>{assignmentLabel(item)}</option>)}</SearchableSelect></label><label>Período<SearchableSelect name="grading_period_id" required defaultValue=""><option value="" disabled>Selecciona período</option>{periods.map(period => <option key={period.id} value={period.id}>{period.school_years?.name} · {period.name}</option>)}</SearchableSelect></label><div className="form-row"><label>Nombre<input name="name" placeholder="Examen parcial" required /></label><label>Ponderación (%)<input name="weight" type="number" min="1" max="100" defaultValue="100" required /></label></div><label>Calificación máxima<input name="max_score" type="number" min="1" defaultValue="100" required /></label><button>Crear evaluación</button></form></section><EvaluationList evaluations={evaluations} /></section>}
    {(tab === 'capture' || tab === 'report') && <><section className="capture-controls form-card"><form onSubmit={loadCapture}><label>Materia y grupo<SearchableSelect value={groupSubjectId} onChange={event => { setGroupSubjectId(event.target.value); setPeriodId(''); setRoster([]) }} required><option value="" disabled>Selecciona una carga</option>{groupSubjects.map(item => <option key={item.id} value={item.id}>{assignmentLabel(item)}</option>)}</SearchableSelect></label><label>Período<SearchableSelect value={periodId} onChange={event => setPeriodId(event.target.value)} disabled={!selectedAssignment} required><option value="" disabled>Selecciona período</option>{currentPeriods.map(period => <option key={period.id} value={period.id}>{period.name}{period.is_active ? ' · Activo' : ''}</option>)}</SearchableSelect></label><button disabled={!groupSubjectId || !periodId || captureLoading}>{captureLoading ? 'Cargando…' : 'Cargar alumnos'}</button></form></section>
      {roster.length > 0 && tab === 'capture' && <section className="grade-capture"><header><div><h3>Captura final por período</h3><p>{selectedAssignment?.subjects?.name} · {roster.length} alumnos</p></div><button onClick={saveGrades} disabled={captureLoading}>{captureLoading ? 'Guardando…' : 'Guardar calificaciones'}</button></header><div className="grade-table"><div className="grade-head"><span>Alumno</span><span>Calificación (0–100)</span><span>Observaciones</span></div>{roster.map(item => <div className="grade-row" key={item.enrollment_id}><span><strong>{personName(item)}</strong><small>{item.enrollment_number || 'Sin matrícula'}</small></span><input type="number" min="0" max="100" step="0.01" value={scores[item.enrollment_id]?.score ?? ''} onChange={event => setScores(previous => ({ ...previous, [item.enrollment_id]: { ...previous[item.enrollment_id], score: event.target.value } }))} /><input value={scores[item.enrollment_id]?.remarks || ''} onChange={event => setScores(previous => ({ ...previous, [item.enrollment_id]: { ...previous[item.enrollment_id], remarks: event.target.value } }))} placeholder="Opcional" /></div>)}</div></section>}
      {roster.length > 0 && tab === 'report' && <section className="report-card"><div className="report-actions"><label>Alumno<SearchableSelect value={selectedStudent} onChange={event => setSelectedStudent(event.target.value)}>{roster.map(item => <option key={item.enrollment_id} value={item.enrollment_id}>{personName(item)}</option>)}</SearchableSelect></label><button onClick={() => window.print()}>Imprimir boleta</button></div>{studentReport && <article className="printable-report"><p className="eyebrow">Boleta de calificaciones</p><h3>{personName(studentReport)}</h3><p>{selectedAssignment?.school_groups?.school_years?.name} · {selectedAssignment?.school_groups?.grades?.education_levels?.name} {selectedAssignment?.school_groups?.grades?.name} {selectedAssignment?.school_groups?.name}</p><dl><div><dt>Materia</dt><dd>{selectedAssignment?.subjects?.name}</dd></div><div><dt>Período</dt><dd>{currentPeriods.find(item => item.id === periodId)?.name}</dd></div><div><dt>Calificación</dt><dd>{scores[selectedStudent]?.score === '' ? 'Pendiente' : scores[selectedStudent]?.score}</dd></div></dl><p><strong>Observaciones:</strong> {scores[selectedStudent]?.remarks || 'Sin observaciones'}</p></article>}</section>}
    </>}
  </>
}

function PeriodList({ periods }) { return <section className="summary-card"><h3>Períodos configurados</h3><ul className="summary-list">{periods.length ? periods.map(item => <li key={item.id}><strong>{item.school_years?.name} · {item.name}{item.is_active ? ' · Activo' : ''}</strong><span>{item.starts_on || 'Sin inicio'} — {item.ends_on || 'Sin fin'}</span></li>) : <li className="empty">Aún no hay períodos.</li>}</ul></section> }
function EvaluationList({ evaluations }) { return <section className="summary-card"><h3>Evaluaciones configuradas</h3><ul className="summary-list">{evaluations.length ? evaluations.map(item => <li key={item.id}><strong>{item.name}</strong><span>{item.group_subjects?.subjects?.name} · Grupo {item.group_subjects?.school_groups?.name}</span><small>{item.weight}% · máximo {item.max_score}</small></li>) : <li className="empty">Aún no hay evaluaciones.</li>}</ul></section> }

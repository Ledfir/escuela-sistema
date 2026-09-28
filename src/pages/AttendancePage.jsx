import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './AttendancePage.css'

const labels = { present: 'Presente', absent: 'Ausente', late: 'Retardo', excused: 'Justificado' }
const today = new Date().toISOString().slice(0, 10)
const nameOf = (student) => [student?.first_names, student?.paternal_surname, student?.maternal_surname].filter(Boolean).join(' ')

export default function AttendancePage() {
  const { session, roles } = useAuth()
  const [groups, setGroups] = useState([]); const [groupId, setGroupId] = useState(''); const [date, setDate] = useState(today)
  const [roster, setRoster] = useState([]); const [states, setStates] = useState({}); const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false); const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const isManager = roles.some(role => ['superadmin', 'administrator', 'school_control'].includes(role.code))

  async function loadGroups() {
    const [groupResult, assignmentResult] = await Promise.all([
      supabase.from('school_groups').select('*, school_years(name), grades(name, education_levels(name))').order('name'),
      supabase.from('group_subjects').select('group_id, teachers(user_id)')
    ])
    if (groupResult.error || assignmentResult.error) return setError(groupResult.error?.message || assignmentResult.error?.message)
    const allowed = isManager ? groupResult.data : groupResult.data.filter(group => assignmentResult.data.some(item => item.group_id === group.id && item.teachers?.user_id === session.user.id))
    setGroups(allowed)
  }
  useEffect(() => { void loadGroups() }, [])
  async function loadRoster(event) {
    event.preventDefault(); setError(''); setNotice(''); setLoading(true); setReady(false)
    const [{ data: existing, error: sessionError }, { data: enrollments, error: enrollmentError }] = await Promise.all([
      supabase.from('attendance_sessions').select('id').eq('group_id', groupId).eq('attendance_date', date).maybeSingle(),
      supabase.from('student_enrollments').select('student_id, students(id, first_names, paternal_surname, maternal_surname, enrollment_number)').eq('group_id', groupId).in('status', ['enrolled', 'active'])
    ])
    if (sessionError || enrollmentError) { setError(sessionError?.message || enrollmentError?.message); setLoading(false); return }
    let existingRecords = []
    if (existing) {
      const { data, error: recordError } = await supabase.from('attendance_records').select('*').eq('attendance_session_id', existing.id)
      if (recordError) { setError(recordError.message); setLoading(false); return }
      existingRecords = data
    }
    const nextStates = Object.fromEntries((enrollments ?? []).map(enrollment => {
      const record = existingRecords.find(item => item.student_id === enrollment.student_id)
      return [enrollment.student_id, { status: record?.status || 'present', notes: record?.notes || '' }]
    }))
    setRoster(enrollments ?? []); setStates(nextStates); setSessionId(existing?.id || null); setReady(true); setLoading(false)
  }
  async function saveAttendance() {
    if (!roster.length) return; setError(''); setNotice(''); setLoading(true)
    let targetSessionId = sessionId
    if (!targetSessionId) {
      const { data, error: createError } = await supabase.from('attendance_sessions').insert({ group_id: groupId, attendance_date: date, recorded_by: session.user.id }).select().single()
      if (createError) { setError(createError.message); setLoading(false); return }
      targetSessionId = data.id; setSessionId(data.id)
    }
    const records = roster.map(enrollment => ({ attendance_session_id: targetSessionId, student_id: enrollment.student_id, status: states[enrollment.student_id]?.status || 'present', notes: states[enrollment.student_id]?.notes?.trim() || null, recorded_by: session.user.id }))
    const { error: saveError } = await supabase.from('attendance_records').upsert(records, { onConflict: 'attendance_session_id,student_id' })
    if (saveError) setError(saveError.message); else setNotice('Asistencia guardada correctamente.')
    setLoading(false)
  }
  const counts = Object.values(states).reduce((all, item) => ({ ...all, [item.status]: (all[item.status] || 0) + 1 }), {})
  const groupLabel = (group) => `${group.school_years?.name} · ${group.grades?.education_levels?.name} ${group.grades?.name} ${group.name}`
  return <><section className="page-heading"><p className="eyebrow">Fase 6</p><h2>Asistencia</h2><p>Selecciona un grupo y fecha para registrar el pase de lista.</p></section>{error && <p className="error banner">{error}</p>}{notice && <p className="notice banner">{notice}</p>}
    <section className="attendance-controls form-card"><form onSubmit={loadRoster}><label>Grupo<select value={groupId} onChange={event => setGroupId(event.target.value)} required><option value="" disabled>{groups.length ? 'Selecciona un grupo' : 'Cargando grupos…'}</option>{groups.map(group => <option key={group.id} value={group.id}>{groupLabel(group)}</option>)}</select></label><label>Fecha<input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label><button disabled={!groupId || loading}>{loading ? 'Cargando…' : 'Cargar lista'}</button></form></section>
    {ready && <section className="attendance-panel"><header><div><h3>Pase de lista</h3><p>{roster.length} alumnos inscritos</p></div><div className="attendance-counts">{Object.entries(labels).map(([status, label]) => <span key={status}>{label}: <strong>{counts[status] || 0}</strong></span>)}</div></header>{roster.length ? <><div className="attendance-table"><div className="attendance-head"><span>Alumno</span><span>Estado</span><span>Observaciones</span></div>{roster.map(enrollment => <div className="attendance-row" key={enrollment.student_id}><span><strong>{nameOf(enrollment.students)}</strong><small>{enrollment.students?.enrollment_number || 'Sin matrícula'}</small></span><select value={states[enrollment.student_id]?.status || 'present'} onChange={event => setStates(previous => ({ ...previous, [enrollment.student_id]: { ...previous[enrollment.student_id], status: event.target.value } }))}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input value={states[enrollment.student_id]?.notes || ''} onChange={event => setStates(previous => ({ ...previous, [enrollment.student_id]: { ...previous[enrollment.student_id], notes: event.target.value } }))} placeholder="Opcional" /></div>)}</div><button className="save-attendance" onClick={saveAttendance} disabled={loading}>{loading ? 'Guardando…' : 'Guardar asistencia'}</button></> : <p className="empty">No hay alumnos inscritos activos en este grupo.</p>}</section>}
  </>
}

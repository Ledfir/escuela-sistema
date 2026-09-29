import SearchableSelect from '../components/SearchableSelect'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './AcademicLoadPage.css'
import './RecordActions.css'

const fullName = (person) => [person?.first_names, person?.paternal_surname, person?.maternal_surname].filter(Boolean).join(' ')
const teacherStatus = { active: 'Activo', inactive: 'Inactivo', on_leave: 'Con licencia' }

export default function AcademicLoadPage() {
  const { hasRole, session } = useAuth()
  const [teachers, setTeachers] = useState([]); const [subjects, setSubjects] = useState([]); const [groups, setGroups] = useState([]); const [skills, setSkills] = useState([]); const [assignments, setAssignments] = useState([])
  const [tab, setTab] = useState('teachers'); const [selectedSubject, setSelectedSubject] = useState(''); const [editingTeacher, setEditingTeacher] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [creatingAccessId, setCreatingAccessId] = useState(null)
  const eligibleTeachers = useMemo(() => teachers.filter(teacher => skills.some(skill => skill.teacher_id === teacher.id && skill.subject_id === selectedSubject)), [teachers, skills, selectedSubject])

  async function load(showLoader = false) {
    if (showLoader) setLoading(true); setError('')
    const [teacherResult, subjectResult, groupResult, skillResult, assignmentResult] = await Promise.all([
      supabase.from('teachers').select('*').is('deleted_at', null).order('paternal_surname'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('school_groups').select('*, school_years(name), grades(name, education_levels(name))').order('name'),
      supabase.from('teacher_subjects').select('*'),
      supabase.from('group_subjects').select('*, teachers(first_names, paternal_surname, maternal_surname), subjects(name, code), school_groups(name, school_years(name), grades(name, education_levels(name)))').order('created_at', { ascending: false })
    ])
    const issue = [teacherResult, subjectResult, groupResult, skillResult, assignmentResult].map(result => result.error).find(Boolean)
    if (issue) setError(issue.message)
    else { setTeachers(teacherResult.data); setSubjects(subjectResult.data); setGroups(groupResult.data); setSkills(skillResult.data); setAssignments(assignmentResult.data) }
    setLoading(false)
  }
  useEffect(() => { load(true) }, [])
  function clearMessage() { setError(''); setNotice('') }
  async function createTeacher(event) {
    event.preventDefault(); clearMessage(); const form = new FormData(event.currentTarget)
    const { data, error: insertError } = await supabase.from('teachers').insert({ first_names: form.get('first_names').trim(), paternal_surname: form.get('paternal_surname').trim(), maternal_surname: form.get('maternal_surname').trim() || null, curp: form.get('curp').trim().toUpperCase() || null, rfc: form.get('rfc').trim().toUpperCase() || null, email: form.get('email').trim() || null, phone: form.get('phone').trim(), address: form.get('address').trim() || null, hire_date: form.get('hire_date') || null, status: form.get('status'), notes: form.get('notes').trim() || null }).select().single()
    if (insertError) return setError(insertError.message)
    setTeachers(previous => [...previous, data].sort((a, b) => fullName(a).localeCompare(fullName(b)))); event.currentTarget.reset(); setNotice('Docente creado. Asigna sus materias para incluirlo en la carga académica.'); setTab('subjects')
  }
  async function updateTeacher(event) {
    event.preventDefault(); clearMessage(); const form = new FormData(event.currentTarget)
    const payload = { first_names: form.get('first_names').trim(), paternal_surname: form.get('paternal_surname').trim(), maternal_surname: form.get('maternal_surname').trim() || null, curp: form.get('curp').trim().toUpperCase() || null, rfc: form.get('rfc').trim().toUpperCase() || null, email: form.get('email').trim() || null, phone: form.get('phone').trim(), address: form.get('address').trim() || null, hire_date: form.get('hire_date') || null, status: form.get('status'), notes: form.get('notes').trim() || null }
    const { data, error: updateError } = await supabase.from('teachers').update(payload).eq('id', editingTeacher.id).select().single()
    if (updateError) return setError(updateError.message)
    setTeachers(previous => previous.map(item => item.id === data.id ? data : item).sort((a, b) => fullName(a).localeCompare(fullName(b))))
    setEditingTeacher(null); event.currentTarget.reset(); setNotice('Datos del docente actualizados correctamente.'); setTab('teachers')
  }
  async function deleteTeacher(teacher) {
    if (!window.confirm(`¿Archivar el expediente de ${fullName(teacher)}? Se conservarán sus datos e historial.`)) return
    clearMessage(); const { error: deleteError } = await supabase.from('teachers').update({ deleted_at: new Date().toISOString(), deleted_by: session.user.id }).eq('id', teacher.id)
    if (deleteError) return setError(deleteError.message)
    setTeachers(previous => previous.filter(item => item.id !== teacher.id)); setSkills(previous => previous.filter(item => item.teacher_id !== teacher.id)); setNotice('Docente archivado correctamente.')
  }
  async function createSubject(event) {
    event.preventDefault(); clearMessage(); const form = new FormData(event.currentTarget)
    const { data, error: insertError } = await supabase.from('subjects').insert({ name: form.get('name').trim(), code: form.get('code').trim().toUpperCase(), weekly_hours: form.get('weekly_hours') ? Number(form.get('weekly_hours')) : null }).select().single()
    if (insertError) return setError(insertError.message)
    setSubjects(previous => [...previous, data].sort((a, b) => a.name.localeCompare(b.name))); event.currentTarget.reset(); setNotice('Materia creada.');
  }
  async function linkSubject(event) {
    event.preventDefault(); clearMessage(); const form = new FormData(event.currentTarget)
    const { data, error: insertError } = await supabase.from('teacher_subjects').insert({ teacher_id: form.get('teacher_id'), subject_id: form.get('subject_id') }).select().single()
    if (insertError) return setError(insertError.message)
    setSkills(previous => [...previous, data]); event.currentTarget.reset(); setNotice('Materia asignada al docente.');
  }
  async function assignLoad(event) {
    event.preventDefault(); clearMessage(); const form = new FormData(event.currentTarget)
    const { data, error: insertError } = await supabase.from('group_subjects').insert({ group_id: form.get('group_id'), subject_id: selectedSubject, teacher_id: form.get('teacher_id') }).select('*, teachers(first_names, paternal_surname, maternal_surname), subjects(name, code), school_groups(name, school_years(name), grades(name, education_levels(name)))').single()
    if (insertError) return setError(insertError.message)
    setAssignments(previous => [data, ...previous]); event.currentTarget.reset(); setSelectedSubject(''); setNotice('Carga académica asignada al grupo.');
  }
  async function createTeacherAccess(teacher) {
    if (!teacher.email) { setError('Agrega un correo electrónico al expediente del docente antes de crear su acceso.'); return }
    setError(''); setNotice(''); setCreatingAccessId(teacher.id)
    const { data, error: invokeError } = await supabase.functions.invoke('create-teacher-access', { body: { teacherId: teacher.id } })
    if (invokeError || data?.error) {
      const message = data?.error || invokeError?.message || 'No fue posible crear el acceso.'
      setError(message); window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message } }))
    } else {
      setNotice(data.message); window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: data.message } })); await load()
    }
    setCreatingAccessId(null)
  }
  const groupLabel = (group) => `${group.school_years?.name || ''} · ${group.grades?.education_levels?.name || ''} ${group.grades?.name || ''} ${group.name}`
  if (loading) return <main className="centered">Cargando docentes y carga académica…</main>
  return <><section className="page-heading"><p className="eyebrow">Fase 5</p><h2>Docentes y carga académica</h2><p>Define qué materias imparte cada docente y asígnalas a los grupos del ciclo escolar.</p></section>{error && <p className="error banner">{error}</p>}{notice && <p className="notice banner">{notice}</p>}
    <div className="module-tabs"><button className={tab === 'teachers' ? 'tab active-tab' : 'tab'} onClick={() => setTab('teachers')}>Docentes</button><button className={tab === 'subjects' ? 'tab active-tab' : 'tab'} onClick={() => setTab('subjects')}>Materias y especialidades</button><button className={tab === 'load' ? 'tab active-tab' : 'tab'} onClick={() => setTab('load')}>Carga académica</button></div>
    {tab === 'teachers' && <div className="teacher-layout"><section className="form-card"><h3>Nuevo docente</h3><form className="wide-form" onSubmit={createTeacher}><div className="form-row triple"><label>Nombres<input name="first_names" required /></label><label>Apellido paterno<input name="paternal_surname" required /></label><label>Apellido materno<input name="maternal_surname" /></label></div><div className="form-row triple"><label>Teléfono<input name="phone" required /></label><label>Correo<input name="email" type="email" /></label><label>Fecha de ingreso<input name="hire_date" type="date" /></label></div><div className="form-row triple"><label>CURP<input name="curp" maxLength="18" /></label><label>RFC<input name="rfc" maxLength="13" /></label><label>Estatus<SearchableSelect name="status" defaultValue="active">{Object.entries(teacherStatus).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</SearchableSelect></label></div><label>Domicilio<input name="address" /></label><label>Notas<textarea name="notes" rows="2" /></label><button>Guardar docente</button></form></section><TeacherList teachers={teachers} skills={skills} subjects={subjects} canCreateAccess={hasRole('superadmin')} creatingAccessId={creatingAccessId} onCreateAccess={createTeacherAccess} onEdit={(teacher) => { setEditingTeacher(teacher); setTab('edit-teacher') }} onDelete={deleteTeacher} /></div>}
    {tab === 'edit-teacher' && editingTeacher && <section className="form-card"><h3>Editar docente: {fullName(editingTeacher)}</h3><form className="wide-form" onSubmit={updateTeacher}><div className="form-row triple"><label>Nombres<input name="first_names" required defaultValue={editingTeacher.first_names} /></label><label>Apellido paterno<input name="paternal_surname" required defaultValue={editingTeacher.paternal_surname} /></label><label>Apellido materno<input name="maternal_surname" defaultValue={editingTeacher.maternal_surname || ''} /></label></div><div className="form-row triple"><label>Teléfono<input name="phone" required defaultValue={editingTeacher.phone} /></label><label>Correo<input name="email" type="email" defaultValue={editingTeacher.email || ''} /></label><label>Fecha de ingreso<input name="hire_date" type="date" defaultValue={editingTeacher.hire_date || ''} /></label></div><div className="form-row triple"><label>CURP<input name="curp" maxLength="18" defaultValue={editingTeacher.curp || ''} /></label><label>RFC<input name="rfc" maxLength="13" defaultValue={editingTeacher.rfc || ''} /></label><label>Estatus<SearchableSelect name="status" defaultValue={editingTeacher.status}>{Object.entries(teacherStatus).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</SearchableSelect></label></div><label>Domicilio<input name="address" defaultValue={editingTeacher.address || ''} /></label><label>Notas<textarea name="notes" rows="2" defaultValue={editingTeacher.notes || ''} /></label><div className="edit-actions"><button type="button" className="cancel-button" onClick={() => { setEditingTeacher(null); setTab('teachers') }}>Cancelar</button><button>Guardar cambios</button></div></form></section>}
    {tab === 'subjects' && <div className="teacher-layout"><section className="form-card"><h3>Nueva materia</h3><form className="wide-form" onSubmit={createSubject}><div className="form-row"><label>Nombre<input name="name" placeholder="Matemáticas" required /></label><label>Clave<input name="code" placeholder="MAT" required /></label></div><label>Horas semanales<input name="weekly_hours" type="number" min="1" /></label><button>Guardar materia</button></form><hr /><h3>Asignar materia a docente</h3><form className="wide-form" onSubmit={linkSubject}><label>Docente<SearchableSelect name="teacher_id" defaultValue="" required><option value="" disabled>Selecciona un docente</option>{teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{fullName(teacher)}</option>)}</SearchableSelect></label><label>Materia<SearchableSelect name="subject_id" defaultValue="" required><option value="" disabled>Selecciona una materia</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</SearchableSelect></label><button>Asignar especialidad</button></form></section><SubjectList subjects={subjects} teachers={teachers} skills={skills} /></div>}
    {tab === 'load' && <div className="teacher-layout"><section className="form-card"><h3>Asignar materia a grupo</h3><form className="wide-form" onSubmit={assignLoad}><label>Grupo<SearchableSelect name="group_id" defaultValue="" required><option value="" disabled>Selecciona un grupo</option>{groups.map(group => <option key={group.id} value={group.id}>{groupLabel(group)}</option>)}</SearchableSelect></label><label>Materia<SearchableSelect value={selectedSubject} onChange={event => setSelectedSubject(event.target.value)} required><option value="" disabled>Selecciona una materia</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</SearchableSelect></label><label>Docente habilitado para la materia<SearchableSelect name="teacher_id" defaultValue="" disabled={!selectedSubject} required><option value="" disabled>{selectedSubject ? 'Selecciona un docente' : 'Primero selecciona materia'}</option>{eligibleTeachers.map(teacher => <option key={teacher.id} value={teacher.id}>{fullName(teacher)}</option>)}</SearchableSelect></label>{selectedSubject && !eligibleTeachers.length ? <p className="error">Primero asigna esta materia a un docente.</p> : null}<button disabled={!selectedSubject || !eligibleTeachers.length}>Asignar carga</button></form></section><AssignmentList assignments={assignments} /></div>}
  </>
}

function TeacherList({ teachers, skills, subjects, canCreateAccess, creatingAccessId, onCreateAccess, onEdit, onDelete }) { return <section className="summary-card"><h3>Docentes registrados</h3><ul className="summary-list">{teachers.length ? teachers.map(teacher => <li key={teacher.id}><strong>{fullName(teacher)}</strong><span>{teacher.phone} · {teacherStatus[teacher.status]}</span><small>{skills.filter(skill => skill.teacher_id === teacher.id).map(skill => subjects.find(subject => subject.id === skill.subject_id)?.name).filter(Boolean).join(', ') || 'Sin materias asignadas'}</small><div className="teacher-row-actions"><button className="small-button" onClick={() => onEdit(teacher)}>Editar</button>{canCreateAccess && <button className="small-button teacher-access" disabled={creatingAccessId === teacher.id || Boolean(teacher.user_id)} onClick={() => onCreateAccess(teacher)}>{teacher.user_id ? 'Acceso vinculado' : creatingAccessId === teacher.id ? 'Creando acceso…' : 'Crear acceso'}</button>}<button className="danger-button" onClick={() => onDelete(teacher)}>Archivar</button></div></li>) : <li className="empty">Aún no hay docentes.</li>}</ul></section> }
function SubjectList({ subjects, teachers, skills }) { return <section className="summary-card"><h3>Materias</h3><ul className="summary-list">{subjects.length ? subjects.map(subject => <li key={subject.id}><strong>{subject.name} <small>· {subject.code}</small></strong><span>{subject.weekly_hours ? `${subject.weekly_hours} horas semanales` : 'Horas no definidas'}</span><small>{skills.filter(skill => skill.subject_id === subject.id).map(skill => fullName(teachers.find(teacher => teacher.id === skill.teacher_id))).filter(Boolean).join(', ') || 'Sin docente habilitado'}</small></li>) : <li className="empty">Aún no hay materias.</li>}</ul></section> }
function AssignmentList({ assignments }) { return <section className="summary-card"><h3>Carga asignada</h3><ul className="summary-list">{assignments.length ? assignments.map(item => <li key={item.id}><strong>{item.subjects?.name} · {fullName(item.teachers)}</strong><span>{item.school_groups?.school_years?.name} · {item.school_groups?.grades?.education_levels?.name} {item.school_groups?.grades?.name} {item.school_groups?.name}</span></li>) : <li className="empty">Aún no hay asignaciones.</li>}</ul></section> }

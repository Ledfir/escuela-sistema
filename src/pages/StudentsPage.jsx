import SearchableSelect from '../components/SearchableSelect'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './StudentsPage.css'
import './RecordActions.css'

const optional = (value) => value?.trim() || null
const studentName = (student) => [student.first_names, student.paternal_surname, student.maternal_surname].filter(Boolean).join(' ')
const guardianName = (guardian) => [guardian.first_names, guardian.paternal_surname, guardian.maternal_surname].filter(Boolean).join(' ')
const statusNames = { preinscribed: 'Preinscrito', enrolled: 'Inscrito', active: 'Activo', withdrawn: 'Baja', graduated: 'Egresado' }

export default function StudentsPage() {
  const { session } = useAuth()
  const [students, setStudents] = useState([]); const [guardians, setGuardians] = useState([])
  const [links, setLinks] = useState([]); const [documents, setDocuments] = useState([])
  const [selectedId, setSelectedId] = useState(null); const [editingStudent, setEditingStudent] = useState(null); const [tab, setTab] = useState('students')
  const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true)
  const [error, setError] = useState(''); const [notice, setNotice] = useState('')

  const selected = students.find(item => item.id === selectedId)
  const selectedLinks = links.filter(item => item.student_id === selectedId)
  const selectedDocuments = documents.filter(item => item.student_id === selectedId)
  const visibleStudents = useMemo(() => students.filter(item => studentName(item).toLocaleLowerCase().includes(search.toLocaleLowerCase()) || item.enrollment_number?.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [students, search])

  async function load(showLoader = false) {
    if (showLoader) setLoading(true); setError('')
    const [studentResult, guardianResult, linkResult, documentResult] = await Promise.all([
      supabase.from('students').select('*').is('deleted_at', null).order('paternal_surname'),
      supabase.from('guardians').select('*').order('paternal_surname'),
      supabase.from('student_guardians').select('*, guardians(*)'),
      supabase.from('student_documents').select('*').order('uploaded_at', { ascending: false })
    ])
    const issue = [studentResult, guardianResult, linkResult, documentResult].map(result => result.error).find(Boolean)
    if (issue) setError(issue.message)
    else { setStudents(studentResult.data); setGuardians(guardianResult.data); setLinks(linkResult.data); setDocuments(documentResult.data) }
    setLoading(false)
  }
  useEffect(() => { load(true) }, [])
  function resetMessage() { setError(''); setNotice('') }

  async function createStudent(event) {
    event.preventDefault(); resetMessage(); const form = new FormData(event.currentTarget)
    const payload = { enrollment_number: optional(form.get('enrollment_number')), first_names: form.get('first_names').trim(), paternal_surname: form.get('paternal_surname').trim(), maternal_surname: optional(form.get('maternal_surname')), birth_date: form.get('birth_date'), curp: optional(form.get('curp'))?.toUpperCase(), sex: form.get('sex'), status: form.get('status'), entry_date: form.get('entry_date') || null, address: optional(form.get('address')), medical_notes: optional(form.get('medical_notes')), allergies: optional(form.get('allergies')), emergency_contact_name: optional(form.get('emergency_contact_name')), emergency_contact_phone: optional(form.get('emergency_contact_phone')) }
    const { data, error: insertError } = await supabase.from('students').insert(payload).select().single()
    if (insertError) return setError(insertError.message)
    setStudents(previous => [...previous, data].sort((a, b) => studentName(a).localeCompare(studentName(b))))
    setSelectedId(data.id); event.currentTarget.reset(); setNotice('Alumno creado correctamente.'); setTab('students')
  }
  async function updateStudent(event) {
    event.preventDefault(); resetMessage(); const form = new FormData(event.currentTarget)
    const payload = { enrollment_number: optional(form.get('enrollment_number')), first_names: form.get('first_names').trim(), paternal_surname: form.get('paternal_surname').trim(), maternal_surname: optional(form.get('maternal_surname')), birth_date: form.get('birth_date'), curp: optional(form.get('curp'))?.toUpperCase(), sex: form.get('sex'), status: form.get('status'), entry_date: form.get('entry_date') || null, address: optional(form.get('address')), medical_notes: optional(form.get('medical_notes')), allergies: optional(form.get('allergies')), emergency_contact_name: optional(form.get('emergency_contact_name')), emergency_contact_phone: optional(form.get('emergency_contact_phone')) }
    const { data, error: updateError } = await supabase.from('students').update(payload).eq('id', editingStudent.id).select().single()
    if (updateError) return setError(updateError.message)
    setStudents(previous => previous.map(item => item.id === data.id ? data : item).sort((a, b) => studentName(a).localeCompare(studentName(b))))
    setSelectedId(data.id); setEditingStudent(null); event.currentTarget.reset(); setNotice('Alumno actualizado correctamente.'); setTab('students')
  }
  async function deleteStudent(student) {
    if (!window.confirm(`¿Archivar el expediente de ${studentName(student)}? Se conservarán sus datos e historial.`)) return
    resetMessage(); const { error: deleteError } = await supabase.from('students').update({ deleted_at: new Date().toISOString(), deleted_by: session.user.id }).eq('id', student.id)
    if (deleteError) return setError(deleteError.message)
    setStudents(previous => previous.filter(item => item.id !== student.id)); setLinks(previous => previous.filter(item => item.student_id !== student.id)); setDocuments(previous => previous.filter(item => item.student_id !== student.id)); setSelectedId(null); setNotice('Alumno archivado correctamente.')
  }
  async function createGuardian(event) {
    event.preventDefault(); resetMessage(); const form = new FormData(event.currentTarget)
    const payload = { first_names: form.get('first_names').trim(), paternal_surname: form.get('paternal_surname').trim(), maternal_surname: optional(form.get('maternal_surname')), curp: optional(form.get('curp'))?.toUpperCase(), email: optional(form.get('email')), phone: form.get('phone').trim(), alternate_phone: optional(form.get('alternate_phone')), address: optional(form.get('address')), occupation: optional(form.get('occupation')) }
    const { data, error: insertError } = await supabase.from('guardians').insert(payload).select().single()
    if (insertError) return setError(insertError.message)
    setGuardians(previous => [...previous, data].sort((a, b) => guardianName(a).localeCompare(guardianName(b))))
    event.currentTarget.reset(); setNotice('Tutor creado correctamente.'); setTab('links')
  }
  async function createLink(event) {
    event.preventDefault(); resetMessage(); const form = new FormData(event.currentTarget); const studentId = form.get('student_id'); const isPrimary = form.get('is_primary') === 'on'
    if (isPrimary) { const { error: primaryError } = await supabase.from('student_guardians').update({ is_primary: false }).eq('student_id', studentId).eq('is_primary', true); if (primaryError) return setError(primaryError.message) }
    const { data, error: insertError } = await supabase.from('student_guardians').insert({ student_id: studentId, guardian_id: form.get('guardian_id'), relationship: form.get('relationship'), is_primary: isPrimary, is_authorized_pickup: form.get('is_authorized_pickup') === 'on', receives_communications: form.get('receives_communications') === 'on' }).select('*, guardians(*)').single()
    if (insertError) return setError(insertError.message)
    setLinks(previous => [...previous.filter(item => !(isPrimary && item.student_id === studentId)), data])
    setSelectedId(studentId); event.currentTarget.reset(); setNotice('Tutor vinculado al alumno correctamente.'); setTab('students')
  }
  async function uploadDocument(event) {
    event.preventDefault(); resetMessage(); const form = new FormData(event.currentTarget); const file = form.get('file'); const studentId = form.get('student_id')
    if (!(file instanceof File) || file.size === 0) return setError('Selecciona un archivo antes de continuar.')
    if (file.size > 10485760) return setError('El archivo supera el límite de 10 MB.')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); const path = `${studentId}/${crypto.randomUUID()}-${safeName}`
    const { error: storageError } = await supabase.storage.from('student-documents').upload(path, file)
    if (storageError) return setError(storageError.message)
    const { data, error: insertError } = await supabase.from('student_documents').insert({ student_id: studentId, document_type: form.get('document_type'), file_name: file.name, storage_path: path, notes: optional(form.get('notes')), uploaded_by: session.user.id }).select().single()
    if (insertError) { await supabase.storage.from('student-documents').remove([path]); return setError(insertError.message) }
    setDocuments(previous => [data, ...previous]); setSelectedId(studentId); event.currentTarget.reset(); setNotice('Documento cargado correctamente.'); setTab('students')
  }
  async function openDocument(document) {
    resetMessage(); const { data, error: urlError } = await supabase.storage.from('student-documents').createSignedUrl(document.storage_path, 60)
    if (urlError) return setError(urlError.message)
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <main className="centered">Cargando expedientes…</main>
  return <><section className="page-heading"><p className="eyebrow">Fase 3</p><h2>Alumnos y expedientes</h2><p>Registra alumnos, tutores autorizados e integra los documentos de cada expediente.</p></section>
    {error && <p className="error banner">{error}</p>}{notice && <p className="notice banner">{notice}</p>}
    <div className="module-tabs"><button className={tab === 'students' ? 'tab active-tab' : 'tab'} onClick={() => setTab('students')}>Alumnos</button><button className={tab === 'new-student' ? 'tab active-tab' : 'tab'} onClick={() => setTab('new-student')}>Nuevo alumno</button><button className={tab === 'guardians' ? 'tab active-tab' : 'tab'} onClick={() => setTab('guardians')}>Nuevo tutor</button><button className={tab === 'links' ? 'tab active-tab' : 'tab'} onClick={() => setTab('links')}>Vínculos</button><button className={tab === 'documents' ? 'tab active-tab' : 'tab'} onClick={() => setTab('documents')}>Documentos</button></div>
    {tab === 'students' && <div className="records-layout"><section className="records-list"><input aria-label="Buscar alumno" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre o matrícula" />{visibleStudents.length ? visibleStudents.map(student => <button className={selectedId === student.id ? 'student-row selected-row' : 'student-row'} key={student.id} onClick={() => setSelectedId(student.id)}><strong>{studentName(student)}</strong><span>{student.enrollment_number || 'Sin matrícula'} · {statusNames[student.status]}</span></button>) : <p className="empty">Aún no hay alumnos.</p>}</section><StudentDetails student={selected} links={selectedLinks} documents={selectedDocuments} onOpenDocument={openDocument} onEdit={(student) => { setEditingStudent(student); setTab('edit-student') }} onDelete={deleteStudent} /></div>}
    {tab === 'new-student' && <FormCard title="Nuevo alumno"><form className="wide-form" onSubmit={createStudent}><div className="form-row triple"><label>Nombres<input name="first_names" required /></label><label>Apellido paterno<input name="paternal_surname" required /></label><label>Apellido materno<input name="maternal_surname" /></label></div><div className="form-row triple"><label>Matrícula<input name="enrollment_number" placeholder="Opcional" /></label><label>Fecha de nacimiento<input name="birth_date" type="date" required /></label><label>CURP<input name="curp" maxLength="18" /></label></div><div className="form-row triple"><label>Sexo<SearchableSelect name="sex" defaultValue="unspecified"><option value="unspecified">Sin especificar</option><option value="female">Femenino</option><option value="male">Masculino</option></SearchableSelect></label><label>Estatus<SearchableSelect name="status" defaultValue="preinscribed">{Object.entries(statusNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</SearchableSelect></label><label>Fecha de ingreso<input name="entry_date" type="date" /></label></div><label>Domicilio<textarea name="address" rows="2" /></label><div className="form-row"><label>Alergias<textarea name="allergies" rows="2" /></label><label>Información médica<textarea name="medical_notes" rows="2" /></label></div><div className="form-row"><label>Contacto de emergencia<input name="emergency_contact_name" /></label><label>Teléfono de emergencia<input name="emergency_contact_phone" /></label></div><button>Guardar alumno</button></form></FormCard>}
    {tab === 'edit-student' && editingStudent && <FormCard title={`Editar alumno: ${studentName(editingStudent)}`}><form className="wide-form" onSubmit={updateStudent}><div className="form-row triple"><label>Nombres<input name="first_names" required defaultValue={editingStudent.first_names} /></label><label>Apellido paterno<input name="paternal_surname" required defaultValue={editingStudent.paternal_surname} /></label><label>Apellido materno<input name="maternal_surname" defaultValue={editingStudent.maternal_surname || ''} /></label></div><div className="form-row triple"><label>Matrícula<input name="enrollment_number" defaultValue={editingStudent.enrollment_number || ''} /></label><label>Fecha de nacimiento<input name="birth_date" type="date" required defaultValue={editingStudent.birth_date} /></label><label>CURP<input name="curp" maxLength="18" defaultValue={editingStudent.curp || ''} /></label></div><div className="form-row triple"><label>Sexo<SearchableSelect name="sex" defaultValue={editingStudent.sex}><option value="unspecified">Sin especificar</option><option value="female">Femenino</option><option value="male">Masculino</option></SearchableSelect></label><label>Estatus<SearchableSelect name="status" defaultValue={editingStudent.status}>{Object.entries(statusNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</SearchableSelect></label><label>Fecha de ingreso<input name="entry_date" type="date" defaultValue={editingStudent.entry_date || ''} /></label></div><label>Domicilio<textarea name="address" rows="2" defaultValue={editingStudent.address || ''} /></label><div className="form-row"><label>Alergias<textarea name="allergies" rows="2" defaultValue={editingStudent.allergies || ''} /></label><label>Información médica<textarea name="medical_notes" rows="2" defaultValue={editingStudent.medical_notes || ''} /></label></div><div className="form-row"><label>Contacto de emergencia<input name="emergency_contact_name" defaultValue={editingStudent.emergency_contact_name || ''} /></label><label>Teléfono de emergencia<input name="emergency_contact_phone" defaultValue={editingStudent.emergency_contact_phone || ''} /></label></div><div className="edit-actions"><button type="button" className="cancel-button" onClick={() => { setEditingStudent(null); setTab('students') }}>Cancelar</button><button>Guardar cambios</button></div></form></FormCard>}
    {tab === 'guardians' && <FormCard title="Nuevo tutor"><form className="wide-form" onSubmit={createGuardian}><div className="form-row triple"><label>Nombres<input name="first_names" required /></label><label>Apellido paterno<input name="paternal_surname" required /></label><label>Apellido materno<input name="maternal_surname" /></label></div><div className="form-row triple"><label>Teléfono<input name="phone" required /></label><label>Teléfono alterno<input name="alternate_phone" /></label><label>Correo<input name="email" type="email" /></label></div><div className="form-row triple"><label>CURP<input name="curp" maxLength="18" /></label><label>Ocupación<input name="occupation" /></label><label>Domicilio<input name="address" /></label></div><button>Guardar tutor</button></form></FormCard>}
    {tab === 'links' && <FormCard title="Vincular tutor con alumno"><form className="wide-form" onSubmit={createLink}><div className="form-row"><label>Alumno<SearchableSelect name="student_id" defaultValue={selectedId || ''} required><option value="" disabled>Selecciona un alumno</option>{students.map(student => <option key={student.id} value={student.id}>{studentName(student)}</option>)}</SearchableSelect></label><label>Tutor<SearchableSelect name="guardian_id" required defaultValue=""><option value="" disabled>Selecciona un tutor</option>{guardians.map(guardian => <option key={guardian.id} value={guardian.id}>{guardianName(guardian)}</option>)}</SearchableSelect></label></div><label>Parentesco<input name="relationship" placeholder="Madre, padre, abuelo, tutor legal…" required /></label><div className="check-grid"><label className="check"><input name="is_primary" type="checkbox" /> Tutor principal</label><label className="check"><input name="is_authorized_pickup" type="checkbox" defaultChecked /> Autorizado para recoger</label><label className="check"><input name="receives_communications" type="checkbox" defaultChecked /> Recibe comunicados</label></div><button>Vincular tutor</button></form></FormCard>}
    {tab === 'documents' && <FormCard title="Agregar documento al expediente"><form className="wide-form" onSubmit={uploadDocument}><div className="form-row"><label>Alumno<SearchableSelect name="student_id" defaultValue={selectedId || ''} required><option value="" disabled>Selecciona un alumno</option>{students.map(student => <option key={student.id} value={student.id}>{studentName(student)}</option>)}</SearchableSelect></label><label>Tipo de documento<SearchableSelect name="document_type" defaultValue="Acta de nacimiento"><option>Acta de nacimiento</option><option>CURP</option><option>Comprobante de domicilio</option><option>INE del tutor</option><option>Fotografía</option><option>Certificado</option><option>Otro</option></SearchableSelect></label></div><label>Archivo (máximo 10 MB)<input name="file" type="file" required /></label><label>Notas<textarea name="notes" rows="2" /></label><button>Subir documento</button></form></FormCard>}
  </>
}

function StudentDetails({ student, links, documents, onOpenDocument, onEdit, onDelete }) { if (!student) return <section className="details-panel empty"><p>Selecciona un alumno para ver su expediente.</p></section>; return <section className="details-panel"><div className="details-title"><div><p className="eyebrow">Expediente</p><h3>{studentName(student)}</h3></div><div className="record-actions"><span className="status-pill">{statusNames[student.status]}</span><button className="small-button" onClick={() => onEdit(student)}>Editar</button><button className="danger-button" onClick={() => onDelete(student)}>Archivar</button></div></div><dl className="details-grid"><div><dt>Matrícula</dt><dd>{student.enrollment_number || 'Pendiente'}</dd></div><div><dt>CURP</dt><dd>{student.curp || 'No registrada'}</dd></div><div><dt>Nacimiento</dt><dd>{student.birth_date}</dd></div><div><dt>Emergencia</dt><dd>{student.emergency_contact_name || 'No registrado'}{student.emergency_contact_phone ? ` · ${student.emergency_contact_phone}` : ''}</dd></div></dl><h4>Tutores vinculados</h4>{links.length ? <ul className="detail-list">{links.map(link => <li key={link.guardian_id}><strong>{guardianName(link.guardians)}</strong><span>{link.relationship}{link.is_primary ? ' · Principal' : ''}{link.is_authorized_pickup ? ' · Autorizado' : ''}</span></li>)}</ul> : <p className="empty">Sin tutores vinculados.</p>}<h4>Documentos</h4>{documents.length ? <ul className="detail-list">{documents.map(document => <li key={document.id}><span><strong>{document.document_type}</strong><span>{document.file_name}</span></span><button className="small-button" onClick={() => onOpenDocument(document)}>Abrir</button></li>)}</ul> : <p className="empty">Sin documentos.</p>}</section> }
function FormCard({ title, children }) { return <section className="form-card"><h3>{title}</h3>{children}</section> }

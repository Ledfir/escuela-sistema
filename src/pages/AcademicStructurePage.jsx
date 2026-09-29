import SearchableSelect from '../components/SearchableSelect'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const emptyData = { years: [], levels: [], grades: [], groups: [] }
const asNumberOrNull = (value) => value === '' ? null : Number(value)

export default function AcademicStructurePage() {
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load(showLoader = false) {
    if (showLoader) setLoading(true)
    setError('')
    const [years, levels, grades, groups] = await Promise.all([
      supabase.from('school_years').select('*').order('starts_on', { ascending: false }),
      supabase.from('education_levels').select('*').order('sort_order'),
      supabase.from('grades').select('*, education_levels(name)').order('sort_order'),
      supabase.from('school_groups').select('*, school_years(name), grades(name, education_levels(name))').order('name')
    ])
    const issue = [years, levels, grades, groups].map(item => item.error).find(Boolean)
    if (issue) setError(issue.message)
    else setData({ years: years.data, levels: levels.data, grades: grades.data, groups: groups.data })
    setLoading(false)
  }
  useEffect(() => { load(true) }, [])

  async function addYear(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError(''); setMessage('')
    const isCurrent = form.get('is_current') === 'on'
    if (isCurrent) await supabase.from('school_years').update({ is_current: false }).eq('is_current', true)
    const { data: created, error: insertError } = await supabase.from('school_years').insert({ name: form.get('name'), starts_on: form.get('starts_on'), ends_on: form.get('ends_on'), is_current: isCurrent }).select().single()
    if (insertError) return setError(insertError.message)
    setData(prev => ({ ...prev, years: [created, ...prev.years.map(year => isCurrent ? { ...year, is_current: false } : year)] }))
    event.currentTarget.reset(); setMessage('Ciclo escolar creado.'); await load()
  }
  async function addLevel(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError(''); setMessage('')
    const { data: created, error: insertError } = await supabase.from('education_levels').insert({ name: form.get('name'), code: form.get('code').toUpperCase(), sort_order: Number(form.get('sort_order')) }).select().single()
    if (insertError) return setError(insertError.message)
    setData(prev => ({ ...prev, levels: [...prev.levels, created].sort((a, b) => a.sort_order - b.sort_order) }))
    event.currentTarget.reset(); setMessage('Nivel educativo creado.'); await load()
  }
  async function addGrade(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError(''); setMessage('')
    const level = data.levels.find(item => item.id === form.get('education_level_id'))
    const { data: created, error: insertError } = await supabase.from('grades').insert({ education_level_id: form.get('education_level_id'), name: form.get('name'), sort_order: Number(form.get('sort_order')) }).select().single()
    if (insertError) return setError(insertError.message)
    setData(prev => ({ ...prev, grades: [...prev.grades, { ...created, education_levels: level }].sort((a, b) => a.sort_order - b.sort_order) }))
    event.currentTarget.reset(); setMessage('Grado creado.'); await load()
  }
  async function addGroup(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError(''); setMessage('')
    const schoolYear = data.years.find(item => item.id === form.get('school_year_id'))
    const grade = data.grades.find(item => item.id === form.get('grade_id'))
    const { data: created, error: insertError } = await supabase.from('school_groups').insert({ school_year_id: form.get('school_year_id'), grade_id: form.get('grade_id'), name: form.get('name'), capacity: asNumberOrNull(form.get('capacity')) }).select().single()
    if (insertError) return setError(insertError.message)
    setData(prev => ({ ...prev, groups: [...prev.groups, { ...created, school_years: schoolYear, grades: grade }].sort((a, b) => a.name.localeCompare(b.name)) }))
    event.currentTarget.reset(); setMessage('Grupo creado.'); await load()
  }
  async function remove(table, id, label) {
    if (!window.confirm(`¿Eliminar ${label}? Esta acción sólo funcionará si no hay información relacionada.`)) return
    setError(''); setMessage('')
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) return setError(deleteError.message)
    setMessage('Registro eliminado.'); await load()
  }

  if (loading) return <main className="centered">Cargando estructura académica…</main>
  return <><section className="page-heading"><div><p className="eyebrow">Fase 2</p><h2>Estructura académica</h2><p>Define el ciclo y la jerarquía nivel → grado → grupo antes de inscribir alumnos.</p></div></section>
    {error && <p className="error banner">{error}</p>}{message && <p className="notice banner">{message}</p>}
    <section className="setup-grid">
      <CatalogCard title="Ciclos escolares" description="Cada inscripción pertenecerá a un ciclo." form={<form onSubmit={addYear}><label>Nombre<input name="name" placeholder="2026–2027" required /></label><div className="form-row"><label>Inicio<input name="starts_on" type="date" required /></label><label>Fin<input name="ends_on" type="date" required /></label></div><label className="check"><input name="is_current" type="checkbox" /> Ciclo actual</label><button>Agregar ciclo</button></form>} items={data.years.map(y => <li key={y.id}><span><strong>{y.name}</strong><small>{y.starts_on} — {y.ends_on}{y.is_current ? ' · Actual' : ''}</small></span><Remove onClick={() => remove('school_years', y.id, `el ciclo ${y.name}`)} /></li>)} />
      <CatalogCard title="Niveles educativos" description="Se cargaron los cuatro niveles iniciales." form={<form onSubmit={addLevel}><label>Nombre<input name="name" placeholder="Bachillerato" required /></label><div className="form-row"><label>Clave<input name="code" placeholder="BACH" required /></label><label>Orden<input name="sort_order" type="number" min="1" required /></label></div><button>Agregar nivel</button></form>} items={data.levels.map(l => <li key={l.id}><span><strong>{l.name}</strong><small>{l.code} · orden {l.sort_order}</small></span><Remove onClick={() => remove('education_levels', l.id, `el nivel ${l.name}`)} /></li>)} />
      <CatalogCard title="Grados" description="Los grados pertenecen a un nivel." form={<form onSubmit={addGrade}><label>Nivel<SearchableSelect name="education_level_id" required defaultValue=""><option value="" disabled>Selecciona un nivel</option>{data.levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</SearchableSelect></label><div className="form-row"><label>Nombre<input name="name" placeholder="4° de primaria" required /></label><label>Orden<input name="sort_order" type="number" min="1" required /></label></div><button>Agregar grado</button></form>} items={data.grades.map(g => <li key={g.id}><span><strong>{g.name}</strong><small>{g.education_levels?.name} · orden {g.sort_order}</small></span><Remove onClick={() => remove('grades', g.id, `el grado ${g.name}`)} /></li>)} />
      <CatalogCard title="Grupos" description="Los grupos se crean para cada ciclo y grado." form={<form onSubmit={addGroup}><div className="form-row"><label>Ciclo<SearchableSelect name="school_year_id" required defaultValue=""><option value="" disabled>Selecciona</option>{data.years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</SearchableSelect></label><label>Grado<SearchableSelect name="grade_id" required defaultValue=""><option value="" disabled>Selecciona</option>{data.grades.map(g => <option key={g.id} value={g.id}>{g.education_levels?.name} · {g.name}</option>)}</SearchableSelect></label></div><div className="form-row"><label>Nombre<input name="name" placeholder="A" required /></label><label>Cupo<input name="capacity" type="number" min="1" placeholder="30" /></label></div><button>Agregar grupo</button></form>} items={data.groups.map(g => <li key={g.id}><span><strong>{g.grades?.education_levels?.name} · {g.grades?.name} {g.name}</strong><small>{g.school_years?.name}{g.capacity ? ` · cupo ${g.capacity}` : ''}</small></span><Remove onClick={() => remove('school_groups', g.id, `el grupo ${g.name}`)} /></li>)} />
    </section>
  </>
}

function CatalogCard({ title, description, form, items }) { return <article className="catalog-card"><header><h3>{title}</h3><p>{description}</p></header>{form}<ul className="catalog-list">{items.length ? items : <li className="empty">Aún no hay registros.</li>}</ul></article> }
function Remove({ onClick }) { return <button type="button" className="danger-button" onClick={onClick}>Eliminar</button> }

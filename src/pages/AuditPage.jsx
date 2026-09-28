import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './AuditPage.css'

const labels = { INSERT: 'Creación', UPDATE: 'Actualización', DELETE: 'Eliminación' }
export default function AuditPage() {
  const [logs, setLogs] = useState([]); const [filter, setFilter] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [openId, setOpenId] = useState(null)
  useEffect(() => { (async () => { const { data, error: queryError } = await supabase.from('audit_logs').select('*').order('occurred_at', { ascending: false }).limit(200); if (queryError) setError(queryError.message); else setLogs(data); setLoading(false) })() }, [])
  const filtered = useMemo(() => logs.filter(log => !filter || log.table_name.toLowerCase().includes(filter.toLowerCase()) || log.action.toLowerCase().includes(filter.toLowerCase())), [logs, filter])
  if (loading) return <main className="centered">Cargando bitácora…</main>
  return <><section className="page-heading"><p className="eyebrow">Fase 12</p><h2>Auditoría y seguridad</h2><p>Bitácora de los últimos 200 cambios críticos. Disponible únicamente para Superadministrador.</p></section>{error && <p className="error banner">{error}</p>}<section className="audit-card"><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filtrar por tabla o acción" aria-label="Filtrar auditoría" /><div className="audit-list">{filtered.length ? filtered.map(log => <article key={log.id} className="audit-row"><div><span className={`audit-action ${log.action.toLowerCase()}`}>{labels[log.action]}</span><strong>{log.table_name.replace('public.','')}</strong><small>{new Date(log.occurred_at).toLocaleString('es-MX')} · {log.actor_user_id || 'Sistema / SQL Editor'}</small></div><button className="small-button" onClick={() => setOpenId(openId === log.id ? null : log.id)}>{openId === log.id ? 'Ocultar' : 'Ver detalle'}</button>{openId === log.id && <pre>{JSON.stringify({ anterior: log.old_data, nuevo: log.new_data }, null, 2)}</pre>}</article>) : <p className="empty">No hay cambios que coincidan.</p>}</div></section></>
}

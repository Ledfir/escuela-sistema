import SearchableSelect from '../components/SearchableSelect'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './FinancePage.css'

const nameOf = (student) => [student?.first_names, student?.paternal_surname, student?.maternal_surname].filter(Boolean).join(' ')
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const chargeStatus = { pending: 'Pendiente', partial: 'Parcial', paid: 'Pagado', cancelled: 'Cancelado' }
const methodNames = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', deposit: 'Depósito', other: 'Otro' }
const balanceOf = (charge) => Number(charge.amount) - Number(charge.discount_amount) + Number(charge.surcharge_amount) - Number(charge.paid_amount)

export default function FinancePage() {
  const { session } = useAuth()
  const [students, setStudents] = useState([]); const [concepts, setConcepts] = useState([]); const [scholarships, setScholarships] = useState([]); const [charges, setCharges] = useState([]); const [payments, setPayments] = useState([])
  const [tab, setTab] = useState('charges'); const [conceptId, setConceptId] = useState(''); const [chargeAmount, setChargeAmount] = useState(''); const [paymentChargeId, setPaymentChargeId] = useState('')
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const paymentCharge = charges.find(item => item.id === paymentChargeId)
  const openCharges = useMemo(() => charges.filter(item => !['paid', 'cancelled'].includes(item.status)), [charges])

  async function load(showLoader = false) {
    if (showLoader) setLoading(true); setError('')
    const [studentResult, conceptResult, scholarshipResult, chargeResult, paymentResult] = await Promise.all([
      supabase.from('students').select('*').order('paternal_surname'),
      supabase.from('billing_concepts').select('*').order('name'),
      supabase.from('student_scholarships').select('*, students(first_names, paternal_surname, maternal_surname)').order('created_at', { ascending: false }),
      supabase.from('student_charges').select('*, students(first_names, paternal_surname, maternal_surname), billing_concepts(name, code)').order('due_date', { ascending: false }),
      supabase.from('payments').select('*, students(first_names, paternal_surname, maternal_surname), student_charges(billing_concepts(name))').order('paid_on', { ascending: false })
    ])
    const issue = [studentResult, conceptResult, scholarshipResult, chargeResult, paymentResult].map(result => result.error).find(Boolean)
    if (issue) setError(issue.message)
    else { setStudents(studentResult.data); setConcepts(conceptResult.data); setScholarships(scholarshipResult.data); setCharges(chargeResult.data); setPayments(paymentResult.data) }
    setLoading(false)
  }
  useEffect(() => { void load(true) }, [])
  const resetMessage = () => { setError(''); setNotice('') }
  async function createConcept(event) {
    event.preventDefault(); resetMessage(); const form = new FormData(event.currentTarget)
    const { data, error: insertError } = await supabase.from('billing_concepts').insert({ name: form.get('name').trim(), code: form.get('code').trim().toUpperCase(), default_amount: form.get('default_amount') || null, frequency: form.get('frequency') }).select().single()
    if (insertError) return setError(insertError.message)
    setConcepts(previous => [...previous, data].sort((a, b) => a.name.localeCompare(b.name))); event.currentTarget.reset(); setNotice('Concepto de cobro creado.')
  }
  async function createScholarship(event) {
    event.preventDefault(); resetMessage(); const form = new FormData(event.currentTarget); const percentage = form.get('percentage'); const fixed = form.get('fixed_amount')
    if (!percentage && !fixed) return setError('Indica un porcentaje o monto fijo.')
    const { data, error: insertError } = await supabase.from('student_scholarships').insert({ student_id: form.get('student_id'), name: form.get('name').trim(), percentage: percentage || null, fixed_amount: fixed || null, starts_on: form.get('starts_on') || null, ends_on: form.get('ends_on') || null, notes: form.get('notes').trim() || null }).select('*, students(first_names, paternal_surname, maternal_surname)').single()
    if (insertError) return setError(insertError.message)
    setScholarships(previous => [data, ...previous]); event.currentTarget.reset(); setNotice('Beca o descuento registrado.')
  }
  async function createCharge(event) {
    event.preventDefault(); resetMessage(); const form = new FormData(event.currentTarget)
    const { data, error: insertError } = await supabase.from('student_charges').insert({ student_id: form.get('student_id'), billing_concept_id: conceptId, due_date: form.get('due_date'), amount: Number(chargeAmount), discount_amount: Number(form.get('discount_amount') || 0), surcharge_amount: Number(form.get('surcharge_amount') || 0), notes: form.get('notes').trim() || null, created_by: session.user.id }).select('*, students(first_names, paternal_surname, maternal_surname), billing_concepts(name, code)').single()
    if (insertError) return setError(insertError.message)
    setCharges(previous => [data, ...previous]); event.currentTarget.reset(); setConceptId(''); setChargeAmount(''); setNotice('Cargo creado correctamente.')
  }
  async function createPayment(event) {
    event.preventDefault(); resetMessage(); const form = new FormData(event.currentTarget); if (!paymentCharge) return
    const amount = Number(form.get('amount')); if (amount > balanceOf(paymentCharge)) return setError('El pago no puede superar el saldo pendiente.')
    const { error: insertError } = await supabase.from('payments').insert({ student_charge_id: paymentCharge.id, student_id: paymentCharge.student_id, paid_on: form.get('paid_on'), amount, method: form.get('method'), reference: form.get('reference').trim() || null, notes: form.get('notes').trim() || null, received_by: session.user.id })
    if (insertError) return setError(insertError.message)
    event.currentTarget.reset(); setPaymentChargeId(''); setNotice('Pago registrado y saldo actualizado.'); await load()
  }
  function chooseConcept(value) { setConceptId(value); setChargeAmount(value ? String(concepts.find(item => item.id === value)?.default_amount ?? '') : '') }
  if (loading) return <main className="centered">Cargando finanzas…</main>
  return <><section className="page-heading"><p className="eyebrow">Fase 8</p><h2>Finanzas y colegiaturas</h2><p>Administra conceptos, cargos individuales, pagos y becas.</p></section>{error && <p className="error banner">{error}</p>}{notice && <p className="notice banner">{notice}</p>}
    <div className="module-tabs"><button className={tab === 'charges' ? 'tab active-tab' : 'tab'} onClick={() => setTab('charges')}>Cargos</button><button className={tab === 'payments' ? 'tab active-tab' : 'tab'} onClick={() => setTab('payments')}>Pagos</button><button className={tab === 'scholarships' ? 'tab active-tab' : 'tab'} onClick={() => setTab('scholarships')}>Becas y descuentos</button><button className={tab === 'concepts' ? 'tab active-tab' : 'tab'} onClick={() => setTab('concepts')}>Conceptos</button></div>
    {tab === 'concepts' && <div className="finance-grid"><section className="form-card"><h3>Nuevo concepto</h3><form className="wide-form" onSubmit={createConcept}><div className="form-row"><label>Nombre<input name="name" placeholder="Colegiatura" required /></label><label>Clave<input name="code" placeholder="COL" required /></label></div><div className="form-row"><label>Monto predeterminado<input name="default_amount" type="number" min="0" step="0.01" /></label><label>Frecuencia<SearchableSelect name="frequency" defaultValue="monthly"><option value="monthly">Mensual</option><option value="one_time">Único</option><option value="annual">Anual</option><option value="other">Otro</option></SearchableSelect></label></div><button>Guardar concepto</button></form></section><ConceptList concepts={concepts} /></div>}
    {tab === 'scholarships' && <div className="finance-grid"><section className="form-card"><h3>Nueva beca o descuento</h3><form className="wide-form" onSubmit={createScholarship}><label>Alumno<SearchableSelect name="student_id" required defaultValue=""><option value="" disabled>Selecciona un alumno</option>{students.map(student => <option key={student.id} value={student.id}>{nameOf(student)}</option>)}</SearchableSelect></label><label>Nombre<input name="name" placeholder="Beca de excelencia" required /></label><div className="form-row"><label>Porcentaje<input name="percentage" type="number" min="0.01" max="100" step="0.01" /></label><label>Monto fijo<input name="fixed_amount" type="number" min="0.01" step="0.01" /></label></div><div className="form-row"><label>Inicio<input name="starts_on" type="date" /></label><label>Fin<input name="ends_on" type="date" /></label></div><label>Notas<textarea name="notes" rows="2" /></label><button>Guardar beca</button></form></section><ScholarshipList scholarships={scholarships} /></div>}
    {tab === 'charges' && <div className="finance-grid"><section className="form-card"><h3>Nuevo cargo</h3><form className="wide-form" onSubmit={createCharge}><label>Alumno<SearchableSelect name="student_id" required defaultValue=""><option value="" disabled>Selecciona un alumno</option>{students.map(student => <option key={student.id} value={student.id}>{nameOf(student)}</option>)}</SearchableSelect></label><label>Concepto<SearchableSelect value={conceptId} onChange={event => chooseConcept(event.target.value)} required><option value="" disabled>Selecciona un concepto</option>{concepts.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</SearchableSelect></label><div className="form-row"><label>Vencimiento<input name="due_date" type="date" required /></label><label>Monto<input value={chargeAmount} onChange={event => setChargeAmount(event.target.value)} type="number" min="0" step="0.01" required /></label></div><div className="form-row"><label>Descuento aplicado<input name="discount_amount" type="number" min="0" step="0.01" defaultValue="0" /></label><label>Recargo<input name="surcharge_amount" type="number" min="0" step="0.01" defaultValue="0" /></label></div><label>Notas<textarea name="notes" rows="2" /></label><button disabled={!conceptId || !chargeAmount}>Crear cargo</button></form></section><ChargeList charges={charges} /></div>}
    {tab === 'payments' && <div className="finance-grid"><section className="form-card"><h3>Registrar pago</h3><form className="wide-form" onSubmit={createPayment}><label>Cargo pendiente<SearchableSelect value={paymentChargeId} onChange={event => setPaymentChargeId(event.target.value)} required><option value="" disabled>Selecciona un cargo</option>{openCharges.map(charge => <option key={charge.id} value={charge.id}>{nameOf(charge.students)} · {charge.billing_concepts?.name} · saldo {money.format(balanceOf(charge))}</option>)}</SearchableSelect></label>{paymentCharge && <p className="finance-balance">Saldo pendiente: <strong>{money.format(balanceOf(paymentCharge))}</strong></p>}<div className="form-row"><label>Fecha<input name="paid_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Monto<input name="amount" type="number" min="0.01" max={paymentCharge ? balanceOf(paymentCharge) : undefined} step="0.01" required /></label></div><div className="form-row"><label>Método<SearchableSelect name="method" defaultValue="cash">{Object.entries(methodNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</SearchableSelect></label><label>Referencia<input name="reference" placeholder="Folio o referencia" /></label></div><label>Notas<textarea name="notes" rows="2" /></label><button disabled={!paymentChargeId}>Registrar pago</button></form></section><PaymentList payments={payments} /></div>}
  </>
}
function ConceptList({ concepts }) { return <section className="summary-card"><h3>Conceptos</h3><ul className="summary-list">{concepts.length ? concepts.map(item => <li key={item.id}><strong>{item.name} · {item.code}</strong><span>{item.default_amount == null ? 'Monto variable' : money.format(item.default_amount)} · {item.frequency}</span></li>) : <li className="empty">Aún no hay conceptos.</li>}</ul></section> }
function ScholarshipList({ scholarships }) { return <section className="summary-card"><h3>Becas registradas</h3><ul className="summary-list">{scholarships.length ? scholarships.map(item => <li key={item.id}><strong>{nameOf(item.students)} · {item.name}</strong><span>{item.percentage ? `${item.percentage}%` : money.format(item.fixed_amount)}{item.is_active ? ' · Activa' : ''}</span></li>) : <li className="empty">Aún no hay becas.</li>}</ul></section> }
function ChargeList({ charges }) { return <section className="summary-card"><h3>Cargos recientes</h3><ul className="summary-list">{charges.length ? charges.map(item => <li key={item.id}><strong>{nameOf(item.students)} · {item.billing_concepts?.name}</strong><span>Vence: {item.due_date} · {chargeStatus[item.status]}</span><small>Total {money.format(Number(item.amount) - Number(item.discount_amount) + Number(item.surcharge_amount))} · saldo {money.format(balanceOf(item))}</small></li>) : <li className="empty">Aún no hay cargos.</li>}</ul></section> }
function PaymentList({ payments }) { return <section className="summary-card"><h3>Pagos recientes</h3><ul className="summary-list">{payments.length ? payments.map(item => <li key={item.id}><strong>{nameOf(item.students)} · {money.format(item.amount)}</strong><span>{item.student_charges?.billing_concepts?.name} · {methodNames[item.method]} · {item.paid_on}</span><small>{item.reference || 'Sin referencia'}</small></li>) : <li className="empty">Aún no hay pagos.</li>}</ul></section> }

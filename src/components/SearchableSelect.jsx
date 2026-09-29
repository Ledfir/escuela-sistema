import { Children, useEffect, useMemo, useRef, useState } from 'react'
import './SearchableSelect.css'

export default function SearchableSelect({ children, name, value, defaultValue = '', onChange, disabled, required, placeholder = 'Buscar o seleccionar…', className = '' }) {
  const options = useMemo(() => Children.toArray(children).filter((child) => child?.type === 'option').map((child) => ({ value: String(child.props.value ?? ''), label: String(child.props.children ?? ''), disabled: child.props.disabled })), [children])
  const controlled = value !== undefined
  const [selected, setSelected] = useState(String(controlled ? value : defaultValue))
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const actual = String(controlled ? value : selected)
  const selectedOption = options.find((option) => option.value === actual)
  const filtered = options.filter((option) => !option.disabled && option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))

  useEffect(() => { if (controlled) setSelected(String(value ?? '')) }, [controlled, value])
  useEffect(() => { const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }; document.addEventListener('mousedown', outside); return () => document.removeEventListener('mousedown', outside) }, [])
  useEffect(() => { const form = root.current?.closest('form'); const reset = () => { if (!controlled) setSelected(String(defaultValue)); setQuery(''); setOpen(false) }; form?.addEventListener('reset', reset); return () => form?.removeEventListener('reset', reset) }, [controlled, defaultValue])
  function choose(next) { if (!controlled) setSelected(next); onChange?.({ target: { value: next } }); setQuery(''); setOpen(false) }
  return <div className={`searchable-select ${className}`} ref={root}>
    {name && <input type="hidden" name={name} value={actual} />}
    <input aria-label={placeholder} className="searchable-input" value={open ? query : (selectedOption?.label || '')} placeholder={placeholder} required={required} disabled={disabled} onFocus={() => { setOpen(true); setQuery('') }} onChange={(event) => { setOpen(true); setQuery(event.target.value) }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && filtered[0]) { event.preventDefault(); choose(filtered[0].value) } }} />
    <button type="button" className="searchable-arrow" disabled={disabled} onClick={() => { setOpen(!open); setQuery('') }}>⌄</button>
    {open && <div className="searchable-menu">{filtered.length ? filtered.map((option) => <button type="button" key={option.value} onClick={() => choose(option.value)} className={option.value === actual ? 'selected-option' : ''}>{option.label}</button>) : <p>Sin resultados</p>}</div>}
  </div>
}

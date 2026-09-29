import { useEffect, useState } from 'react'
import './GlobalToast.css'

export default function GlobalToast() {
  const [toasts, setToasts] = useState([])
  useEffect(() => {
    const show = (event) => {
      const toast = { id: crypto.randomUUID(), type: event.detail?.type || 'success', message: event.detail?.message || 'Operación completada.' }
      if (event.detail?.resetForm && window.__lastSubmittedForm?.isConnected) {
        window.__lastSubmittedForm.reset()
        window.__lastSubmittedForm = null
      }
      setToasts((current) => [...current.slice(-3), toast])
      window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 4500)
    }
    const rememberForm = (event) => { if (event.target instanceof HTMLFormElement) window.__lastSubmittedForm = event.target }
    window.addEventListener('app:toast', show)
    document.addEventListener('submit', rememberForm, true)
    return () => { window.removeEventListener('app:toast', show); document.removeEventListener('submit', rememberForm, true) }
  }, [])
  return <aside className="global-toasts" aria-live="polite">{toasts.map((toast) => <div className={`global-toast global-toast-${toast.type}`} key={toast.id}><strong>{toast.type === 'error' ? 'No se pudo guardar' : 'Guardado correctamente'}</strong><span>{toast.message}</span><button aria-label="Cerrar alerta" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>×</button></div>)}</aside>
}

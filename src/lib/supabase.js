import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_escuela_SUPABASE_URL
const anonKey = import.meta.env.VITE_escuela_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

const apiFetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init)
  const response = await fetch(input, init)
  const isWrite = request.url.startsWith(`${url}/rest/v1/`) && ['POST', 'PATCH', 'DELETE'].includes(request.method)
  if (isWrite && typeof window !== 'undefined') {
    if (response.ok) {
      const action = request.method === 'DELETE' ? 'Registro eliminado.' : request.method === 'PATCH' ? 'Registro actualizado.' : 'Registro guardado.'
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: action, resetForm: request.method === 'POST' } }))
    } else {
      let message = 'Revisa la información e inténtalo nuevamente.'
      try { const body = await response.clone().json(); message = body.message || body.details || body.hint || message } catch { /* Respuesta no JSON */ }
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message } }))
    }
  }
  return response
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, { global: { fetch: apiFetch } })
  : null

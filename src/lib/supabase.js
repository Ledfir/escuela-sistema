import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL_escuela_
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY_escuela_

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null

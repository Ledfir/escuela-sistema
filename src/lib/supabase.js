import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.escuela_VITE_SUPABASE_URL
const anonKey = import.meta.env.escuela_VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null

import { createContext, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    const loadRoles = async (userId) => {
      setLoading(true)
      const { data } = await supabase.from('user_roles').select('roles(code, name)').eq('user_id', userId)
      setRoles((data ?? []).map(({ roles: role }) => role).filter(Boolean))
      setLoading(false)
    }
    supabase.auth.getSession().then(async ({ data: { session: nextSession } }) => {
      setSession(nextSession)
      if (nextSession) await loadRoles(nextSession.user.id)
      if (!nextSession) setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setPasswordRecovery(false)
      setSession(nextSession)
      if (nextSession) void loadRoles(nextSession.user.id)
      else { setRoles([]); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const value = {
    session, roles, loading, configured: isSupabaseConfigured,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, fullName) => supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } }),
    signOut: () => supabase.auth.signOut(),
    passwordRecovery,
    clearPasswordRecovery: () => setPasswordRecovery(false),
    hasRole: (...allowed) => roles.some((role) => allowed.includes(role.code))
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

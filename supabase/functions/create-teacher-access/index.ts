import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) throw new Error('No se recibió una sesión válida.')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const token = authorization.replace('Bearer ', '')
    const { data: { user }, error: userError } = await userClient.auth.getUser(token)
    if (userError || !user) throw new Error('La sesión no es válida.')

    const { data: roles, error: roleError } = await adminClient
      .from('user_roles')
      .select('roles!inner(code)')
      .eq('user_id', user.id)
    if (roleError || !roles?.some((item) => item.roles?.code === 'superadmin')) throw new Error('Sólo un Superadministrador puede crear accesos de docentes.')

    const { teacherId } = await request.json()
    if (!teacherId) throw new Error('Selecciona un docente.')
    const { data: teacher, error: teacherError } = await adminClient
      .from('teachers')
      .select('id, first_names, paternal_surname, maternal_surname, email, user_id')
      .eq('id', teacherId)
      .single()
    if (teacherError || !teacher) throw new Error('No se encontró el expediente docente.')
    if (!teacher.email) throw new Error('El docente necesita un correo electrónico en su expediente.')

    let accountId = teacher.user_id
    let invited = false
    if (!accountId) {
      const { data: users, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (usersError) throw usersError
      const existing = users.users.find((candidate) => candidate.email?.toLowerCase() === teacher.email.toLowerCase())
      if (existing) accountId = existing.id
      else {
        const fullName = [teacher.first_names, teacher.paternal_surname, teacher.maternal_surname].filter(Boolean).join(' ')
        const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(teacher.email, {
          data: { full_name: fullName },
          redirectTo: Deno.env.get('SITE_URL') || undefined
        })
        if (inviteError || !invite.user) throw inviteError || new Error('No fue posible enviar la invitación.')
        accountId = invite.user.id
        invited = true
      }
      const { error: linkError } = await adminClient.from('teachers').update({ user_id: accountId }).eq('id', teacher.id)
      if (linkError) throw linkError
    }

    const { data: teacherRole, error: teacherRoleError } = await adminClient.from('roles').select('id').eq('code', 'teacher').single()
    if (teacherRoleError || !teacherRole) throw new Error('No existe el rol teacher en la configuración.')
    const { error: assignmentError } = await adminClient.from('user_roles').upsert({ user_id: accountId, role_id: teacherRole.id }, { onConflict: 'user_id,role_id' })
    if (assignmentError) throw assignmentError

    return Response.json({ message: invited ? 'Invitación enviada y acceso docente creado.' : 'Cuenta existente enlazada y rol docente asignado.', invited }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return Response.json({ error: error.message || 'No fue posible crear el acceso.' }, { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

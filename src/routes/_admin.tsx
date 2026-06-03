import { createFileRoute, redirect } from '@tanstack/react-router'
import { AdminShell } from '@/components/AdminShell'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_admin')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw redirect({ to: '/login' })
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()
    if (data?.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminShell,
})
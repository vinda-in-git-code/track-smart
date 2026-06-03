import { supabase } from '@/integrations/supabase/client'

export type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string | null
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) return null
  return data as Profile
}

export async function updateMyProfile(updates: { full_name: string; avatar_url?: string | null }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  await supabase.auth.updateUser({
    data: { full_name: updates.full_name }
  })
  
  const { error } = await supabase
    .from('profiles')
    .upsert({ 
      id: user.id, 
      email: user.email, 
      full_name: updates.full_name,
      avatar_url: updates.avatar_url ?? null
    })
  if (error) throw new Error(error.message)
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const ext = file.name.split('.').pop()
  const path = `${user.id}/avatar.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
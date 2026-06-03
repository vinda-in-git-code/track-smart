import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { getMyProfile, updateMyProfile, uploadAvatar } from '@/services/profileApi'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/settings')({
  component: Settings,
})

function Settings() {
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const u = {
          id: session.user.id,
          email: session.user.email ?? '',
          name: (session.user.user_metadata?.full_name as string) ?? session.user.email?.split('@')[0] ?? 'User',
        }
        setUser(u)
        try {
          const p = await getMyProfile()
          setName(p?.full_name ?? u.name)
          setAvatarUrl(p?.avatar_url ?? null)
        } catch {
          setName(u.name)
        }
      }
      setLoading(false)
    })
  }, [])

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return toast.error('Ukuran maksimal 5MB')
    setUploading(true)
    try {
      const url = await uploadAvatar(file)
      setAvatarUrl(url)
      await updateMyProfile({ full_name: name || user?.name || 'User', avatar_url: url })
      toast.success('Foto profil diperbarui')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Nama tidak boleh kosong')
    setSaving(true)
    try {
      await updateMyProfile({
        full_name: name.trim(),
        avatar_url: avatarUrl,
      })
      toast.success('Profil disimpan!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const initials = (name || user?.email || 'U')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Atur profil dan preferensi kamu.</p>
      </div>

      <Section title="Profil">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar className="h-20 w-20 border-2 border-border">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="bg-primary-soft text-primary text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[var(--shadow-soft)] hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Foto profil</p>
            <p className="text-xs mt-0.5">JPG / PNG, maks 5MB</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Nama</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="h-11 rounded-xl"
            placeholder="Nama lengkap"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={user?.email ?? ''}
            disabled
            className="h-11 rounded-xl opacity-70"
          />
          <p className="text-xs text-muted-foreground">Email tidak dapat diubah dari sini.</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="rounded-xl bg-[image:var(--gradient-primary)] hover:opacity-95"
        >
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Menyimpan…</> : 'Simpan'}
        </Button>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-[var(--shadow-card)] space-y-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  )
}

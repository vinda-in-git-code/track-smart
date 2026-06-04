import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Upload, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { getAppSetting, setAppSetting } from '@/services/api'

export const Route = createFileRoute('/_admin/admin/settings')({
  component: AdminSettings,
})

function AdminSettings() {
  const [appName, setAppName] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [maintenance, setMaintenance] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAppSetting('app_name').then((val) => {
      const name = val ?? 'Track Smart, Split Easy'
      setAppName(name)
      setOriginalName(name)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!appName.trim()) return toast.error('App name tidak boleh kosong')
    setSaving(true)
    try {
      await setAppSetting('app_name', appName.trim())
      setOriginalName(appName.trim())
      toast.success('Settings berhasil disimpan!')
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan settings')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = appName !== originalName

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Konfigurasi aplikasi dan sistem.</p>
      </div>

      <Section title="Branding">
        <div className="space-y-1.5">
          <Label>App name</Label>
          {loading ? (
            <div className="h-11 rounded-xl bg-muted animate-pulse" />
          ) : (
            <Input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="Nama aplikasi"
            />
          )}
          {isDirty && (
            <p className="text-xs text-amber-500">Ada perubahan yang belum disimpan</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Logo</Label>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              TS
            </div>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => toast.info('Upload logo belum tersedia')}
            >
              <Upload className="h-4 w-4 mr-2" /> Upload logo
            </Button>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || loading || !isDirty}
          className="rounded-xl bg-[image:var(--gradient-primary)]"
        >
          {saving
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...</>
            : <><Save className="h-4 w-4 mr-2" /> Save Changes</>}
        </Button>
      </Section>

      <Section title="System">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Maintenance mode</p>
            <p className="text-xs text-muted-foreground">Sembunyikan aplikasi dari pengguna saat update.</p>
          </div>
          <Switch
            checked={maintenance}
            onCheckedChange={(v) => {
              setMaintenance(v)
              toast.message(v ? 'Maintenance ON' : 'Maintenance OFF')
            }}
          />
        </div>
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
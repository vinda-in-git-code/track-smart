import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

export const Route = createFileRoute('/_admin/admin/settings')({
  component: AdminSettings,
})

function AdminSettings() {
  const [appName, setAppName] = useState('Track Smart, Split Easy')
  const [maintenance, setMaintenance] = useState(false)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Konfigurasi aplikasi dan sistem.</p>
      </div>

      <Section title="Branding">
        <div className="space-y-1.5">
          <Label>App name</Label>
          <Input value={appName} onChange={(e) => setAppName(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>Logo</Label>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-primary-soft flex items-center justify-center text-primary font-bold">TS</div>
            <Button variant="outline" className="rounded-xl" onClick={() => toast.info('Upload — coming soon')}>
              <Upload className="h-4 w-4 mr-2" /> Upload logo
            </Button>
          </div>
        </div>
        <Button onClick={() => toast.success('Settings saved')} className="rounded-xl bg-[image:var(--gradient-primary)]">Save</Button>
      </Section>

      <Section title="System">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Maintenance mode</p>
            <p className="text-xs text-muted-foreground">Sembunyikan aplikasi dari pengguna saat update.</p>
          </div>
          <Switch checked={maintenance} onCheckedChange={(v) => { setMaintenance(v); toast.message(v ? 'Maintenance ON' : 'Maintenance OFF') }} />
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
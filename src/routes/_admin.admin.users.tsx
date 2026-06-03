import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Search, Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getAdminUsers, type AdminUser } from '@/services/adminApi'

export const Route = createFileRoute('/_admin/admin/users')({
  component: UsersPage,
})

function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [detail, setDetail] = useState<AdminUser | null>(null)

  useEffect(() => { getAdminUsers().then(setUsers) }, [])

  const filtered = useMemo(() => users.filter((u) => {
    if (q && !(u.name + u.email).toLowerCase().includes(q.toLowerCase())) return false
    if (status !== 'all' && u.status !== status) return false
    return true
  }), [users, q, status])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola pengguna terdaftar.</p>
      </div>

      <div className="bg-card border border-border/60 rounded-3xl p-4 md:p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="pl-9 h-10 rounded-xl" />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-10 w-full md:w-40 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <Th>Name</Th><Th>Email</Th><Th>Registered</Th><Th>Status</Th><Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border/60 hover:bg-accent/40 transition-colors">
                  <Td className="font-medium">{u.name}</Td>
                  <Td className="text-muted-foreground">{u.email}</Td>
                  <Td>{u.registerDate}</Td>
                  <Td><StatusBadge s={u.status} /></Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setDetail(u)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>User Detail</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              {[['Name', detail.name], ['Email', detail.email], ['Registered', detail.registerDate], ['Status', detail.status]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/60 py-1.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left font-medium text-xs uppercase tracking-wide px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}
function StatusBadge({ s }: { s: 'active' | 'inactive' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s === 'active' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>{s}</span>
  )
}
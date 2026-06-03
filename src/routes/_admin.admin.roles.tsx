import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldOff, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { getRoles, setUserRole, removeUserRole, getAdminUsers } from '@/services/adminApi'
import { toast } from 'sonner'

export const Route = createFileRoute('/_admin/admin/roles')({
  component: RolesPage,
})

function RolesPage() {
  const [roles, setRoles] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRole, setSelectedRole] = useState<'admin' | 'user'>('admin')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const [r, u] = await Promise.all([getRoles(), getAdminUsers()])
    setRoles(r)
    setUsers(u)
  }

  useEffect(() => { load() }, [])

  const handleSet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return toast.error('Pilih user dulu!')
    setLoading(true)
    try {
      await setUserRole(selectedUser, selectedRole)
      toast.success('Role berhasil diset!')
      setOpen(false)
      setSelectedUser('')
      load()
    } catch {
      toast.error('Gagal set role')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (user_id: string, name: string) => {
    if (!confirm(`Hapus role admin dari ${name}?`)) return
    try {
      await removeUserRole(user_id)
      toast.success('Role dihapus')
      load()
    } catch {
      toast.error('Gagal hapus role')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Role Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola hak akses pengguna.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-soft)]">
              <UserPlus className="h-4 w-4 mr-1" /> Assign Role
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle>Assign Role</DialogTitle></DialogHeader>
            <form onSubmit={handleSet} className="space-y-4">
              <div className="space-y-1.5">
                <Label>User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih user" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'admin' | 'user')}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="w-full rounded-xl bg-[image:var(--gradient-primary)]">
                {loading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border/60 rounded-3xl p-4 md:p-6 shadow-[var(--shadow-card)]">
        {roles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Belum ada role yang diassign.
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium text-xs uppercase tracking-wide px-4 py-3">User</th>
                  <th className="text-left font-medium text-xs uppercase tracking-wide px-4 py-3">Email</th>
                  <th className="text-left font-medium text-xs uppercase tracking-wide px-4 py-3">Role</th>
                  <th className="text-left font-medium text-xs uppercase tracking-wide px-4 py-3">Since</th>
                  <th className="text-right font-medium text-xs uppercase tracking-wide px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.user_id} className="border-t border-border/60 hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {r.profiles?.full_name ?? r.profiles?.email ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.profiles?.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                        r.role === 'admin'
                          ? 'bg-violet-500/15 text-violet-600'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {r.role === 'admin'
                          ? <ShieldCheck className="h-3 w-3" />
                          : <ShieldOff className="h-3 w-3" />
                        }
                        {r.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.created_at?.slice(0, 10) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => handleRemove(r.user_id, r.profiles?.full_name ?? r.profiles?.email ?? 'user')}
                      >
                        Hapus Role
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

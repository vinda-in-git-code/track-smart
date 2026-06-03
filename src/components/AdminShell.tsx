import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Receipt, ScanLine,
  Settings, ShieldCheck, ArrowLeftRight, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/services/api'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { toast } from 'sonner'

const nav = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/roles', label: 'Roles', icon: ShieldCheck },
  { to: '/admin/transactions', label: 'Transactions', icon: Receipt },
  { to: '/admin/ocr-logs', label: 'OCR Logs', icon: ScanLine },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          name: (session.user.user_metadata?.full_name as string) ?? session.user.email?.split('@')[0] ?? 'Admin',
        })
      }
    })
  }, [])

  const switchToUser = () => {
    toast.success('Switched to user view')
    navigate({ to: '/dashboard' })
  }

  const handleLogout = () => {
    logout()
    toast.success('Berhasil keluar')
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className="hidden md:flex w-64 flex-col fixed inset-y-0 left-0 z-30 text-white"
        style={{ background: 'linear-gradient(180deg, oklch(0.22 0.06 285), oklch(0.18 0.07 290))' }}
      >
        <div className="px-6 py-6 flex items-center gap-2.5 border-b border-white/10">
          <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Admin Panel</p>
            <p className="text-[11px] text-white/60">Track Smart</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <Button
            onClick={switchToUser}
            variant="outline"
            className="w-full rounded-xl bg-white/5 border-white/20 text-white hover:bg-white/15 hover:text-white"
          >
            <ArrowLeftRight className="h-4 w-4 mr-2" /> Switch to User
          </Button>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center text-xs font-semibold">
              {user?.name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{user?.name ?? 'Admin'}</p>
              <p className="text-[11px] text-white/60 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/15 text-white/70">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 md:ml-64">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, oklch(0.22 0.06 285), oklch(0.18 0.07 290))' }}>
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm md:text-base">Admin Panel</p>
              <p className="text-[11px] text-muted-foreground hidden md:block">Manage users, transactions & system</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={switchToUser} size="sm" variant="outline" className="rounded-full md:hidden">
              <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> User
            </Button>
          </div>
        </header>

        <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto pb-24 md:pb-8">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-lg border-t border-border">
          <div className="grid grid-cols-5 px-1 py-1.5">
            {nav.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? location.pathname === to : location.pathname.startsWith(to)
              return (
                <Link key={to} to={to}
                  className={cn('flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground')}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      </main>
    </div>
  )
}

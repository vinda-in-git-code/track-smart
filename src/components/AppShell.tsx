import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Receipt, PieChart, Settings,
  Plus, LogOut, Wallet, ArrowLeftRight,
  PiggyBank, Target, Menu, ShieldCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout, onAuthChange } from '@/services/api'
import { supabase } from '@/integrations/supabase/client'
import { getMyProfile } from '@/services/profileApi'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { toast } from 'sonner'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/split-bill', label: 'Split Bill', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: PieChart },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  useEffect(() => {
    const handleOpen = () => setIsMobileSidebarOpen(true)
    window.addEventListener('open-sidebar', handleOpen)
    return () => window.removeEventListener('open-sidebar', handleOpen)
  }, [])

  useEffect(() => {
    let mounted = true
    const sub = onAuthChange((u) => {
      if (!mounted) return
      setUser(u)
    })
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          name: (session.user.user_metadata?.full_name as string) ?? (session.user.email?.split('@')[0] ?? 'User'),
        })
        try {
          const profile = await getMyProfile()
          if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
        } catch {
          // Profile data is optional for the shell.
        }

        // Check if admin role
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (mounted && data?.role === 'admin') {
              setIsAdmin(true)
            }
          })
      }
      setAuthReady(true)
    })
    return () => {
      mounted = false
      sub.data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (authReady && !user) navigate({ to: '/login' })
  }, [authReady, user, navigate])

  const handleLogout = () => {
    logout()
    toast.success('Berhasil keluar')
    navigate({ to: '/login' })
  }

  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/transactions') || location.pathname.startsWith('/budgets') || location.pathname.startsWith('/goals') || location.pathname.startsWith('/reports')

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar fixed inset-y-0 left-0 z-30">
        <div className="px-6 py-6 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[image:var(--gradient-primary)] flex items-center justify-center shadow-[var(--shadow-glow)]">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Track Smart</p>
              <p className="text-xs text-muted-foreground leading-tight">Split Easy</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-soft)]'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <Link to="/transactions/add">
            <Button className="w-full rounded-xl bg-[image:var(--gradient-primary)] hover:opacity-95 shadow-[var(--shadow-soft)]">
              <Plus className="h-4 w-4 mr-1" /> Add Transaction
            </Button>
          </Link>
          {isAdmin && (
            <Link to="/admin">
              <Button variant="outline" className="w-full rounded-xl bg-card border border-border/60 hover:bg-sidebar-accent/50 text-foreground transition-all shadow-[var(--shadow-soft)]">
                <ShieldCheck className="h-4 w-4 mr-2 text-primary" /> Dev : Admin mode
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-primary-soft flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} alt={user?.name} className="h-full w-full object-cover" />
                : user?.name?.[0]?.toUpperCase() ?? 'U'
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name ?? 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop overlay for mobile drawer */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-border bg-sidebar transition-transform duration-300 ease-in-out md:hidden",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-6 py-6 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[image:var(--gradient-primary)] flex items-center justify-center shadow-[var(--shadow-glow)]">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Track Smart</p>
              <p className="text-xs text-muted-foreground leading-tight">Split Easy</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setIsMobileSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-soft)]'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <Link to="/transactions/add" onClick={() => setIsMobileSidebarOpen(false)}>
            <Button className="w-full rounded-xl bg-[image:var(--gradient-primary)] hover:opacity-95 shadow-[var(--shadow-soft)]">
              <Plus className="h-4 w-4 mr-1" /> Add Transaction
            </Button>
          </Link>
          {isAdmin && (
            <Link to="/admin" onClick={() => setIsMobileSidebarOpen(false)}>
              <Button variant="outline" className="w-full rounded-xl bg-card border border-border/60 hover:bg-sidebar-accent/50 text-foreground transition-all shadow-[var(--shadow-soft)]">
                <ShieldCheck className="h-4 w-4 mr-2 text-primary" /> Dev : Admin mode
              </Button>
            </Link>
          )}
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-primary-soft flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} alt={user?.name} className="h-full w-full object-cover" />
                : user?.name?.[0]?.toUpperCase() ?? 'U'
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name ?? 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => {
                setIsMobileSidebarOpen(false)
                handleLogout()
              }}
              className="p-1.5 rounded-lg hover:bg-sidebar-accent text-muted-foreground"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 pb-8">
        <header className={cn(
          'md:hidden sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3 items-center justify-between',
          isDashboard ? 'hidden' : 'flex',
        )}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="font-semibold text-sm">Track Smart</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/transactions/add">
              <Button size="sm" className="rounded-full bg-[image:var(--gradient-primary)] h-9 px-4">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </Link>
          </div>
        </header>

        <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Plus, Target, Trash2, Calendar, Menu, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getGoals, addGoal, contributeToGoal, deleteGoal, monthlyRequired, monthsUntil, type SavingsGoal } from '@/services/goalsApi'
import { formatIDR, parseIDR } from '@/services/api'

export const Route = createFileRoute('/_app/goals')({
  component: GoalsPage,
})

const EMOJIS = ['🎯', '🏝️', '💻', '🚗', '🏠', '✈️', '📱', '💍', '🎓', '🛡️', '🎮', '📷']

function GoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [date, setDate] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [contribOpen, setContribOpen] = useState(false)
  const [contribGoal, setContribGoal] = useState<SavingsGoal | null>(null)
  const [contribAmount, setContribAmount] = useState('')

  useEffect(() => { getGoals().then(setGoals) }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetAmount = parseIDR(target)
    if (!name.trim()) return toast.error('Nama goal wajib diisi')
    if (targetAmount <= 0) return toast.error('Target harus lebih dari 0')
    if (!date) return toast.error('Pilih tanggal target')
    await addGoal({ name: name.trim(), targetAmount, targetDate: date, emoji })
    setGoals(await getGoals())
    setOpen(false)
    setName(''); setTarget(''); setDate(''); setEmoji('🎯')
    toast.success('Goal ditambahkan ✨')
  }

  const openContribute = (g: SavingsGoal) => {
    setContribGoal(g)
    setContribAmount('')
    setContribOpen(true)
  }

  const submitContribute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contribGoal) return
    const amount = parseIDR(contribAmount)
    if (amount === 0) return toast.error('Masukkan jumlah')
    const updated = await contributeToGoal(contribGoal.id, amount)
    setGoals(await getGoals())
    setContribOpen(false)
    if (updated && updated.savedAmount >= updated.targetAmount) {
      toast.success(`Selamat! Goal "${updated.name}" tercapai!`)
    } else {
      toast.success('Tabungan ditambahkan')
    }
  }

  const remove = async (g: SavingsGoal) => {
    await deleteGoal(g.id)
    setGoals((prev) => (prev ?? []).filter((x) => x.id !== g.id))
    toast.success('Goal dihapus')
  }

  if (!goals) return <GoalsSkeleton />

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0)
  const completed = goals.filter((g) => g.savedAmount >= g.targetAmount).length

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Mobile Page Header */}
      <div className="md:hidden">
        <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-sidebar'))}
            className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted/20 transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-center text-xl font-bold tracking-tight">Saving Goals</h1>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-1 mb-5">
          Set target, tabungan sedikit sedikit, capai impian
        </p>
      </div>

      {/* Desktop Page Header */}
      <div className="hidden md:flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Savings Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">Nabung jadi lebih terarah dan mudah.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-soft)]">
          <Plus className="h-4 w-4 mr-1" /> New Goal
        </Button>
      </div>

      {/* Dialog for creating goal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Buat Goal Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Pilih Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => setEmoji(e)}
                    className={cn('h-10 w-10 rounded-xl border text-xl flex items-center justify-center transition-all',
                      emoji === e ? 'border-primary bg-primary-soft scale-110' : 'border-border bg-card hover:border-primary/40'
                    )}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nama Goal</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Liburan ke Jepang" className="rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Target Tabungan</Label>
              <Input inputMode="numeric" value={target ? formatIDR(parseIDR(target)) : ''}
                onChange={(e) => setTarget(e.target.value)} placeholder="Rp 25.000.000" className="rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Target Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)} className="rounded-xl h-11" />
            </div>
            <DialogFooter>
              <Button type="submit" className="rounded-xl bg-[image:var(--gradient-primary)]">Simpan Goal</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {goals.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
              <p className="text-xs text-muted-foreground">Income</p>
              <p className="text-sm min-[360px]:text-base md:text-lg font-semibold text-success mt-1">{formatIDR(totalSaved)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">dari {formatIDR(totalTarget)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
              <p className="text-xs text-muted-foreground">Goal Aktif</p>
              <p className="text-sm min-[360px]:text-base md:text-lg font-bold text-foreground mt-1">
                {goals.length - completed > 0 ? '-' : ''} {formatIDR(totalTarget - totalSaved)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">sedang dikerja</p>
            </div>
            <div className="col-span-2 md:col-span-1 rounded-2xl border border-border/60 bg-[image:linear-gradient(135deg,var(--primary-soft),transparent)] bg-primary-soft/10 p-4">
              <p className="text-xs text-muted-foreground">Net</p>
              <p className="text-sm min-[360px]:text-base md:text-lg font-semibold text-success mt-1">{formatIDR(totalSaved)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">goal sukses</p>
            </div>
          </div>

          {/* Mobile Add Goal button (direct mockup replica) */}
          <div className="md:hidden">
            <Button onClick={() => setOpen(true)} className="w-full rounded-xl bg-[image:var(--gradient-primary)] hover:opacity-95 shadow-[var(--shadow-soft)] h-11 py-2 text-sm font-semibold flex items-center justify-center gap-1.5">
              <Plus className="h-4 w-4 rounded-full border border-current p-0.5 shrink-0" /> New Goal
            </Button>
          </div>
        </>
      )}

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary-soft mx-auto flex items-center justify-center mb-3">
            <Target className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-semibold">Belum ada goal</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Mulai dengan target kecil dulu — beli sepatu baru, dana darurat, dll.</p>
          <Button onClick={() => setOpen(true)} className="rounded-xl bg-[image:var(--gradient-primary)]">
            <Plus className="h-4 w-4 mr-1" /> Buat Goal Pertama
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const ratio = Math.min(100, (g.savedAmount / g.targetAmount) * 100)
            const isComplete = g.savedAmount >= g.targetAmount
            const remaining = Math.max(0, g.targetAmount - g.savedAmount)
            const months = monthsUntil(g.targetDate)
            const perMonth = monthlyRequired(g)
            const targetDateLabel = new Date(g.targetDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

            return (
              <div key={g.id} className={cn('rounded-2xl border bg-card p-4 sm:p-5 shadow-[var(--shadow-card)] relative overflow-hidden',
                isComplete ? 'border-success/40' : 'border-border/60')}>
                {isComplete && (
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/15 text-success text-[11px] font-semibold">
                      Tercapai
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary-soft flex items-center justify-center text-xl sm:text-2xl shrink-0">
                      {g.emoji ?? '🎯'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">{g.name}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" /> {targetDateLabel} • {months} bln lagi
                      </p>
                    </div>
                  </div>
                  {!isComplete && (
                    <button onClick={() => remove(g)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Delete goal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl sm:text-2xl font-bold">{formatIDR(g.savedAmount)}</span>
                    <span className="text-xs text-muted-foreground">/ {formatIDR(g.targetAmount)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all',
                      isComplete ? 'bg-[image:linear-gradient(90deg,var(--success),var(--chart-5))]' : 'bg-[image:var(--gradient-primary)]')}
                      style={{ width: `${ratio}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="text-muted-foreground">{isComplete ? 'Goal tercapai' : `Sisa ${formatIDR(remaining)}`}</span>
                    <span className="font-semibold text-primary">{Math.round(ratio)}%</span>
                  </div>
                </div>
                {!isComplete && (
                  <>
                    <div className="rounded-xl bg-primary-soft/10 p-3 mb-3 flex items-center gap-2 border border-primary-soft/20">
                      <ArrowUpRight className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-[11px] sm:text-xs text-muted-foreground leading-normal">
                        Tabung <span className="font-semibold text-foreground">{formatIDR(perMonth)}</span>/bulan biar tercapai tepat waktu
                      </p>
                    </div>
                    <Button onClick={() => openContribute(g)} variant="outline"
                      className="w-full rounded-xl border-border/60 bg-card text-foreground hover:bg-primary-soft hover:text-primary h-9.5 flex items-center justify-center gap-1 text-xs sm:text-sm shadow-none transition-all">
                      <Plus className="h-4 w-4 rounded-full border border-current p-0.5 shrink-0" /> Tambah Tabungan
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={contribOpen} onOpenChange={setContribOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{contribGoal?.emoji} Tambah Tabungan — {contribGoal?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitContribute} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Jumlah</Label>
              <Input inputMode="numeric" value={contribAmount ? formatIDR(parseIDR(contribAmount)) : ''}
                onChange={(e) => setContribAmount(e.target.value)} placeholder="Rp 500.000"
                className="rounded-xl h-11" autoFocus />
              <p className="text-xs text-muted-foreground">Tip: pakai angka negatif buat koreksi (misal "-100000")</p>
            </div>
            <DialogFooter>
              <Button type="submit" className="rounded-xl bg-[image:var(--gradient-primary)]">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GoalsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
      </div>
    </div>
  )
}

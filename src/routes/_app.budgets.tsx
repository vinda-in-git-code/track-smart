import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, AlertTriangle, CheckCircle2, TrendingUp, Wallet, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getBudgets, upsertBudget, deleteBudget, getBudgetStatus, type Budget } from '@/services/budgetApi'
import { getTransactions, formatIDR, parseIDR, type Transaction, type Category } from '@/services/api'

export const Route = createFileRoute('/_app/budgets')({
  component: BudgetsPage,
})

const ALL_CATEGORIES: Category[] = [
  'Food', 'Transportation', 'Shopping', 'Entertainment',
  'Health', 'Education', 'Utilities', 'Groceries',
  'Restaurants', 'Coffee Shops', 'Social Life', 'Other'
]

function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[] | null>(null)
  const [txs, setTxs] = useState<Transaction[] | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [formCat, setFormCat] = useState<Category>('Food')
  const [formLimit, setFormLimit] = useState('')

  const monthKey = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    Promise.all([getBudgets(), getTransactions()]).then(([b, t]) => {
      setBudgets(b)
      setTxs(t)
    })
  }, [])

  const handleRefresh = () => {
    Promise.all([getBudgets(), getTransactions()]).then(([b, t]) => {
      setBudgets(b)
      setTxs(t)
      toast.success('Data diperbarui')
    })
  }

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    ;(txs ?? [])
      .filter((t) => t.type === 'expense' && t.date.startsWith(monthKey))
      .forEach((t) => {
        map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
      })
    return map
  }, [txs, monthKey])

  const totalLimit = (budgets ?? []).reduce((s, b) => s + b.limit, 0)
  const totalSpent = (budgets ?? []).reduce((s, b) => s + (spentByCategory.get(b.category) ?? 0), 0)
  const overallRatio = totalLimit > 0 ? Math.min(100, (totalSpent / totalLimit) * 100) : 0

  const exceededCount = (budgets ?? []).filter(
    (b) => (spentByCategory.get(b.category) ?? 0) >= b.limit,
  ).length
  const warningCount = (budgets ?? []).filter((b) => {
    const spent = spentByCategory.get(b.category) ?? 0
    return spent < b.limit && spent / b.limit >= 0.8
  }).length

  const openAdd = () => {
    setEditing(null)
    setFormCat(ALL_CATEGORIES.find((c) => !budgets?.some((b) => b.category === c)) ?? 'Food')
    setFormLimit('')
    setOpen(true)
  }

  const openEdit = (b: Budget) => {
    setEditing(b)
    setFormCat(b.category)
    setFormLimit(String(b.limit))
    setOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const limit = parseIDR(formLimit)
    if (limit <= 0) return toast.error('Limit harus lebih dari 0')
    await upsertBudget(formCat, limit)
    const updated = await getBudgets()
    setBudgets(updated)
    setOpen(false)
    toast.success(editing ? 'Budget diperbarui' : 'Budget ditambahkan')
  }

  const remove = async (b: Budget) => {
    await deleteBudget(b.id)
    setBudgets((prev) => (prev ?? []).filter((x) => x.id !== b.id))
    toast.success('Budget dihapus')
  }

  if (!budgets || !txs) return <BudgetsSkeleton />

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
          <h1 className="text-center text-xl font-bold tracking-tight">Budgets</h1>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
          >
            Refresh
          </button>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-1 mb-5">
          Set limit per kategori dan pantau pengeluaran bulan ini
        </p>
      </div>

      {/* Desktop Page Header */}
      <div className="hidden md:flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atur limit tiap kategori dan pantau pengeluaran bulananmu.
          </p>
        </div>
        <Button onClick={openAdd} className="rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-soft)]">
          <Plus className="h-4 w-4 mr-1" /> New Budget
        </Button>
      </div>

      {/* Dialog for adding/editing budget */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Budget' : 'New Budget'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={formCat} onValueChange={(v) => setFormCat(v as Category)} disabled={!!editing}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_CATEGORIES.map((c) => {
                    const taken = !editing && budgets.some((b) => b.category === c)
                    return (
                      <SelectItem key={c} value={c} disabled={taken}>
                        {c} {taken && '(sudah ada)'}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Limit per bulan</Label>
              <Input
                inputMode="numeric"
                value={formLimit ? formatIDR(parseIDR(formLimit)) : ''}
                onChange={(e) => setFormLimit(e.target.value)}
                placeholder="Rp 1.500.000"
                className="rounded-xl h-11"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="rounded-xl bg-[image:var(--gradient-primary)]">
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Overall summary */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[image:var(--gradient-primary)] flex items-center justify-center text-primary-foreground shadow-[var(--shadow-glow)] shrink-0">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bulan ini</p>
              <p className="text-xl sm:text-2xl font-bold">
                {formatIDR(totalSpent)}{' '}
                <span className="text-xs sm:text-sm text-muted-foreground font-normal">/ {formatIDR(totalLimit)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {exceededCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {exceededCount} lewat limit
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/15 text-warning-foreground text-xs font-semibold">
                <TrendingUp className="h-3.5 w-3.5 shrink-0" /> {warningCount} mendekati limit
              </span>
            )}
            {exceededCount === 0 && warningCount === 0 && budgets.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/15 text-success text-xs font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Semua aman
              </span>
            )}
          </div>
        </div>
        <div className="mt-4">
          <Progress value={overallRatio} className="h-2.5 rounded-full" />
        </div>
      </div>

      {/* Mobile Add Budget button (direct mockup replica) */}
      <div className="md:hidden">
        <Button onClick={openAdd} className="w-full rounded-xl bg-[image:var(--gradient-primary)] hover:opacity-95 shadow-[var(--shadow-soft)] h-11 py-2 text-sm font-semibold flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4 rounded-full border border-current p-0.5 shrink-0" /> New Budget
        </Button>
      </div>

      {/* Budget cards */}
      {budgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary-soft mx-auto flex items-center justify-center mb-3">
            <Wallet className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-semibold">Belum ada budget</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Mulai set limit per kategori biar pengeluaran lebih terkontrol.
          </p>
          <Button onClick={openAdd} className="rounded-xl bg-[image:var(--gradient-primary)]">
            <Plus className="h-4 w-4 mr-1" /> Tambah Budget Pertama
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((b) => {
            const spent = spentByCategory.get(b.category) ?? 0
            const remaining = b.limit - spent
            const ratio = Math.min(100, (spent / b.limit) * 100)
            const status = getBudgetStatus(spent, b.limit)
            const tone =
              status === 'exceeded'
                ? { bar: 'bg-destructive', text: 'text-destructive', chip: 'bg-destructive/10 text-destructive' }
                : status === 'warning'
                ? { bar: 'bg-warning', text: 'text-warning-foreground', chip: 'bg-warning/15 text-warning-foreground' }
                : { bar: 'bg-success', text: 'text-success', chip: 'bg-success/10 text-success' }

            return (
              <div
                key={b.id}
                className={cn(
                  'rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-soft)]',
                  status === 'exceeded' ? 'border-destructive/40' : 'border-border/60',
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <button onClick={() => openEdit(b)} className="font-semibold text-base hover:text-primary text-left">
                      {b.category}
                    </button>
                    <p className="text-xs text-muted-foreground mt-0.5">Budget bulanan</p>
                  </div>
                  <button
                    onClick={() => remove(b)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold">{formatIDR(spent)}</span>
                    <span className="text-xs text-muted-foreground">/ {formatIDR(b.limit)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', tone.bar)} style={{ width: `${ratio}%` }} />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', tone.chip)}>
                      {status === 'exceeded'
                        ? `Lewat ${formatIDR(spent - b.limit)}`
                        : status === 'warning'
                        ? `${Math.round(ratio)}% terpakai`
                        : `Sisa ${formatIDR(remaining)}`}
                    </span>
                    <span className={cn('text-xs font-semibold', tone.text)}>{Math.round(ratio)}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BudgetsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
      </div>
    </div>
  )
}

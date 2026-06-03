import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Trash2, ArrowDownRight, ArrowUpRight, Filter, Menu } from 'lucide-react'
import { deleteTransaction, formatIDR, getTransactions, type Transaction } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/transactions/')({
  component: TransactionsListPage,
})

const CATEGORIES = [
  'All', 'Income', 'Food', 'Transportation', 'Shopping', 'Entertainment',
  'Health', 'Education', 'Utilities', 'Groceries', 'Restaurants',
  'Coffee Shops', 'Social Life', 'Other'
] as const

const NEED_CATEGORIES = [
  'Food', 'Coffee Shops', 'Restaurants', 'Fast Food', 'Groceries',
  'Transportation', 'Gas & Fuel', 'Utilities', 'Rent', 'Internet',
  'Mobile Phone', 'Health', 'Household', 'Family', 'Education',
]
const WANT_CATEGORIES = [
  'Entertainment', 'Shopping', 'Social Life', 'Tourism',
  'Alcohol & Bars', 'Movies & Dvds', 'Festivals',
]

function getNeedWant(category: string): 'Need' | 'Want' | 'Unclassified' {
  if (NEED_CATEGORIES.includes(category)) return 'Need'
  if (WANT_CATEGORIES.includes(category)) return 'Want'
  return 'Unclassified'
}

const NEED_WANT_CONFIG = {
  Need: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  Want: 'bg-pink-100 text-pink-600 dark:bg-pink-950/40 dark:text-pink-300',
  Unclassified: 'bg-muted text-muted-foreground',
}

function TransactionsListPage() {
  const [txs, setTxs] = useState<Transaction[] | null>(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all')
  const [category, setCategory] = useState<string>('All')
  const [sort, setSort] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc')
  const [needWantFilter, setNeedWantFilter] = useState<'all' | 'Need' | 'Want' | 'Unclassified'>('all')

  useEffect(() => {
    getTransactions().then(setTxs)
  }, [])

  const filtered = useMemo(() => {
    if (!txs) return []
    let list = txs.filter((t) => {
      if (type !== 'all' && t.type !== type) return false
      if (category !== 'All' && t.category !== category) return false
      if (needWantFilter !== 'all' && getNeedWant(t.category) !== needWantFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(`${t.note ?? ''} ${t.category} ${t.payment_method ?? ''}`.toLowerCase().includes(q))) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'date_asc': return a.date.localeCompare(b.date)
        case 'amount_desc': return b.amount - a.amount
        case 'amount_asc': return a.amount - b.amount
        default: return b.date.localeCompare(a.date)
      }
    })
    return list
  }, [txs, search, type, category, sort, needWantFilter])

  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { income, expense, net: income - expense, count: filtered.length }
  }, [filtered])

  const handleDelete = async (id: string) => {
    await deleteTransaction(id)
    setTxs((prev) => (prev ? prev.filter((t) => t.id !== id) : prev))
    toast.success('Transaction deleted')
  }

  if (!txs) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

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
          <h1 className="text-center text-xl font-bold tracking-tight">Transactions</h1>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-1 mb-5">
          {totals.count} transaction{totals.count === 1 ? '' : 's'} found
        </p>
      </div>

      {/* Desktop Page Header */}
      <div className="hidden md:flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totals.count} transaction{totals.count === 1 ? '' : 's'} found.
          </p>
        </div>
        <Link to="/transactions/add">
          <Button className="rounded-xl bg-[image:var(--gradient-primary)] hover:opacity-95 shadow-[var(--shadow-soft)]">
            <Plus className="h-4 w-4 mr-1" /> Add Transaction
          </Button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Income</p>
          <p className="text-sm min-[360px]:text-base md:text-lg font-semibold text-success mt-0.5">{formatIDR(totals.income)}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="text-sm min-[360px]:text-base md:text-lg font-semibold text-foreground font-bold mt-0.5">
            {totals.expense > 0 ? '-' : ''} {formatIDR(totals.expense)}
          </p>
        </div>
        <div className="col-span-2 md:col-span-1 rounded-2xl border border-border/60 bg-[image:linear-gradient(135deg,var(--primary-soft),transparent)] bg-primary-soft/10 p-4">
          <p className="text-xs text-muted-foreground">Net</p>
          <p className={`text-sm min-[360px]:text-base md:text-lg font-semibold mt-0.5 ${totals.net >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatIDR(totals.net)}
          </p>
        </div>
      </div>

      {/* Mobile Add Transaction button (direct mockup replica) */}
      <div className="md:hidden">
        <Link to="/transactions/add">
          <Button className="w-full rounded-xl bg-[image:var(--gradient-primary)] hover:opacity-95 shadow-[var(--shadow-soft)] h-11 py-2 text-sm font-semibold flex items-center justify-center gap-1.5">
            <Plus className="h-4 w-4 rounded-full border border-current p-0.5 shrink-0" /> Add Transaction
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border/60 bg-card p-3 sm:p-4 shadow-[var(--shadow-card)]">
        {/* Mobile view filters */}
        <div className="flex flex-col gap-2.5 md:hidden">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search note, category..."
              className="pl-9 rounded-xl h-9 text-xs"
            />
          </div>
          <div className="grid grid-cols-[1.1fr_0.9fr_1fr] gap-1.5">
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="h-8.5 rounded-xl text-[10px] px-2.5">
                <Filter className="h-3.5 w-3.5 mr-1 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs">All types</SelectItem>
                <SelectItem value="income" className="text-xs">Income</SelectItem>
                <SelectItem value="expense" className="text-xs">Expense</SelectItem>
              </SelectContent>
            </Select>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8.5 rounded-xl text-[10px] px-2.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="h-8.5 rounded-xl text-[10px] px-2.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="date_desc" className="text-xs">Newest first</SelectItem>
                <SelectItem value="date_asc" className="text-xs">Oldest first</SelectItem>
                <SelectItem value="amount_desc" className="text-xs">Amount: high → low</SelectItem>
                <SelectItem value="amount_asc" className="text-xs">Amount: low → high</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Desktop view filters */}
        <div className="hidden md:flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search note, category…"
              className="pl-9 rounded-xl"
            />
          </div>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="w-36 rounded-xl">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={needWantFilter} onValueChange={(v) => setNeedWantFilter(v as typeof needWantFilter)}>
            <SelectTrigger className="w-44 rounded-xl">
              <SelectValue placeholder="Semua label" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Semua label</SelectItem>
              <SelectItem value="Need">Need</SelectItem>
              <SelectItem value="Want">Want</SelectItem>
              <SelectItem value="Unclassified">Unclassified</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-44 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="date_desc">Newest first</SelectItem>
              <SelectItem value="date_asc">Oldest first</SelectItem>
              <SelectItem value="amount_desc">Amount: high → low</SelectItem>
              <SelectItem value="amount_asc">Amount: low → high</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-3">Date</th>
                <th className="text-left font-medium px-5 py-3">Type</th>
                <th className="text-left font-medium px-5 py-3">Category</th>
                <th className="text-left font-medium px-5 py-3">Label</th>
                <th className="text-left font-medium px-5 py-3">Note</th>
                <th className="text-left font-medium px-5 py-3">Method</th>
                <th className="text-right font-medium px-5 py-3">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-12">No matching transactions.</td></tr>
              )}
              {filtered.map((t) => {
                const label = t.type === 'expense' ? getNeedWant(t.category) : null
                return (
                  <tr key={t.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      {t.type === 'income' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <ArrowUpRight className="h-3.5 w-3.5" /> Income
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80">
                          <ArrowDownRight className="h-3.5 w-3.5" /> Expense
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${t.type === 'income' ? 'bg-success' : 'bg-primary'}`} />
                        {t.category}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {label
                        ? <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${NEED_WANT_CONFIG[label]}`}>{label}</span>
                        : <span className="text-[11px] text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground max-w-[220px] truncate">{t.note ?? '—'}</td>
                    <td className="px-5 py-3 text-muted-foreground">{t.payment_method ?? '—'}</td>
                    <td className={`px-5 py-3 text-right font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                      {t.type === 'income' ? '+' : '−'} {formatIDR(t.amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-muted-foreground text-sm">
            No matching transactions.
          </div>
        )}
        {filtered.map((t) => {
          return (
            <div key={t.id} className="rounded-2xl border border-border/60 bg-card p-3 flex items-center justify-between shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground/70'}`}>
                  {t.type === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{t.note || t.category}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {t.category} - {t.payment_method ?? '—'} - {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3 flex flex-col items-end justify-between h-10">
                <p className={`text-sm font-semibold ${t.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                  {t.type === 'income' ? '+' : '−'} {formatIDR(t.amount)}
                </p>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  className="p-1 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Delete transaction"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
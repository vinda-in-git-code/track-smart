import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Menu, PiggyBank, Percent, Target, Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts'
import { StatCard } from '@/components/StatCard'
import { getTransactions, formatIDR, type Transaction } from '@/services/api'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'

export const Route = createFileRoute('/_app/dashboard')({
  component: Dashboard,
})

const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'oklch(0.78 0.12 30)',
]

const graphOptions = [
  { value: 'monthly', label: 'Monthly Overview', title: 'Monthly Overview' },
  { value: 'topCategories', label: 'Top 5 Categories', title: 'Top 5 Categories' },
  { value: 'spendingPattern', label: 'Spending Pattern', title: 'Spending Pattern' },
  { value: 'byCategory', label: 'By Category', title: 'By Category' },
] as const

type GraphMode = (typeof graphOptions)[number]['value']

const formatTooltipIDR = (value: unknown) => formatIDR(Number(value) || 0)
const formatMonthLong = (month: string) =>
  new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
const formatMonthShort = (month: string) => {
  const date = new Date(month + '-01')
  const monthLabel = date.toLocaleDateString('en-US', { month: 'short' })
  return `${monthLabel} ${String(date.getFullYear()).slice(-2)}`
}

function Dashboard() {
  const [txs, setTxs] = useState<Transaction[] | null>(null)
  const [month, setMonth] = useState<string>('')
  const [graphMode, setGraphMode] = useState<GraphMode>('monthly')
  const [isGraphDropdownOpen, setIsGraphDropdownOpen] = useState(false)

  useEffect(() => {
    getTransactions().then((data) => {
      setTxs(data)
      if (data.length > 0) {
        const months = Array.from(new Set(data.map((t) => t.date.slice(0, 7)))).sort().reverse()
        setMonth(months[0])
      }
    })
  }, [])

  const months = useMemo(() => {
    if (!txs) return []
    const set = new Set(txs.map((t) => t.date.slice(0, 7)))
    return Array.from(set).sort().reverse()
  }, [txs])

  const filtered = useMemo(
    () => (txs ?? []).filter((t) => t.date.startsWith(month)),
    [txs, month],
  )

  const income = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const savings = income - expense
  const savingRate = income > 0 ? Math.round((savings / income) * 100) : 0

  const monthlySeries = useMemo(() => {
    if (!txs) return []
    const map = new Map<string, { month: string; income: number; expense: number }>()
    txs.forEach((t) => {
      const key = t.date.slice(0, 7)
      const cur = map.get(key) ?? { month: key, income: 0, expense: 0 }
      if (t.type === 'income') cur.income += t.amount
      else cur.expense += t.amount
      map.set(key, cur)
    })
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({
        ...m,
        label: new Date(m.month + '-01').toLocaleDateString('id-ID', { month: 'short' }),
      }))
  }, [txs])

  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    filtered.filter((t) => t.type === 'expense').forEach((t) => {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const topCategories = useMemo(() => categoryData.slice(0, 5), [categoryData])

  const dayOfWeekData = useMemo(() => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
    const totals = Array(7).fill(0) as number[]
    filtered.filter((t) => t.type === 'expense').forEach((t) => {
      const d = new Date(t.date).getDay()
      totals[d] += t.amount
    })
    return days.map((label, i) => ({ label, value: totals[i] }))
  }, [filtered])

  const noSpendDays = useMemo(() => {
    if (!month) return { count: 0, target: 10 }
    const expenseDays = new Set(filtered.filter((t) => t.type === 'expense').map((t) => t.date))
    const [y, m] = month.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const today = new Date()
    const upTo = today.getFullYear() === y && today.getMonth() + 1 === m ? today.getDate() : daysInMonth
    let count = 0
    for (let d = 1; d <= upTo; d++) {
      const day = `${month}-${String(d).padStart(2, '0')}`
      if (!expenseDays.has(day)) count++
    }
    return { count, target: 10 }
  }, [filtered, month])

  if (!txs) return <DashboardSkeleton />

  const activeGraph = graphOptions.find((option) => option.value === graphMode) ?? graphOptions[0]

  return (
    <div className="space-y-5 md:space-y-6">
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
          <h1 className="text-center text-xl font-bold tracking-tight">Dashboard</h1>
          {months.length > 0 && (
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-7 w-auto gap-1 rounded-full border-transparent bg-transparent px-1 text-xs font-semibold shadow-none hover:bg-muted/20 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70">
                <span>{formatMonthShort(month)}</span>
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonthLong(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <p className="mt-1 text-center text-sm text-muted-foreground">Ringkasan keuangan kamu bulan ini.</p>
      </div>

      <div className="hidden items-end justify-between gap-3 md:flex">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ringkasan keuangan kamu bulan ini.</p>
        </div>
        {months.length > 0 && (
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-8 w-fit min-w-[130px] gap-1.5 rounded-full border border-border/60 bg-card px-3 text-xs shadow-none hover:bg-muted/50 transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonthLong(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Income" value={formatIDR(income)} icon={ArrowUpRight} tone="success" />
        <StatCard label="Expenses" value={formatIDR(expense)} icon={ArrowDownRight} tone="destructive" />
        <StatCard label="Savings" value={formatIDR(savings)} icon={PiggyBank} tone="primary" />
        <StatCard label="Saving Rate" value={`${savingRate}%`} icon={Percent} tone="warning" />
      </div>

      <div className="hidden gap-4 md:grid lg:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Monthly Overview</h3>
              <p className="text-xs text-muted-foreground">Income vs Expenses</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-success" /> Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Expenses
              </span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={monthlySeries}>
                <defs>
                  <linearGradient id="desktopIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="desktopExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)' }}
                  formatter={formatTooltipIDR}
                />
                <Area type="monotone" dataKey="income" stroke="var(--success)" strokeWidth={2.5} fill="url(#desktopIncomeGrad)" dot={{ r: 3 }} />
                <Area type="monotone" dataKey="expense" stroke="var(--primary)" strokeWidth={2.5} fill="url(#desktopExpenseGrad)" dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold">By Category</h3>
          <p className="mb-2 text-xs text-muted-foreground">Expenses breakdown</p>
          <div className="h-64">
            {categoryData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={2}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatTooltipIDR} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="hidden gap-4 md:grid lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold">Top 5 Categories</h3>
          <p className="mb-3 text-xs text-muted-foreground">Pengeluaran terbesar bulan ini</p>
          <div className="h-60">
            {topCategories.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Belum ada pengeluaran</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={topCategories} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                  <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} width={86} />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} formatter={formatTooltipIDR} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)' }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {topCategories.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold">Spending Pattern</h3>
          <p className="mb-3 text-xs text-muted-foreground">Total pengeluaran perhari dalam seminggu</p>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip cursor={{ fill: 'var(--muted)' }} formatter={formatTooltipIDR} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)' }} />
                <Bar dataKey="value" fill="var(--chart-4)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <section className="space-y-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold md:text-xl">{activeGraph.title}</h2>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">Graph by</span>
            <div className="relative">
              {!isGraphDropdownOpen ? (
                <button
                  type="button"
                  onClick={() => setIsGraphDropdownOpen(true)}
                  className="h-7 w-[142px] flex items-center justify-between rounded-full bg-card border border-border/40 px-3 text-[10px] font-semibold text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-muted/30"
                >
                  <span className="truncate">{activeGraph.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-70 shrink-0 ml-1" />
                </button>
              ) : (
                <>
                  <div
                    className="fixed inset-0 z-45 bg-transparent"
                    onClick={() => setIsGraphDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-0 z-50 w-[142px] rounded-2xl border border-border/60 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsGraphDropdownOpen(false)}
                      className="w-full h-7 px-3.5 flex items-center justify-between border-b border-border/60 text-[10px] font-medium text-foreground bg-card hover:bg-muted/30 transition-colors"
                    >
                      <span className="truncate">{activeGraph.label}</span>
                      <ChevronUp className="h-3 w-3 opacity-70 shrink-0 ml-1" />
                    </button>
                    <div className="py-1 bg-card">
                      {graphOptions
                        .filter((opt) => opt.value !== graphMode)
                        .map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setGraphMode(opt.value)
                              setIsGraphDropdownOpen(false)
                            }}
                            className="w-full text-left px-3.5 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                          >
                            {opt.label}
                          </button>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)] md:p-5">
          {graphMode === 'monthly' && (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground md:text-sm">Income vs Expenses</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-success" /> Income
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Expenses
                  </span>
                </div>
              </div>
              <div className="h-[250px] md:h-80">
                <ResponsiveContainer>
                  <AreaChart data={monthlySeries} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)' }}
                      formatter={formatTooltipIDR}
                    />
                    <Area type="monotone" dataKey="income" stroke="var(--success)" strokeWidth={2.5} fill="url(#incomeGrad)" dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="expense" stroke="var(--primary)" strokeWidth={2.5} fill="url(#expenseGrad)" dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {graphMode === 'topCategories' && (
            <>
              <p className="mb-3 text-xs font-medium text-muted-foreground md:text-sm">Pengeluaran terbesar bulan ini</p>
              <div className="h-[250px] md:h-80">
                {topCategories.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Belum ada pengeluaran</div>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={topCategories} layout="vertical" margin={{ top: 4, right: 8, left: -6, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                      <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} width={76} />
                      <Tooltip cursor={{ fill: 'var(--muted)' }} formatter={formatTooltipIDR} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)' }} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={26}>
                        {topCategories.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}

          {graphMode === 'spendingPattern' && (
            <>
              <p className="mb-3 text-xs font-medium text-muted-foreground md:text-sm">Total pengeluaran per hari dalam seminggu</p>
              <div className="h-[250px] md:h-80">
                <ResponsiveContainer>
                  <BarChart data={dayOfWeekData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip cursor={{ fill: 'var(--muted)' }} formatter={formatTooltipIDR} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)' }} />
                    <Bar dataKey="value" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {graphMode === 'byCategory' && (
            <>
              <p className="mb-3 text-xs font-medium text-muted-foreground md:text-sm">Expense breakdown</p>
              <div className="h-[250px] md:h-80">
                {categoryData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data</div>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="72%" paddingAngle={2}>
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={formatTooltipIDR} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <div className="rounded-2xl border border-primary-soft/50 bg-primary-soft/20 p-4 md:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary md:rounded-2xl md:bg-[image:var(--gradient-primary)] md:text-primary-foreground md:shadow-[var(--shadow-glow)]">
              <Trophy className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold md:text-base">
                No-Spend Challenge <Target className="h-4 w-4 text-primary" />
              </p>
              <p className="text-xs text-muted-foreground">{noSpendDays.count} dari {noSpendDays.target} hari tanpa pengeluaran</p>
            </div>
          </div>
          <div className="w-20 shrink-0 md:w-72">
            <Progress value={Math.min(100, (noSpendDays.count / noSpendDays.target) * 100)} className="h-3 rounded-full" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <h3 className="font-semibold">Recent Transactions</h3>
          <Link to="/transactions" className="text-xs font-medium text-primary hover:underline">
            View all -&gt;
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm">Date</th>
                <th className="text-left font-medium px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm">Category</th>
                <th className="text-left font-medium px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm">Note</th>
                <th className="text-right font-medium px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center text-muted-foreground py-10">No transactions this month.</td></tr>
              )}
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-border/60">
                  <td className="px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm text-muted-foreground">
                    {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full ${t.type === 'income' ? 'bg-success' : 'bg-primary'}`} />
                      {t.category}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm text-muted-foreground">{t.note ?? '-'}</td>
                  <td className={`px-3 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm text-right font-semibold ${t.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                    {t.type === 'income' ? '+' : '-'} {formatIDR(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

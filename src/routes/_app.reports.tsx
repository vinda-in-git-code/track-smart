import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { getTransactions, formatIDR, type Transaction } from '@/services/api'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Lightbulb, FileDown, FileSpreadsheet, ShoppingBag, Heart, Menu, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { exportTransactionsCSV, exportReportPDF } from '@/services/exportApi'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/reports')({
  component: Reports,
})

// mapping dr ds
const NEED_CATEGORIES = [
  'Food', 'Coffee Shops', 'Restaurants', 'Fast Food', 'Groceries',
  'Transportation', 'Gas & Fuel', 'Utilities', 'Rent', 'Internet',
  'Mobile Phone', 'Health', 'Household', 'Family', 'Education',
]
const WANT_CATEGORIES = [
  'Entertainment', 'Shopping', 'Social Life', 'Tourism',
  'Alcohol & Bars', 'Movies & Dvds', 'Festivals',
]
const SPLIT_BILL_CATEGORIES = [
  'Restaurants', 'Fast Food', 'Coffee Shops', 'Food',
  'Alcohol & Bars', 'Movies & Dvds', 'Social Life', 'Tourism', 'Festivals',
]

function getNeedWant(category: string): 'Need' | 'Want' | 'Unclassified' {
  if (NEED_CATEGORIES.includes(category)) return 'Need'
  if (WANT_CATEGORIES.includes(category)) return 'Want'
  return 'Unclassified'
}

function getQuarter(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getMonth() + 1) / 3)
}

const DONUT_COLORS = { Need: '#7c3aed', Want: '#f472b6', Unclassified: '#e2e8f0' }
const QUARTER_COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#e879f9']

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow text-xs">
      {label && <p className="font-semibold mb-1">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>
          {p.name !== 'value' ? `${p.name}: ` : ''}{formatIDR(p.value)}
        </p>
      ))}
    </div>
  )
}

function Reports() {
  const [txs, setTxs] = useState<Transaction[] | null>(null)
  const [month, setMonth] = useState('')

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
    return Array.from(new Set(txs.map((t) => t.date.slice(0, 7)))).sort().reverse()
  }, [txs])

  const data = useMemo(() => {
    if (!txs || !month) return null

    const allExp = txs.filter((t) => t.type === 'expense')
    const monthExp = allExp.filter((t) => t.date.startsWith(month))
    const monthInc = txs.filter((t) => t.type === 'income' && t.date.startsWith(month))

    const totalExp = monthExp.reduce((s, t) => s + t.amount, 0)
    const totalInc = monthInc.reduce((s, t) => s + t.amount, 0)
    const savings = totalInc - totalExp
    const savingRate = totalInc > 0 ? Math.round((savings / totalInc) * 100) : 0

    // breakdown category
    const catMap = new Map<string, number>()
    monthExp.forEach((t) => catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount))
    const categories = Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value, pct: totalExp ? Math.round((value / totalExp) * 100) : 0 }))
      .sort((a, b) => b.value - a.value)

    // spending trend 6 bulan
    const trendMap = new Map<string, number>()
    allExp.forEach((t) => {
      const k = t.date.slice(0, 7)
      trendMap.set(k, (trendMap.get(k) ?? 0) + t.amount)
    })
    const trend = Array.from(trendMap.entries())
      .sort()
      .slice(-6)
      .map(([m, value]) => ({
        month: new Date(m + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        value,
      }))

    // rata rata ongluaran per bulan
    const monthlyTotals = Array.from(trendMap.values())
    const avgMonthly = monthlyTotals.length > 0
      ? Math.round(monthlyTotals.reduce((s, v) => s + v, 0) / monthlyTotals.length)
      : 0

    // breakdown semua data 
    const quarterMap = new Map<number, number>()
    allExp.forEach((t) => {
      const q = getQuarter(t.date)
      quarterMap.set(q, (quarterMap.get(q) ?? 0) + t.amount)
    })
    const quarterly = [1, 2, 3, 4].map((q) => ({
      name: `Q${q}`,
      value: quarterMap.get(q) ?? 0,
    }))
    const highestQ = quarterly.reduce((a, b) => a.value > b.value ? a : b)

    // breakdown need vs want
    const needWantMap = new Map<string, number>()
    monthExp.forEach((t) => {
      const label = getNeedWant(t.category)
      needWantMap.set(label, (needWantMap.get(label) ?? 0) + t.amount)
    })
    const needWant = ['Need', 'Want', 'Unclassified']
      .filter((l) => needWantMap.has(l))
      .map((l) => ({ name: l, value: needWantMap.get(l)!, pct: totalExp ? Math.round((needWantMap.get(l)! / totalExp) * 100) : 0 }))

    const needPct = needWant.find(n => n.name === 'Need')?.pct ?? 0
    const wantPct = needWant.find(n => n.name === 'Want')?.pct ?? 0

    // breakdown top split bill categories
    const splitMap = new Map<string, number>()
    allExp.filter((t) => SPLIT_BILL_CATEGORIES.includes(t.category)).forEach((t) => {
      splitMap.set(t.category, (splitMap.get(t.category) ?? 0) + 1)
    })
    const splitCategories = Array.from(splitMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const trendMobile = trend.slice(-3)

    return {
      totalExp, totalInc, savings, savingRate,
      categories, trend, trendMobile, topCategory: categories[0],
      avgMonthly, quarterly, highestQ,
      needWant, needPct, wantPct,
      splitCategories,
    }
  }, [txs, month])

  if (!txs) return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-48" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Mobile Page Header */}
      <div className="md:hidden relative flex items-center justify-center min-h-[50px] mb-5">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-sidebar'))}
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-muted/20 transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">Report</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Insight keuangan kamu
          </p>
        </div>
        {months.length > 0 && (
          <div className="absolute right-0">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-8 w-auto gap-1 rounded-full border border-border/60 bg-card px-2.5 text-xs font-semibold shadow-none hover:bg-muted/20 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70">
                <span>{new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }) + " '" + month.slice(-2)}</span>
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {new Date(m + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Desktop Page Header */}
      <div className="hidden md:flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Analisis keuangan kamu secara lengkap.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {months.length > 0 && (
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-8 w-fit min-w-[130px] gap-1.5 rounded-full border border-border/60 bg-card px-3 text-xs shadow-none hover:bg-muted/50 transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {new Date(m + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" className="rounded-xl"
            onClick={() => { if (!txs) return; exportTransactionsCSV(txs, `transactions-${new Date().toISOString().slice(0, 10)}.csv`); toast.success('CSV diunduh!') }}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> CSV
          </Button>
          <Button className="rounded-xl bg-[image:var(--gradient-primary)]"
            onClick={() => { if (!data) return; exportReportPDF({ totalExp: data.totalExp, categories: data.categories, trend: data.trend, filename: `report-${month}.pdf` }); toast.success('PDF diunduh!') }}>
            <FileDown className="h-4 w-4 mr-1.5" /> PDF
          </Button>
        </div>
      </div>

      {!data ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
          Belum ada transaksi.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {/* Mobile summary card (Mockup replica) */}
          <div className="md:hidden space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-[var(--shadow-card)]">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">BULAN INI</p>
              <p className="text-2xl font-bold text-foreground mt-1">{formatIDR(data.totalExp)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total pengeluaran</p>
            </div>
          </div>

          {/* Desktop summary cards grid */}
          <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Income', value: formatIDR(data.totalInc), color: 'text-emerald-500' },
              { label: 'Expenses', value: formatIDR(data.totalExp), color: 'text-destructive' },
              { label: 'Savings', value: formatIDR(data.savings), color: data.savings >= 0 ? 'text-primary' : 'text-destructive' },
              { label: 'Saving Rate', value: `${data.savingRate}%`, color: 'text-violet-500' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* BQ1 — Avg monthly + Insight & mobile actions */}
          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 gap-3">
            {/* Mobile Insight & Export Actions (Mockup replica) */}
            <div className="md:hidden space-y-3">
              <div className="rounded-2xl bg-[#8b5cf6] text-white p-4 shadow-[var(--shadow-glow)]">
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  <Lightbulb className="h-4.5 w-4.5 shrink-0 text-white fill-white/10" /> Insight
                </div>
                <p className="mt-1.5 text-xs sm:text-sm font-semibold leading-normal opacity-95">
                  {data.topCategory
                    ? `Pengeluaran terbesar bulan ini: ${data.topCategory.name} (${data.topCategory.pct}% dari total).`
                    : 'Belum ada pengeluaran bulan ini.'}
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="w-1/2 rounded-full h-11 border border-slate-200 bg-white text-slate-900 font-bold hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 shadow-[var(--shadow-soft)]"
                  onClick={() => { if (!txs) return; exportTransactionsCSV(txs, `transactions-${new Date().toISOString().slice(0, 10)}.csv`); toast.success('CSV diunduh!') }}
                >
                  <FileText className="h-4 w-4 mr-1.5 shrink-0 text-foreground" /> CSV
                </Button>
                <Button
                  className="w-1/2 rounded-full h-11 bg-[#8b5cf6] text-white font-bold hover:bg-violet-600 shadow-[var(--shadow-soft)]"
                  onClick={() => { if (!data) return; exportReportPDF({ totalExp: data.totalExp, categories: data.categories, trend: data.trend, filename: `report-${month}.pdf` }); toast.success('PDF diunduh!') }}
                >
                  <FileText className="h-4 w-4 mr-1.5 shrink-0 text-white" /> PDF
                </Button>
              </div>
            </div>

            {/* Desktop Avg Monthly card */}
            <div className="hidden md:block rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Rata-rata Pengeluaran / Bulan</p>
              <p className="text-2xl font-bold text-primary">{formatIDR(data.avgMonthly)}</p>
              <p className="text-xs text-muted-foreground mt-1">Dihitung dari seluruh riwayat transaksi</p>
            </div>

            {/* Desktop Insight card */}
            <div className="hidden md:flex rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground p-5 shadow-[var(--shadow-glow)] items-start gap-3">
              <Lightbulb className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold opacity-90">Insight Bulan Ini</p>
                <p className="mt-1 text-sm font-medium leading-snug">
                  {data.topCategory
                    ? <>Pengeluaran terbesar: <strong>{data.topCategory.name}</strong> ({data.topCategory.pct}% · {formatIDR(data.topCategory.value)})</>
                    : 'Belum ada pengeluaran bulan ini.'}
                </p>
              </div>
            </div>
          </div>

          {/* BQ2 — Quarterly */}
          <div className="hidden md:block rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold">Pengeluaran per Kuartal</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tertinggi: <span className="text-primary font-semibold">{data.highestQ.name}</span> · {formatIDR(data.highestQ.value)}
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={data.quarterly} barSize={48}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {data.quarterly.map((_, i) => (
                      <Cell key={i} fill={QUARTER_COLORS[i]} opacity={data.quarterly[i].name === data.highestQ.name ? 1 : 0.5} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* BQ3 — Need vs Want + BQ4 Split Bill Categories (side by side) */}
          <div className="hidden md:grid md:grid-cols-2 gap-4">

            {/* Need vs Want Donut */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Kebutuhan vs Keinginan</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Bulan ini berdasarkan kategori</p>
              {data.needWant.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Belum ada data</div>
              ) : (
                <>
                  <div className="h-48">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={data.needWant} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                          {data.needWant.map((entry) => (
                            <Cell key={entry.name} fill={DONUT_COLORS[entry.name as keyof typeof DONUT_COLORS] ?? '#ccc'} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1 rounded-xl bg-violet-50 dark:bg-violet-950/30 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Kebutuhan</p>
                      <p className="text-lg font-bold text-violet-600">{data.needPct}%</p>
                    </div>
                    <div className="flex-1 rounded-xl bg-pink-50 dark:bg-pink-950/30 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Keinginan</p>
                      <p className="text-lg font-bold text-pink-500">{data.wantPct}%</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Top Split Bill Categories */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Top Kategori Split Bill</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Kategori yang paling sering dibelanja bareng</p>
              {data.splitCategories.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Belum ada data</div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer>
                    <BarChart data={data.splitCategories} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={11} width={80} />
                      <Tooltip
                        formatter={(v: any) => [`${v} transaksi`, 'Frekuensi']}
                        contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)' }}
                      />
                      <Bar dataKey="count" fill="#a78bfa" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {data.splitCategories[0] && (
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  🏆 <strong>{data.splitCategories[0].name}</strong> paling sering jadi bahan split bill
                </p>
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-[var(--shadow-card)]">
            <h3 className="font-bold text-base mb-1">Category Breakdown</h3>
            <p className="text-xs text-muted-foreground mb-4">Pengeluaran per kategori bulan ini</p>
            <div className="h-72">
              {data.categories.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Belum ada data</div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={data.categories} layout="vertical" margin={{ left: -15, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={11} width={80} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Spending Trend - Mobile View */}
          <div className="md:hidden rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base">Spending Trend</h3>
                <p className="text-xs text-muted-foreground mt-0.5">3 bulan terakhir</p>
              </div>
              <TrendingUp className="h-5 w-5 text-[#8b5cf6]" />
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={data.trendMobile} margin={{ left: -15, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1-mobile" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fill="url(#g1-mobile)"
                    dot={{ r: 4, stroke: '#8b5cf6', strokeWidth: 2, fill: '#fff', fillOpacity: 1 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Spending Trend - Desktop View */}
          <div className="hidden md:block rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Spending Trend</h3>
                <p className="text-xs text-muted-foreground mt-0.5">6 bulan terakhir</p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={data.trend}>
                  <defs>
                    <linearGradient id="g1-desktop" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    fill="url(#g1-desktop)"
                    dot={{ r: 4, stroke: 'var(--chart-1)', strokeWidth: 2, fill: '#fff', fillOpacity: 1 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
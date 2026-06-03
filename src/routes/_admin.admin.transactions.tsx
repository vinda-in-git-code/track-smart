import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAdminTransactions, type AdminTx } from '@/services/adminApi'
import { formatIDR } from '@/services/api'
import { toast } from 'sonner'

export const Route = createFileRoute('/_admin/admin/transactions')({
  component: TxPage,
})

function TxPage() {
  const [txs, setTxs] = useState<AdminTx[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [cat, setCat] = useState('all')

  useEffect(() => { getAdminTransactions().then(setTxs) }, [])

  const categories = useMemo(() => Array.from(new Set(txs.map((t) => t.category))), [txs])

  const filtered = useMemo(() => txs.filter((t) => {
    if (from && t.date < from) return false
    if (to && t.date > to) return false
    if (cat !== 'all' && t.category !== cat) return false
    return true
  }), [txs, from, to, cat])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Transaction Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">Pantau seluruh transaksi pengguna.</p>
        </div>
        <Button onClick={() => toast.info('CSV export — coming soon')} className="rounded-xl bg-[image:var(--gradient-primary)]">
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="bg-card border border-border/60 rounded-3xl p-4 md:p-6 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-xl mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-xl mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Category</label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="h-10 rounded-xl mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <Th>User</Th><Th>Date</Th><Th>Type</Th><Th>Category</Th><Th className="text-right">Amount</Th><Th>Method</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-border/60 hover:bg-accent/40 transition-colors">
                  <Td className="font-medium">{t.user}</Td>
                  <Td>{t.date}</Td>
                  <Td>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${t.type === 'income' ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive'}`}>{t.type}</span>
                  </Td>
                  <Td>{t.category}</Td>
                  <Td className="text-right font-semibold">{formatIDR(t.amount)}</Td>
                  <Td className="text-muted-foreground">{t.paymentMethod}</Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No transactions.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left font-medium text-xs uppercase tracking-wide px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}
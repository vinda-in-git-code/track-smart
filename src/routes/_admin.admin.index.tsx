import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Users, Receipt, Layers, Activity as ActivityIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getAdminOverview, type Activity } from '@/services/adminApi'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_admin/admin/')({
  component: AdminOverview,
})

function AdminOverview() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminOverview>> | null>(null)

  useEffect(() => { getAdminOverview().then(setData) }, [])

  if (!data) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Ringkasan sistem & aktivitas terkini.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} label="Total Users" value={data.totalUsers.toLocaleString()} />
        <Stat icon={Receipt} label="Total Transactions" value={data.totalTransactions.toLocaleString()} />
        <Stat icon={Layers} label="Split Bill Sessions" value={data.totalSplitBills.toLocaleString()} />
        <Stat icon={ActivityIcon} label="Active Today" value="—" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-3xl p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Daily Active Users</h2>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dau}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }} />
                <Bar dataKey="users" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-semibold mb-4">Recent Activity</h2>
          <ul className="space-y-3 max-h-72 overflow-auto pr-1">
            {data.activity.map((a: Activity) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <div className="h-8 w-8 rounded-full bg-primary-soft flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                  {a.user[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate"><span className="font-medium">{a.user}</span> {a.action}</p>
                  <p className="text-[11px] text-muted-foreground">{a.at}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="h-8 w-8 rounded-lg bg-primary-soft flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  )
}
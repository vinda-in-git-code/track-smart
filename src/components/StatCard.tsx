import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type Props = {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: 'primary' | 'success' | 'warning' | 'destructive'
  className?: string
}

const toneMap = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-[oklch(0.94_0.06_160)] text-[oklch(0.45_0.14_160)]',
  warning: 'bg-[oklch(0.96_0.08_75)] text-[oklch(0.45_0.14_75)]',
  destructive: 'bg-[oklch(0.96_0.05_25)] text-destructive',
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'primary', className }: Props) {
  return (
    <div className={cn('relative rounded-2xl bg-card p-3 shadow-[var(--shadow-card)] border border-border/60 sm:p-5', className)}>
      <div className="min-w-0">
        <div className="pr-8 sm:pr-11">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sm:text-xs">{label}</p>
        </div>
        <p className="mt-2.5 whitespace-nowrap text-sm min-[360px]:text-base min-[400px]:text-lg font-bold leading-none tracking-tight sm:text-2xl">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className={cn('absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full sm:right-5 sm:top-5 sm:h-10 sm:w-10', toneMap[tone])}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
    </div>
  )
}

import { supabase } from '@/integrations/supabase/client'
import type { Category } from './api'

export type Budget = {
  id: string
  user_id: string
  category: Category
  limit: number
  month: string
  created_at: string
}

export async function getBudgets(): Promise<Budget[]> {
  const month = new Date().toISOString().slice(0, 7)
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('month', month)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((b) => ({ ...b, limit: b.amount })) as Budget[]
}

export async function upsertBudget(category: string, limit: number): Promise<void> {
  const month = new Date().toISOString().slice(0, 7)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: existing } = await supabase
    .from('budgets')
    .select('id')
    .eq('user_id', user.id)
    .eq('category', category)
    .eq('month', month)
    .single()
  if (existing) {
    await supabase.from('budgets').update({ amount: limit }).eq('id', existing.id)
  } else {
    await supabase.from('budgets').insert({ user_id: user.id, category, amount: limit, month })
  }
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export function getBudgetStatus(spent: number, limit: number): 'safe' | 'warning' | 'exceeded' {
  if (spent >= limit) return 'exceeded'
  if (spent / limit >= 0.8) return 'warning'
  return 'safe'
}
import { supabase } from '@/integrations/supabase/client'

export type SavingsGoal = {
  id: string
  user_id: string
  name: string
  emoji: string
  targetAmount: number
  savedAmount: number
  targetDate: string
  created_at: string
}

export async function getGoals(): Promise<SavingsGoal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((g) => ({
    id: g.id,
    user_id: g.user_id,
    name: g.name,
    emoji: g.emoji ?? '🎯',
    targetAmount: g.target_amount,
    savedAmount: g.current_amount,
    targetDate: g.deadline ?? new Date().toISOString().slice(0, 10),
    created_at: g.created_at,
  }))
}

export async function addGoal(goal: {
  name: string
  targetAmount: number
  targetDate: string
  emoji: string
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('goals').insert({
    user_id: user.id,
    name: goal.name,
    emoji: goal.emoji,
    target_amount: goal.targetAmount,
    current_amount: 0,
    deadline: goal.targetDate,
  })
  if (error) throw new Error(error.message)
}

export async function contributeToGoal(id: string, amount: number): Promise<SavingsGoal | null> {
  const { data: goal, error: fetchError } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw new Error(fetchError.message)
  const newAmount = Math.max(0, goal.current_amount + amount)
  const { error } = await supabase
    .from('goals')
    .update({ current_amount: newAmount })
    .eq('id', id)
  if (error) throw new Error(error.message)
  return {
    id: goal.id,
    user_id: goal.user_id,
    name: goal.name,
    emoji: goal.emoji ?? '🎯',
    targetAmount: goal.target_amount,
    savedAmount: newAmount,
    targetDate: goal.deadline ?? '',
    created_at: goal.created_at,
  }
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export function monthsUntil(targetDate: string): number {
  const now = new Date()
  const target = new Date(targetDate)
  const diff = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  return Math.max(0, diff)
}

export function monthlyRequired(goal: SavingsGoal): number {
  const months = monthsUntil(goal.targetDate)
  if (months <= 0) return Math.max(0, goal.targetAmount - goal.savedAmount)
  return Math.ceil((goal.targetAmount - goal.savedAmount) / months)
}
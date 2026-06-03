import { supabase } from '@/integrations/supabase/client'
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function register(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  })
  if (error) throw new Error(error.message)
  return data
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export type Transaction = {
  id: string
  user_id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  note?: string
  date: string
  payment_method?: string
  created_at: string
}

export function parseIDR(str: string): number {
  return Number(str.replace(/[^0-9]/g, '')) || 0
}

export function formatIDR(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export async function getTransactions() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Transaction[]
}

export async function addTransaction(tx: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...tx, user_id: user.id })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Transaction
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}


export type Budget = {
  id: string
  user_id: string
  category: string
  amount: number
  month: string
  created_at: string
}

export type Category =
  | 'Food'
  | 'Transportation'
  | 'Shopping'
  | 'Entertainment'
  | 'Health'
  | 'Education'
  | 'Utilities'
  | 'Groceries'
  | 'Restaurants'
  | 'Coffee Shops'
  | 'Social Life'
  | 'Other'

export async function getBudgets(month: string) {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('month', month)

  if (error) throw new Error(error.message)

  return data as Budget[]
}

export async function addBudget(
  budget: Omit<Budget, 'id' | 'user_id' | 'created_at'>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('budgets')
    .insert({ ...budget, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as Budget
}

export async function deleteBudget(id: string) {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export type Goal = {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  deadline?: string
  created_at: string
}

export async function getGoals() {
  const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Goal[]
}

export async function addGoal(goal: Omit<Goal, 'id' | 'user_id' | 'created_at'>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('goals')
    .insert({ ...goal, user_id: user.id })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Goal
}

export async function updateGoal(id: string, updates: Partial<Goal>) {
  const { data, error } = await supabase.from('goals').update(updates).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Goal
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function loginWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`
    }
  })
  if (error) throw new Error(error.message)
  return data
}

export function getCurrentUser() {
  return null
}

export async function getUserRole(): Promise<'admin' | 'user'> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'user'
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  return (data?.role as 'admin' | 'user') ?? 'user'
}

export function onAuthChange(callback: (user: { id: string; email: string; name: string } | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        email: session.user.email ?? '',
        name: (session.user.user_metadata?.full_name as string) ?? session.user.email?.split('@')[0] ?? 'User',
      })
    } else {
      callback(null)
    }
  })
}

export async function forgotPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-pass`,
  })

  if (error) throw error
}

export type OcrItem = {
  nama_barang: string
  jumlah_barang: number
  total_harga_barang: number
}

export type OcrResult = {
  items: OcrItem[]
  total_belanja: number
  raw_text: string
  cleaned_text: string
  item_text_for_classification: string
}

export async function scanReceipt(file: File): Promise<OcrResult> {
  const formData = new FormData()
  formData.append('file', file)

  const { data: { user } } = await supabase.auth.getUser()

  const res = await fetch(`${API_BASE}/api/ocr`, {
    method: 'POST',
    body: formData,
    headers: user ? { 'x-user-id': user.id } : {},
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `OCR failed: ${res.status}`)
  }

  return res.json()
}

export async function saveOcrLog(
  filename: string,
  result: OcrResult,
  status: 'success' | 'failed'
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('ocr_logs').insert({
    user_id: user.id,
    filename,
    status,
    items_count: result.items.length,
    total_belanja: result.total_belanja,
    items: result.items.map(i => ({ name: i.nama_barang, price: i.total_harga_barang })),
    raw_text: result.raw_text,
  })
}

export type SplitBillRecord = {
  id: string
  title: string
  filename: string
  total_belanja: number
  items: { nama_barang: string; jumlah_barang: number; total_harga_barang: number }[]
  people: { id: string; name: string; color: string }[]
  assignments: Record<string, string[]>
  person_totals: Record<string, number>
  created_at: string
}

export async function saveSplitBill(payload: {
  title: string
  filename: string
  total_belanja: number
  items: OcrItem[]
  people: { id: string; name: string; color: string }[]
  assignments: Record<number, string[]>
  person_totals: Record<string, number>
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not logged in')

  const { error } = await supabase.from('split_bills').insert({
    user_id: user.id,
    title: payload.title,
    filename: payload.filename,
    total_belanja: payload.total_belanja,
    items: payload.items,
    people: payload.people,
    assignments: payload.assignments,
    person_totals: payload.person_totals,
  })
  if (error) throw new Error(error.message)
}

export async function getSplitBills(): Promise<SplitBillRecord[]> {
  const { data, error } = await supabase
    .from('split_bills')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as SplitBillRecord[]
}

export async function deleteSplitBill(id: string) {
  const { error } = await supabase.from('split_bills').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

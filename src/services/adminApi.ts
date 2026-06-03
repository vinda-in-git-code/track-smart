export type Role = 'admin' | 'user'

export type AdminUser = {
  id: string; name: string; email: string; registerDate: string; status: 'active' | 'inactive'
}

export type AdminTx = {
  id: string; user: string; date: string; type: 'income' | 'expense'
  category: string; amount: number; paymentMethod: string
}

export type OcrLog = {
  id: string; user: string; uploadedAt: string; filename: string
  itemsCount: number; status: 'success' | 'failed'; items?: { name: string; price: number }[]
}

export type Activity = { id: string; user: string; action: string; at: string }

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/admin`

export async function getAdminOverview() {
  const res = await fetch(`${BASE}/overview`)
  return res.json()
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${BASE}/users`)
  return res.json()
}

export async function getAdminTransactions(): Promise<AdminTx[]> {
  const res = await fetch(`${BASE}/transactions`)
  return res.json()
}

export async function getOcrLogs(): Promise<OcrLog[]> {
  const res = await fetch(`${BASE}/ocr-logs`)
  return res.json()
}

export async function toggleUserStatus(_id: string): Promise<AdminUser | null> {
  return null
}

export async function getRoles(): Promise<{ user_id: string; role: string; profiles: { full_name: string | null; email: string | null } }[]> {
  const res = await fetch(`${BASE}/roles`)
  return res.json()
}

export async function setUserRole(user_id: string, role: 'admin' | 'user'): Promise<void> {
  await fetch(`${BASE}/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, role }),
  })
}

export async function removeUserRole(user_id: string): Promise<void> {
  await fetch(`${BASE}/roles/${user_id}`, { method: 'DELETE' })
}

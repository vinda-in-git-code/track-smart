const express = require('express')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '../../.env' })

const router = express.Router()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET /api/admin/overview
router.get('/overview', async (req, res) => {
  try {
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })

    const { data: recentTxs } = await supabase
      .from('transactions')
      .select('id, user_id, type, category, amount, date, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(10)

    const activity = (recentTxs ?? []).map((t) => ({
      id: t.id,
      user: t.profiles?.full_name ?? t.profiles?.email ?? 'Unknown',
      action: `${t.type === 'income' ? 'Added income' : 'Added expense'} ${t.category}`,
      at: new Date(t.date).toLocaleDateString('id-ID'),
    }))

    const dau = [
      { day: 'Mon', users: 0 }, { day: 'Tue', users: 0 }, { day: 'Wed', users: 0 },
      { day: 'Thu', users: 0 }, { day: 'Fri', users: 0 }, { day: 'Sat', users: 0 }, { day: 'Sun', users: 0 },
    ]

    res.json({ totalUsers: totalUsers ?? 0, totalTransactions: totalTransactions ?? 0, totalSplitBills: 0, activity, dau })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error

    const users = (data ?? []).map((p) => ({
      id: p.id,
      name: p.full_name ?? p.email ?? 'Unknown',
      email: p.email ?? '',
      registerDate: p.created_at?.slice(0, 10) ?? '',
      status: 'active',
    }))

    res.json(users)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/transactions
router.get('/transactions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, profiles(full_name, email)')
      .order('date', { ascending: false })
      .limit(100)
    if (error) throw error

    const txs = (data ?? []).map((t) => ({
      id: t.id,
      user: t.profiles?.full_name ?? t.profiles?.email ?? 'Unknown',
      date: t.date,
      type: t.type,
      category: t.category,
      amount: t.amount,
      paymentMethod: t.payment_method ?? '—',
    }))

    res.json(txs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/ocr-logs
router.get('/ocr-logs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ocr_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error

    const logs = (data ?? []).map((l) => ({
      id: l.id,
      user: l.user_id ?? 'Unknown',
      uploadedAt: new Date(l.created_at).toLocaleString('id-ID'),
      filename: l.filename,
      itemsCount: l.items_count,
      status: l.status,
      items: l.items ?? [],
    }))

    res.json(logs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/roles
router.get('/roles', async (req, res) => {
  try {
    const { data: roles, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error

    // Fetch profiles terpisah
    const userIds = (roles ?? []).map((r) => r.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

    const result = (roles ?? []).map((r) => ({
      ...r,
      profiles: profileMap[r.user_id] ?? null,
    }))

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/roles
router.post('/roles', async (req, res) => {
  try {
    const { user_id, role } = req.body
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id, role }, { onConflict: 'user_id' })
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/admin/roles/:user_id
router.delete('/roles/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', user_id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
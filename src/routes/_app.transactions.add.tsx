import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { addTransaction, formatIDR, parseIDR, scanReceipt } from '@/services/api'
import { classifyReceipt, type ReceiptClassification } from '@/services/classifierApi'
import { type OcrResult } from '@/services/api'
import { toast } from 'sonner'
import { ArrowLeft, Info, Loader2, Upload } from 'lucide-react'

export const Route = createFileRoute('/_app/transactions/add')({
  component: AddTx,
})

const CATEGORIES_EXPENSE = [
  'Food', 'Transportation', 'Shopping', 'Entertainment',
  'Health', 'Education', 'Utilities', 'Groceries',
  'Restaurants', 'Coffee Shops', 'Social Life', 'Other'
]

const CATEGORIES_INCOME = [
  'Salary', 'Paycheck', 'Bonus', 'Interest', 'Gift', 'Other'
]

const NEED_CATEGORIES = [
  'Food', 'Coffee Shops', 'Restaurants', 'Fast Food', 'Groceries',
  'Transportation', 'Gas & Fuel', 'Utilities', 'Rent', 'Internet',
  'Mobile Phone', 'Health', 'Household', 'Family', 'Education',
]
const WANT_CATEGORIES = [
  'Entertainment', 'Shopping', 'Social Life', 'Tourism',
  'Alcohol & Bars', 'Movies & Dvds', 'Festivals',
]

function getNeedWant(category: string): 'Need' | 'Want' | 'Unclassified' {
  if (NEED_CATEGORIES.includes(category)) return 'Need'
  if (WANT_CATEGORIES.includes(category)) return 'Want'
  return 'Unclassified'
}

const NEED_WANT_CONFIG = {
  Need: {
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    desc: 'Pengeluaran kebutuhan pokok.',
  },
  Want: {
    badge: 'bg-pink-100 text-pink-600 dark:bg-pink-950/40 dark:text-pink-300',
    desc: 'Pengeluaran keinginan — bisa dikontrol.',
  },
  Unclassified: {
    badge: 'bg-muted text-muted-foreground',
    desc: 'Kategori ini belum terklasifikasi.',
  },
}

function AddTx() {
  const navigate = useNavigate()
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amountStr, setAmountStr] = useState('')
  const [category, setCategory] = useState('')
  const [payment_method, setPaymentMethod] = useState('Cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [scanningReceipt, setScanningReceipt] = useState(false)
  const [_ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [classification, setClassification] = useState<ReceiptClassification | null>(null)

  const categories = type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE
  const label = type === 'expense' && category ? getNeedWant(category) : null
  const isSavingsHint = note.toLowerCase().includes('saving') || note.toLowerCase().includes('tabung')

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanningReceipt(true)
    setOcrResult(null)
    setClassification(null)
    setType('expense')

    try {
      const result = await scanReceipt(file)
      setOcrResult(result)

      if (result.total_belanja) setAmountStr(String(result.total_belanja))

      const itemSummary = result.items
        .slice(0, 5)
        .map((item) => item.nama_barang)
        .join(', ')

      if (!note) {
        setNote(itemSummary ? `Scan struk: ${itemSummary}` : `Scan struk: ${file.name}`)
      }

      try {
        const predicted = await classifyReceipt(result)
        setClassification(predicted)

        const matchedCategory = CATEGORIES_EXPENSE.find(
          (c) => c.toLowerCase() === predicted.predicted_category.toLowerCase()
        ) ?? 'Other'

        setCategory(matchedCategory)
        toast.success(`Kategori otomatis: ${matchedCategory}`)
      } catch (err: any) {
        toast.error(err.message || 'OCR berhasil, klasifikasi gagal.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal scan struk.')
    } finally {
      setScanningReceipt(false)
      e.target.value = ''
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseIDR(amountStr)
    if (!amount) return toast.error('Masukkan nominal yang valid.')
    if (!category) return toast.error('Pilih kategori dulu!')
    setSaving(true)
    try {
      await addTransaction({
        type,
        amount: parseIDR(amountStr),
        category,
        note: note || undefined,
        date,
        payment_method,
      })
      toast.success('Transaksi tersimpan!')
      navigate({ to: '/transactions' })
    } catch {
      toast.error('Gagal menyimpan transaksi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/transactions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tambah Transaksi</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">Catat pemasukan atau pengeluaran kamu.</p>

      <form onSubmit={submit} className="bg-card border border-border/60 rounded-3xl p-6 shadow-[var(--shadow-card)] space-y-5">
        {/* Type toggle */}
        <div className="grid grid-cols-2 bg-muted p-1 rounded-xl">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setCategory('') }}
              className={`py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                type === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              {t === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
            </button>
          ))}
        </div>

        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label className="flex items-center gap-2">
                Scan struk otomatis
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                OCR akan membaca struk, lalu classifier memilih kategori transaksi.
              </p>
            </div>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              onChange={handleReceiptUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              disabled={scanningReceipt}
              onClick={() => receiptInputRef.current?.click()}
              className="h-10 rounded-xl"
            >
              {scanningReceipt ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {scanningReceipt ? 'Memproses...' : 'Upload struk'}
            </Button>
          </div>

          {classification && (
            <div className="rounded-xl border border-primary/20 bg-background/80 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Kategori: {classification.predicted_category}</span>
                <span className="text-xs text-muted-foreground">
                  Confidence {(classification.confidence * 100).toFixed(2)}%
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {classification.cleaned_text}
              </p>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label>Nominal (IDR)</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
            <Input
              inputMode="numeric"
              value={amountStr ? new Intl.NumberFormat('id-ID').format(parseIDR(amountStr)) : ''}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0"
              className="h-14 pl-11 text-xl font-bold rounded-xl"
            />
          </div>
          {amountStr && <p className="text-xs text-muted-foreground">{formatIDR(parseIDR(amountStr))}</p>}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Date */}
          <div className="space-y-1.5">
            <Label>Tanggal</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" />
          </div>

          {/* Category + Need/Want preview */}
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Preview label Need/Want */}
            {label && (
              <div className="flex items-center gap-2 pt-0.5">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${NEED_WANT_CONFIG[label].badge}`}>
                  {label}
                </span>
                <span className="text-[11px] text-muted-foreground">{NEED_WANT_CONFIG[label].desc}</span>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="space-y-1.5">
            <Label>Metode Pembayaran</Label>
            <Select value={payment_method} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Cash', 'QRIS', 'Bank', 'Card', 'E-Wallet'].map((p) =>
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <Label>Catatan (opsional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Misal: makan siang dengan tim"
            className="rounded-xl min-h-20"
          />
          {/*nyatet*/}
          {isSavingsHint && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Mau catat tabungan? Catat sebagai <strong>Pengeluaran</strong> di rekening asal,
                lalu catat lagi sebagai <strong>Pemasukan</strong> di rekening tujuan.
                Saldo tabungan otomatis terhitung di Reports.
              </span>
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-12 rounded-xl bg-[image:var(--gradient-primary)] hover:opacity-95 shadow-[var(--shadow-soft)]"
        >
          {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
        </Button>
      </form>
    </div>
  )
}

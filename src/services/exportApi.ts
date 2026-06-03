import type { Transaction } from './api'

export function exportTransactionsCSV(txs: Transaction[], filename: string) {
  const headers = ['Date', 'Type', 'Category', 'Amount', 'Payment Method', 'Note']
  const rows = txs.map((t) => [
    t.date,
    t.type,
    t.category,
    t.amount,
    t.payment_method ?? '',
    t.note ?? '',
  ])

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportReportPDF({
  totalExp,
  categories,
  trend,
  filename,
}: {
  totalExp: number
  categories: { name: string; value: number; pct: number }[]
  trend: { month: string; value: number }[]
  filename: string
}) {
  import('jspdf').then(({ default: jsPDF }) => {
    const doc = new jsPDF()

    // header
    doc.setFontSize(20)
    doc.setTextColor(40, 40, 40)
    doc.text('Track Smart — Financial Report', 20, 25)

    doc.setFontSize(11)
    doc.setTextColor(120, 120, 120)
    doc.text(`Generated: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 20, 35)

    // buat total
    doc.setFontSize(13)
    doc.setTextColor(40, 40, 40)
    doc.text('Total Pengeluaran Bulan Ini', 20, 55)
    doc.setFontSize(18)
    doc.setTextColor(80, 80, 200)
    doc.text(
      new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalExp),
      20, 67
    )

    // breadkown category
    doc.setFontSize(13)
    doc.setTextColor(40, 40, 40)
    doc.text('Category Breakdown', 20, 87)

    let y = 97
    categories.slice(0, 10).forEach((c) => {
      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)
      doc.text(`${c.name}`, 25, y)
      doc.text(
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(c.value),
        120, y
      )
      doc.text(`${c.pct}%`, 175, y)
      y += 9
    })

    // trend 6 months
    y += 10
    doc.setFontSize(13)
    doc.setTextColor(40, 40, 40)
    doc.text('Spending Trend (3 Bulan Terakhir)', 20, y)
    y += 10

    trend.forEach((t) => {
      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)
      doc.text(t.month, 25, y)
      doc.text(
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(t.value),
        120, y
      )
      y += 9
    })

    doc.save(filename)
  })
}
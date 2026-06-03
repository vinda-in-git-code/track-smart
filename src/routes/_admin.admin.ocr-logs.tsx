import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getOcrLogs, type OcrLog } from '@/services/adminApi'
import { formatIDR } from '@/services/api'

export const Route = createFileRoute('/_admin/admin/ocr-logs')({
  component: OcrLogsPage,
})

function OcrLogsPage() {
  const [logs, setLogs] = useState<OcrLog[]>([])
  const [status, setStatus] = useState<'all' | 'success' | 'failed'>('all')
  const [detail, setDetail] = useState<OcrLog | null>(null)

  useEffect(() => { getOcrLogs().then(setLogs) }, [])

  const filtered = useMemo(() => logs.filter((l) => status === 'all' || l.status === status), [logs, status])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">OCR Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Riwayat hasil scan struk.</p>
      </div>

      <div className="bg-card border border-border/60 rounded-3xl p-4 md:p-6 shadow-[var(--shadow-card)]">
        <div className="mb-4 max-w-xs">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <Th>User</Th><Th>Uploaded</Th><Th>File</Th><Th className="text-right">Items</Th><Th>Status</Th><Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-border/60 hover:bg-accent/40 transition-colors">
                  <Td className="font-medium">{l.user}</Td>
                  <Td className="text-muted-foreground">{l.uploadedAt}</Td>
                  <Td className="font-mono text-xs">{l.filename}</Td>
                  <Td className="text-right">{l.itemsCount}</Td>
                  <Td>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${l.status === 'success' ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive'}`}>{l.status}</span>
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setDetail(l)} disabled={l.status === 'failed'}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Extracted Items — {detail?.filename}</DialogTitle></DialogHeader>
          {detail && (
            <div className="divide-y divide-border/60 text-sm">
              {detail.items?.map((it, i) => (
                <div key={i} className="flex justify-between py-2">
                  <span>{it.name}</span>
                  <span className="font-medium">{formatIDR(it.price)}</span>
                </div>
              ))}
              {!detail.items?.length && <p className="text-muted-foreground py-4">No items extracted.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left font-medium text-xs uppercase tracking-wide px-4 py-3 ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}
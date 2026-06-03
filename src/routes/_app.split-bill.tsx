import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera, Upload, X, Loader2, Plus, FileDown,
  UserCircle2, History, Trash2, Check, Pencil, PlusCircle, Receipt,
  FileText, Circle, CheckCircle2, BookmarkCheck, Wallet
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScanBarcode } from "lucide-react";
import {
  scanReceipt, saveSplitBill, getSplitBills, deleteSplitBill, addTransaction,
  type OcrItem, type SplitBillRecord, formatIDR,
} from "@/services/api";
import { classifyReceipt, type ReceiptClassification } from "@/services/classifierApi";
import { useMobilePageTitle } from "@/hooks/useMobilePageTitle";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/split-bill")({
  head: () => ({ meta: [{ title: "Split Bill — Track Smart" }] }),
  component: SplitBill,
});

type Person = { id: string; name: string; color: string };
type Assignment = Record<number, string[]>;
type EditableItem = OcrItem & { _edited?: boolean };
type ExtraCharge = { id: string; label: string; amount: number; isPercent: boolean; percentOf: 'subtotal' };

const COLORS = ["#f87171","#fb923c","#facc15","#4ade80","#38bdf8","#a78bfa","#f472b6","#34d399"];
const COMMON_EXTRAS = [
  { label: "Service Charge 5%", amount: 5, isPercent: true },
  { label: "Service Charge 10%", amount: 10, isPercent: true },
  { label: "PPN 11%", amount: 11, isPercent: true },
  { label: "PB1 10%", amount: 10, isPercent: true },
];
function genId() { return Math.random().toString(36).slice(2, 8); }

// Track split bills yang sudah dicatat ke transaksi (pakai localStorage biar persist)
function getRecordedIds(): Set<string> {
  try {
    const raw = localStorage.getItem('split_bill_recorded')
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}
function markAsRecorded(id: string) {
  try {
    const ids = getRecordedIds()
    ids.add(id)
    localStorage.setItem('split_bill_recorded', JSON.stringify([...ids]))
  } catch {}
}

const EXPENSE_CATEGORIES = [
  'Food', 'Transportation', 'Shopping', 'Entertainment',
  'Health', 'Education', 'Utilities', 'Groceries',
  'Restaurants', 'Coffee Shops', 'Social Life', 'Other'
]

function SplitBill() {
  const [tab, setTab] = useState<"scan" | "history">("scan");
  const [history, setHistory] = useState<SplitBillRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState<SplitBillRecord | null>(null);
  const [recordedIds, setRecordedIds] = useState<Set<string>>(getRecordedIds);
  const { setTitle } = useMobilePageTitle();

  useEffect(() => {
    setTitle("Split Bill", "Foto struk, ekstrak otomatis, lalu bagi adil");
    return () => setTitle("");
  }, [setTitle]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try { setHistory(await getSplitBills()); } catch {}
    finally { setHistoryLoading(false); }
  };

  const handleMarkRecorded = (id: string) => {
    markAsRecorded(id)
    setRecordedIds(getRecordedIds())
  }

  useEffect(() => { if (tab === "history") loadHistory(); }, [tab]);

  return (
    <div className="space-y-5">
      {/* Page Header - hidden on mobile since navbar shows title */}
      <div className="hidden md:block">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Split Bill</h1>
        <p className="text-sm text-muted-foreground mt-1 break-words">
          Scan struk, atur pembagian, dan tagih teman.
        </p>
      </div>

      <div className="flex gap-2 bg-muted/50 p-1 rounded-2xl w-fit">
        {(["scan", "history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
              tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t === "scan"
              ? <><Camera className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />Scan</>
              : <><History className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />Riwayat</>}
          </button>
        ))}
      </div>

      {tab === "scan" && <ScanTab onSaved={() => { setTab("history"); loadHistory(); }} />}
      {tab === "history" && (
        <HistoryTab
          history={history}
          loading={historyLoading}
          recordedIds={recordedIds}
          onDelete={async (id) => { await deleteSplitBill(id); loadHistory(); }}
          onView={setDetailRecord}
          onRecorded={handleMarkRecorded}
        />
      )}
      {detailRecord && (
        <DetailModal
          record={detailRecord}
          isRecorded={recordedIds.has(detailRecord.id)}
          onRecorded={handleMarkRecorded}
          onClose={() => setDetailRecord(null)}
        />
      )}
    </div>
  );
}

function ScanTab({ onSaved }: { onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [title, setTitle] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [classification, setClassification] = useState<ReceiptClassification | null>(null);

  const [people, setPeople] = useState<Person[]>([
    { id: genId(), name: "Kamu", color: COLORS[0] },
    { id: genId(), name: "Teman", color: COLORS[1] },
  ]);
  const [newName, setNewName] = useState("");
  const [assignments, setAssignments] = useState<Assignment>({});
  const [payerId, setPayerId] = useState<string>("");

  useEffect(() => {
    if (people.length > 0 && !payerId) {
      setPayerId(people[0].id);
    }
  }, [people, payerId]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setSelectedFile(file);
    setItems([]); setError(null);
    setAssignments({}); setSaved(false); setEditingIdx(null);
    setExtraCharges([]); setClassification(null);
  };

  const handleScan = async () => {
    if (!selectedFile) return;
    setIsScanning(true); setError(null);
    try {
      const result = await scanReceipt(selectedFile);
      if (!Array.isArray(result?.items)) throw new Error('Format respons OCR tidak valid, coba scan ulang');
      const TAX_KEYWORDS = /service.?charge|pajak|tax|ppn|pb1|vat|servis/i;
      const normalItems: EditableItem[] = [];
      const detectedExtras: ExtraCharge[] = [];

      result.items.forEach(item => {
        if (TAX_KEYWORDS.test(item.nama_barang)) {
          detectedExtras.push({
            id: genId(),
            label: item.nama_barang,
            amount: item.total_harga_barang,
            isPercent: false,
            percentOf: 'subtotal',
          });
        } else {
          normalItems.push({ ...item });
        }
      });

      setItems(normalItems);
      setAssignments({});
      if (detectedExtras.length > 0) setExtraCharges(detectedExtras);

      try {
        const predicted = await classifyReceipt(result);
        setClassification(predicted);
      } catch {
        // classifier gagal tidak blocker
      }

    } catch (err: any) { setError(err.message || "Gagal scan struk"); }
    finally { setIsScanning(false); }
  };

  const handleReset = () => {
    setPreview(null); setSelectedFile(null); setItems([]);
    setError(null); setAssignments({}); setSaved(false); setTitle("");
    setEditingIdx(null); setExtraCharges([]); setClassification(null);
  };

  const updateItem = (idx: number, field: keyof EditableItem, value: string | number) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value, _edited: true } : item
    ));
  };
  const deleteItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setAssignments(prev => {
      const next: Assignment = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = +k;
        if (ki === idx) return;
        next[ki > idx ? ki - 1 : ki] = v;
      });
      return next;
    });
    if (editingIdx === idx) setEditingIdx(null);
  };
  const addItem = () => {
    setItems(prev => [...prev, { nama_barang: "Item baru", jumlah_barang: 1, total_harga_barang: 0, _edited: true }]);
    setEditingIdx(items.length);
  };

  const subtotal = items.reduce((s, i) => s + i.total_harga_barang, 0);
  const resolvedExtras = extraCharges.map(ec => ({
    ...ec,
    resolved: ec.isPercent ? Math.round(subtotal * ec.amount / 100) : ec.amount,
  }));
  const totalExtraAmount = resolvedExtras.reduce((s, e) => s + e.resolved, 0);
  const grandTotal = subtotal + totalExtraAmount;

  const addExtraCharge = () => {
    setExtraCharges(prev => [...prev, { id: genId(), label: "Biaya tambahan", amount: 0, isPercent: false, percentOf: 'subtotal' }]);
  };
  const updateExtra = (id: string, field: keyof ExtraCharge, value: any) => {
    setExtraCharges(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };
  const removeExtra = (id: string) => setExtraCharges(prev => prev.filter(e => e.id !== id));
  const addCommonExtra = (template: typeof COMMON_EXTRAS[0]) => {
    if (extraCharges.some(e => e.label === template.label)) return;
    setExtraCharges(prev => [...prev, { id: genId(), ...template, percentOf: 'subtotal' }]);
  };

  const addPerson = () => {
    const name = newName.trim() || `Orang ${people.length + 1}`;
    setPeople(p => [...p, { id: genId(), name, color: COLORS[p.length % COLORS.length] }]);
    setNewName("");
  };
  const removePerson = (id: string) => {
    setPeople(p => {
      const next = p.filter(x => x.id !== id);
      if (payerId === id && next.length > 0) setPayerId(next[0].id);
      return next;
    });
    setAssignments(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[+k] = next[+k].filter(pid => pid !== id); });
      return next;
    });
  };
  const toggleAssign = (itemIdx: number, personId: string) => {
    setAssignments(prev => {
      const cur = prev[itemIdx] ?? [];
      return { ...prev, [itemIdx]: cur.includes(personId) ? cur.filter(p => p !== personId) : [...cur, personId] };
    });
  };

  const totalsPerPerson = () => {
    const itemTotals: Record<string, number> = {};
    people.forEach(p => { itemTotals[p.id] = 0; });
    items.forEach((item, i) => {
      const assigned = assignments[i] ?? [];
      if (!assigned.length) return;
      const share = Math.ceil(item.total_harga_barang / assigned.length);
      assigned.forEach(pid => { itemTotals[pid] = (itemTotals[pid] ?? 0) + share; });
    });
    const final: Record<string, number> = { ...itemTotals };
    if (totalExtraAmount > 0 && subtotal > 0) {
      people.forEach(p => {
        const proportion = (itemTotals[p.id] ?? 0) / subtotal;
        final[p.id] = Math.ceil((final[p.id] ?? 0) + totalExtraAmount * proportion);
      });
    }
    return final;
  };

  const unassignedSubtotal = items.reduce(
    (sum, item, i) => (assignments[i] ?? []).length === 0 ? sum + item.total_harga_barang : sum, 0
  );
  const personTotals = totalsPerPerson();

  const handleSave = async () => {
    if (!items.length || !selectedFile) return;
    setIsSaving(true);
    try {
      await saveSplitBill({
        title: title.trim() || classification?.predicted_category || `Split ${selectedFile.name}`,
        filename: selectedFile.name,
        total_belanja: grandTotal,
        items,
        people,
        assignments,
        person_totals: personTotals,
      });
      setSaved(true);
      setTimeout(onSaved, 900);
    } catch (err: any) { setError(err.message); }
    finally { setIsSaving(false); }
  };

  const exportPDF = () => {
    if (!items.length) return;
    setIsExporting(true);
    const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const filename = selectedFile?.name ?? 'struk';

    const itemRows = items.map((item, i) => {
      const assigned = assignments[i] ?? [];
      const dots = assigned.map(pid => {
        const color = people.find(p => p.id === pid)?.color ?? '#ccc';
        return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:3px;vertical-align:middle;"></span>`;
      }).join('');
      const names = assigned.length > 0
        ? assigned.map(pid => people.find(p => p.id === pid)?.name ?? '').join(', ')
        : '<em style="color:#c4b5fd">belum di-assign</em>';
      return `<tr>
        <td>${item.nama_barang}${item._edited ? ' <sup style="color:#a855f7;font-size:9px">edited</sup>' : ''}</td>
        <td style="text-align:center">${item.jumlah_barang}x</td>
        <td style="text-align:right;font-weight:600">${formatIDR(item.total_harga_barang)}</td>
        <td>${dots} ${names}</td>
      </tr>`;
    }).join('');

    const extraRows = resolvedExtras.map(e => `
      <tr style="background:#faf5ff;">
        <td colspan="2" style="color:#7c3aed;font-size:12px;">
          ${e.label}${e.isPercent ? ` (${e.amount}% dari subtotal)` : ''} — dibagi proporsional
        </td>
        <td style="text-align:right;font-weight:600;color:#7c3aed;">${formatIDR(e.resolved)}</td>
        <td style="font-size:11px;color:#a78bfa;">semua</td>
      </tr>`).join('');

    const personRows = people.map(p => `
      <div class="person-row">
        <div class="person-left"><div class="dot" style="background:${p.color}"></div><span>${p.name}</span></div>
        <strong>${formatIDR(personTotals[p.id] ?? 0)}</strong>
      </div>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Split Bill — ${title || filename}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#faf9ff;color:#1e1b4b}
.page{max-width:680px;margin:0 auto;padding:48px 40px}
.hero{background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#ec4899 100%);border-radius:24px;padding:36px 32px;color:#fff;margin-bottom:32px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.08)}
.hero-brand{font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;opacity:.8;margin-bottom:10px}
.hero-title{font-size:32px;font-weight:800;margin-bottom:4px}
.hero-sub{font-size:13px;opacity:.75;margin-bottom:16px}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.2);backdrop-filter:blur(8px);border-radius:99px;padding:6px 16px;font-size:13px;font-weight:700}
.section{margin-bottom:28px}
.section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#7c3aed;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.section-label::after{content:'';flex:1;height:1px;background:linear-gradient(to right,#e9d5ff,transparent)}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 8px rgba(124,58,237,.06)}
thead tr{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff}
thead th{padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.5px;text-align:left}
thead th:nth-child(2){text-align:center}thead th:nth-child(3){text-align:right}
tbody tr:last-child td{border-bottom:none}
tbody td{padding:10px 14px;font-size:13px;border-bottom:1px solid #f5f3ff}
.subtotal-row td{border-top:2px solid #e9d5ff;font-weight:600;padding:10px 14px;background:#fafafa}
.grand-total-row td{background:#f5f3ff;font-weight:800;color:#7c3aed;font-size:14px;padding:12px 14px}
.person-row{display:flex;align-items:center;justify-content:space-between;background:#fff;border-radius:14px;padding:14px 18px;margin-bottom:8px;box-shadow:0 1px 6px rgba(124,58,237,.06);border:1px solid #f0ebff}
.person-left{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600}
.dot{width:13px;height:13px;border-radius:50%}
.person-row strong{font-size:17px;font-weight:800;color:#7c3aed}
.footer{text-align:center;margin-top:40px;font-size:11px;color:#c4b5fd;padding-top:20px;border-top:1px dashed #ede9fe}
@media print{body{background:#fff}.page{padding:32px 28px}}
</style></head><body><div class="page">
  <div class="hero">
    <div class="hero-brand">Track Smart</div>
    <div class="hero-title">${title.trim() || 'Split Bill'}</div>
    <div class="hero-sub">${filename} &nbsp;·&nbsp; ${date}</div>
    <div class="hero-badge">Total ${formatIDR(grandTotal)}</div>
  </div>
  <div class="section">
    <div class="section-label">🧾 Detail Item</div>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Harga</th><th>Untuk siapa</th></tr></thead>
      <tbody>
        ${itemRows}
        <tr class="subtotal-row"><td colspan="2">Subtotal</td><td style="text-align:right" colspan="2">${formatIDR(subtotal)}</td></tr>
        ${extraRows}
        <tr class="grand-total-row"><td colspan="2">Grand Total</td><td style="text-align:right" colspan="2">${formatIDR(grandTotal)}</td></tr>
      </tbody>
    </table>
    ${unassignedSubtotal > 0 ? `<div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:12px;padding:10px 14px;font-size:12px;color:#a855f7;margin-top:8px;">⚠️ ${formatIDR(unassignedSubtotal)} belum di-assign</div>` : ''}
  </div>
  <div class="section">
    <div class="section-label">Tagihan per Orang</div>
    <p style="font-size:11px;color:#a78bfa;margin-bottom:12px;">Sudah termasuk service charge & pajak (dibagi proporsional)</p>
    ${personRows}
  </div>
  <div class="footer">Dibuat dengan ♥ oleh Track Smart &nbsp;·&nbsp; ${date}</div>
</div></body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html); win.document.close();
      setTimeout(() => { win.print(); setIsExporting(false); }, 700);
    } else { setIsExporting(false); }
  };

  const hasItems = items.length > 0;

  return (
    <div className="space-y-5">
      {/* Upload */}
      <div className="rounded-[32px] border border-slate-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 shadow-[0_8px_30px_-4px_rgba(139,92,246,0.03)]">
        {!preview ? (
          <label className="block cursor-pointer">
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
            <div className="border border-dashed border-slate-300 dark:border-zinc-700 rounded-3xl p-8 sm:p-10 text-center hover:bg-muted/5 transition-colors">
              <div className="h-14 w-14 mx-auto rounded-full bg-[#ede9fe] dark:bg-[#7c3aed]/20 flex items-center justify-center text-[#7c3aed] mb-4 shadow-sm">
                <Camera className="h-6 w-6" />
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Upload struk belanja</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">Tap untuk ambil foto atau pilih dari galeri</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">Pastikan foto tidak blur, sesuai frame, dan teks struk terbaca jelas</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#7c3aed] font-bold hover:underline">
                <Upload className="h-3.5 w-3.5" /> Pilih file
              </span>
            </div>
          </label>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-muted max-h-[300px] flex items-center justify-center">
              <img src={preview} alt="Receipt" className="w-full h-full object-contain max-h-[300px]" />
              <button onClick={handleReset} className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center shadow">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 px-1 text-left leading-relaxed font-semibold">
              {items.length > 0 ? `${items.length}` : 'Beberapa'} item ditemukan. Edit jika perlu lalu assign ke peserta
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center px-5 h-10 rounded-full border border-slate-200 bg-white text-slate-900 font-bold hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 shadow-[var(--shadow-soft)]"
              >
                Upload ulang
              </button>
              <Button className="rounded-full h-10 px-5 bg-[#8b5cf6] text-white hover:bg-violet-600" onClick={handleScan} disabled={isScanning}>
                {isScanning
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning...</>
                  : <><ScanBarcode className="h-4 w-4 mr-2" /> {hasItems ? 'Scan Ulang' : 'Scan Struk'}</>}
              </Button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
          </div>
        )}
      </div>

      {error && <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">{error}</div>}

      {classification && (
        <div className="rounded-[32px] border border-primary/20 bg-white dark:bg-zinc-950 p-4 shadow-[0_8px_30px_-4px_rgba(139,92,246,0.06)]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Hasil Klasifikasi AI</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <span className="text-sm font-semibold bg-[#ede9fe] dark:bg-[#7c3aed]/20 text-[#7c3aed] dark:text-[#a78bfa] px-3 py-1 rounded-full">
              {classification.predicted_category}
            </span>
            <span className="text-xs text-muted-foreground">
              Confidence {(classification.confidence * 100).toFixed(1)}%
            </span>
          </div>
          {classification.cleaned_text && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{classification.cleaned_text}</p>
          )}
        </div>
      )}

      {hasItems && (
        <>
          {/* Title */}
          <div className="rounded-[32px] border border-slate-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 shadow-[0_8px_30px_-4px_rgba(139,92,246,0.03)]">
            <label className="block text-sm font-medium mb-2">Nama sesi <span className="text-muted-foreground font-normal">(opsional)</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Contoh: Makan Siang Jumat"
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* People */}
          <div className="rounded-[32px] border border-slate-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 shadow-[0_8px_30px_-4px_rgba(139,92,246,0.03)] space-y-4">
            <h2 className="font-bold text-slate-800 dark:text-slate-200">Peserta</h2>
            <div className="flex flex-wrap gap-2">
              {people.map(p => (
                <div key={p.id} className="flex items-center gap-1 bg-[#ede9fe] dark:bg-[#7c3aed]/15 text-[#7c3aed] dark:text-[#a78bfa] rounded-full px-4 py-1.5 text-sm font-bold shadow-sm">
                  <span>{p.name}</span>
                  {people.length > 1 && (
                    <button onClick={() => removePerson(p.id)} className="text-[#7c3aed]/80 dark:text-[#a78bfa]/80 hover:text-destructive ml-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPerson()}
                placeholder="Nama peserta"
                className="flex-1 h-11 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <button onClick={addPerson}
                className="h-11 rounded-full px-5 bg-[#8b5cf6] text-white font-bold hover:bg-violet-600 flex items-center gap-1.5 shadow-md">
                <Plus className="h-4 w-4 shrink-0" /> Tambah
              </button>
            </div>
            <div className="border-t border-slate-100 dark:border-zinc-900 pt-3">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Yang membayar</p>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger className="w-full h-11 rounded-full border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-4 text-sm font-semibold shadow-sm hover:bg-slate-50 [&>svg]:opacity-70">
                  <SelectValue placeholder="Pilih yang membayar" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {people.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items */}
          <div className="rounded-[32px] border border-slate-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-4 sm:p-6 shadow-[0_8px_30px_-4px_rgba(139,92,246,0.03)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 dark:text-slate-200">Items</h2>
              <span className="text-xs font-semibold text-muted-foreground">{items.length} item · {formatIDR(subtotal)}</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-zinc-900">
              {items.map((item, i) => (
                <div key={i} className="py-4 space-y-2.5 first:pt-0 last:pb-0">
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <input
                      value={item.nama_barang}
                      onChange={e => updateItem(i, 'nama_barang', e.target.value)}
                      className="flex-1 h-11 rounded-full border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Nama item"
                    />
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min={0}
                        value={item.total_harga_barang === 0 ? '' : item.total_harga_barang}
                        onChange={e => updateItem(i, 'total_harga_barang', parseInt(e.target.value) || 0)}
                        className="w-full sm:w-32 h-11 rounded-full border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-4 text-right text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Harga"
                      />
                      <button
                        onClick={() => deleteItem(i)}
                        className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        aria-label="Hapus item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {people.map(p => {
                      const assigned = assignments[i] ?? [];
                      const active = assigned.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleAssign(i, p.id)}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-all shadow-sm ${
                            active
                              ? 'bg-[#ede9fe] dark:bg-[#7c3aed]/15 border-[#8b5cf6] text-[#7c3aed] dark:text-[#a78bfa]'
                              : 'bg-[#faf8ff] dark:bg-zinc-900/50 border-violet-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-[#ede9fe]/20'
                          }`}
                        >
                          {active ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#7c3aed] dark:text-[#a78bfa] fill-current" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-[#8b5cf6] dark:text-[#a78bfa] shrink-0" />
                          )}
                          <span>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addItem}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-dashed border-[#8b5cf6]/40 text-sm text-[#7c3aed] hover:bg-[#ede9fe]/30 transition-colors font-bold">
              <Plus className="h-4 w-4" /> Tambah item manual
            </button>
          </div>

          {/* Extra Charges */}
          <div className="rounded-[32px] border border-slate-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 shadow-[0_8px_30px_-4px_rgba(139,92,246,0.03)]">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> Service Charge & Pajak
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Dibagi sesuai porsi belanja.</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {COMMON_EXTRAS.map(t => {
                const added = extraCharges.some(e => e.label === t.label);
                return (
                  <button key={t.label} onClick={() => addCommonExtra(t)}
                    className={`text-xs rounded-full px-3 py-1 border font-medium transition-all ${
                      added
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
                    }`}>
                    {added ? <Check className="h-3 w-3 inline mr-1" /> : <Plus className="h-3 w-3 inline mr-1" />}
                    {t.label}
                  </button>
                );
              })}
            </div>
            {extraCharges.length > 0 && (
              <div className="space-y-2 mb-3">
                {extraCharges.map(ec => {
                  const resolved = ec.isPercent ? Math.round(subtotal * ec.amount / 100) : ec.amount;
                  return (
                    <div key={ec.id} className="rounded-2xl border border-border/60 p-3">
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <input value={ec.label} onChange={e => updateExtra(ec.id, 'label', e.target.value)}
                            className="w-full h-8 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                          <div className="flex gap-2 items-center">
                            <div className="flex rounded-xl border border-border overflow-hidden text-xs">
                              <button onClick={() => updateExtra(ec.id, 'isPercent', true)}
                                className={`px-3 py-1.5 font-medium transition-colors ${ec.isPercent ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>%</button>
                              <button onClick={() => updateExtra(ec.id, 'isPercent', false)}
                                className={`px-3 py-1.5 font-medium transition-colors ${!ec.isPercent ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Rp</button>
                            </div>
                            <input type="number" min={0} value={ec.amount}
                              onChange={e => updateExtra(ec.id, 'amount', parseFloat(e.target.value) || 0)}
                              className="flex-1 h-8 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                            <span className="text-sm font-semibold text-primary shrink-0 min-w-[80px] text-right">= {formatIDR(resolved)}</span>
                          </div>
                        </div>
                        <button onClick={() => removeExtra(ec.id)}
                          className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-0.5">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={addExtraCharge}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-primary/40 text-sm text-primary hover:bg-primary/5 transition-colors font-medium">
              <PlusCircle className="h-4 w-4" /> Tambah biaya lain
            </button>
            {extraCharges.length > 0 && (
              <div className="mt-3 flex justify-between text-sm font-semibold bg-primary/5 rounded-2xl px-4 py-2.5">
                <span>Total biaya tambahan</span>
                <span className="text-primary">{formatIDR(totalExtraAmount)}</span>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-[32px] border border-slate-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 shadow-[0_8px_30px_-4px_rgba(139,92,246,0.03)]">
            <h2 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <UserCircle2 className="h-5 w-5 text-primary" /> Ringkasan Tagihan
            </h2>
            <div className="space-y-2.5 mb-5">
              {people.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-2xl p-3 border border-border/60 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{p.name}</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{formatIDR(personTotals[p.id] ?? 0)}</span>
                </div>
              ))}
              {unassignedSubtotal > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 rounded-xl px-3 py-2 font-medium">
                  ⚠️ {formatIDR(unassignedSubtotal)} belum di-assign
                </p>
              )}
              <div className="space-y-1 pt-3 border-t border-border/60 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{formatIDR(subtotal)}</span>
                </div>
                {resolvedExtras.map(e => (
                  <div key={e.id} className="flex justify-between text-muted-foreground">
                    <span>{e.label}</span><span>{formatIDR(e.resolved)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t border-border/40 text-slate-900 dark:text-slate-100">
                  <span>Grand Total</span><span>{formatIDR(grandTotal)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="w-full sm:w-1/2 rounded-full h-11 border border-slate-200 bg-white text-slate-900 font-bold hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 shadow-[var(--shadow-soft)]" onClick={exportPDF} disabled={isExporting}>
                {isExporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileDown className="h-4 w-4 mr-1.5" />}
                Export PDF
              </Button>
              <Button className="w-full sm:w-1/2 rounded-full h-11 bg-[#8b5cf6] text-white font-bold hover:bg-violet-600 shadow-[var(--shadow-soft)]" onClick={handleSave} disabled={isSaving || saved}>
                {saved ? <><Check className="h-4 w-4 mr-1.5" /> Tersimpan!</>
                  : isSaving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Menyimpan...</>
                  : "Simpan ke Riwayat"}
              </Button>
            </div>
          </div>
        </>
      )}

      {!preview && !hasItems && (
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: ScanBarcode, title: "Smart OCR", desc: "AI otomatis baca struk dan ekstrak item serta harga dalam hitungan detik." },
            { icon: Pencil, title: "Quick Edit", desc: "Hasil scan kurang akurat? Edit nama, qty, harga atau tambah manual." },
            { icon: FileText, title: "Share & Simpan", desc: "Langsung bagi tagihan dengan teman-temanmu." },
          ].map(c => (
            <div key={c.title} className="bg-card border border-border/60 rounded-2xl p-5 shadow-[var(--shadow-card)]">
              <div className="text-2xl mb-2">{c.icon && <c.icon className="h-6 w-6" />}</div>
              <h3 className="font-semibold text-sm mb-1">{c.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper untuk catat transaksi dari split bill
async function recordSplitBillTransaction(record: SplitBillRecord, category: string) {
  // people[0] = "Kamu" — selalu index pertama
  const myPerson = record.people[0]
  if (!myPerson) throw new Error('Tidak ada peserta')
  const amount = (record.person_totals as Record<string, number>)[myPerson.id] ?? 0
  if (!amount) throw new Error('Tagihan kamu 0, tidak perlu dicatat')

  const date = record.created_at.slice(0, 10)
  const note = record.title || `Split bill: ${record.filename}`

  await addTransaction({
    type: 'expense',
    amount,
    category,
    note,
    date,
    payment_method: 'Cash',
  })
}

function HistoryTab({ history, loading, recordedIds, onDelete, onView, onRecorded }: {
  history: SplitBillRecord[]
  loading: boolean
  recordedIds: Set<string>
  onDelete: (id: string) => Promise<void>
  onView: (r: SplitBillRecord) => void
  onRecorded: (id: string) => void
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [recording, setRecording] = useState<string | null>(null);

  const handleRecord = async (r: SplitBillRecord) => {
    setRecording(r.id)
    try {
      // Coba tebak kategori dari nama title, fallback Food
      const category = EXPENSE_CATEGORIES.includes('Restaurants') ? 'Restaurants' : 'Food'
      await recordSplitBillTransaction(r, category)
      onRecorded(r.id)
      toast.success('Transaksi berhasil dicatat!')
    } catch (err: any) {
      toast.error(err.message || 'Gagal mencatat transaksi')
    } finally {
      setRecording(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat riwayat...
    </div>
  );
  if (!history.length) return (
    <div className="rounded-3xl border border-border/60 bg-card p-12 text-center shadow-[var(--shadow-card)]">
      <div className="text-4xl mb-3">🧾</div>
      <p className="font-semibold">Belum ada riwayat split bill</p>
      <p className="text-sm text-muted-foreground mt-1">Scan struk pertama kamu dan simpan hasilnya!</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {history.map(r => {
        const date = new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const time = new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const personTotalsMap = r.person_totals as Record<string, number>
        const myPerson = r.people.find(p => p.name === "Kamu") ?? r.people[0]
        const myAmount = myPerson ? (personTotalsMap[myPerson.id] ?? 0) : 0
        const isRecorded = recordedIds.has(r.id)
        return (
          <div key={r.id} className="flex flex-col justify-between rounded-3xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)] h-full">
            <div>
              {/* Top row: title + total + delete */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm sm:text-base truncate">{r.title || r.filename}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm">{formatIDR(r.total_belanja)}</span>
                  <Button size="sm" variant="ghost"
                    className="h-8 w-8 rounded-xl p-0 text-muted-foreground hover:text-destructive"
                    disabled={deleting === r.id}
                    onClick={async () => { setDeleting(r.id); await onDelete(r.id); setDeleting(null); }}>
                    {deleting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Meta info */}
              <p className="text-xs text-muted-foreground mt-1">{date} · {time} · {r.items.length} item</p>

              {/* People chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {r.people.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="truncate max-w-[60px] sm:max-w-none">{p.name}</span>
                    <span className="shrink-0 font-medium">· {formatIDR((r.person_totals as Record<string, number>)[p.id] ?? 0)}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom row: action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 pt-3 border-t border-border/40">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-2xl text-sm font-bold shadow-[var(--shadow-soft)]"
                onClick={() => onView(r)}
              >
                Lihat Detail
              </Button>
              {isRecorded ? (
                <span className="inline-flex items-center justify-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-bold px-3 h-11">
                  <BookmarkCheck className="h-4 w-4 shrink-0" /> Sudah dicatat
                </span>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-2xl text-sm font-bold border-[#8b5cf6]/40 text-[#7c3aed] hover:bg-[#ede9fe]/50 dark:text-[#a78bfa] shadow-[var(--shadow-soft)]"
                  disabled={recording === r.id || myAmount === 0}
                  onClick={() => handleRecord(r)}
                >
                  {recording === r.id
                    ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    : <Wallet className="h-4 w-4 mr-1.5 shrink-0" />}
                  Catat ({formatIDR(myAmount)})
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailModal({ record, isRecorded, onRecorded, onClose }: {
  record: SplitBillRecord
  isRecorded: boolean
  onRecorded: (id: string) => void
  onClose: () => void
}) {
  const date = new Date(record.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const assignments: Record<number, string[]> = record.assignments as any;
  const personTotals: Record<string, number> = record.person_totals as any;
  const myAmount = personTotals[record.people[0]?.id] ?? 0
  const [recording, setRecording] = useState(false)

  const handleRecord = async () => {
    setRecording(true)
    try {
      await recordSplitBillTransaction(record, 'Restaurants')
      onRecorded(record.id)
      toast.success('Transaksi berhasil dicatat!')
    } catch (err: any) {
      toast.error(err.message || 'Gagal mencatat transaksi')
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-start justify-between gap-3 sticky top-0 bg-card rounded-t-3xl sm:rounded-t-3xl">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm sm:text-base truncate">{record.title || record.filename}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{date} · {formatIDR(record.total_belanja)}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detail Item</p>
            <div className="space-y-2">
              {record.items.map((item, i) => {
                const assigned: string[] = (assignments[i] ?? []) as string[];
                return (
                  <div key={i} className="flex items-start justify-between gap-2 text-sm py-2 border-b border-border/40 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.nama_barang}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {assigned.map(pid => {
                          const person = record.people.find(p => p.id === pid);
                          return person ? (
                            <span key={pid} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-0.5">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: person.color }} />
                              {person.name}
                            </span>
                          ) : null;
                        })}
                        {assigned.length === 0 && <span className="text-xs text-muted-foreground italic">Tidak di-assign</span>}
                      </div>
                    </div>
                    <span className="font-semibold shrink-0 text-sm">{formatIDR(item.total_harga_barang)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tagihan per Orang</p>
            <div className="space-y-2">
              {record.people.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 sm:px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <span className="font-bold text-sm">{formatIDR(personTotals[p.id] ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tombol Catat ke Transaksi di modal */}
          <div className="pt-2 border-t border-border/60">
            {isRecorded ? (
              <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <BookmarkCheck className="h-4 w-4" /> Sudah dicatat ke transaksi
              </div>
            ) : (
              <Button
                className="w-full h-11 rounded-2xl bg-[#8b5cf6] text-white font-bold hover:bg-violet-600"
                disabled={recording || myAmount === 0}
                onClick={handleRecord}
              >
                {recording
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mencatat...</>
                  : <><Wallet className="h-4 w-4 mr-2" /> Catat ke Transaksi ({formatIDR(myAmount)})</>}
              </Button>
            )}
            {myAmount === 0 && !isRecorded && (
              <p className="text-xs text-muted-foreground text-center mt-2">Tagihan kamu 0 — tidak perlu dicatat</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
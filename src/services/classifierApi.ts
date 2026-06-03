import type { OcrResult } from '@/services/api'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type ReceiptClassification = {
  predicted_category: string
  confidence: number
  cleaned_text: string
}

export async function classifyReceipt(result: OcrResult): Promise<ReceiptClassification> {
  const res = await fetch(`${API_BASE}/api/classifier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown classifier error' }))
    throw new Error(err.detail || err.error || `Classifier failed: ${res.status}`)
  }

  const data = await res.json()
  const normalized = Array.isArray(data) && data.length === 1 ? data[0] : data

  return {
    predicted_category: normalized.predicted_category ?? 'Other',
    confidence: Number(normalized.confidence ?? 0),
    cleaned_text: normalized.cleaned_text ?? result.item_text_for_classification ?? result.cleaned_text ?? '',
  }
}

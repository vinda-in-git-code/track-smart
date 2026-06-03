const express = require('express')
const router = express.Router()
const multer = require('multer')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const upload = multer({ storage: multer.memoryStorage() })
const DEFAULT_OCR_ENDPOINT = 'https://luxdream-receipt-ocr-gemini.hf.space/ocr/receipt'

function getOcrEndpoint() {
  const configured = (process.env.OCR_SERVICE_URL || DEFAULT_OCR_ENDPOINT).replace(/\/+$/, '')
  return configured.endsWith('/ocr/receipt') ? configured : `${configured}/ocr/receipt`
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

router.post('/', upload.single('file'), async (req, res) => {
  const filename = req.file?.originalname || 'unknown'
  const userId = req.headers['x-user-id'] || null

  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const form = new FormData()
    const blob = new Blob([req.file.buffer], {
      type: req.file.mimetype,
    })
    
    form.append('file', blob, req.file.originalname)

    const ocrResponse = await fetch(getOcrEndpoint(), {
      method: 'POST',
      body: form,
    })

    if (!ocrResponse.ok) {
      const errText = await ocrResponse.text()
      if (userId) {
        await supabase.from('ocr_logs').insert({
          user_id: userId, filename, status: 'failed',
          items_count: 0, total_belanja: 0, items: [], raw_text: '',
        })
      }
      return res.status(502).json({ error: 'OCR service error', detail: errText })
    }

    const result = await ocrResponse.json()
    
    if (userId) {
      await supabase.from('ocr_logs').insert({
        user_id: userId,
        filename,
        status: 'success',
        items_count: result.items?.length ?? 0,
        total_belanja: result.total_belanja ?? 0,
        items: (result.items ?? []).map(i => ({ name: i.nama_barang, price: i.total_harga_barang })),
        raw_text: result.raw_text ?? '',
      })
    }

    res.json(result)
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'OCR service not running',
        detail: 'Pastikan Python FastAPI server sudah dijalankan di port 8000'
      })
    }
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

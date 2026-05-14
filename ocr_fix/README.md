# Receipt OCR API

API wrapper untuk pipeline OCR struk berbasis PaddleOCR.

## Install

```bash
pip install -r requirements.txt
```

## Run local

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## Endpoint

### Health check

```http
GET /health
```

Response:

```json
{"status":"ok"}
```

### OCR receipt

```http
POST /ocr/receipt
Content-Type: multipart/form-data
```

Field:

- `file`: image struk, format `jpg`, `jpeg`, `png`, atau `webp`

Contoh curl:

```bash
curl -X POST "http://localhost:8000/ocr/receipt" \
  -F "file=@struk.jpg"
```

Contoh response:

```json
{
  "items": [
    {
      "nama_barang": "AQUA 600ML",
      "jumlah_barang": 2,
      "total_harga_barang": 8000
    }
  ],
  "total_belanja": 8000,
  "item_text_for_classification": "aqua ml",
  "raw_text": "...",
  "cleaned_text": "AQUA 600ML"
}
```

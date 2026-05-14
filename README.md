# OCR Receipt Parser

- PaddleOCR parser manual
- PaddleOCR + Ollama AI cleaner
- Flask API
- Frontend testing sederhana

---

# Features

- OCR receipt image
- Manual regex-based receipt parser
- JSON output
- Flask API
- Frontend upload testing
- Optional Ollama AI cleaner
- Automatic fallback jika Ollama gagal

---

# File Explanation

## app.py

Flask API server.

Digunakan untuk:
- menerima upload gambar receipt
- menjalankan OCR pipeline
- mengembalikan hasil JSON response

---
## ocr_pipeline.py

Utility/helper OCR processing.

Digunakan untuk:
- preprocessing OCR
- OCR reconstruction
- helper processing
- helper function yang dipanggil oleh Flask API atau pipeline parser

--

## index.html

Frontend sederhana untuk testing API secara lokal.

Digunakan untuk:
- upload image
- melihat hasil OCR JSON
- testing endpoint Flask

---

## src/paddle_receipt_pipeline.py

Pipeline utama tanpa AI.

Flow:

```txt
image
→ PaddleOCR
→ reconstruct OCR lines
→ manual parser
→ JSON output
```

File ini:
- tidak menggunakan Ollama
- parsing qty/harga menggunakan regex/manual logic
- lebih stabil untuk extraction angka

---

## src/paddle_receipt_pipeline_with_ollama.py

Pipeline OCR + Ollama cleaner.

Flow:

```txt
image
→ PaddleOCR
→ manual parser
→ Ollama cleaner
→ cleaned JSON output
```

Catatan:
- manual parser tetap menjadi source utama
- Ollama hanya membantu membersihkan typo OCR pada nama barang
- qty/harga tetap menggunakan parser manual
- jika Ollama gagal/timeout/error, otomatis fallback ke hasil parser manual

---

# JSON Output Example

```json
{
  "items": [
    {
      "nama_barang": "Beef Teriyaki Ramen",
      "jumlah_barang": 1,
      "total_harga_barang": 42000
    }
  ],
  "total_belanja": 42000,
  "item_text_for_classification": "beef teriyaki ramen",
  "raw_text": "OCR raw text",
  "cleaned_text": "Beef Teriyaki Ramen"
}
```

---

# Installation

Install semua dependency:

```bash
pip install -r requirements.txt
```

Jika PaddleOCR belum terinstall:

```bash
pip install paddleocr
pip install paddlepaddle
```

Install dependency tambahan:

```bash
pip install flask requests opencv-python numpy
```

---

# Run Manual Parser

Tanpa Ollama:

```bash
python src/paddle_receipt_pipeline.py --image data/raw/nama_file.jpg --debug
```

Output JSON:

```txt
data/processed/output.json
```

---

# Run Ollama Parser

Pastikan Ollama sudah install dan running.

Pull model:

```bash
ollama pull qwen2.5:0.5b
```

Run:

```bash
python src/paddle_receipt_pipeline_with_ollama.py --image data/raw/nama_file.jpg --debug
```

Jika Ollama gagal:
- timeout
- invalid JSON
- response error

maka otomatis fallback ke parser manual.

---

# Run Flask API

Buka terminal pertama untuk menjalankan Flask API:

```bash
python app.py
```

Default Flask endpoint:

```txt
http://localhost:5000
```

---

# Run Ngrok

Buka terminal kedua untuk menjalankan Ngrok.

Install Ngrok:
```bash
npm install -g ngrok
```

atau download:
```txt
https://ngrok.com/download
```

Expose Flask port 5000:

```bash
ngrok http 5000
```

Ngrok akan memberikan public URL seperti:

```txt
https://xxxx.ngrok-free.app
```

Flow:

```txt
Frontend / External Client
→ Ngrok Public URL
→ Flask API (localhost:5000)
→ OCR Pipeline
```

Catatan:
- Terminal pertama menjalankan Flask API
- Terminal kedua menjalankan Ngrok
- Flask harus tetap running agar Ngrok dapat forward request
---

# Frontend Testing

Buka:

```txt
index.html
```

di browser untuk testing upload image dan response API.

---

# Ollama Notes

Project menggunakan Ollama sebagai optional AI cleaner.

Model default:

```txt
qwen2.5:0.5b
```

Endpoint default:

```txt
http://localhost:11434/api/generate
```

Ollama digunakan hanya untuk:
- cleaning nama barang
- memperbaiki typo OCR

Bukan untuk:
- extraction qty
- extraction harga
- extraction total

---

# Git Ignore Recommendation

Buat `.gitignore`:

```gitignore
__pycache__/
*.pyc
venv/
.env
data/raw/
data/processed/
models/
```

---

# Docker Notes

Saat deploy Docker:

Yang perlu dipush:
- app.py
- requirements.txt
- ocr_pipeline.py
- src/

Yang tidak perlu dipush:
- Ollama model
- cache
- local environment
- venv
- OCR output production

Jika menggunakan Ollama di Docker:

```bash
docker exec -it ollama ollama pull qwen2.5:0.5b
```

Jika Flask dan Ollama berada dalam docker-compose yang sama:

```txt
http://ollama:11434/api/generate
```

Jika lokal:

```txt
http://localhost:11434/api/generate
```

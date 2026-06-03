# OCR Receipt Parser & Category Classification

## Overview

Sistem ini terdiri dari dua proses utama:

1. **OCR Receipt Parser**
   - Mengambil gambar struk sebagai input
   - Membaca teks menggunakan PaddleOCR
   - Melakukan parsing item, jumlah barang, harga barang, dan total belanja
   - Menghasilkan output dalam format JSON

2. **Receipt Category Classification**
   - Mengambil data item dari JSON hasil OCR
   - Menggabungkan nama-nama barang menjadi satu teks
   - Melakukan preprocessing teks
   - Memprediksi kategori struk menggunakan model TensorFlow

---

## Main Features

- OCR struk belanja dari gambar
- Parsing hasil OCR menjadi JSON
- Output item belanja, jumlah, harga, dan total
- Optional AI cleaner menggunakan Ollama
- Fallback ke parser manual jika AI cleaner gagal
- Text classification untuk kategori struk
- REST API untuk menjalankan model klasifikasi
- TensorBoard untuk monitoring training model

---

## Project Flow

```txt
Receipt Image
→ PaddleOCR
→ OCR Text Reconstruction
→ Manual Parser / AI Cleaner
→ JSON Output
→ Text Preprocessing
→ TensorFlow Classification Model
→ Predicted Category

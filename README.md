# OCR Receipt Parser & Category Classification

## Overview

Sistem ini terdiri dari dua proses utama yang telah diperbarui menggunakan integrasi Large Language Model (LLM) dan TensorFlow:

1. **OCR Receipt Parser (Gemini API)**
   - Mengambil gambar struk belanja sebagai input.
   - Membaca teks mentah pada struk menggunakan **PaddleOCR**.
   - Melakukan rekonstruksi baris teks (line reconstruction) dari koordinat kotak pembatas (bounding boxes) hasil deteksi PaddleOCR untuk menyusun teks struk yang lebih berurutan dan terstruktur.
   - Menggunakan **Gemini API (`gemini-2.5-flash`)** via Google GenAI SDK untuk mem-parsing nama barang, jumlah/quantity (`jumlah_barang`), dan total harga per barang (`total_harga_barang`).
   - Menghasilkan output ekstraksi akhir dalam format JSON terstruktur (`output.json`).

2. **Receipt Category Classification (TensorFlow)**
   - Mengambil data teks item hasil parsing OCR (memprioritaskan field `item_text_for_classification`, `cleaned_text`, atau gabungan nama barang dari daftar `items`).
   - Melakukan pembersihan teks (preprocessing) untuk menghapus kata-kata tidak relevan seperti angka, ukuran produk (ml, g, kg, pcs), serta kata-kata promosi/diskon (promo, disc, refill, gratis, dll.).
   - Memprediksi kategori struk belanja secara otomatis menggunakan model neural network berbasis **TensorFlow (`receipt_classifier.keras`)** dengan bantuan **Tokenizer** dan **Label Encoder**.

---

## Main Features

- **PaddleOCR Engine**: Deteksi dan pengenalan teks dari gambar struk secara lokal.
- **Smart Text Line Reconstruction**: Menyusun kembali potongan teks OCR secara horizontal berdasarkan koordinat y-center untuk meminimalkan salah pembacaan baris struk.
- **Gemini AI Extraction**: Integrasi dengan **Gemini 2.5 Flash** untuk parsing item belanja yang sangat fleksibel dan akurat tanpa memerlukan regular expression (regex) manual yang kaku.
- **Auto-Calculated Summary**: Akumulasi otomatis total belanja berdasarkan penjumlahan harga barang dari item yang terdeteksi.
- **REST API Services**: Implementasi API modern menggunakan **FastAPI** yang terbagi menjadi dua service:
  - **`app_llm.py`**: API untuk pemrosesan OCR gambar struk dan ekstraksi item belanja via Gemini (`/ocr/receipt`).
  - **`app.py`**: API untuk klasifikasi kategori belanja berdasarkan data teks struk (`/predict`).
- **Standardized Output**: Hasil parsing disimpan dalam format JSON terstandardisasi (`output.json`) yang berisi list items, total belanja, cleaned text, dan raw text hasil OCR.
- **Notebook Pelatihan**: Jupyter Notebook (`klasifikasi_kategori.ipynb`) untuk alur pelatihan model klasifikasi dari awal hingga evaluasi model TensorFlow.

---

## Project Flow

```txt
Receipt Image
→ PaddleOCR (Detection & Recognition)
→ Text Line Reconstruction (Coordinate-based)
→ Gemini API (gemini-2.5-flash Parsing)
→ JSON Output (items, total_belanja, item_text_for_classification)
→ Text Preprocessing & Cleaning
→ TensorFlow Classification Model (receipt_classifier.keras)
→ Predicted Category & Confidence Score
```
# Receipt Category Classifier API

REST API untuk klasifikasi kategori struk belanja menggunakan FastAPI dan TensorFlow.

## Features

- Klasifikasi kategori struk otomatis
- REST API menggunakan FastAPI
- Model Machine Learning TensorFlow/Keras
- TensorBoard monitoring
- Swagger API Documentation

---

# Tech Stack

- Python
- FastAPI
- TensorFlow / Keras
- Scikit-learn
- Uvicorn

---

# Installation

## 1. Clone Repository

```bash
git clone <repository-url>
cd klasifikasi-kategori-capstone
```

---

## 2. Create Virtual Environment

```bash
python -m venv .venv
```

---

## 3. Activate Virtual Environment

### Windows

```bash
.venv\Scripts\activate
```

### Linux / MacOS

```bash
source .venv/bin/activate
```

---

## 4. Install Dependencies

```bash
pip install fastapi uvicorn tensorflow scikit-learn numpy python-multipart
```

---

# Running API

Jalankan server FastAPI:

```bash
python -m uvicorn app:app --reload
```

Server akan berjalan di:

```txt
http://127.0.0.1:8000
```

Swagger Documentation:

```txt
http://127.0.0.1:8000/docs
```

---

# API Testing

## Endpoint

```http
POST /predict
```

---

## Request Format

Upload file JSON melalui Swagger UI.

---

## Testing via Swagger

1. Buka:

```txt
http://127.0.0.1:8000/docs
```

2. Klik endpoint:

```txt
POST /predict
```

3. Klik:

```txt
Try it out
```

4. Upload file JSON

5. Klik:

```txt
Execute
```

---

## Example Response

```json
{
  "predicted_category": "Makanan",
  "confidence": 0.9821
}
```

---

# TensorBoard

TensorBoard digunakan untuk memantau proses training model.

## Run TensorBoard

```python
%load_ext tensorboard
%tensorboard --logdir logs/fit
```

---

# Model Performance

- Accuracy >= 85%
- MAE <= 0.02

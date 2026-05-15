import re
import json
import pickle
import numpy as np
import tensorflow as tf

from fastapi import FastAPI, UploadFile, File, HTTPException
from tensorflow.keras.preprocessing.sequence import pad_sequences

app = FastAPI(title="Receipt Category Classifier API")

# Load model dan asset
model = tf.keras.models.load_model("receipt_classifier.keras")

with open("tokenizer.pkl", "rb") as f:
    tokenizer = pickle.load(f)

with open("label_encoder.pkl", "rb") as f:
    label_encoder = pickle.load(f)

max_length = 100


def clean_text(text):
    text = str(text).casefold()
    text = re.sub(r'\b\d+(ml|g|kg|pcs|w|gb|mah|l)\b', ' ', text)
    text = re.sub(r'\b\d+\b', ' ', text)

    text = re.sub(
        r'\b(promo|disc|discount|refill|new|large|small|reg|regular|express|hyper|mart|midi|indo|alfa|pcs|item|gratis)\b',
        ' ',
        text
    )

    text = re.sub(r'[^a-zA-Z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    return text


def extract_text_from_json(data):
    # Prioritas 1: field khusus klasifikasi
    if data.get("item_text_for_classification"):
        return data["item_text_for_classification"]

    # Prioritas 2: cleaned_text
    if data.get("cleaned_text"):
        return data["cleaned_text"]

    # Prioritas 3: ambil dari items
    if data.get("items"):
        item_names = []

        for item in data["items"]:
            if "nama_barang" in item:
                item_names.append(item["nama_barang"])

        return " ".join(item_names)

    raise ValueError("JSON harus punya item_text_for_classification, cleaned_text, atau items.")


@app.get("/")
def home():
    return {
        "message": "Receipt Category Classifier API is running"
    }


@app.post("/predict")
async def predict_category(file: UploadFile = File(...)):
    try:
        data = json.load(file.file)

        raw_text = extract_text_from_json(data)
        cleaned_text = clean_text(raw_text)

        sequence = tokenizer.texts_to_sequences([cleaned_text])

        padded = pad_sequences(
            sequence,
            maxlen=max_length,
            padding="post",
            truncating="post"
        )

        prediction = model.predict(padded)

        class_id = int(np.argmax(prediction, axis=1)[0])
        category = label_encoder.inverse_transform([class_id])[0]
        confidence = float(prediction[0][class_id])

        return {
            "predicted_category": category,
            "confidence": confidence,
            "cleaned_text": cleaned_text
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
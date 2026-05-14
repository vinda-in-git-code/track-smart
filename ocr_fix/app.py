import os
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Import functions from the existing OCR pipeline
from ocr_pipeline import (
    PaddleOCR,
    reconstruct_lines_from_paddle,
    get_rightmost_price,
    extract_qty_and_price,
    clean_item_name,
    is_valid_item_name,
    is_stop_marker,
    is_strict_non_item,
    extract_total,
    create_classification_text,
)

app = FastAPI(
    title="Receipt OCR API",
    description="API OCR struk untuk ekstraksi item, total belanja, raw text, dan text klasifikasi.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ocr = None

@app.on_event("startup")
def load_model():
    global ocr
    ocr = PaddleOCR(lang="en")


def normalize_paddle_result(result):
    normalized_lines = []

    def traverse(node):
        if not isinstance(node, (list, tuple)):
            return
        if len(node) == 2 and isinstance(node[1], (list, tuple)) and len(node[1]) >= 1 and isinstance(node[1][0], str):
            box = node[0]
            text = node[1][0]
            conf = float(node[1][1]) if len(node[1]) > 1 else 1.0
            normalized_lines.append([box, [text, conf]])
            return
        if len(node) == 2 and isinstance(node[0], str) and isinstance(node[1], (float, int)):
            normalized_lines.append([None, [node[0], float(node[1])]])
            return
        for item in node:
            traverse(item)

    if result:
        traverse(result)
    return normalized_lines


def parse_receipt_image(image_path: str):
    empty_result = {
        "items": [],
        "total_belanja": 0,
        "item_text_for_classification": "",
        "raw_text": "",
        "cleaned_text": "",
    }

    try:
        try:
            paddle_result = ocr.predict(image_path)
        except AttributeError:
            paddle_result = ocr.ocr(image_path)
    except Exception as exc:
        raise RuntimeError(f"OCR failed: {exc}") from exc

    normalized_lines = normalize_paddle_result(paddle_result)
    if not normalized_lines:
        return empty_result

    reconstructed_lines = reconstruct_lines_from_paddle(normalized_lines)

    lines_text_only = []
    section = "HEADER"
    items = []
    pending_name = ""
    cleaned_lines = []

    for text in reconstructed_lines:
        text = text.strip()
        if not text:
            continue

        lines_text_only.append(text)
        price = get_rightmost_price(text)

        if section == "HEADER":
            if price is not None:
                section = "ITEMS"
            else:
                pending_name = text
                continue

        if section == "ITEMS":
            if is_stop_marker(text):
                section = "FOOTER"
                continue

            if is_strict_non_item(text):
                continue

            if price is not None:
                qty, parsed_price = extract_qty_and_price(text)
                name_part = clean_item_name(text)
                name = f"{pending_name} {name_part}".strip()

                if is_valid_item_name(name):
                    items.append({
                        "nama_barang": name,
                        "jumlah_barang": qty,
                        "total_harga_barang": parsed_price,
                    })
                    cleaned_lines.append(name)

                pending_name = ""
            else:
                pending_name = f"{pending_name} {text}".strip() if pending_name else text

    raw_text = "\n".join(lines_text_only)
    total_belanja = extract_total(lines_text_only, items)

    return {
        "items": items,
        "total_belanja": total_belanja,
        "item_text_for_classification": create_classification_text(items),
        "raw_text": raw_text,
        "cleaned_text": "\n".join(cleaned_lines),
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/ocr/receipt")
async def ocr_receipt(file: UploadFile = File(...)):
    allowed_ext = {".jpg", ".jpeg", ".png", ".webp"}
    _, ext = os.path.splitext(file.filename or "")
    ext = ext.lower()

    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="File harus berupa jpg, jpeg, png, atau webp")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        result = parse_receipt_image(tmp_path)
        return JSONResponse(content=result)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

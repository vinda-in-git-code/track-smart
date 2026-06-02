import os
import json
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.paddle_receipt_pipeline_LLM import (
    PaddleOCR,
    reconstruct_lines_from_paddle,
    extract_items_with_gemini
)

app = FastAPI(
    title="Receipt OCR Gemini API",
    version="1.0.0"
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
def startup():
    global ocr

    print("Loading PaddleOCR...")

    ocr = PaddleOCR(
        lang="en"
    )

    print("PaddleOCR Loaded")


def normalize_paddle_result(result):
    normalized_lines = []

    def traverse(node):
        if not isinstance(node, (list, tuple)):
            return

        if (
            len(node) == 2
            and isinstance(node[1], (list, tuple))
            and len(node[1]) >= 1
            and isinstance(node[1][0], str)
        ):
            box = node[0]
            text = node[1][0]
            conf = float(node[1][1]) if len(node[1]) > 1 else 1.0

            normalized_lines.append(
                [box, [text, conf]]
            )
            return

        if (
            len(node) == 2
            and isinstance(node[0], str)
            and isinstance(node[1], (float, int))
        ):
            normalized_lines.append(
                [None, [node[0], float(node[1])]]
            )
            return

        for item in node:
            traverse(item)

    if result:
        traverse(result)

    return normalized_lines


def process_receipt(image_path):
    try:
        try:
            result = ocr.predict(image_path)
        except AttributeError:
            result = ocr.ocr(image_path)

        normalized_lines = normalize_paddle_result(result)

        reconstructed_lines = reconstruct_lines_from_paddle(
            normalized_lines
        )

        ocr_text = "\n".join(
            reconstructed_lines
        )

        gemini_result = extract_items_with_gemini(
            ocr_text
        )

        items = gemini_result.get(
            "items",
            []
        )

        return {
            "success": True,
            "items": items,
            "total_belanja": sum(
                int(
                    item.get(
                        "total_harga_barang",
                        0
                    )
                )
                for item in items
            ),
            "item_text_for_classification": " ".join(
                item.get(
                    "nama_barang",
                    ""
                )
                for item in items
            ),
            "raw_text": ocr_text
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.get("/")
def root():
    return {
        "message": "Receipt OCR Gemini API"
    }


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


@app.post("/ocr/receipt")
async def ocr_receipt(
    file: UploadFile = File(...)
):
    ext = os.path.splitext(
        file.filename
    )[1].lower()

    if ext not in [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    ]:
        raise HTTPException(
            status_code=400,
            detail="Invalid image"
        )

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=ext
    ) as tmp:

        tmp.write(
            await file.read()
        )

        temp_path = tmp.name

    try:
        result = process_receipt(
            temp_path
        )

        return JSONResponse(
            content=result
        )

    finally:
        if os.path.exists(
            temp_path
        ):
            os.remove(
                temp_path
            )
"""
ocr.py — Adaptive OCR Pipeline untuk Berbagai Format Struk
===========================================================
Mendukung berbagai format struk secara otomatis:

  Format A (Indonesia - Indomaret/Alfamart):
      ABC ORANGE 525ML     1    13500    13,500

  Format B (Malaysia - MR DIY, BOOK TA.K):
      CHOPPING BOARD 35.5x25.5CM
      EZ10HD05 - 24
      8970669 1X 19.00 19.00

  Format C (Fallback - struk sederhana satu kolom):
      Nasi Goreng         15.000
      Es Teh               5.000

Output: satu file JSON terindeks → output/results.json

Penggunaan:
    python ocr.py --input data/train/img/
    python ocr.py --input data/test/img/
    python ocr.py --input data/train/img/struk.jpg --debug
"""

import re
import cv2
import json
import argparse
import logging
import numpy as np
import pytesseract
from PIL import Image, ExifTags
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

SUPPORTED_EXT        = {".jpg", ".jpeg", ".png", ".webp"}
TESS_CONFIG          = r"--oem 3 --psm 6 -l ind+eng"
CONFIDENCE_THRESHOLD = 60.0
OUTPUT_JSON          = Path("output/results.json")


# ═══════════════════════════════════════════════════════════════
# DATA MODELS
# ═══════════════════════════════════════════════════════════════

@dataclass
class Item:
    name:       str
    qty:        float
    unit_price: float
    subtotal:   float

@dataclass
class ReceiptData:
    index:          int
    filename:       str
    detected_format: str        # "A", "B", atau "C"
    items:          list
    tax:            float
    subtotal:       float
    confidence:     float
    needs_review:   bool
    review_reason:  Optional[str]


# ═══════════════════════════════════════════════════════════════
# PREPROCESSING
# ═══════════════════════════════════════════════════════════════

def preprocess(image_path: str, debug: bool = False) -> np.ndarray:
    path      = Path(image_path)
    debug_dir = Path("output/debug") / path.stem
    if debug:
        debug_dir.mkdir(parents=True, exist_ok=True)

    img = _load(image_path, debug, debug_dir)
    img = _grayscale_denoise(img, debug, debug_dir)
    img = _deskew(img, debug, debug_dir)
    img = _binarize(img, debug, debug_dir)
    img = _sharpen_upscale(img, debug, debug_dir)

    if debug:
        cv2.imwrite(str(debug_dir / "FINAL.png"), img)
    return img


def _load(image_path, debug, debug_dir):
    pil_img = Image.open(image_path)
    try:
        exif = pil_img._getexif()
        if exif:
            for tag, val in exif.items():
                if ExifTags.TAGS.get(tag) == "Orientation":
                    rot = {3: 180, 6: 270, 8: 90}.get(val)
                    if rot:
                        pil_img = pil_img.rotate(rot, expand=True)
    except Exception:
        pass
    img  = cv2.cvtColor(np.array(pil_img.convert("RGB")), cv2.COLOR_RGB2BGR)
    h, w = img.shape[:2]
    if w > 1800:
        img = cv2.resize(img, (1800, int(h * 1800/w)), interpolation=cv2.INTER_AREA)
    if debug:
        cv2.imwrite(str(debug_dir / "A_loaded.png"), img)
    return img


def _grayscale_denoise(img, debug, debug_dir):
    gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    noise = gray.std()
    out   = (cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)
             if noise > 40 else cv2.GaussianBlur(gray, (3, 3), 0))
    if debug:
        cv2.imwrite(str(debug_dir / "B_denoise.png"), out)
    return out


def _deskew(img, debug, debug_dir):
    edges = cv2.Canny(img, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, 80, minLineLength=80, maxLineGap=10)
    if lines is not None:
        angles = [np.degrees(np.arctan2(y2-y1, x2-x1))
                  for x1,y1,x2,y2 in [l[0] for l in lines]
                  if x2 != x1 and -20 < np.degrees(np.arctan2(y2-y1,x2-x1)) < 20]
        if angles:
            skew = np.median(angles)
            if abs(skew) >= 0.5:
                h, w = img.shape[:2]
                M    = cv2.getRotationMatrix2D((w//2, h//2), skew, 1.0)
                img  = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC,
                                      borderMode=cv2.BORDER_REPLICATE)
    if debug:
        cv2.imwrite(str(debug_dir / "C_deskewed.png"), img)
    return img


def _binarize(img, debug, debug_dir):
    contrast = img.std()
    if contrast > 60:
        _, out = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    else:
        out = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                    cv2.THRESH_BINARY, blockSize=31, C=15)
    out = cv2.morphologyEx(out, cv2.MORPH_CLOSE, np.ones((1,1), np.uint8))
    if debug:
        cv2.imwrite(str(debug_dir / "D_binary.png"), out)
    return out


def _sharpen_upscale(img, debug, debug_dir):
    blurred = cv2.GaussianBlur(img, (0,0), sigmaX=2)
    sharp   = cv2.addWeighted(img, 1.5, blurred, -0.5, 0)
    h, w    = sharp.shape[:2]
    out     = cv2.resize(sharp, (w*2, h*2), interpolation=cv2.INTER_CUBIC)
    if debug:
        cv2.imwrite(str(debug_dir / "E_final.png"), out)
    return out


# ═══════════════════════════════════════════════════════════════
# OCR
# ═══════════════════════════════════════════════════════════════

def run_tesseract(img: np.ndarray) -> tuple[str, float]:
    data  = pytesseract.image_to_data(img, config=TESS_CONFIG,
                                      output_type=pytesseract.Output.DICT)
    confs = [float(c) for c in data["conf"] if int(c) > -1]
    avg   = np.mean(confs) if confs else 0.0

    lines = {}
    for i in range(len(data["text"])):
        word = data["text"][i].strip()
        if not word or int(data["conf"][i]) < 0:
            continue
        key = (data["block_num"][i], data["line_num"][i])
        lines.setdefault(key, []).append(word)

    raw = "\n".join(" ".join(lines[k]) for k in sorted(lines))
    return raw, avg / 100.0


def check_quality(raw: str, conf: float) -> tuple[bool, Optional[str]]:
    if conf < CONFIDENCE_THRESHOLD / 100:
        return True, f"Confidence rendah ({conf*100:.1f}%) — coba foto lebih terang."
    if len(raw.strip()) < 30:
        return True, "Teks terlalu sedikit terbaca."
    if not re.search(r"\d{3,}", raw):
        return True, "Tidak ada angka harga terdeteksi."
    return False, None


# ═══════════════════════════════════════════════════════════════
# FORMAT DETECTOR
# ═══════════════════════════════════════════════════════════════

def detect_format(lines: list[str]) -> str:
    """
    Deteksi format struk secara otomatis berdasarkan pola baris.

    Format A: ada baris dengan pola NAMA   QTY   ANGKA   ANGKA (4 kolom)
              → Indomaret, Alfamart, struk Indonesia umumnya

    Format B: ada baris dengan pola NX HARGA HARGA (qty pakai 'X')
              → MR DIY, BOOK TA.K, struk Malaysia umumnya

    Format C: fallback — baris NAMA   HARGA (2 kolom)
              → struk sederhana, restoran, warung
    """
    score_a = score_b = 0

    for line in lines:
        line = line.strip()

        # Skor Format A: NAMA + 3 angka terpisah spasi panjang
        if re.search(
            r"[A-Za-z]{2,}.{2,}\s{2,}\d{1,3}\s{2,}\d{3,}\s{2,}\d{1,3}[.,]\d{3}",
            line
        ):
            score_a += 2

        # Skor Format B: ada pola NX di tengah baris diikuti harga
        if re.search(r"\b\d+\s*[xX]\s+\d+[.,]\d{2}", line):
            score_b += 2

        # Sinyal tambahan Format A: angka tanpa desimal (harga Indonesia)
        if re.search(r"\s\d{4,6}\s", line):
            score_a += 1

        # Sinyal tambahan Format B: mata uang RM
        if re.search(r"\bRM\b", line, re.IGNORECASE):
            score_b += 1

    if score_a == 0 and score_b == 0:
        return "C"
    return "A" if score_a >= score_b else "B"


# ═══════════════════════════════════════════════════════════════
# REGEX PATTERNS — universal
# ═══════════════════════════════════════════════════════════════

# Harga universal: 13500 / 13,500 / 13.500 / 19.00 / 19,00
_PRICE = r"(\d{1,3}(?:[.,]\d{3})+|\d{1,3}[.,]\d{2}|\d{4,})"

# Format A — Indonesia: NAMA   QTY   HARGA_SATUAN   SUBTOTAL
ITEM_A_RE = re.compile(
    r"^([A-Z][A-Z0-9 .&\/\-\(\)]{2,}?)"   # nama barang huruf besar
    r"\s{2,}(\d{1,3})\s{2,}"               # qty
    r"(\d{4,6})\s{2,}"                     # harga satuan (tanpa pemisah ribuan)
    + _PRICE + r"\s*$"                     # subtotal (dengan pemisah)
)

# Format B — Malaysia: BARCODE/KODE   NX   HARGA   HARGA
ITEM_B_RE = re.compile(
    r"^[\w\s\-]*?\b(\d+)\s*[xX]\s+"       # qty (pola NX)
    + _PRICE +                             # harga satuan
    r"(?:\s+" + _PRICE + r")?\s*$"        # subtotal (opsional)
)

# Format C — Fallback: NAMA   HARGA
ITEM_C_RE = re.compile(
    r"^(.+?)\s{2,}(?:[Rr][Pp]\.?\s*)?" + _PRICE + r"\s*$"
)

# Keyword non-item (universal)
SKIP_RE = re.compile(
    r"^\s*(?:"
    r"total|subtotal|sub\s*total|grand\s*total|"
    r"harga\s*jual|jumlah|amount|"
    r"ppn|pajak|vat|gst|tax|"
    r"diskon|discount|voucher|"
    r"tunai|cash|bayar|payment|"
    r"kembali|kembalian|change|"
    r"rounding|rounded|"
    r"member|poin|point|"
    r"kasir|cashier|operator|"
    r"terima\s*kasih|thank|please|"
    r"npwp|telp|fax|jl\.|jalan|"
    r"cancel|void|item\(s\)|qty\(s\)"
    r")\b",
    re.IGNORECASE
)

# Summary patterns
TAX_RE   = re.compile(r"\b(?:ppn|pajak|vat|gst|tax|service\s*charge)\b[^\d]*" + _PRICE, re.I)
SUB_RE   = re.compile(r"\b(?:harga\s*jual|sub\s*total|subtotal)\b[^\d]*" + _PRICE, re.I)
TOTAL_RE = re.compile(r"\b(?:grand\s*total|total\s*(?:rm|rp)?|total\s*rounded)\b[^\d]*" + _PRICE, re.I)


# ═══════════════════════════════════════════════════════════════
# PARSERS PER FORMAT
# ═══════════════════════════════════════════════════════════════

def parse_format_a(lines: list[str]) -> list[Item]:
    """
    Parser Indonesia: satu baris = satu item.
    NAMA   QTY   HARGA_SATUAN   SUBTOTAL
    """
    items = []
    for line in lines:
        line = line.strip()
        if not line or SKIP_RE.match(line):
            continue
        if re.search(r"\(\d+\)", line):   # baris cancel/void
            continue

        m = ITEM_A_RE.match(line)
        if not m:
            continue

        name_s, qty_s, unit_s, sub_s = m.groups()
        try:
            qty        = int(qty_s)
            unit_price = _parse_price(unit_s)
            subtotal   = _parse_price(sub_s)
            name       = _clean_name(name_s)

            if not name or unit_price == 0:
                continue

            # Validasi: subtotal ≈ qty × unit_price (toleransi 10%)
            expected = qty * unit_price
            if expected > 0 and abs(subtotal - expected) / expected > 0.10:
                continue

            items.append(Item(name=name, qty=qty, unit_price=unit_price, subtotal=subtotal))
        except Exception:
            continue
    return items


def parse_format_b(lines: list[str]) -> list[Item]:
    """
    Parser Malaysia: nama di baris terpisah, harga di baris NX.
    Scan dari bawah — temukan baris harga, cari nama di atasnya.
    """
    items = []
    for i, line in enumerate(lines):
        line = line.strip()
        m    = ITEM_B_RE.match(line)
        if not m:
            continue

        qty_s, unit_s, sub_s = m.groups()

        # Cari nama barang — mundur dari baris harga
        name = None
        for j in range(i - 1, max(i - 5, -1), -1):
            candidate = lines[j].strip()
            if not candidate or SKIP_RE.match(candidate):
                continue
            # Kandidat nama: ada huruf, tidak ada pola harga, tidak pure angka
            if (re.search(r"[A-Za-z]{2,}", candidate) and
                not re.search(r"\d+[.,]\d{2}", candidate) and
                not re.match(r"^[\d\s\-]+$", candidate) and
                len(candidate) > 3):
                name = candidate
                break

        if not name:
            continue

        try:
            qty        = float(qty_s)
            unit_price = _parse_price(unit_s)
            subtotal   = _parse_price(sub_s) if sub_s else round(qty * unit_price, 2)
            name       = _clean_name(name)

            if not name or unit_price == 0:
                continue

            items.append(Item(name=name, qty=qty, unit_price=unit_price, subtotal=subtotal))
        except Exception:
            continue
    return items


def parse_format_c(lines: list[str]) -> list[Item]:
    """
    Parser fallback: NAMA   HARGA (tanpa kolom qty dan unit price).
    qty default 1, unit_price = subtotal.
    """
    items = []
    for line in lines:
        line = line.strip()
        if not line or SKIP_RE.match(line) or len(line) < 4:
            continue

        m = ITEM_C_RE.match(line)
        if not m:
            continue

        name_s, price_s = m.groups()
        try:
            price = _parse_price(price_s)
            name  = _clean_name(name_s)

            if not name or price == 0:
                continue

            items.append(Item(name=name, qty=1, unit_price=price, subtotal=price))
        except Exception:
            continue
    return items


# ═══════════════════════════════════════════════════════════════
# MAIN EXTRACTOR
# ═══════════════════════════════════════════════════════════════

def extract(raw: str) -> tuple[list[Item], float, float, str]:
    """
    Deteksi format → jalankan parser yang sesuai.
    Return: (items, tax, subtotal, format_name)
    """
    lines  = raw.strip().split("\n")
    fmt    = detect_format(lines)
    logger.info(f"  Format terdeteksi: {fmt}")

    if fmt == "A":
        items = parse_format_a(lines)
        # Fallback ke C kalau Format A tidak menghasilkan item
        if not items:
            items = parse_format_c(lines)
            fmt   = "C (fallback dari A)"
    elif fmt == "B":
        items = parse_format_b(lines)
        if not items:
            items = parse_format_c(lines)
            fmt   = "C (fallback dari B)"
    else:
        items = parse_format_c(lines)

    tax      = _extract_tax(raw)
    subtotal = _extract_subtotal(raw, items)
    return items, tax, subtotal, fmt


def _extract_tax(text: str) -> float:
    m = TAX_RE.search(text)
    return _parse_price(m.group(1)) if m else 0.0


def _extract_subtotal(text: str, items: list[Item]) -> float:
    m = SUB_RE.search(text)
    if m:
        return _parse_price(m.group(1))
    m = TOTAL_RE.search(text)
    if m:
        return _parse_price(m.group(1))
    return round(sum(i.subtotal for i in items), 2)


def _parse_price(s: str) -> float:
    """Konversi string harga ke float — handle format Indonesia dan Malaysia."""
    s = re.sub(r"[^\d.,]", "", s)

    # Tentukan apakah titik atau koma sebagai desimal
    has_dot_thousands = bool(re.search(r"\.\d{3}", s))
    has_comma_decimal = bool(re.search(r",\d{2}$", s))
    has_dot_decimal   = bool(re.search(r"\.\d{2}$", s))

    if has_dot_thousands:
        # Format Indonesia: 13.500 → titik = ribuan
        s = s.replace(".", "").replace(",", ".")
    elif has_comma_decimal and not has_dot_decimal:
        # Format Malaysia: 19,00 → koma = desimal
        s = s.replace(",", ".")
    elif has_dot_decimal:
        # Format Malaysia: 19.00 → titik = desimal, sudah benar
        s = s.replace(",", "")
    else:
        # Plain number: 13500
        s = s.replace(",", "").replace(".", "")

    try:
        return float(s)
    except ValueError:
        return 0.0


def _clean_name(name: str) -> str:
    name = re.sub(r"\s+", " ", name).strip()
    # Title case tapi pertahankan singkatan (semua huruf besar ≤ 3 char)
    words = []
    for w in name.split():
        words.append(w if (w.isupper() and len(w) <= 3) else w.title())
    return " ".join(words)


# ═══════════════════════════════════════════════════════════════
# JSON STORAGE — satu file terindeks
# ═══════════════════════════════════════════════════════════════

def load_results() -> dict:
    if OUTPUT_JSON.exists():
        with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "total_processed": 0,
        "avg_confidence":  0.0,
        "format_counts":   {"A": 0, "B": 0, "C": 0},
        "receipts":        {}
    }


def save_result(data: dict, result: ReceiptData):
    OUTPUT_JSON.parent.mkdir(exist_ok=True)
    data["receipts"][result.filename] = asdict(result)

    entries                = list(data["receipts"].values())
    data["total_processed"] = len(entries)
    data["avg_confidence"]  = round(
        sum(e["confidence"] for e in entries) / len(entries), 3
    )

    # Hitung distribusi format
    fmt_counts = {"A": 0, "B": 0, "C": 0}
    for e in entries:
        fmt = e.get("detected_format", "C")[0]  # ambil huruf pertama
        if fmt in fmt_counts:
            fmt_counts[fmt] += 1
        else:
            fmt_counts["C"] += 1
    data["format_counts"] = fmt_counts

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ═══════════════════════════════════════════════════════════════
# PIPELINE
# ═══════════════════════════════════════════════════════════════

def process_image(image_path: str, index: int, data: dict,
                  debug: bool = False) -> ReceiptData:
    filename          = Path(image_path).name
    img               = preprocess(image_path, debug=debug)
    raw, conf         = run_tesseract(img)
    needs_rev, reason = check_quality(raw, conf)
    items, tax, sub, fmt = extract(raw)

    result = ReceiptData(
        index            = index,
        filename         = filename,
        detected_format  = fmt,
        items            = [asdict(i) for i in items],
        tax              = tax,
        subtotal         = sub,
        confidence       = round(conf, 3),
        needs_review     = needs_rev,
        review_reason    = reason
    )

    _print_result(result)
    save_result(data, result)
    return result


def _print_result(r: ReceiptData):
    flag = "⚠" if r.needs_review else "✓"
    logger.info(f"\n[{r.index:>4}] {flag} {r.filename}  |  fmt:{r.detected_format}  |  conf:{r.confidence*100:.1f}%")

    if r.items:
        logger.info(f"       {'NAMA BARANG':<35} {'QTY':>4}  {'SUBTOTAL':>12}")
        logger.info(f"       {'-'*55}")
        for it in r.items:
            logger.info(f"       {it['name']:<35} {it['qty']:>4.0f}  {it['subtotal']:>12,.2f}")
        logger.info(f"       {'-'*55}")
    else:
        logger.info("       (tidak ada item terdeteksi)")

    logger.info(f"       {'Subtotal':<39} {r.subtotal:>12,.2f}")
    if r.tax:
        logger.info(f"       {'Pajak/Tax':<39} {r.tax:>12,.2f}")
    if r.needs_review:
        logger.info(f"       ⚠ {r.review_reason}")


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OCR struk termal - adaptive multi-format")
    parser.add_argument("--input", required=True, help="Path gambar atau folder")
    parser.add_argument("--debug", action="store_true",
                        help="Simpan gambar tiap step ke output/debug/")
    args  = parser.parse_args()
    path  = Path(args.input)
    data  = load_results()
    start = data["total_processed"]

    if path.is_dir():
        images = sorted(f for f in path.rglob("*") if f.suffix.lower() in SUPPORTED_EXT)
        logger.info(f"\nBatch: {len(images)} gambar | Output → {OUTPUT_JSON}\n")
        ok = err = 0

        for i, img_path in enumerate(images, start=start + 1):
            try:
                process_image(str(img_path), index=i, data=data, debug=args.debug)
                ok += 1
            except Exception as e:
                logger.error(f"  ERROR [{i}] {img_path.name}: {e}")
                err += 1

        fc = data.get("format_counts", {})
        logger.info(f"\n{'='*55}")
        logger.info(f"  Diproses       : {ok} file")
        logger.info(f"  Error          : {err}")
        logger.info(f"  Avg Confidence : {data['avg_confidence']*100:.1f}%")
        logger.info(f"  Format A (ID)  : {fc.get('A', 0)} struk")
        logger.info(f"  Format B (MY)  : {fc.get('B', 0)} struk")
        logger.info(f"  Format C (lain): {fc.get('C', 0)} struk")
        logger.info(f"  Total di JSON  : {data['total_processed']} struk")
        logger.info(f"  Output         : {OUTPUT_JSON}")
        logger.info(f"{'='*55}")

    elif path.is_file():
        idx = start + 1
        process_image(str(path), index=idx, data=data, debug=args.debug)
        fc  = data.get("format_counts", {})
        logger.info(f"\n  Output JSON    → {OUTPUT_JSON}")
        logger.info(f"  Total tersimpan: {data['total_processed']} struk")
        logger.info(f"  Avg Confidence : {data['avg_confidence']*100:.1f}%")
    else:
        logger.error(f"Path tidak ditemukan: {path}")
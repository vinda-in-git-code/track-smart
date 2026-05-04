import cv2
import numpy as np
import pytesseract
import argparse
import sys
import os
import re
import json

# pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
pytesseract.pytesseract.tesseract_mac = r"/usr/local/bin/tesseract"

def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect

def deskew(image):
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image.copy()
        thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
        
        coords = np.column_stack(np.where(thresh > 0))
        if len(coords) == 0:
            return image
            
        angle = cv2.minAreaRect(coords)[-1]
        if angle > 45: angle = 90 - angle
        elif angle < -45: angle = -(90 + angle)
        else: angle = -angle
            
        if abs(angle) < 0.5:
            return image
            
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        bg_color = (255, 255, 255) if len(image.shape) == 3 else 255
        return cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=bg_color)
    except Exception:
        return image

def get_receipt_crop(image):
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image.copy()
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)
        
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None
            
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        largest_cnt = contours[0]
        
        area = cv2.contourArea(largest_cnt)
        image_area = image.shape[0] * image.shape[1]
        
        if area / image_area < 0.1:
            return None
            
        peri = cv2.arcLength(largest_cnt, True)
        approx = cv2.approxPolyDP(largest_cnt, 0.02 * peri, True)
        
        if len(approx) == 4:
            pts = approx.reshape(4, 2)
            rect = order_points(pts)
            (tl, tr, br, bl) = rect
            
            widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
            widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
            maxWidth = max(int(widthA), int(widthB))
            
            heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
            heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
            maxHeight = max(int(heightA), int(heightB))
            
            dst = np.array([
                [0, 0],
                [maxWidth - 1, 0],
                [maxWidth - 1, maxHeight - 1],
                [0, maxHeight - 1]], dtype="float32")
                
            M = cv2.getPerspectiveTransform(rect, dst)
            warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
            
            padding = 20
            bg_color = [255, 255, 255] if len(image.shape) == 3 else 255
            padded = cv2.copyMakeBorder(warped, padding, padding, padding, padding, cv2.BORDER_CONSTANT, value=bg_color)
            return padded
        else:
            x, y, w, h = cv2.boundingRect(largest_cnt)
            aspect_ratio = float(w)/h
            if 0.2 < aspect_ratio < 5.0:
                crop = image[max(0, y-20):min(image.shape[0], y+h+20), max(0, x-20):min(image.shape[1], x+w+20)]
                if crop.size > 0:
                    return crop
        return None
    except Exception:
        return None

def get_rotations(image):
    return [
        ("rot_0", image),
        ("rot_90", cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)),
        ("rot_180", cv2.rotate(image, cv2.ROTATE_180)),
        ("rot_270", cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE))
    ]

def get_preprocess_variants(image, debug=False):
    variants = {}
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image.copy()
    
    variants["gray"] = gray
    
    gray_2x = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    variants["resize_2x"] = gray_2x
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    clahe_2x = clahe.apply(gray_2x)
    variants["clahe_2x"] = clahe_2x
    
    denoised_2x = cv2.fastNlMeansDenoising(gray_2x, h=10)
    thresh_adapt = cv2.adaptiveThreshold(denoised_2x, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    variants["adaptive_thresh"] = thresh_adapt
    
    if debug:
        gray_3x = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
        variants["resize_3x"] = gray_3x
        
        variants["denoise_2x"] = denoised_2x
        
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
        sharpen_2x = cv2.filter2D(gray_2x, -1, kernel)
        variants["sharpen_2x"] = sharpen_2x
        
        _, thresh_otsu = cv2.threshold(denoised_2x, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants["otsu_thresh"] = thresh_otsu
        
        kernel_morph = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        morph_close = cv2.morphologyEx(thresh_otsu, cv2.MORPH_CLOSE, kernel_morph)
        variants["morph_close"] = morph_close
        
    return variants

def score_text(text):
    if not text or not text.strip():
        return -1000
        
    score = 0
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    line_count = len(lines)
    
    total_chars = len(text)
    alnum_chars = sum(c.isalnum() for c in text)
    if total_chars > 0:
        alnum_ratio = alnum_chars / total_chars
        if alnum_ratio < 0.3:
            score -= 50
    else:
        return -1000
        
    price_pattern = re.compile(r'\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\b|\b\d{4,}\b')
    prices_found = len(re.findall(price_pattern, text))
    score += prices_found * 10
    
    if prices_found == 0:
        score -= 20
        
    keywords = ['TOTAL', 'SUBTOTAL', 'BAYAR', 'KEMBALI', 'CASH', 'ITEM', 'QTY', 'HARGA', 'PEMBAYARAN', 'GRAND TOTAL', 'TAX', 'PPN']
    text_upper = text.upper()
    kw_count = sum(1 for kw in keywords if kw in text_upper)
    score += kw_count * 15
    
    score += min(line_count, 30) * 2
    
    words = text.split()
    if len(words) > 0:
        short_words = sum(1 for w in words if len(w) <= 2 and w.isalnum())
        if short_words / len(words) > 0.5:
            score -= 30
            
    garbage_lines = 0
    item_like_lines = 0
    for line in lines:
        letters = sum(c.isalpha() for c in line)
        digits = sum(c.isdigit() for c in line)
        if len(line) > 5 and letters == 0 and digits == 0:
            garbage_lines += 1
        if letters > 2 and re.search(price_pattern, line):
            item_like_lines += 1
            
    score -= garbage_lines * 5
    score += item_like_lines * 5
    
    return score

def extract_text(image_path: str, lang: str = 'eng', debug: bool = False) -> str:
    if not os.path.exists(image_path):
        print(f"Error: Image file not found at '{image_path}'", file=sys.stderr)
        sys.exit(1)
        
    try:
        pytesseract.get_tesseract_version()
    except pytesseract.TesseractNotFoundError:
        print("Error: Tesseract is not installed or not in your PATH.", file=sys.stderr)
        sys.exit(1)
        
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Failed to load image '{image_path}'. Ensure it is a valid image format.", file=sys.stderr)
        sys.exit(1)
        
    # Resize max width 1400 to optimize performance
    h, w = image.shape[:2]
    if w > 1400:
        scale = 1400.0 / w
        image = cv2.resize(image, (1400, int(h * scale)), interpolation=cv2.INTER_AREA)
        
    debug_dir = "data/processed/debug"
    if debug:
        os.makedirs(debug_dir, exist_ok=True)
        
    candidates = {}
    candidates["original"] = image
    
    crop = get_receipt_crop(image)
    if crop is not None:
        candidates["crop"] = crop
        
    if debug:
        deskewed = deskew(image)
        if deskewed is not image:
            candidates["deskewed"] = deskewed
            
        rot_candidates = {}
        for name, cand in list(candidates.items()):
            if name in ["original", "crop"]:
                for rot_name, rot_img in get_rotations(cand):
                    if rot_name == "rot_0":
                        continue
                    rot_candidates[f"{name}_{rot_name}"] = rot_img
                    
        candidates.update(rot_candidates)
    
    if debug:
        for name, cand in candidates.items():
            cv2.imwrite(os.path.join(debug_dir, f"candidate_{name}.jpg"), cand)
            
    best_text = ""
    best_score = -99999
    
    if debug:
        configs = ["--oem 3 --psm 6", "--oem 3 --psm 4", "--oem 3 --psm 11", "--oem 3 --psm 12"]
    else:
        configs = ["--oem 3 --psm 6", "--oem 3 --psm 4"]
        
    MAX_ATTEMPTS = 12 if not debug else 1000
    attempt_count = 0
    
    for cand_name, cand_img in candidates.items():
        if attempt_count >= MAX_ATTEMPTS:
            break
            
        variants = get_preprocess_variants(cand_img, debug=debug)
        
        if debug:
            for v_name, v_img in variants.items():
                cv2.imwrite(os.path.join(debug_dir, f"variant_{cand_name}_{v_name}.jpg"), v_img)
                
        for v_name, v_img in variants.items():
            if attempt_count >= MAX_ATTEMPTS:
                break
                
            for config in configs:
                if attempt_count >= MAX_ATTEMPTS:
                    break
                    
                attempt_count += 1
                if debug:
                    print(f"Attempting OCR ({attempt_count}/{MAX_ATTEMPTS}) -> [{cand_name}] [{v_name}] [{config}]")
                else:
                    print(f"Attempting OCR ({attempt_count}/{MAX_ATTEMPTS})...")
                    
                try:
                    text = pytesseract.image_to_string(v_img, lang=lang, config=config)
                    score = score_text(text)
                    
                    if debug:
                        preview = text.replace('\n', ' ')[:50]
                        print(f"  Result Score: {score:.2f} | Preview: {preview}")
                        
                    if score > best_score:
                        best_score = score
                        best_text = text
                        
                except Exception as e:
                    if debug:
                        print(f"  Warning: OCR failed. Error: {e}", file=sys.stderr)
                    continue

    if debug:
        print(f"\n=== BEST CANDIDATE SCORE: {best_score:.2f} ===")
        
    if not best_text or not best_text.strip():
        print("Error: OCR returned an empty result for all attempts.", file=sys.stderr)
        sys.exit(1)
        
    return best_text.strip()

def clean_ocr_text(text: str) -> str:
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        line = line.replace('|', 'I')
        line = line.replace('~', '-')
        cleaned_lines.append(line)
    return '\n'.join(cleaned_lines)

def parse_price(value: str) -> int | None:
    value = re.sub(r'[.,]00$', '', value.strip())
    value = re.sub(r'[^\d]', '', value)
    if value:
        try:
            return int(value)
        except:
            return None
    return None

def is_noise_line(line: str) -> bool:
    line_upper = line.upper()
    noise_patterns = [
        # Alamat / Address
        r'\bJL\.?\b', r'\bJLN\.?\b', r'\bJALAN\b', r'\bKEC\.?\b', r'\bKAB\.?\b', r'\bKOTA\b', r'\bBLOK\b', r'\bRT\b', r'\bRW\b',
        # Phone
        r'\bTELP\b', r'\bHP\b', r'\b08\d{8,}\b', r'\+62\d+',
        # Transaction / Date
        r'\bTRANS\b', r'\bKASSA\b', r'\bKASIR\b', r'\bCASHIER\b', r'\bRECEIPT\b', r'\bNO\.?\b', r'\bNOTA\b', 
        r'\bTANGGAL\b', r'\bWAKTU\b', r'\bDATE\b', r'\bTIME\b', r'\bSERVER\b', r'\bTABLE\b',
        # Payment / Tax / Summary
        r'\bTOTAL\b', r'\bSUBTOTAL\b', r'\bGRAND\s*TOTAL\b', r'\bTOTAL\s*BELANJA\b', r'\bTOTAL\s*HRG\b', 
        r'\bTUNAI\b', r'\bBAYAR\b', r'\bKEMBALI\b', r'\bCASH\b', r'\bNON\s*TUNAI\b', r'\bPAYMENT\b', 
        r'\bPEMBAYARAN\b', r'\bPPN\b', r'\bPB1\b', r'\bTAX\b', r'\bSERVICE\b', r'\bDISCOUNT\b', r'\bDISKON\b', 
        r'\bVOUCHER\b', r'\bCHARGE\b', r'\bROUND\b', r'\bANDA\s*HEMAT\b', r'\bQTY\b', r'\bITEM\b',
        # Footer
        r'\bTERIMA\s*KASIH\b', r'\bTHANK\s*YOU\b', r'\bDOWNLOAD\b', r'\bAPP\s*STORE\b', r'\bPLAY\b', 
        r'\bCUSTOMER\b', r'\bLAYANAN\b', r'\bNPWP\b',
    ]
    for pattern in noise_patterns:
        if re.search(pattern, line_upper):
            return True
            
    price_pattern = r'(?<!\d)(?:Rp\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d{4,})(?!\d)'
    has_price = bool(re.search(price_pattern, line, re.IGNORECASE))
    
    letters = sum(c.isalpha() for c in line)
    if not has_price and letters < 2:
        return True
        
    return False

def extract_qty_price(line: str) -> tuple:
    price_pattern = r'(?<!\d)(?:Rp\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d{4,})(?!\d)'
    matches = list(re.finditer(price_pattern, line, re.IGNORECASE))
    
    valid_prices = []
    for m in matches:
        p_val = parse_price(m.group(1))
        if p_val is not None and 100 <= p_val <= 10000000:
            valid_prices.append((m, p_val))
            
    if not valid_prices:
        return 1, None, line
        
    total_price_match, total_price = valid_prices[-1]
    
    unit_price_match, unit_price = None, None
    if len(valid_prices) > 1:
        unit_price_match, unit_price = valid_prices[-2]
        
    qty = 1
    qty_patterns = [
        r'(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:[xX\*]|\bPcs\b|\bPCS\b|\bpcs\b|@)',
        r'^\s*(\d{1,2})\s+(?=[a-zA-Z])',
    ]
    
    qty_str = None
    qty_match_span = None
    
    for pat in qty_patterns:
        m = re.search(pat, line, re.IGNORECASE)
        if m:
            if not (m.start(1) >= total_price_match.start() and m.end(1) <= total_price_match.end()):
                if unit_price_match and m.start(1) >= unit_price_match.start() and m.end(1) <= unit_price_match.end():
                    continue
                qty_str = m.group(1).replace(',', '.')
                qty_match_span = m.span()
                break
                
    if qty_str:
        try:
            qty = int(float(qty_str))
        except:
            qty = 1
    else:
        if unit_price and unit_price > 0 and total_price % unit_price == 0:
            calc_qty = total_price // unit_price
            if calc_qty > 0:
                sub = line[:unit_price_match.start()]
                m = re.search(r'\b' + str(calc_qty) + r'\b', sub)
                if m:
                    qty = calc_qty
                    qty_match_span = m.span()
                else:
                    qty = calc_qty

    parts_to_remove = [total_price_match.span()]
    if unit_price_match:
        parts_to_remove.append(unit_price_match.span())
    if qty_match_span:
        parts_to_remove.append(qty_match_span)
        
    parts_to_remove.sort(key=lambda x: x[0])
    merged = []
    for start, end in parts_to_remove:
        if not merged:
            merged.append([start, end])
        else:
            prev_start, prev_end = merged[-1]
            if start < prev_end:
                merged[-1][1] = max(prev_end, end)
            else:
                merged.append([start, end])
                
    name = line
    for start, end in reversed(merged):
        name = name[:start] + " " + name[end:]
        
    name = re.sub(r'(?i)\bRp\b|@|:', ' ', name)
    name = re.sub(r'[^a-zA-Z0-9\s%\-/\'’+°]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    
    return qty, total_price, name

def extract_receipt_data(raw_text: str, debug: bool = False) -> dict:
    cleaned_text = clean_ocr_text(raw_text)
    lines = cleaned_text.split('\n')
    
    items = []
    jumlah_semua_barang = 0
    total_belanja = 0
    
    total_keywords = ["TOTAL BELANJA", "GRAND TOTAL", "TOTAL HRG", "TOTAL TAGIHAN", "TOTAL"]
    ignore_for_total = ["TUNAI", "BAYAR", "KEMBALI", "CASH", "NON TUNAI", "SUBTOTAL"]
    found_total = False
    
    for i, line in enumerate(lines):
        upper_line = line.upper()
        
        if any(re.search(r'\b' + kw.replace(' ', r'\s*') + r'\b', upper_line) for kw in total_keywords):
            if any(re.search(r'\b' + kw.replace(' ', r'\s*') + r'\b', upper_line) for kw in ignore_for_total):
                continue
                
            price_pattern = r'(?<!\d)(?:Rp\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d{4,})(?!\d)'
            price_matches = re.findall(price_pattern, line, re.IGNORECASE)
            
            total_candidates = []
            for m in price_matches:
                p = parse_price(m)
                if p and p >= 100:
                    total_candidates.append(p)
                    
            if total_candidates:
                total_belanja = total_candidates[-1]
                found_total = True
                break
            elif i + 1 < len(lines):
                next_matches = re.findall(price_pattern, lines[i+1], re.IGNORECASE)
                next_candidates = []
                for m in next_matches:
                    p = parse_price(m)
                    if p and p >= 100:
                        next_candidates.append(p)
                if next_candidates:
                    total_belanja = next_candidates[-1]
                    found_total = True
                    break

    i = 0
    while i < len(lines):
        line = lines[i]
        
        if is_noise_line(line):
            if debug:
                print(f"[REJECTED] '{line}' | Reason: Noise line match")
            i += 1
            continue
            
        qty, item_total, name = extract_qty_price(line)
        
        if item_total is not None and len(name) >= 2:
            items.append({
                "nama_barang": name,
                "jumlah_barang": qty,
                "total_harga_barang": item_total
            })
            if debug:
                print(f"[ACCEPTED] '{line}' | Reason: Single-line item | Qty: {qty}, Price: {item_total}, Name: {name}")
        elif item_total is None and sum(c.isalpha() for c in line) > 2:
            if i + 1 < len(lines):
                next_line = lines[i+1]
                if not is_noise_line(next_line):
                    next_qty, next_item_total, next_name = extract_qty_price(next_line)
                    if next_item_total is not None:
                        combined_name = (name + " " + next_name).strip()
                        items.append({
                            "nama_barang": combined_name if combined_name else name,
                            "jumlah_barang": next_qty,
                            "total_harga_barang": next_item_total
                        })
                        if debug:
                            print(f"[ACCEPTED] '{line}' + '{next_line}' | Reason: Multi-line item | Qty: {next_qty}, Price: {next_item_total}, Name: {combined_name}")
                        i += 1
                    else:
                        if debug:
                            print(f"[REJECTED] '{line}' | Reason: No price found and next line no price")
                else:
                    if debug:
                        print(f"[REJECTED] '{line}' | Reason: No price found and next line is noise")
            else:
                if debug:
                    print(f"[REJECTED] '{line}' | Reason: No price found at end of lines")
        else:
            if debug:
                print(f"[REJECTED] '{line}' | Reason: No price found and not valid name")
                
        i += 1

    for item in items:
        jumlah_semua_barang += item["jumlah_barang"]
        
    if not found_total:
        total_belanja = sum(item["total_harga_barang"] for item in items)
        
    return {
        "items": items,
        "jumlah_semua_barang": jumlah_semua_barang,
        "total_belanja": total_belanja,
        "raw_text": raw_text,
        "cleaned_text": cleaned_text
    }

def process_image(image_path, lang='eng'):
    """Fungsi wrapper untuk dipanggil oleh ocr_app.py"""
    text_result = extract_text(image_path, lang=lang, debug=False)
    parsed_data = extract_receipt_data(text_result, debug=False)
    return parsed_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Robust multi-path OCR for receipt images")
    parser.add_argument('--image', type=str, required=True, help="Path to the receipt image")
    parser.add_argument('--lang', type=str, default='eng', help="Language code for Tesseract (e.g., ind, eng)")
    parser.add_argument('--debug', action='store_true', help="Enable debug mode")
    parser.add_argument('--json-only', action='store_true', help="Output only JSON")
    
    args = parser.parse_args()
    
    if args.json_only:
        import sys
        import os
        original_stdout = sys.stdout
        sys.stdout = open(os.devnull, 'w')
        
    result = extract_text(args.image, lang=args.lang, debug=args.debug)
    
    if args.json_only:
        sys.stdout.close()
        sys.stdout = original_stdout
        
        parsed_data = extract_receipt_data(result, debug=args.debug)
        print(json.dumps(parsed_data, indent=2, ensure_ascii=False))
    else:
        if not args.debug:
            print("--- OCR Result ---")
        print(result)
        
        parsed_data = extract_receipt_data(result, debug=args.debug)
        print("\n---- JSON ----")
        print(json.dumps(parsed_data, indent=2, ensure_ascii=False))
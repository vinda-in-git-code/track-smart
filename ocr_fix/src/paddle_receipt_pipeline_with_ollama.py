import argparse
import json
import os
import re
import sys
import requests

try:
    from paddleocr import PaddleOCR
except ImportError:
    print("Error: PaddleOCR not installed.", file=sys.stderr)
    print("Please install it using: pip install paddleocr paddlepaddle", file=sys.stderr)
    sys.exit(1)

def parse_args():
    parser = argparse.ArgumentParser(description="PaddleOCR Receipt Pipeline")
    parser.add_argument("--image", required=True, help="Path to the image file")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    parser.add_argument("--json-only", action="store_true", help="Output only JSON")
    return parser.parse_args()

def sort_ocr_boxes(dt_boxes):
    dt_boxes.sort(key=lambda x: (x[0][0][1], x[0][0][0]))
    return dt_boxes

def get_rightmost_price(text):
    t = re.sub(r'(?i)\b(?:no\.|nomor|trans|trx|struk|nota|kasir|cashier|telp|tlp|post?|npwp)\s*[:#-]?\s*[\d.,]+\b', '', text)
    t = re.sub(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b', '', t)
    t = re.sub(r'\b\d{2}:\d{2}(?::\d{2})?\b', '', t)
    t = re.sub(r'Rp\.?\s*', '', t, flags=re.IGNORECASE)
    
    chunks = re.findall(r'\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{3,7}\b', t)
    for chunk in reversed(chunks):
        c = chunk.replace('.', '').replace(',', '')
        if c.isdigit() and not c.startswith('0'):
            val = int(c)
            if 500 <= val <= 9999999:
                return val
    return None

def extract_qty_and_price(text):
    qty = 1.0
    price = get_rightmost_price(text)
    
    m = re.search(r'\b(\d+(?:[,.]\d+)?)\s*(?:x|pcs|btl|ns)\b', text, re.IGNORECASE)
    if m:
        qty_str = m.group(1).replace(',', '.')
        try:
            qty = float(qty_str)
        except ValueError:
            pass
    else:
        t = re.sub(r'(?i)\b(?:no\.|nomor|trans|trx|struk|nota|kasir|cashier|telp|tlp)\s*[:#-]?\s*[\d.,]+\b', '', text)
        t = re.sub(r'Rp\.?\s*', '', t, flags=re.IGNORECASE)
        chunks = re.findall(r'\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+\b', t)
        vals = []
        for c in chunks:
            c_clean = c.replace('.', '').replace(',', '')
            if c_clean.isdigit():
                vals.append(int(c_clean))
        vals = [v for v in vals if v > 0]
        
        if len(vals) >= 3 and 500 <= vals[-1] <= 9999999 and 500 <= vals[-2] <= 9999999:
            if vals[-3] < 100:
                qty = float(vals[-3])
        elif len(vals) >= 2 and 500 <= vals[-1] <= 9999999:
            if vals[-2] < 100:
                qty = float(vals[-2])

    if qty.is_integer():
        qty = int(qty)
    return qty, price

def clean_item_name(text):
    t = re.sub(r'(?i)\b(?:no\.|nomor|trans|trx|struk|nota|kasir|cashier|telp|tlp)\s*[:#-]?\s*[\d.,]+\b', '', text)
    t = re.sub(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b', '', t)
    t = re.sub(r'Rp\.?\s*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{3,8}\b', '', t)
    t = re.sub(r'\b\d+(?:[,.]\d+)?\s*(?:x|pcs|btl|ns)\b', '', t, flags=re.IGNORECASE)
    t = re.sub(r'[\d.,:@\-\s]+$', '', t)
    t = re.sub(r'^[\-\*\.\:\s]+', '', t)
    return t.strip()

def is_valid_item_name(text):
    return bool(re.search(r'[A-Za-z]', text))

STOP_MARKERS = [
    "subtotal", "sub total", "total", "tax", "ppn", "pb1", "service", "charge",
    "discount", "diskon", "voucher", "payment", "tunai", "cash", "kembali",
    "kembalian", "bayar", "non tunai", "card", "kartu", "debit", "kredit",
    "grand total", "total belanja", "total tagihan", "total hrg",
    "terima kasih", "thank you", "anda", "pelanggan"
]

def is_stop_marker(text):
    text_lower = text.lower()
    for marker in STOP_MARKERS:
        if re.search(r'\b' + re.escape(marker) + r'\b', text_lower):
            if marker == "total" and any(k in text_lower for k in ["harga", "price", "item", "qty"]):
                continue
            return True
    return False

def is_strict_non_item(text):
    text_upper = text.upper()
    summary_patterns = [
        r"\bITEM\s*:?\s*\d+\s+TOTAL\b",
        r"\bJUMLAH\s+ITEM\b",
        r"\bJUMLAH\s+SEMUA\s+BARANG\b",
        r"\bTOTAL\s+BELANJA\b",
        r"\bSUB\s*TOTAL\b",
        r"\bGRAND\s+TOTAL\b",
    ]
    for pattern in summary_patterns:
        if re.search(pattern, text_upper):
            return True
            
    if "TOTAL" in text_upper and "ITEM" in text_upper:
        return True
        
    if "TOTAL" in text_upper:
        return True

    return False

def extract_total(lines_text, items):
    for text in reversed(lines_text):
        t_lower = text.lower()
        if any(kw in t_lower for kw in ["grand total", "total belanja", "total tagihan", "total hrg"]):
            p = get_rightmost_price(text)
            if p: return p

    for i, text in reversed(list(enumerate(lines_text))):
        t_lower = text.lower()
        if "total" in t_lower and not any(kw in t_lower for kw in ["sub", "item", "qty", "discount"]):
            p = get_rightmost_price(text)
            if p: return p
            if i + 1 < len(lines_text):
                p2 = get_rightmost_price(lines_text[i+1])
                if p2: return p2
                
    if items:
        return sum(item["total_harga_barang"] for item in items)
    return 0

def create_classification_text(items):
    texts = []
    for item in items:
        name = item['nama_barang'].lower()
        name = re.sub(r'[^a-z\s]', ' ', name)
        name = ' '.join(name.split())
        if name:
            texts.append(name)
    return " ".join(texts)

def reconstruct_lines_from_paddle(normalized_lines):
    tokens = []
    lines_no_box = []
    for item in normalized_lines:
        box = item[0]
        text = item[1][0]
        
        if not box or not isinstance(box, list) or len(box) == 0:
            lines_no_box.append(text)
            continue
            
        try:
            y_coords = [p[1] for p in box]
            x_coords = [p[0] for p in box]
            y_min, y_max = min(y_coords), max(y_coords)
            x_min = min(x_coords)
            y_center = (y_min + y_max) / 2.0
            height = y_max - y_min
            tokens.append({
                'text': text,
                'x_min': x_min,
                'y_center': y_center,
                'height': height
            })
        except Exception:
            lines_no_box.append(text)

    if not tokens:
        return lines_no_box

    heights = sorted([t['height'] for t in tokens])
    median_height = heights[len(heights) // 2]
    threshold = median_height * 0.6

    tokens.sort(key=lambda t: t['y_center'])

    rows = []
    current_row = []
    current_row_y = None

    for t in tokens:
        if not current_row:
            current_row.append(t)
            current_row_y = t['y_center']
        else:
            if abs(t['y_center'] - current_row_y) <= threshold:
                current_row.append(t)
                current_row_y = sum(item['y_center'] for item in current_row) / len(current_row)
            else:
                rows.append(current_row)
                current_row = [t]
                current_row_y = t['y_center']
    if current_row:
        rows.append(current_row)

    reconstructed_lines = []
    for row in rows:
        row.sort(key=lambda t: t['x_min'])
        row_text = " ".join([t['text'] for t in row])
        reconstructed_lines.append(row_text)

    return reconstructed_lines + lines_no_box

def parse_receipt_manual(reconstructed_lines, debug=False):
    lines_text_only = []
    section = "HEADER"
    items = []
    pending_name = ""
    cleaned_lines = []
    
    for text in reconstructed_lines:
        try:
            text = text.strip()
            if not text:
                continue
            lines_text_only.append(text)
            
            price = get_rightmost_price(text)
            
            if debug:
                print(f"[DEBUG] Line: '{text}' | State: {section}")
                
            if section == "HEADER":
                if price is not None:
                    section = "ITEMS"
                    if debug: print(f"[DEBUG] Reason: Found price {price}, switching to ITEMS")
                else:
                    pending_name = text
                    if debug: print("[DEBUG] Reason: No price found, keeping as pending name")
                    continue

            if section == "ITEMS":
                if is_stop_marker(text):
                    section = "FOOTER"
                    if debug: print("[DEBUG] Reason: Found stop marker, switching to FOOTER")
                    continue
                    
                if is_strict_non_item(text):
                    if debug: print("[DEBUG] Reason: Strict NON_ITEM matched, discarding line")
                    continue
                    
                if price is not None:
                    qty, p = extract_qty_and_price(text)
                    name_part = clean_item_name(text)
                    name = pending_name + " " + name_part
                    name = name.strip()
                    
                    if is_valid_item_name(name):
                        items.append({
                            "nama_barang": name,
                            "jumlah_barang": qty,
                            "total_harga_barang": p
                        })
                        cleaned_lines.append(name)
                        if debug: 
                            print(f"[DEBUG] Accepted: YES")
                            print(f"[DEBUG] Parsed Item Name: {name}")
                            print(f"[DEBUG] Parsed Qty: {qty}")
                            print(f"[DEBUG] Parsed Price: {p}")
                    else:
                        if debug: 
                            print(f"[DEBUG] Accepted: NO")
                            print(f"[DEBUG] Reason: Invalid item name (no letters)")
                    
                    pending_name = ""
                else:
                    if pending_name:
                        pending_name += " " + text
                    else:
                        pending_name = text
                    if debug: 
                        print(f"[DEBUG] Accepted: NO")
                        print(f"[DEBUG] Reason: No price found, appending to pending name")
                    
            if section == "FOOTER":
                if debug: print("[DEBUG] Accepted: NO | Reason: In FOOTER section")
                
        except Exception as e:
            if debug: print(f"[DEBUG] Error processing line: {e}")
            continue

    raw_text = "\n".join(lines_text_only)
        
    total_belanja = extract_total(lines_text_only, items)
    
    return {
        "items": items,
        "total_belanja": total_belanja,
        "item_text_for_classification": create_classification_text(items),
        "raw_text": raw_text,
        "cleaned_text": "\n".join(cleaned_lines)
    }

def clean_item_names_with_ollama(items, debug=False):
    if not items:
        return items

    names = [item.get("nama_barang", "") for item in items]
    names_json = json.dumps(names, ensure_ascii=False)

    prompt = f"""
You clean OCR mistakes in receipt item names.

Return JSON only.
No markdown.
No explanation.

Input is a JSON array of item names.
Return exactly this JSON format:
{{
  "cleaned_names": ["name1", "name2"]
}}

Rules:
- Keep the same number of names
- Keep the same order
- Do not add items
- Do not remove items
- Do not invent products
- If unsure, keep original text
- Only fix obvious OCR mistakes inside product names
- Preserve food/drink/product meaning
- Preserve size/variant info like 1L, 500ML, XL, spicy, original, roll, ramen
- Do not change quantity or price numbers
- Common OCR confusions: 0/O, 1/l/I, 5/S, 8/B, ]/l, |/l/I, rn/m, vv/w, cl/d

Item names:
{names_json}
""".strip()

    try:
        if debug:
            print("[DEBUG] Cleaning item names with Ollama...")

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "qwen2.5:1.5b",
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=180
        )
        response.raise_for_status()

        data = response.json()
        content = data.get("response", "").strip()

        if debug:
            print("[DEBUG] Ollama raw response:")
            print(content)

        result = json.loads(content)

        cleaned_names = result.get("cleaned_names")
        if not isinstance(cleaned_names, list):
            raise ValueError("cleaned_names missing or not a list")

        if len(cleaned_names) != len(names):
            raise ValueError(f"Item count mismatch: expected {len(names)}, got {len(cleaned_names)}")

        new_items = []
        for item, new_name in zip(items, cleaned_names):
            copied = item.copy()

            if isinstance(new_name, str) and new_name.strip():
                copied["nama_barang"] = new_name.strip()

            new_items.append(copied)

        if debug:
            print("[DEBUG] Ollama cleaned names success")

        return new_items

    except Exception as e:
        if debug:
            print(f"[DEBUG] Ollama failed, using original names. Error: {e}")
        return items

def main():
    args = parse_args()
    
    if not os.path.exists(args.image):
        print(f"Error: Image file not found: {args.image}", file=sys.stderr)
        sys.exit(1)
    
    if args.debug:
        print("Running PaddleOCR...")

    try:
        ocr = PaddleOCR(lang="en")
        try:
            result = ocr.predict(args.image)
        except AttributeError:
            result = ocr.ocr(args.image)
    except Exception as e:
        print("Failed to initialize or run PaddleOCR:", e)
        sys.exit(1)

    empty_result = {
        "items": [],
        "total_belanja": 0,
        "item_text_for_classification": "",
        "raw_text": "",
        "cleaned_text": ""
    }
    
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

    if not normalized_lines:
        print(json.dumps(empty_result, indent=2, ensure_ascii=False))
        return
        
    reconstructed_lines = reconstruct_lines_from_paddle(normalized_lines)

    if args.debug:
        print(f"OCR lines found: {len(reconstructed_lines)}")
        for i, text in enumerate(reconstructed_lines, 1):
            print(f"[LINE {i:02d}] {text}")
    
    manual_result = parse_receipt_manual(reconstructed_lines, args.debug)
    
    cleaned_items = clean_item_names_with_ollama(manual_result["items"], args.debug)
    
    cleaned_lines = [item["nama_barang"] for item in cleaned_items]
    manual_result["items"] = cleaned_items
    manual_result["cleaned_text"] = "\n".join(cleaned_lines)
    
    class_texts = []
    for name in cleaned_lines:
        cname = re.sub(r'[^a-z\s]', ' ', name.lower())
        cname = ' '.join(cname.split())
        if cname:
            class_texts.append(cname)
    manual_result["item_text_for_classification"] = " ".join(class_texts).strip()
    
    result_json = manual_result
    

    # Save result to JSON file
    output_path = "data/processed/output.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result_json, f, indent=2, ensure_ascii=False)

    if args.debug:
        print(f"[DEBUG] JSON saved to: {output_path}")

    if not args.json_only and not args.debug:
        print(json.dumps(result_json, indent=2, ensure_ascii=False))
    elif args.json_only:
        print(json.dumps(result_json, indent=2, ensure_ascii=False))
    elif args.debug:
        print("\n[DEBUG] FINAL JSON:")
        print(json.dumps(result_json, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()

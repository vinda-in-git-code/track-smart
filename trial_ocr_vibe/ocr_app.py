from flask import Flask, jsonify, request
import os
import json
from werkzeug.utils import secure_filename
from flask_cors import CORS
from src.ocr import process_image

app = Flask(__name__)
# Mengizinkan akses lintas origin (CORS) dari Frontend
CORS(app)

# Konfigurasi Upload untuk VPS (bisa menyimpan di folder lokal)
UPLOAD_FOLDER = 'uploads'
JSON_FOLDER = 'json_results'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(JSON_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['JSON_FOLDER'] = JSON_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # Max 16MB

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/', methods=['GET'])
def health_check():
    """Endpoint GET untuk memastikan service berjalan (Health Check)"""
    return jsonify({
        'status': 'online',
        'message': 'OCR API Service is running smoothly on VPS',
        'endpoints': {
            'POST /api/v1/ocr': 'Upload form-data containing "file" (image) to extract OCR text'
        }
    }), 200

@app.route('/api/v1/ocr', methods=['POST'])
def process_ocr():
    """Endpoint POST untuk menerima gambar, memproses OCR, dan mengembalikan JSON"""
    if 'file' not in request.files:
        return jsonify({'error': 'Tidak ada file gambar yang dikirim dalam request'}), 400
        
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'File kosong / tidak dipilih'}), 400
        
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Simpan gambar ke folder uploads
        file.save(filepath)
        
        try:
            # 1. Jalankan proses OCR
            result = process_image(filepath)
            
            # 2. Siapkan path untuk menyimpan hasil JSON
            base_filename = os.path.splitext(filename)[0]
            json_filename = f"{base_filename}.json"
            json_filepath = os.path.join(app.config['JSON_FOLDER'], json_filename)
            
            # 3. Simpan hasil ekstraksi ke folder json_results
            with open(json_filepath, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=4)
            
            # (Opsional) Hapus gambar setelah diproses jika tidak ingin memenuhi storage
            # if os.path.exists(filepath):
            #     os.remove(filepath)
            
            # 4. Lempar kembali isi JSON tersebut ke Frontend
            return jsonify({
                "status": "success",
                "message": f"Berhasil diproses dan disimpan sebagai {json_filename}",
                "data": result
            }), 200
            
        except Exception as e:
            return jsonify({'error': f'Gagal memproses gambar: {str(e)}'}), 500
            
    return jsonify({'error': 'Format file tidak didukung. Gunakan JPG/PNG.'}), 400

if __name__ == '__main__':
    # Jalankan server di port 3000 (bisa disesuaikan)
    app.run(host='0.0.0.0', port=3000, debug=True)

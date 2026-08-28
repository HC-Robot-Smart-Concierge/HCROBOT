import os
import sys
import io

# Cấu hình UTF-8 cho Windows Terminal
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

# Thêm thư mục backend vào sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.rag.obsidian_service import obsidian_service
from app.core.config import settings


def main():
    print("==========================================================")
    print("🔄 ĐANG ĐỒNG BỘ DỮ LIỆU TỪ OBSIDIAN VAULT SANG CHROMADB...")
    print("==========================================================")
    print(f"📍 Đường dẫn Vault: {os.path.abspath(settings.OBSIDIAN_VAULT_DIR)}")

    try:
        result = obsidian_service.sync_vault_to_chroma()
        print(f"✅ Đồng bộ THÀNH CÔNG!")
        print(f"📄 Số file Markdown đã xử lý: {result['files_processed']}")
        print(f"📦 Số Chunks đã lưu vào ChromaDB: {result['chunks_upserted']}")
        print("==========================================================")
    except Exception as e:
        print(f"❌ LỖI trong quá trình đồng bộ Obsidian: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

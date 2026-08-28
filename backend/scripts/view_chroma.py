import json
import sys
import os
import io

# Reconfigure stdout for UTF-8 encoding on Windows terminal
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.chroma import get_chroma_client


def inspect_chromadb():
    client = get_chroma_client()
    collections = client.list_collections()
    
    print("=" * 60)
    print(f"CHROMADB DATA INSPECTOR (Path: {os.path.abspath('./chroma_db')})")
    print("=" * 60)
    
    if not collections:
        print("[INFO] Hiện chưa có Collection nào trong ChromaDB.")
        return

    print(f"[+] Tổng số Collections: {len(collections)}")
    for col in collections:
        collection = client.get_collection(col.name)
        count = collection.count()
        print(f"\n📁 Collection Name: '{col.name}' (Tổng số tài liệu: {count})")
        
        if count > 0:
            data = collection.get()
            for i in range(count):
                doc_id = data["ids"][i]
                doc_text = data["documents"][i]
                metadata = data["metadatas"][i] if data["metadatas"] else {}
                
                print(f"  --- [{i+1}] ID: {doc_id} ---")
                print(f"  📄 Nội dung  : {doc_text}")
                print(f"  🏷️  Metadata  : {json.dumps(metadata, ensure_ascii=False)}")
        else:
            print("  (Collection trống)")
            
    print("=" * 60)


if __name__ == "__main__":
    inspect_chromadb()

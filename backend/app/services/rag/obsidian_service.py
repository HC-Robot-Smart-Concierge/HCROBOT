import os
import re
import glob
import logging
from typing import List, Dict, Any, Tuple, Optional

from app.db.chroma import get_concierge_collection
from app.core.config import settings

logger = logging.getLogger(__name__)


class ObsidianRAGService:
    """
    Service quản lý đọc, phân tích các file Markdown từ Obsidian Vault
    và đồng bộ tự động vào ChromaDB Vector Store.
    """

    @staticmethod
    def parse_frontmatter(file_content: str) -> Tuple[Dict[str, Any], str]:
        """
        Bóc tách phần YAML Frontmatter ở đầu file Markdown (nếu có).
        Ví dụ:
        ---
        category: facilities
        tags: [pool]
        ---
        Nội dung markdown...
        """
        metadata = {}
        content = file_content.strip()

        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                yaml_text = parts[1].strip()
                content = parts[2].strip()

                # Parse thủ công đơn giản để tránh phụ thuộc nếu thiếu PyYAML
                for line in yaml_text.splitlines():
                    if ":" in line:
                        key, val = line.split(":", 1)
                        key = key.strip()
                        val = val.strip().strip("'\"")
                        if val.startswith("[") and val.endswith("]"):
                            val = [item.strip(" '\"") for item in val[1:-1].split(",") if item.strip()]
                        metadata[key] = val

        return metadata, content

    @staticmethod
    def chunk_markdown(content: str, filename: str, file_metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Chia nhỏ file Markdown thành các đoạn (chunks) theo tiêu đề H1/H2/H3 (#, ##, ###).
        """
        chunks = []
        # Tách nội dung theo tiêu đề Markdown
        sections = re.split(r'\n(?=#+ )', content)
        
        doc_id_base = os.path.splitext(os.path.basename(filename))[0]

        for idx, section in enumerate(sections):
            clean_text = section.strip()
            if not clean_text:
                continue

            # Rút trích tiêu đề của section nếu có
            first_line = clean_text.splitlines()[0] if clean_text else ""
            section_title = first_line.lstrip("# ").strip() if first_line.startswith("#") else "General"

            chunk_id = f"obsidian_{doc_id_base}_section_{idx+1}"
            
            chunk_metadata = {
                "source": "obsidian",
                "filename": filename,
                "section": section_title,
            }
            
            # Gộp metadata từ frontmatter (ép về string/number để tương thích ChromaDB metadata)
            for k, v in file_metadata.items():
                if isinstance(v, list):
                    chunk_metadata[k] = ", ".join(map(str, v))
                else:
                    chunk_metadata[k] = str(v)

            chunks.append({
                "id": chunk_id,
                "document": clean_text,
                "metadata": chunk_metadata
            })

        return chunks

    def sync_vault_to_chroma(
        self, 
        vault_dir: Optional[str] = None, 
        collection_name: str = "concierge_kb"
    ) -> Dict[str, Any]:
        """
        Đọc tất cả các file .md từ Obsidian Vault và lưu/cập nhật vào ChromaDB.
        """
        target_dir = vault_dir or settings.OBSIDIAN_VAULT_DIR
        abs_vault_path = os.path.abspath(target_dir)

        if not os.path.exists(abs_vault_path):
            os.makedirs(abs_vault_path, exist_ok=True)
            logger.warning(f"Đã tạo mới thư mục Obsidian Vault tại {abs_vault_path}")

        md_files = glob.glob(os.path.join(abs_vault_path, "**", "*.md"), recursive=True)

        if not md_files:
            logger.info(f"Không tìm thấy file .md nào trong Obsidian Vault ({abs_vault_path})")
            return {
                "status": "success",
                "files_processed": 0,
                "chunks_upserted": 0,
                "vault_path": abs_vault_path
            }

        all_ids = []
        all_documents = []
        all_metadatas = []

        total_files = 0
        for md_file in md_files:
            try:
                with open(md_file, "r", encoding="utf-8", errors="replace") as f:
                    raw_content = f.read()

                rel_filename = os.path.relpath(md_file, abs_vault_path)
                file_metadata, markdown_text = self.parse_frontmatter(raw_content)
                chunks = self.chunk_markdown(markdown_text, rel_filename, file_metadata)

                for chunk in chunks:
                    all_ids.append(chunk["id"])
                    all_documents.append(chunk["document"])
                    all_metadatas.append(chunk["metadata"])

                total_files += 1
            except Exception as e:
                logger.error(f"Lỗi khi đọc file Obsidian {md_file}: {e}")

        if all_ids:
            collection = get_concierge_collection(collection_name)
            
            # Xóa các tài liệu cũ trong collection để đảm bảo khi xóa file .md trên Obsidian thì ChromaDB cũng sạch
            try:
                existing = collection.get()
                if existing and existing.get("ids") and len(existing["ids"]) > 0:
                    collection.delete(ids=existing["ids"])
            except Exception as e:
                logger.warning(f"Không thể dọn dẹp tài liệu cũ trước khi sync: {e}")

            collection.upsert(
                ids=all_ids,
                documents=all_documents,
                metadatas=all_metadatas
            )
            logger.info(f"Đã đồng bộ {len(all_ids)} chunks từ {total_files} file Obsidian vào ChromaDB!")


        return {
            "status": "success",
            "files_processed": total_files,
            "chunks_upserted": len(all_ids),
            "vault_path": abs_vault_path
        }


obsidian_service = ObsidianRAGService()

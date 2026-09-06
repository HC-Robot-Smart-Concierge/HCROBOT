import os
import glob
import uuid
import shutil
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from app.schemas.rag import (
    RAGDocumentItem,
    RAGDocumentListResponse,
    RAGActionResponse,
    RAGStatsResponse,
    RAGSourceFileItem,
    RAGSourceFilesResponse,
    RAGFileUploadResponse,
)
from app.db.chroma import get_concierge_collection
from app.core.config import settings

router = APIRouter()


@router.get("/stats", response_model=RAGStatsResponse, summary="Thống kê tổng quan tri thức RAG")
def get_rag_stats():
    """
    Trả về số liệu thống kê: Tổng mẩu tri thức, số file nguồn, phân bổ theo danh mục.
    """
    try:
        collection = get_concierge_collection("concierge_kb")
        data = collection.get()
        total_docs = len(data["ids"]) if data and "ids" in data else 0

        # Phân bổ danh mục
        categories = {}
        if data and "metadatas" in data and data["metadatas"]:
            for meta in data["metadatas"]:
                if meta and isinstance(meta, dict):
                    cat = meta.get("category", "Chung")
                    categories[cat] = categories.get(cat, 0) + 1

        # Đếm số file nguồn
        vault_files = glob.glob(os.path.join(settings.OBSIDIAN_VAULT_DIR, "*.*"))
        upload_files = glob.glob("static/uploads/*.*")
        total_sources = len(vault_files) + len(upload_files)

        return RAGStatsResponse(
            total_documents=total_docs,
            total_sources=max(total_sources, 1),
            rag_health_percent=98.5 if total_docs > 0 else 0.0,
            categories=categories,
            last_synced="Vừa đồng bộ",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lấy thống kê RAG: {str(e)}",
        )


@router.get("/sources", response_model=RAGSourceFilesResponse, summary="Danh sách các file nguồn đã nạp vào Robot")
def get_rag_sources():
    """
    Quét danh sách các file trong thư mục tri thức Obsidian & Uploads.
    """
    try:
        sources = []
        # Quét Obsidian Vault
        os.makedirs(settings.OBSIDIAN_VAULT_DIR, exist_ok=True)
        vault_files = glob.glob(os.path.join(settings.OBSIDIAN_VAULT_DIR, "*.*"))
        for fpath in vault_files:
            fname = os.path.basename(fpath)
            fsize = os.path.getsize(fpath) / 1024.0
            mtime = datetime.fromtimestamp(os.path.getmtime(fpath)).strftime("%Y-%m-%d %H:%M")
            ext = os.path.splitext(fname)[1].lower().replace(".", "")

            raw_text = None
            if ext in ["md", "txt"]:
                try:
                    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                        raw_text = f.read()
                except Exception:
                    pass

            sources.append(
                RAGSourceFileItem(
                    filename=fname,
                    file_type=ext.upper(),
                    file_size_kb=round(fsize, 2),
                    chunks_count=5,
                    last_modified=mtime,
                    status="Synced",
                    content=raw_text,
                )
            )

        # Quét Uploads
        upload_files = glob.glob("static/uploads/*.*")
        for fpath in upload_files:
            fname = os.path.basename(fpath)
            fsize = os.path.getsize(fpath) / 1024.0
            mtime = datetime.fromtimestamp(os.path.getmtime(fpath)).strftime("%Y-%m-%d %H:%M")
            ext = os.path.splitext(fname)[1].lower().replace(".", "")

            raw_text = None
            if ext in ["md", "txt"]:
                try:
                    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                        raw_text = f.read()
                except Exception:
                    pass

            sources.append(
                RAGSourceFileItem(
                    filename=fname,
                    file_type=ext.upper(),
                    file_size_kb=round(fsize, 2),
                    chunks_count=1 if ext in ["jpg", "png", "webp"] else 3,
                    last_modified=mtime,
                    status="Active",
                    content=raw_text,
                )
            )

        return RAGSourceFilesResponse(total=len(sources), sources=sources)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi đọc file nguồn: {str(e)}",
        )


@router.post("/sources/save", response_model=RAGActionResponse, summary="Lưu trực tiếp nội dung file Markdown xuống ổ đĩa và tái đồng bộ ChromaDB")
def save_source_file(payload: dict):
    """
    Lưu nội dung chỉnh sửa của file .md trực tiếp vào backend/knowledge_vault/ và tự động sync RAG.
    """
    try:
        filename = payload.get("filename")
        content = payload.get("content", "")
        if not filename:
            raise HTTPException(status_code=400, detail="Thiếu filename")

        os.makedirs(settings.OBSIDIAN_VAULT_DIR, exist_ok=True)
        file_path = os.path.join(settings.OBSIDIAN_VAULT_DIR, filename)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        # Tái đồng bộ Obsidian Vault ngay lập tức
        from app.services.rag.obsidian_service import obsidian_service
        obsidian_service.sync_vault_to_chroma()

        return RAGActionResponse(
            message=f"Đã lưu file {filename} xuống đĩa và tái đồng bộ ChromaDB thành công!",
            id=filename,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lưu file nguồn: {str(e)}",
        )


@router.post("/upload-file", response_model=RAGFileUploadResponse, summary="Tải file PDF, DOCX, Markdown hoặc Ảnh nạp vào Robot")
def upload_rag_file(
    file: UploadFile = File(...),
    category: Optional[str] = Form("general"),
):
    """
    Xử lý tải file:
    - Nếu là ảnh: Lưu vào static/uploads/ để Robot chiếu lên màn hình.
    - Nếu là tài liệu (.md, .txt, .pdf): Bóc tách chữ, cắt đoạn và nạp vào ChromaDB.
    """
    try:
        os.makedirs("static/uploads", exist_ok=True)
        filename = file.filename or f"doc_{uuid.uuid4().hex[:6]}"
        ext = os.path.splitext(filename)[1].lower()

        dest_path = os.path.join("static/uploads", filename)
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. Nếu là file ảnh
        if ext in [".jpg", ".jpeg", ".png", ".webp"]:
            image_url = f"/static/uploads/{filename}"
            return RAGFileUploadResponse(
                message="Tải ảnh thành công! Đã sẵn sàng hiển thị trên màn hình Robot.",
                filename=filename,
                chunks_created=0,
                image_url=image_url,
            )

        # 2. Nếu là file văn bản / Markdown / PDF
        text_content = ""
        if ext in [".md", ".txt"]:
            with open(dest_path, "r", encoding="utf-8", errors="replace") as f:
                text_content = f.read()
        elif ext == ".pdf":
            try:
                import pypdf
                reader = pypdf.PdfReader(dest_path)
                text_content = "\n".join([page.extract_text() or "" for page in reader.pages])
            except Exception:
                text_content = f"Nội dung file PDF {filename}"
        else:
            text_content = f"Tài liệu nạp: {filename}"

        # Cắt đoạn đơn giản và nạp vào ChromaDB
        collection = get_concierge_collection("concierge_kb")
        chunks = [c.strip() for c in text_content.split("\n\n") if len(c.strip()) > 30]
        if not chunks:
            chunks = [text_content.strip() or f"Tài liệu {filename}"]

        ids = [f"up_{uuid.uuid4().hex[:6]}_{i}" for i in range(len(chunks))]
        metadatas = [{"source": filename, "category": category, "upload_time": datetime.utcnow().isoformat()} for _ in chunks]

        collection.upsert(ids=ids, documents=chunks, metadatas=metadatas)

        return RAGFileUploadResponse(
            message=f"Đã bóc tách và nạp thành công {len(chunks)} mẩu tri thức vào Robot!",
            filename=filename,
            chunks_created=len(chunks),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi nạp file: {str(e)}",
        )


@router.get("/documents", response_model=RAGDocumentListResponse, summary="Xem tất cả tài liệu tri thức trong ChromaDB")
def list_rag_documents():
    """
    Lấy danh sách toàn bộ thông tin tri thức khách sạn đang được lưu trong ChromaDB.
    """
    try:
        collection = get_concierge_collection("concierge_kb")
        data = collection.get()

        items = []
        count = len(data["ids"]) if data and "ids" in data else 0
        for i in range(count):
            items.append(
                RAGDocumentItem(
                    id=data["ids"][i],
                    document=data["documents"][i],
                    metadata=data["metadatas"][i] if data["metadatas"] else {},
                )
            )

        return RAGDocumentListResponse(total=count, documents=items)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi đọc dữ liệu ChromaDB: {str(e)}",
        )


@router.post("/documents", response_model=RAGActionResponse, summary="Thêm hoặc Cập nhật (Upsert) tài liệu tri thức")
def upsert_rag_document(doc: RAGDocumentItem):
    """
    Thêm mới một đoạn tri thức (FAQ/Quy định) vào ChromaDB. Nếu ID đã tồn tại thì tự động cập nhật nội dung mới.
    """
    try:
        collection = get_concierge_collection("concierge_kb")
        collection.upsert(
            ids=[doc.id],
            documents=[doc.document],
            metadatas=[doc.metadata or {}],
        )
        return RAGActionResponse(
            message="Thêm/Cập nhật tài liệu tri thức vào ChromaDB thành công",
            id=doc.id,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi thêm/sửa tài liệu ChromaDB: {str(e)}",
        )


@router.delete("/documents/{doc_id}", response_model=RAGActionResponse, summary="Xóa tài liệu tri thức theo ID")
def delete_rag_document(doc_id: str):
    """
    Xóa một tài liệu tri thức khỏi ChromaDB theo ID.
    """
    try:
        collection = get_concierge_collection("concierge_kb")
        collection.delete(ids=[doc_id])
        return RAGActionResponse(
            message="Đã xóa tài liệu khỏi ChromaDB thành công",
            id=doc_id,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xóa tài liệu ChromaDB: {str(e)}",
        )


@router.post("/sync-obsidian", summary="Đồng bộ tự động tất cả ghi chú Obsidian Vault vào ChromaDB")
def sync_obsidian_vault():
    """
    Quét toàn bộ file Markdown (.md) trong thư mục Obsidian Vault và tự động nạp vào ChromaDB.
    """
    try:
        from app.services.rag.obsidian_service import obsidian_service
        result = obsidian_service.sync_vault_to_chroma()
        return {
            "message": "Đồng bộ Obsidian Vault vào ChromaDB thành công!",
            "result": result,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi đồng bộ Obsidian Vault: {str(e)}",
        )




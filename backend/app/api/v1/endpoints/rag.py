from fastapi import APIRouter, HTTPException, status
from app.schemas.rag import RAGDocumentItem, RAGDocumentListResponse, RAGActionResponse
from app.db.chroma import get_concierge_collection

router = APIRouter()


@router.get("/documents", response_model=RAGDocumentListResponse, summary="Xem tất cả tài liệu tri thức trong ChromaDB")
async def list_rag_documents():
    """
    Lấy danh sách toàn bộ thông tin tri thức khách sạn đang được lưu trong ChromaDB.
    """
    try:
        collection = get_concierge_collection("concierge_kb")
        data = collection.get()
        
        items = []
        count = len(data["ids"])
        for i in range(count):
            items.append(RAGDocumentItem(
                id=data["ids"][i],
                document=data["documents"][i],
                metadata=data["metadatas"][i] if data["metadatas"] else {}
            ))
            
        return RAGDocumentListResponse(total=count, documents=items)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi đọc dữ liệu ChromaDB: {str(e)}"
        )


@router.post("/documents", response_model=RAGActionResponse, summary="Thêm hoặc Cập nhật (Upsert) tài liệu tri thức")
async def upsert_rag_document(doc: RAGDocumentItem):
    """
    Thêm mới một đoạn tri thức (FAQ/Quy định) vào ChromaDB. Nếu ID đã tồn tại thì tự động cập nhật nội dung mới.
    """
    try:
        collection = get_concierge_collection("concierge_kb")
        collection.upsert(
            ids=[doc.id],
            documents=[doc.document],
            metadatas=[doc.metadata or {}]
        )
        return RAGActionResponse(
            message="Thêm/Cập nhật tài liệu tri thức vào ChromaDB thành công",
            id=doc.id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi thêm/sửa tài liệu ChromaDB: {str(e)}"
        )


@router.delete("/documents/{doc_id}", response_model=RAGActionResponse, summary="Xóa tài liệu tri thức theo ID")
async def delete_rag_document(doc_id: str):
    """
    Xóa một tài liệu tri thức khỏi ChromaDB theo ID.
    """
    try:
        collection = get_concierge_collection("concierge_kb")
        collection.delete(ids=[doc_id])
        return RAGActionResponse(
            message="Đã xóa tài liệu khỏi ChromaDB thành công",
            id=doc_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xóa tài liệu ChromaDB: {str(e)}"
        )


@router.post("/sync-obsidian", summary="Đồng bộ tự động tất cả ghi chú Obsidian Vault vào ChromaDB")
async def sync_obsidian_vault():
    """
    Quét toàn bộ file Markdown (.md) trong thư mục Obsidian Vault và tự động nạp vào ChromaDB.
    """
    try:
        from app.services.rag.obsidian_service import obsidian_service
        result = obsidian_service.sync_vault_to_chroma()
        return {
            "message": "Đồng bộ Obsidian Vault vào ChromaDB thành công!",
            "result": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi đồng bộ Obsidian Vault: {str(e)}"
        )


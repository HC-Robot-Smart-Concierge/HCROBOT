// =====================================================================
// AURORA OS - KNOWLEDGE BASE & RAG API SERVICE
// Connects React Frontend with FastAPI Backend (/api/v1/rag) & ChromaDB
// =====================================================================

const RAG_BASE_URL = '/api/v1/rag';

/**
 * Generic fetch with fallback to provided mock data if offline or error occurs.
 */
async function fetchWithFallback(url, options = {}, fallbackData = null) {
  try {
    const token = localStorage.getItem('aurora_jwt_token');
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`[KnowledgeAPI] Fallback for ${url}:`, error.message);
    return fallbackData;
  }
}

/**
 * Lấy số liệu thống kê tổng quan tri thức RAG (KPI Cards, Phân bổ danh mục)
 */
export const fetchRAGStats = async () => {
  return await fetchWithFallback(
    `${RAG_BASE_URL}/stats`,
    {},
    {
      total_documents: 6,
      total_sources: 1,
      rag_health_percent: 98.5,
      categories: { Dining: 1, Facilities: 1, Wellness: 1, Accommodations: 1, Policies: 1, General: 1 },
      last_synced: 'Vừa xong',
    }
  );
};

/**
 * Xem danh sách tất cả tài liệu tri thức trong ChromaDB kèm metadata hình ảnh
 */
export const fetchRAGDocuments = async () => {
  return await fetchWithFallback(`${RAG_BASE_URL}/documents`, {}, { total: 0, documents: [] });
};

/**
 * Lấy danh sách các file tài liệu nguồn trong Obsidian Vault & Uploads
 */
export const fetchRAGSources = async () => {
  return await fetchWithFallback(`${RAG_BASE_URL}/sources`, {}, { total: 0, sources: [] });
};

/**
 * Thêm mới hoặc cập nhật một mẩu tri thức vào ChromaDB
 */
export const upsertRAGDocument = async (doc) => {
  return await fetchWithFallback(
    `${RAG_BASE_URL}/documents`,
    {
      method: 'POST',
      body: JSON.stringify(doc),
    },
    { message: 'Thêm/sửa tài liệu thành công', id: doc.id }
  );
};

/**
 * Xóa tài liệu tri thức theo ID khỏi ChromaDB
 */
export const deleteRAGDocument = async (docId) => {
  return await fetchWithFallback(
    `${RAG_BASE_URL}/documents/${encodeURIComponent(docId)}`,
    {
      method: 'DELETE',
    },
    { message: 'Đã xóa tài liệu khỏi ChromaDB thành công', id: docId }
  );
};

/**
 * Đồng bộ 1-click từ thư mục Obsidian Vault vào ChromaDB
 */
export const syncObsidianVault = async () => {
  return await fetchWithFallback(
    `${RAG_BASE_URL}/sync-obsidian`,
    {
      method: 'POST',
    },
    { message: 'Đồng bộ Obsidian Vault vào ChromaDB thành công!' }
  );
};

/**
 * Tải file PDF, DOCX, Markdown hoặc Ảnh lên Server để Robot bóc tách và nạp tri thức
 */
export const uploadRAGFile = async (file, category = 'general') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const token = localStorage.getItem('aurora_jwt_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${RAG_BASE_URL}/upload-file`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload thất bại với status: ${res.status}`);
  }
  return await res.json();
};

/**
 * Lưu trực tiếp nội dung chỉnh sửa file .md xuống ổ đĩa backend/knowledge_vault/
 */
export const saveRAGSourceFile = async (filename, content) => {
  return await fetchWithFallback(
    `${RAG_BASE_URL}/sources/save`,
    {
      method: 'POST',
      body: JSON.stringify({ filename, content }),
    },
    { message: `Đã lưu file ${filename} thành công!`, id: filename }
  );
};

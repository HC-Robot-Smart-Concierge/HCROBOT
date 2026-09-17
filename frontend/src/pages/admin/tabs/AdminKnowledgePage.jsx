import React, { useState, useEffect } from 'react';
import {
  fetchRAGStats,
  fetchRAGDocuments,
  fetchRAGSources,
  deleteRAGDocument,
  syncObsidianVault,
  saveRAGSourceFile,
} from '../../../services/knowledgeApi';
import { Pagination } from '../../../components/common/Pagination';

export const AdminKnowledgePage = ({ activeSubView = 'sources' }) => {
  const [currentView, setCurrentView] = useState(activeSubView);
  const [stats, setStats] = useState({
    total_documents: 0,
    total_sources: 0,
    rag_health_percent: 100,
    categories: {},
    last_synced: 'Đang tải...',
  });
  const [documents, setDocuments] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Markdown File Editor State
  const [editingSourceFile, setEditingSourceFile] = useState(null);
  const [sourceMarkdownContent, setSourceMarkdownContent] = useState('');
  const [editorModeTab, setEditorModeTab] = useState('edit');
  const [isSavingSource, setIsSavingSource] = useState(false);

  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 7;

  const showNotification = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const handleOpenSourceEditor = (src) => {
    setEditingSourceFile(src);
    setSourceMarkdownContent(src.content || `# ${src.filename}\n\nChưa có nội dung.`);
    setEditorModeTab('edit');
  };

  const handleSaveSourceMarkdown = async () => {
    if (!editingSourceFile) return;
    try {
      setIsSavingSource(true);
      await saveRAGSourceFile(editingSourceFile.filename, sourceMarkdownContent);
      showNotification(`Đã lưu file "${editingSourceFile.filename}" và tái đồng bộ ChromaDB!`);
      setEditingSourceFile(null);
      await loadAllData();
    } catch (err) {
      showNotification('Lỗi khi lưu file: ' + err.message);
    } finally {
      setIsSavingSource(false);
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [st, docs, src] = await Promise.all([
        fetchRAGStats(),
        fetchRAGDocuments(),
        fetchRAGSources(),
      ]);
      setStats(st || {});
      setDocuments(docs.documents || []);
      setSources(src.sources || []);
    } catch {
      // Network fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (activeSubView) {
      setCurrentView(activeSubView);
      if (activeSubView !== 'articles') {
        setSelectedArticle(null);
      }
    }
  }, [activeSubView]);

  const handleSyncObsidian = async () => {
    try {
      setIsLoading(true);
      const res = await syncObsidianVault();
      showNotification(res.message || 'Đồng bộ Obsidian Vault thành công!');
      await loadAllData();
    } catch (err) {
      showNotification('Lỗi khi đồng bộ Obsidian: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Xác nhận xóa tài liệu khỏi Vector Database của Robot?')) return;
    try {
      await deleteRAGDocument(docId);
      showNotification('Đã xóa mẩu tri thức khỏi Vector Database');
      if (selectedArticle?.id === docId) setSelectedArticle(null);
      await loadAllData();
    } catch (err) {
      showNotification('Lỗi khi xóa: ' + err.message);
    }
  };

  // Filter Documents
  const filteredDocuments = documents.filter((doc) => {
    const title = doc.metadata?.title || doc.id || '';
    const content = doc.document || '';
    const category = doc.metadata?.category || 'Chung';

    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat = categoryFilter === 'All' || category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCat;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery]);

  const paginatedDocuments = filteredDocuments.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="w-full flex flex-col p-4 space-y-3 pb-2" style={{ color: '#262626' }}>
      {/* Toast Notification */}
      {actionMessage && (
        <div
          className="fixed top-5 right-5 z-50 px-4 py-2 rounded-lg border text-xs font-semibold shadow-lg"
          style={{
            backgroundColor: '#262626',
            color: '#F2EFE9',
            borderColor: '#BFBFBD',
          }}
        >
          {actionMessage}
        </div>
      )}

      {/* VIEW: SYNCED SOURCE FILES (Default / Main Knowledge View) */}
      {(currentView === 'sources' || !currentView) && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: '#BFBFBD' }}>
            <div>
              <h2 className="text-base font-bold tracking-tight" style={{ color: '#262626' }}>
                Nguồn Dữ Liệu Đồng Bộ (Source Documents)
              </h2>
              <p className="text-[11px] font-normal" style={{ color: '#8C8C8C' }}>
                Quản lý các file Markdown trong Obsidian Vault và tài liệu PDF đã nạp vào Vector Store
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={handleSyncObsidian}
                disabled={isLoading}
                className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: '#262626',
                  color: '#F2EFE9',
                  borderColor: '#262626',
                }}
              >
                {isLoading ? 'Đang đồng bộ...' : 'Đồng bộ Obsidian Vault'}
              </button>
            </div>
          </div>

          {/* Sources Table */}
          <div
            className="rounded-xl border overflow-hidden shadow-none"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: '#E9E5DC',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
                  >
                    <th className="py-2.5 px-4">Tên file nguồn</th>
                    <th className="py-2.5 px-3 w-24">Định dạng</th>
                    <th className="py-2.5 px-3 w-28">Dung lượng</th>
                    <th className="py-2.5 px-3 w-32">Số đoạn chunks</th>
                    <th className="py-2.5 px-4 w-40">Cập nhật lần cuối</th>
                    <th className="py-2.5 px-3 w-28 text-center">Trạng thái</th>
                    <th className="py-2.5 px-4 text-right w-36">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                  {sources.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-xs" style={{ color: '#8C8C8C' }}>
                        Chưa có file nguồn nào trong thư mục Vault.
                      </td>
                    </tr>
                  ) : (
                    sources.map((src, idx) => (
                      <tr
                        key={idx}
                        className="transition-colors hover:bg-[#F2EFE9]/40"
                        style={{ borderBottom: '1px solid #E9E5DC' }}
                      >
                        {/* Filename */}
                        <td className="py-2 px-4 font-semibold text-xs" style={{ color: '#262626' }}>
                          {src.filename}
                        </td>

                        {/* File Type */}
                        <td className="py-2 px-3">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border inline-block uppercase"
                            style={{
                              backgroundColor: '#E9E5DC',
                              borderColor: '#BFBFBD',
                              color: '#262626',
                            }}
                          >
                            {src.file_type}
                          </span>
                        </td>

                        {/* File Size */}
                        <td className="py-2 px-3 font-mono text-[11px]" style={{ color: '#8C8C8C' }}>
                          {src.file_size_kb} KB
                        </td>

                        {/* Chunks Count */}
                        <td className="py-2 px-3 font-semibold text-[11px]" style={{ color: '#262626' }}>
                          {src.chunks_count} chunks
                        </td>

                        {/* Last Modified */}
                        <td className="py-2 px-4 text-[11px] font-mono" style={{ color: '#8C8C8C' }}>
                          {src.last_modified}
                        </td>

                        {/* Status */}
                        <td className="py-2 px-3 text-center">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-medium border inline-block"
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#BFBFBD',
                              color: '#262626',
                            }}
                          >
                            {src.status || 'Synced'}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-2 px-4 text-right">
                          <button
                            onClick={() => handleOpenSourceEditor(src)}
                            className="px-2.5 py-1 rounded text-xs font-medium border cursor-pointer hover:opacity-80 transition-all whitespace-nowrap"
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#BFBFBD',
                              color: '#262626',
                            }}
                          >
                            Xem & sửa file
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: OVERVIEW */}
      {currentView === 'overview' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: '#BFBFBD' }}>
            <div>
              <h2 className="text-base font-bold tracking-tight" style={{ color: '#262626' }}>
                Tổng Quan Tri Thức AI (Knowledge Overview)
              </h2>
              <p className="text-[11px] font-normal" style={{ color: '#8C8C8C' }}>
                Kho tri thức khách sạn Vector RAG phục vụ tra cứu tức thì cho Robot Concierge
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={handleSyncObsidian}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: '#262626',
                  color: '#F2EFE9',
                  borderColor: '#262626',
                }}
              >
                {isLoading ? 'Đang đồng bộ...' : 'Đồng bộ Obsidian'}
              </button>
              <button
                onClick={() => setCurrentView('sources')}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              >
                Xem file nguồn ({sources.length})
              </button>
            </div>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
              <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>TỔNG MẨU TRI THỨC</div>
              <div className="flex items-baseline gap-1.5 my-1">
                <span className="text-2xl font-bold" style={{ color: '#262626' }}>{stats.total_documents}</span>
                <span className="text-xs" style={{ color: '#8C8C8C' }}>mẩu</span>
              </div>
              <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>Nhúng sẵn trong ChromaDB</div>
            </div>

            <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
              <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>TÀI LIỆU NGUỒN</div>
              <div className="flex items-baseline gap-1.5 my-1">
                <span className="text-2xl font-bold" style={{ color: '#262626' }}>{stats.total_sources}</span>
                <span className="text-xs" style={{ color: '#8C8C8C' }}>tệp</span>
              </div>
              <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>Obsidian Vault & PDF</div>
            </div>

            <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
              <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>ĐỘ SẴN SÀNG VECTOR RAG</div>
              <div className="flex items-baseline gap-1.5 my-1">
                <span className="text-2xl font-bold" style={{ color: '#262626' }}>{stats.rag_health_percent}%</span>
              </div>
              <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>Mô hình embedding hoạt động tốt</div>
            </div>

            <div className="p-3 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}>
              <div className="text-[11px] font-semibold" style={{ color: '#8C8C8C' }}>LẦN ĐỒNG BỘ CUỐI</div>
              <div className="flex items-baseline gap-1.5 my-1">
                <span className="text-base font-bold truncate" style={{ color: '#262626' }}>{stats.last_synced}</span>
              </div>
              <div className="text-[10px] font-medium" style={{ color: '#8C8C8C' }}>Tự động cập nhật</div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: ARTICLES */}
      {currentView === 'articles' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: '#BFBFBD' }}>
            <div>
              <h2 className="text-base font-bold tracking-tight" style={{ color: '#262626' }}>
                Danh Sách Bài Viết Tri Thức (Knowledge Articles)
              </h2>
              <p className="text-[11px] font-normal" style={{ color: '#8C8C8C' }}>
                Mẩu kiến thức thực tế trong ChromaDB đang được Robot sử dụng để trả lời khách
              </p>
            </div>

            <button
              onClick={() => setCurrentView('sources')}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            >
              Xem file nguồn ({sources.length})
            </button>
          </div>

          {/* Search & Filter */}
          <div
            className="p-2.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2.5"
            style={{
              backgroundColor: '#E9E5DC',
              borderColor: '#BFBFBD',
            }}
          >
            <div className="w-full sm:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bài viết tri thức..."
                className="w-full px-3 py-1.5 rounded-lg text-xs font-normal border focus:outline-none"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#BFBFBD',
                  color: '#262626',
                }}
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none cursor-pointer"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#BFBFBD',
                color: '#262626',
              }}
            >
              <option value="All">Tất cả danh mục</option>
              <option value="Dining">Ẩm thực (Dining)</option>
              <option value="Facilities">Cơ sở vật chất</option>
              <option value="Wellness">Wellness / Spa</option>
              <option value="Accommodations">Hạng phòng</option>
              <option value="General">Chung</option>
            </select>
          </div>

          {/* Articles Table */}
          <div
            className="rounded-xl border overflow-hidden shadow-none"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: '#E9E5DC',
                      borderColor: '#BFBFBD',
                      color: '#262626',
                    }}
                  >
                    <th className="py-2.5 px-4">Tiêu đề</th>
                    <th className="py-2.5 px-3 w-32">Danh mục</th>
                    <th className="py-2.5 px-4">Nội dung tóm tắt</th>
                    <th className="py-2.5 px-4 text-right w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs" style={{ borderColor: '#E9E5DC' }}>
                  {paginatedDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs" style={{ color: '#8C8C8C' }}>
                        Không tìm thấy bài viết nào.
                      </td>
                    </tr>
                  ) : (
                    paginatedDocuments.map((doc) => (
                      <tr
                        key={doc.id}
                        className="transition-colors hover:bg-[#F2EFE9]/40"
                        style={{ borderBottom: '1px solid #E9E5DC' }}
                      >
                        <td className="py-2 px-4 font-semibold text-xs" style={{ color: '#262626' }}>
                          {doc.metadata?.title || doc.id}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-medium border inline-block"
                            style={{
                              backgroundColor: '#E9E5DC',
                              borderColor: '#BFBFBD',
                              color: '#262626',
                            }}
                          >
                            {doc.metadata?.category || 'Chung'}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-[11px] truncate max-w-md" style={{ color: '#8C8C8C' }}>
                          {doc.document}
                        </td>
                        <td className="py-2 px-4 text-right">
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="px-2.5 py-1 rounded text-xs font-medium border cursor-pointer hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#BFBFBD',
                              color: '#8C8C8C',
                            }}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredDocuments.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              itemName="tài liệu"
            />
          </div>
        </div>
      )}

      {/* MARKDOWN FILE VIEWER & EDITOR MODAL (Real disk file in knowledge_vault/) */}
      {editingSourceFile && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-3xl w-full rounded-2xl border p-5 space-y-3 shadow-xl"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFBFBD',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <h3 className="text-xs font-bold" style={{ color: '#262626' }}>
                  Chỉnh sửa file nguồn: <span className="font-mono">{editingSourceFile.filename}</span>
                </h3>
                <p className="text-[10px]" style={{ color: '#8C8C8C' }}>
                  File được lưu trực tiếp vào thư mục knowledge_vault và tự động đồng bộ sang ChromaDB
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setEditorModeTab('edit')}
                  className="px-2.5 py-1 rounded text-xs font-medium border cursor-pointer"
                  style={{
                    backgroundColor: editorModeTab === 'edit' ? '#262626' : '#FFFFFF',
                    color: editorModeTab === 'edit' ? '#F2EFE9' : '#262626',
                    borderColor: editorModeTab === 'edit' ? '#262626' : '#BFBFBD',
                  }}
                >
                  Soạn thảo
                </button>
                <button
                  onClick={() => setEditorModeTab('preview')}
                  className="px-2.5 py-1 rounded text-xs font-medium border cursor-pointer"
                  style={{
                    backgroundColor: editorModeTab === 'preview' ? '#262626' : '#FFFFFF',
                    color: editorModeTab === 'preview' ? '#F2EFE9' : '#262626',
                    borderColor: editorModeTab === 'preview' ? '#262626' : '#BFBFBD',
                  }}
                >
                  Xem trước
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="h-80 overflow-y-auto">
              {editorModeTab === 'edit' ? (
                <textarea
                  value={sourceMarkdownContent}
                  onChange={(e) => setSourceMarkdownContent(e.target.value)}
                  placeholder="Nhập nội dung Markdown..."
                  className="w-full h-full p-3 rounded-lg border font-mono text-xs focus:outline-none resize-none"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                />
              ) : (
                <div
                  className="w-full h-full p-3 rounded-lg border text-xs font-mono whitespace-pre-wrap overflow-y-auto"
                  style={{
                    backgroundColor: '#E9E5DC',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  {sourceMarkdownContent}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between border-t pt-2.5" style={{ borderColor: '#BFBFBD' }}>
              <span className="text-[11px]" style={{ color: '#8C8C8C' }}>
                Dung lượng: {Math.round(sourceMarkdownContent.length / 1024 * 10) / 10} KB
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingSourceFile(null)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor: '#E9E5DC',
                    borderColor: '#BFBFBD',
                    color: '#262626',
                  }}
                >
                  Đóng
                </button>

                <button
                  onClick={handleSaveSourceMarkdown}
                  disabled={isSavingSource}
                  className="px-4 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer"
                  style={{
                    backgroundColor: '#262626',
                    borderColor: '#262626',
                    color: '#F2EFE9',
                  }}
                >
                  {isSavingSource ? 'Đang lưu...' : 'Lưu & nạp vào Robot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FolderSync,
  UploadCloud,
  PlusCircle,
  Search,
  CheckCircle2,
  FileText,
  FileCode,
  Image as ImageIcon,
  Sparkles,
  ExternalLink,
  Trash2,
  RefreshCw,
  Eye,
  Layers,
  HelpCircle,
  Clock,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Utensils,
  BedDouble,
  HeartPulse,
  Tag,
} from 'lucide-react';
import {
  fetchRAGStats,
  fetchRAGDocuments,
  fetchRAGSources,
  upsertRAGDocument,
  deleteRAGDocument,
  syncObsidianVault,
  uploadRAGFile,
} from '../../../services/knowledgeApi';


export const AdminKnowledgePage = ({ activeSubView = 'overview' }) => {
  const [currentView, setCurrentView] = useState(activeSubView);
  const [stats, setStats] = useState({
    total_documents: 0,
    total_sources: 0,
    rag_health_percent: 98.5,
    categories: {},
    last_synced: 'Đang tải...',
  });
  const [documents, setDocuments] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Upload State
  const [uploadFileObj, setUploadFileObj] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [isUploading, setIsUploading] = useState(false);

  // Create Article Form
  const [articleForm, setArticleForm] = useState({
    title: '',
    category: 'Dining',
    facility: '',
    floor: '',
    primary_image: '',
    gallery_images: '',
    content: '',
  });

  // Load Data
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
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Knowledge RAG:', err);
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

  const showNotification = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Sync Obsidian
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

  // Handle Delete Document
  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này khỏi Robot?')) return;
    try {
      await deleteRAGDocument(docId);
      showNotification('Đã xóa mẩu tri thức khỏi Vector Database');
      if (selectedArticle?.id === docId) setSelectedArticle(null);
      await loadAllData();
    } catch (err) {
      showNotification('Lỗi khi xóa: ' + err.message);
    }
  };

  // Handle Upload File
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFileObj) {
      alert('Vui lòng chọn file cần tải lên');
      return;
    }
    try {
      setIsUploading(true);
      const res = await uploadRAGFile(uploadFileObj, uploadCategory);
      showNotification(res.message || 'Nạp file vào Robot thành công!');
      setUploadFileObj(null);
      await loadAllData();
      setCurrentView('articles');
    } catch (err) {
      showNotification('Lỗi nạp file: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Create Article
  const handleCreateArticleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const docId = `kb_${articleForm.category.toLowerCase()}_${Date.now().toString().slice(-4)}`;
      const newDoc = {
        id: docId,
        document: articleForm.content,
        metadata: {
          title: articleForm.title,
          category: articleForm.category,
          facility: articleForm.facility || articleForm.category.toLowerCase(),
          floor: articleForm.floor || 'Khách sạn Aurora',
          primary_image: articleForm.primary_image,
          gallery_images: articleForm.gallery_images || articleForm.primary_image,
          status: 'Active',
          last_updated: new Date().toISOString().split('T')[0],
        },
      };

      await upsertRAGDocument(newDoc);
      showNotification(`Đã tạo bài viết "${articleForm.title}" và nạp vào ChromaDB!`);
      setArticleForm({
        title: '',
        category: 'Dining',
        facility: '',
        floor: '',
        primary_image: '',
        gallery_images: '',
        content: '',
      });
      await loadAllData();
      setCurrentView('articles');
    } catch (err) {
      showNotification('Lỗi khi tạo bài viết: ' + err.message);
    } finally {
      setIsLoading(false);
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

  const getCategoryIcon = (category = '') => {
    const cat = category.toLowerCase();
    if (cat.includes('dining') || cat.includes('ăn')) return <Utensils className="w-3.5 h-3.5" />;
    if (cat.includes('facility') || cat.includes('cơ sở')) return <Building2 className="w-3.5 h-3.5" />;
    if (cat.includes('wellness') || cat.includes('spa')) return <HeartPulse className="w-3.5 h-3.5" />;
    if (cat.includes('room') || cat.includes('accommodat')) return <BedDouble className="w-3.5 h-3.5" />;
    return <BookOpen className="w-3.5 h-3.5" />;
  };

  return (
    <div className="w-full h-full flex flex-col p-6 space-y-6 overflow-y-auto custom-scrollbar">
      {/* Toast Notification */}
      {actionMessage && (
        <div className="fixed top-5 right-5 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-stone-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold">{actionMessage}</span>
        </div>
      )}

      {/* VIEW 1: OVERVIEW (Screen 1 Figma) */}
      {currentView === 'overview' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                Tổng Quan Tri Thức AI (Knowledge Base Overview)
              </h2>
              <p className="text-sm text-stone-500 font-medium">
                Kho tri thức khách sạn Vector RAG phục vụ tra cứu tức thì cho Robot Concierge
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncObsidian}
                disabled={isLoading}
                className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-stone-300 shadow-sm"
              >
                <FolderSync className={`w-4 h-4 text-indigo-600 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Đồng Bộ Obsidian</span>
              </button>
              <button
                onClick={() => setCurrentView('create')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Soạn Bài Viết Mới</span>
              </button>
            </div>
          </div>

          {/* 4 Metric Cards (Matching Screen 1) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Tổng Mẩu Tri Thức</span>
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <BookOpen className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-stone-900">{stats.total_documents}</span>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Vector Synced
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1 font-medium">Được nhúng sẵn trong ChromaDB</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Tài Liệu Nguồn</span>
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FileCode className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-stone-900">{stats.total_sources}</span>
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Obsidian & Vault
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1 font-medium">Tệp Markdown, PDF & Văn bản</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Độ Tin Cậy RAG</span>
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-stone-900">{stats.rag_health_percent}%</span>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Optimal
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1 font-medium">Mô hình nhúng Ollama bge-m3</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Lần Đồng Bộ Cuối</span>
                <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-xl font-black text-stone-900">{stats.last_synced}</span>
                <span className="text-[11px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                  Auto-watch
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1 font-medium">Lắng nghe thay đổi thời gian thực</p>
            </div>
          </div>

          {/* Categories Breakdown & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Phân Bổ Tri Thức Theo Danh Mục Khách Sạn</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  { key: 'Dining', label: 'Ẩm Thực & Nhà Hàng', icon: Utensils, color: 'bg-amber-500' },
                  { key: 'Facilities', label: 'Cơ Sở Vật Chất & Bể Bơi', icon: Building2, color: 'bg-blue-500' },
                  { key: 'Wellness', label: 'Spa & Massage Trị Liệu', icon: HeartPulse, color: 'bg-emerald-500' },
                  { key: 'Accommodations', label: 'Hạng Phòng & Tiện Nghi', icon: BedDouble, color: 'bg-indigo-500' },
                  { key: 'Policies', label: 'Quy Định Check-in / Out', icon: ShieldCheck, color: 'bg-rose-500' },
                  { key: 'General', label: 'Mạng Wi-Fi & Chỉ Dẫn', icon: BookOpen, color: 'bg-stone-500' },
                ].map((item) => {
                  const count = stats.categories?.[item.key] || 1;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.key}
                      onClick={() => {
                        setCategoryFilter(item.key);
                        setCurrentView('articles');
                      }}
                      className="p-4 rounded-xl border border-stone-100 bg-stone-50/70 hover:bg-stone-100 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${item.color} text-white flex items-center justify-center`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-900">{item.label}</p>
                          <p className="text-[10px] text-stone-500 font-medium">Bấm để xem danh sách</p>
                        </div>
                      </div>
                      <span className="text-sm font-black text-stone-800">{count} mục</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Thao Tác Nhanh</span>
              </h3>
              <p className="text-xs text-stone-500">
                Cập nhật nhanh tri thức mới cho Robot Concierge qua file hoặc bài viết:
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setCurrentView('upload')}
                  className="w-full text-left p-3 rounded-xl border border-stone-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <UploadCloud className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="text-xs font-bold text-stone-900">Kéo Thả Tải File PDF / Docx</p>
                      <p className="text-[10px] text-stone-500">Tự động bóc tách và phân đoạn</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-indigo-600" />
                </button>

                <button
                  onClick={() => setCurrentView('create')}
                  className="w-full text-left p-3 rounded-xl border border-stone-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <PlusCircle className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-stone-900">Tạo Bài Viết Tri Thức Có Ảnh</p>
                      <p className="text-[10px] text-stone-500">Chiếu ảnh trực tiếp lên Robot</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600" />
                </button>

                <button
                  onClick={() => setCurrentView('sources')}
                  className="w-full text-left p-3 rounded-xl border border-stone-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <FolderSync className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-stone-900">Quản Lý File Vault Obsidian</p>
                      <p className="text-[10px] text-stone-500">Xem {sources.length} tài liệu đã đồng bộ</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-blue-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: KNOWLEDGE ARTICLES LIST (Screen 2 Figma) OR ARTICLE DETAIL (Screen 5 Figma) */}
      {currentView === 'articles' && (
        <div className="space-y-6">
          {/* If NO Article Selected -> Show List (Screen 2) */}
          {!selectedArticle ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
                <div>
                  <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                    Danh Sách Bài Viết Tri Thức (Knowledge Articles)
                  </h2>
                  <p className="text-sm text-stone-500 font-medium">
                    Toàn bộ mẩu kiến thức đang được Robot sử dụng để trả lời và hiển thị hình ảnh
                  </p>
                </div>

                <button
                  onClick={() => setCurrentView('create')}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-indigo-400" />
                  <span>+ Thêm Bài Viết Mới</span>
                </button>
              </div>

              {/* Search & Category Filter Pills */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm theo tiêu đề hoặc nội dung..."
                      className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    {['All', 'Dining', 'Facilities', 'Wellness', 'Accommodations', 'Policies'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                          categoryFilter.toLowerCase() === cat.toLowerCase()
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Articles Table */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50/80 border-b border-stone-200 text-[11px] font-black text-stone-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4">TIÊU ĐỀ & MÃ TRI THỨC</th>
                        <th className="py-3.5 px-4">DANH MỤC</th>
                        <th className="py-3.5 px-4">VỊ TRÍ / TẦNG</th>
                        <th className="py-3.5 px-4">HÌNH ẢNH ROBOT</th>
                        <th className="py-3.5 px-4">TRẠNG THÁI</th>
                        <th className="py-3.5 px-4 text-right">THAO TÁC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs">
                      {filteredDocuments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-stone-400 font-medium">
                            Không tìm thấy bài viết nào phù hợp.
                          </td>
                        </tr>
                      ) : (
                        filteredDocuments.map((doc) => {
                          const meta = doc.metadata || {};
                          const title = meta.title || doc.id;
                          const category = meta.category || 'General';
                          const floor = meta.floor || 'Aurora Grand';
                          const hasImage = !!meta.primary_image;

                          return (
                            <tr key={doc.id} className="hover:bg-stone-50/60 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-stone-900">{title}</div>
                                <div className="text-[10px] text-stone-400 font-mono mt-0.5">{doc.id}</div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {getCategoryIcon(category)}
                                  <span>{category}</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-medium text-stone-600">{floor}</td>
                              <td className="py-3.5 px-4">
                                {hasImage ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <ImageIcon className="w-3 h-3" />
                                    <span>Có hình ảnh</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-stone-400 font-medium">Chỉ văn bản</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Active</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right space-x-1">
                                <button
                                  onClick={() => {
                                    setSelectedArticle(doc);
                                    setSelectedImageIndex(0);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-indigo-50 text-stone-700 hover:text-indigo-600 font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Xem chi tiết</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteDoc(doc.id)}
                                  className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer inline-flex items-center"
                                  title="Xóa tri thức"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* IF ARTICLE SELECTED -> SHOW ARTICLE DETAIL WITH IMAGES (Screen 5 Figma) */
            <div className="space-y-6">
              {/* Back button */}
              <button
                onClick={() => setSelectedArticle(null)}
                className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại danh sách bài viết</span>
              </button>

              {/* 2-Column Detail Layout (Screen 5) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column (2/3): Article Content & Photo Gallery */}
                <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {selectedArticle.metadata?.category || 'General'}
                      </span>
                      <span className="text-xs text-stone-400 font-medium">
                        Cập nhật: {selectedArticle.metadata?.last_updated || '2026-08-28'}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                      {selectedArticle.metadata?.title || selectedArticle.id}
                    </h2>
                  </div>

                  {/* Photo Gallery (Screen 5 Figma: Restaurant Photos for Robot Display) */}
                  {(() => {
                    const primary = selectedArticle.metadata?.primary_image;
                    const galleryStr = selectedArticle.metadata?.gallery_images || primary || '';
                    const images = galleryStr.split(',').map((s) => s.trim()).filter(Boolean);

                    if (images.length === 0) return null;

                    const activeImg = images[selectedImageIndex] || images[0];

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-indigo-600" />
                            <span>Hình Ảnh Trưng Bày Trên Màn Hình Robot</span>
                          </span>
                          <span className="text-[11px] text-stone-400 font-medium">
                            {images.length} hình ảnh
                          </span>
                        </div>

                        {/* Main Featured Photo */}
                        <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-stone-200 shadow-md group">
                          <img
                            src={activeImg}
                            alt="Visual card for robot screen"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-[11px] font-bold flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Tự động bung lên màn hình khi khách hỏi Robot về địa điểm này</span>
                          </div>
                        </div>

                        {/* Thumbnail Strip */}
                        {images.length > 1 && (
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {images.map((imgUrl, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedImageIndex(idx)}
                                className={`w-20 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${
                                  selectedImageIndex === idx
                                    ? 'border-indigo-600 shadow-md scale-105'
                                    : 'border-stone-200 opacity-70 hover:opacity-100'
                                }`}
                              >
                                <img src={imgUrl} alt="thumbnail" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Body Content */}
                  <div className="border-t border-stone-100 pt-5 space-y-3">
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                      NỘI DUNG TRI THỨC VĂN BẢN (CHUNKS):
                    </h4>
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-sm text-stone-800 leading-relaxed font-medium">
                      {selectedArticle.document}
                    </div>
                  </div>
                </div>

                {/* Right Column (1/3): Metadata & Settings (Screen 5 Right Panel) */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-5">
                    <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-3">
                      THÔNG SỐ RAG METADATA
                    </h3>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-stone-400 block text-[11px] font-medium">MÃ TÀI LIỆU (ID):</span>
                        <span className="font-mono font-bold text-stone-800">{selectedArticle.id}</span>
                      </div>

                      <div>
                        <span className="text-stone-400 block text-[11px] font-medium">DANH MỤC:</span>
                        <span className="font-bold text-stone-800">
                          {selectedArticle.metadata?.category || 'General'}
                        </span>
                      </div>

                      <div>
                        <span className="text-stone-400 block text-[11px] font-medium">VỊ TRÍ / TẦNG:</span>
                        <span className="font-bold text-stone-800">
                          {selectedArticle.metadata?.floor || 'Aurora Grand Hotel'}
                        </span>
                      </div>

                      <div>
                        <span className="text-stone-400 block text-[11px] font-medium">VECTOR COLLECTION:</span>
                        <span className="font-mono font-bold text-indigo-600">concierge_kb</span>
                      </div>

                      <div>
                        <span className="text-stone-400 block text-[11px] font-medium">MÔ HÌNH EMBEDDING:</span>
                        <span className="font-bold text-stone-800">Ollama bge-m3 (1024 dims)</span>
                      </div>
                    </div>

                    <div className="border-t border-stone-100 pt-4 space-y-2">
                      <button
                        onClick={() => handleDeleteDoc(selectedArticle.id)}
                        className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa Bài Viết Khỏi Robot</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: SYNCED SOURCE FILES (Screen 3 Figma) */}
      {currentView === 'sources' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                Nguồn Dữ Liệu Đồng Bộ (Source Documents)
              </h2>
              <p className="text-sm text-stone-500 font-medium">
                Quản lý các file Markdown trong Obsidian Vault và tài liệu PDF đã nạp vào Vector Store
              </p>
            </div>

            <button
              onClick={handleSyncObsidian}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <FolderSync className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Đồng Bộ Obsidian Vault Ngay</span>
            </button>
          </div>

          {/* Sources Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200 text-[11px] font-black text-stone-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">TÊN FILE NGUỒN</th>
                    <th className="py-3.5 px-4">ĐỊNH DẠNG</th>
                    <th className="py-3.5 px-4">DUNG LƯỢNG</th>
                    <th className="py-3.5 px-4">SỐ ĐOẠN CHUNKS</th>
                    <th className="py-3.5 px-4">CẬP NHẬT LẦN CUỐI</th>
                    <th className="py-3.5 px-4">TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {sources.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-stone-400 font-medium">
                        Chưa có file nguồn nào trong thư mục Vault.
                      </td>
                    </tr>
                  ) : (
                    sources.map((src, idx) => (
                      <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-stone-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          <span>{src.filename}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-stone-100 text-stone-700">
                            {src.file_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-stone-600 font-mono">{src.file_size_kb} KB</td>
                        <td className="py-3.5 px-4 font-bold text-stone-800">{src.chunks_count} chunks</td>
                        <td className="py-3.5 px-4 text-stone-500">{src.last_modified}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{src.status}</span>
                          </span>
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

      {/* VIEW 4: CREATE ARTICLE WITH INTEGRATED FILE & IMAGE UPLOAD */}
      {currentView === 'create' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="border-b border-stone-200 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                Soạn Thảo Bài Viết Tri Thức Mới (Article Editor)
              </h2>
              <p className="text-sm text-stone-500 font-medium">
                Tạo tri thức văn bản kèm tải ảnh hoặc bóc tách file tự động cho Robot Concierge
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentView('articles')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-stone-500 hover:bg-stone-100 transition-all cursor-pointer"
            >
              ✕ Đóng
            </button>
          </div>

          <form onSubmit={handleCreateArticleSubmit} className="bg-white p-8 rounded-3xl border border-stone-200 shadow-lg space-y-6">
            {/* Quick File Import Box (Tùy chọn tải file tài liệu để tự động điền) */}
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-900">
                    Bạn có sẵn file tài liệu (PDF, Word, Markdown)?
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Tải file lên để hệ thống tự động bóc tách chữ vào bài viết dưới đây
                  </p>
                </div>
              </div>

              <div>
                <input
                  id="import-doc-input"
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      try {
                        setIsUploading(true);
                        const res = await uploadRAGFile(file, articleForm.category);
                        showNotification('Đã tải và bóc tách nội dung file thành công!');
                        // Auto-fill title if empty
                        if (!articleForm.title) {
                          setArticleForm((prev) => ({
                            ...prev,
                            title: file.name.replace(/\.[^/.]+$/, ''),
                          }));
                        }
                      } catch (err) {
                        showNotification('Lỗi khi nạp file: ' + err.message);
                      } finally {
                        setIsUploading(false);
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('import-doc-input').click()}
                  disabled={isUploading}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-200 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  {isUploading ? 'Đang đọc file...' : '📂 Chọn file tài liệu'}
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                TIÊU ĐỀ BÀI VIẾT:
              </label>
              <input
                type="text"
                required
                value={articleForm.title}
                onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                placeholder="Ví dụ: Restaurant Booking Policy, Hướng Dẫn Hồ Bơi..."
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
              />
            </div>

            {/* Category & Floor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  DANH MỤC:
                </label>
                <select
                  value={articleForm.category}
                  onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none"
                >
                  <option value="Dining">Dining (Ẩm Thực & Bar)</option>
                  <option value="Facilities">Facilities (Hồ Bơi / Tiện Ích)</option>
                  <option value="Wellness">Wellness (Spa / Gym)</option>
                  <option value="Accommodations">Accommodations (Phòng Ngủ)</option>
                  <option value="Policies">Policies (Quy Định Khách Sạn)</option>
                  <option value="General">General (Chung)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  VỊ TRÍ / TẦNG:
                </label>
                <input
                  type="text"
                  value={articleForm.floor}
                  onChange={(e) => setArticleForm({ ...articleForm, floor: e.target.value })}
                  placeholder="Ví dụ: Tầng 4 (Khu Wellness), Tầng 25..."
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Visual Image Uploader & Preview (Màn hình Robot) */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                HÌNH ẢNH MINH HỌA (SẼ CHIẾU LÊN MÀN HÌNH CẢM ỨNG ROBOT):
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={articleForm.primary_image}
                  onChange={(e) => setArticleForm({ ...articleForm, primary_image: e.target.value })}
                  placeholder="Dán link ảnh (https://...) hoặc chọn upload từ máy..."
                  className="flex-1 w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none"
                />

                <input
                  id="image-file-upload-input"
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      try {
                        setIsUploading(true);
                        const res = await uploadRAGFile(file, articleForm.category);
                        if (res.image_url) {
                          setArticleForm((prev) => ({
                            ...prev,
                            primary_image: res.image_url,
                            gallery_images: res.image_url,
                          }));
                          showNotification('Đã tải ảnh lên Server thành công!');
                        }
                      } catch (err) {
                        showNotification('Lỗi khi tải ảnh: ' + err.message);
                      } finally {
                        setIsUploading(false);
                      }
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={() => document.getElementById('image-file-upload-input').click()}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border border-stone-300"
                >
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  <span>Chọn ảnh từ máy</span>
                </button>
              </div>

              {/* Image Preview if available */}
              {articleForm.primary_image && (
                <div className="mt-3 relative w-48 h-32 rounded-xl overflow-hidden border border-stone-200 shadow-sm group">
                  <img
                    src={articleForm.primary_image}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded">
                      Ảnh Robot Screen
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Content WYSIWYG */}
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                NỘI DUNG TRI THỨC VĂN BẢN (ROBOT DÙNG ĐỂ ĐỌC HIỂU & TRẢ LỜI):
              </label>
              <textarea
                rows={6}
                required
                value={articleForm.content}
                onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                placeholder="Nhập thông tin chi tiết về chính sách, giờ hoạt động, giá dịch vụ để AI học..."
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed font-medium"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setCurrentView('articles')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isLoading ? 'Đang lưu...' : 'Lưu & Nạp Vào ChromaDB'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

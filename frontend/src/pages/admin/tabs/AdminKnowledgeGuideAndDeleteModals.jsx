import React from 'react';
import { Zap, Trash2, Layers, X, FileCode, File, Check, BookOpen, Copy } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

export const AdminKnowledgeGuideAndDeleteModals = ({
  deleteConfirmTarget,
  setDeleteConfirmTarget,
  isDeleting,
  handleExecuteConfirmDelete,
  isShowMdGuide,
  setIsShowMdGuide,
  isTemplateCopied,
  handleCopyStarterTemplate,
}) => {
  const { t, language } = useLanguage();
  return (
    <>
      {/* ========================================================================= */}
      {/* CUSTOM IN-APP DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-stone-900 truncate">
                  {deleteConfirmTarget.type === 'file'
                    ? t('knowledgeConfirmDeleteFileTitle')
                    : t('knowledgeConfirmDeleteScenarioTitle')}
                </h3>
                <p className="text-xs text-stone-500 font-mono truncate">
                  {deleteConfirmTarget.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              {deleteConfirmTarget.type === 'file'
                ? t('knowledgeConfirmDeleteFileDesc').replace('{name}', deleteConfirmTarget.filename)
                : t('knowledgeConfirmDeleteScenarioDesc').replace('{title}', deleteConfirmTarget.title)}
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
              >
                {t('knowledgeBtnCancelDelete')}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {isDeleting ? (
                  <span>{isEN ? 'Deleting...' : 'Đang xóa...'}</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('knowledgeBtnConfirmDelete')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MARKDOWN AUTHORING GUIDE FOR ROBOT AI MODAL */}
      {/* ========================================================================= */}
      {isShowMdGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-stone-200 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-stone-50 shrink-0" style={{ borderColor: '#E9E5DC' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 tracking-wide">
                    {t('knowledgeModalMdGuideTitle')}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {isEN
                      ? 'Standards, Chunking Architecture & Best Practices for RAG & ChromaDB'
                      : 'Quy chuẩn cấu trúc phân đoạn, bóc tách RAG và mẫu văn phong chuẩn cho Robot'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShowMdGuide(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-stone-700 leading-relaxed">
              {/* 1. Principle Card */}
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 flex items-start gap-3">
                <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wide">
                    {isEN ? '1. Why Markdown (.md) is the fastest format for Robot AI (< 5ms)?' : '1. Vì sao AI đọc Markdown (.md) nhanh nhất (< 5ms)?'}
                  </h4>
                  <p className="text-blue-800 text-[11px]">
                    {isEN
                      ? 'The backend chunker splits text by markdown header regex \\n(?=#+ ). Each section becomes a clean, independent semantic vector chunk in ChromaDB without parsing noise, OCR errors, or text corruption.'
                      : 'Hệ thống Backend cắt đoạn (chunking) theo biểu thức chính quy \\n(?=#+ ). Mỗi tiêu đề # hoặc ## biến thành một mẩu tri thức độc lập có ngữ cảnh hoàn chỉnh trong ChromaDB, không bị lẫn rác hay vỡ chữ như file PDF/DOCX.'}
                  </p>
                </div>
              </div>

              {/* 2. Five Essential Parts Grid */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-stone-900 uppercase tracking-wider text-xs flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>{isEN ? '2. The 5 Core Components of an Ideal Knowledge File' : '2. Năm Thành Phần Cốt Lõi Của Một File Tri Thức Chuẩn'}</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">1</span>
                      <span>YAML Frontmatter (Metadata)</span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      {isEN
                        ? 'Placed at line 1. Contains title, category, tags, and language: en/vi to trigger automatic language badges.'
                        : 'Đặt ở đầu file giữa 2 dòng ---. Chứa title, category, tags, và quan trọng nhất là language: vi hoặc en để hệ thống tự động gán badge.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">2</span>
                      <span>{isEN ? 'Header Hierarchy (#, ##, ###)' : 'Phân Cấp Tiêu Đề (#, ##, ###)'}</span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      {isEN
                        ? '1 H1 per file. Use ## for each facility/section. Aim for 50 - 300 words per section for optimal embedding retrieval.'
                        : 'Chỉ 1 tiêu đề # H1 cho toàn file. Dùng ## cho từng dịch vụ/khu vực. Mỗi mục nên chứa từ 50 - 300 từ đủ thông tin độc lập.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">3</span>
                      <span>{isEN ? 'Markdown Tables (| Col 1 | Col 2 |)' : 'Bảng Biểu Markdown (Tables)'}</span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      {isEN
                        ? 'Best for numerical data, operating hours, prices, and fast reference. Edit effortlessly with our Excel Table mode.'
                        : 'Tối ưu tuyệt đối cho AI tra cứu giờ mở cửa, chi phí, tầng và chỉ dẫn. Chỉnh sửa cực nhanh với chế độ Bảng Excel.'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5">
                    <div className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">4</span>
                      <span>{isEN ? 'Bilingual Suffixes (_vi.md & _en.md)' : 'Đuôi File Song Ngữ (_vi.md & _en.md)'}</span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      {isEN
                        ? 'Name files with _vi.md and _en.md to enable instant 1-click bilingual switching in the editor modal.'
                        : 'Đặt tên có đuôi _vi.md và _en.md để hệ thống tự động ghép cặp song ngữ và kích hoạt nút chuyển đổi nhanh trong Editor.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Starter Template Code Block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-900 uppercase tracking-wider text-xs flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-600" />
                    <span>{isEN ? '3. Standard Starter Markdown Template' : '3. Mẫu Khung Template Chuẩn Để Sao Chép'}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopyStarterTemplate}
                    className="px-3 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-2xs"
                  >
                    {isTemplateCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t('knowledgeTemplateCopied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('knowledgeBtnCopyTemplate')}</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-stone-900 text-stone-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-stone-800">
{`---
title: Cẩm Nang Dịch Vụ & Tiện Nghi Khách Sạn
category: hotel_facilities
hotel: Aurora Grand Hotel
language: vi
tags: [gym, spa, ho_boi, nha_hang, bai_xe]
---

# CẨM NANG DỊCH VỤ & TIỆN NGHI KHÁCH SẠN

Tài liệu cung cấp thông tin tra cứu cho Robot Concierge và khách lưu trú.

---

## 1. HỒ BƠI VÔ CỰC (INFINITY POOL) — TẦNG 5

### Vị trí và Giờ hoạt động
- **Vị trí:** Sân thượng ngoài trời Tầng 5.
- **Giờ mở cửa:** Phục vụ hàng ngày từ **06:00 đến 22:00**.
- **Chi phí:** Hoàn toàn **MIỄN PHÍ** cho khách lưu trú.

### Các tiện ích miễn phí kèm theo
- Nước uống detox thảo mộc ướp lạnh tự do.
- Khăn tắm lớn và áo phao bơi đa kích cỡ.

---

## 2. BẢNG TRA CỨU TIỆN ÍCH TỔNG HỢP

| Tên Dịch Vụ | Vị Trí | Giờ Phục Vụ | Chi Phí |
|---|---|---|---|
| Hồ Bơi Vô Cực | Tầng 5 | 06:00 - 22:00 | Miễn phí |
| Phòng Tập Gym | Tầng 5 | Mở cửa 24/7 | Miễn phí |
| Gọi Món Tận Phòng 24/7 | Tầng 2 (Bếp Trung Tâm) | Mở 24/7 | Theo thực đơn Room Service |

---

## 3. KỊCH BẢN ĐỐI THOẠI HỎI ĐÁP MẪU CHO ROBOT

1. **Khách hỏi:** "Hồ bơi khách sạn ở đâu và có nước uống không?"
   - **Robot trả lời:** "Dạ hồ bơi vô cực nằm tại Tầng 5, mở cửa từ 6 giờ sáng đến 22 giờ tối. Khách sạn có chuẩn bị sẵn nước uống detox thảo mộc và khăn tắm miễn phí cho quý khách ạ!"
`}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t bg-stone-50 flex items-center justify-between shrink-0" style={{ borderColor: '#E9E5DC' }}>
              <div className="text-[11px] text-stone-500 font-mono">
                {isEN ? 'Saved in backend/knowledge_vault/' : 'Tài liệu được lưu tại backend/knowledge_vault/'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyStarterTemplate}
                  className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer hover:bg-stone-100 flex items-center gap-1.5 bg-white text-stone-700 border-stone-300"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('knowledgeBtnCopyTemplate')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsShowMdGuide(false)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  {isEN ? 'Close Guide' : 'Đóng Hướng Dẫn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

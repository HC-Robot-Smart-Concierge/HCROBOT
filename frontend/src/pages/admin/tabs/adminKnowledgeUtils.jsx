import React from 'react';

export const CATEGORY_MAP = {
  facility: { labelVI: 'Tiện ích', labelEN: 'Amenities', bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE' },
  faq: { labelVI: 'Hỏi đáp (FAQ)', labelEN: 'FAQ', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  greeting: { labelVI: 'Lời chào', labelEN: 'Greetings', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  service: { labelVI: 'Dịch vụ', labelEN: 'Services', bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  chitchat: { labelVI: 'Trò chuyện', labelEN: 'Small Talk', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
};

export const getCategoryLabel = (cat, isEN) => {
  const item = CATEGORY_MAP[cat];
  if (!item) return cat;
  return isEN ? item.labelEN : item.labelVI;
};

export const DEFAULT_FORM_STATE = {
  title: '',
  category: 'faq',
  match_keywords: '',
  match_type: 'keyword',
  response_vi: '',
  response_en: '',
  action_type: 'none',
  destination_key: '',
  eye_expression: 'none',
  is_fast_path: true,
  is_active: true,
  priority: 50,
};

export const buildStarterKnowledgeTemplate = (isEN) => {
const templateText = `---
title: Tiêu Đề Tài Liệu Tri Thức Mới
category: hotel_facilities
hotel: Aurora Grand Hotel
language: ${isEN ? 'en' : 'vi'}
tags: [tien_nghi, dich_vu, huong_dan]
---

# TIÊU ĐỀ TÀI LIỆU CHÍNH

Mô tả ngắn gọn về phạm vi và nội dung của tài liệu tại đây.

---

## 1. TÊN KHU VỰC HOẶC DỊCH VỤ — TẦNG X

### Vị trí và Giờ hoạt động
- **Vị trí:** Tầng X, mô tả lối đi chi tiết.
- **Giờ mở cửa:** Phục vụ từ **06:00 đến 22:00**.
- **Đối tượng & Chi phí:** Hoàn toàn MIỄN PHÍ cho khách lưu trú.

### Danh mục trang thiết bị & Tiện ích
- Liệt kê trang thiết bị chính thứ nhất.
- Liệt kê trang thiết bị chính thứ hai.
- Tiện ích miễn phí kèm theo (khăn, nước uống, hướng dẫn viên).

---

## 2. BẢNG TỔNG HỢP TRA CỨU NHANH

| Hạng Mục | Vị Trí | Giờ Phục Vụ | Ghi Chú |
|---|---|---|---|
| Dịch vụ 1 | Tầng X | 24/7 | Miễn phí |
| Dịch vụ 2 | Tầng Y | 06:00 - 22:00 | Đặt trước 30 phút |

---

## 3. KỊCH BẢN HỎI ĐÁP MẪU CHO ROBOT

1. **Khách hỏi:** "Câu hỏi thường gặp của khách lưu trú?"
   - **Robot trả lời:** "Dạ câu trả lời lễ phép, chu đáo và chính xác theo phong cách 5 sao của Robot Concierge tại đây ạ!"
`;
  return templateText;
};

export const renderMarkdownPreview = (text, isEN) => {
  if (!text) return <p className="text-stone-400 italic">{isEN ? 'No document content.' : 'Chưa có nội dung văn bản.'}</p>;
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-xs leading-relaxed text-stone-800">
      {lines.map((l, i) => {
        const t = l.trim();
        if (t.startsWith('# ')) {
          return <h1 key={i} className="text-base font-black text-stone-900 border-b pb-1 pt-2">{t.slice(2)}</h1>;
        }
        if (t.startsWith('## ')) {
          return <h2 key={i} className="text-sm font-bold text-stone-900 border-b pb-1 pt-2">{t.slice(3)}</h2>;
        }
        if (t.startsWith('### ')) {
          return <h3 key={i} className="text-xs font-bold text-stone-900 pt-1">{t.slice(4)}</h3>;
        }
        if (t.startsWith('- ') || t.startsWith('* ')) {
          return <li key={i} className="ml-4 list-disc text-stone-700">{t.slice(2)}</li>;
        }
        if (t.startsWith('|')) {
          return <div key={i} className="font-mono text-[11px] bg-stone-100 px-2 py-0.5 rounded overflow-x-auto">{t}</div>;
        }
        if (!t) return <div key={i} className="h-1.5" />;
        return <p key={i} className="text-stone-700">{t}</p>;
      })}
    </div>
  );
};

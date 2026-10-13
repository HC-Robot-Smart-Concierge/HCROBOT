# Kiến Trúc Tính Năng Thu Thập Đánh Giá (Feedback) & Quản Lý Vòng Đời Hội Thoại Robot Concierge

Tài liệu thiết kế kiến trúc chuẩn công nghiệp (Production-Grade Architecture) cho tính năng **Thu thập đánh giá của khách hàng**, **Xác định thời điểm kết thúc hội thoại**, và **Cơ chế cảnh báo phản hồi tiêu cực về bộ phận Concierge** trên nền tảng HCRobot.

---

## 1. Vấn Đề Thực Tế & Triết Lý Thiết Kế (HRI Philosophy)

### 1.1. Thách thức trong giao tiếp Người - Robot (Human-Robot Interaction)
Trong môi trường khách sạn cao cấp, việc yêu cầu khách hàng đánh giá gặp 2 cạm bẫy lớn:
1. **Chờ khách đi xa mới xin đánh giá (Sai lầm phổ biến):** Khi camera phát hiện khách đã bước đi (`onGuestLeft`), nếu lúc này robot mới phát âm thanh xin đánh giá thì robot đang "nói chuyện với không khí", tạo cảm giác thiếu tự nhiên và gây phiền hà cho sảnh chờ.
2. **Hỏi đánh giá quá sớm hoặc liên tục:** Sau mỗi câu hỏi đều hỏi "Quý khách thấy câu trả lời thế nào?" sẽ làm gián đoạn dòng suy nghĩ khi khách còn nhu cầu tiếp theo.

### 1.2. Giải pháp cốt lõi
- **Chủ động trao quyền cho khách hàng:** Luôn hiển thị nút **`[Hoàn tất / Đánh giá]` (End Session)** nổi bật, tinh tế trên màn hình cảm ứng của Robot.
- **Hỗ trợ Đa phương thức (Multi-Modal):** Khách có thể chạm nút trên màn hình hoặc nói lời kết thúc (*"Cảm ơn em"*, *"Tạm biệt"*).
- **Quy tắc 3 giây (Zero-Friction UI):** Form đánh giá chỉ cần đúng **1 chạm** (thang điểm 1-5 sao), đếm ngược tự đóng (8 giây) để nếu khách vừa chạm xong quay lưng đi, hệ thống vẫn lưu trữ mượt mà mà không kẹt giao diện.
- **Service Recovery (Xử lý khủng hoảng dịch vụ):** Đánh giá tiêu cực (dưới hoặc bằng 3 sao) phải lập tức kích hoạt chuông cảnh báo tới bộ phận Concierge kèm bản ghi cuộc trò chuyện để nhân viên xử lý tức thì.

---

## 2. Luồng Vận Hành & Sơ Đồ Trạng Thái (State Machine)

### 2.1. Sơ đồ tuần tự (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Guest as Khách hàng
    participant Screen as Robot Screen (Kiosk UI)
    participant Speech as Voice/VAD Engine
    participant Backend as FastAPI Backend (ai.py)
    participant DB as PostgreSQL
    participant Concierge as Concierge Dashboard (Staff)

    Note over Guest, Screen: Đang trong phiên hội thoại (State RT-03/RT-04)
    alt Cách 1: Khách chạm nút trên màn hình
        Guest->>Screen: Bấm nút "Hoàn tất cuộc trò chuyện"
    else Cách 2: Khách nói lời tạm biệt
        Guest->>Speech: "Cảm ơn em, anh xong rồi"
        Speech->>Screen: Phát hiện Intent 'farewell' / 'closing'
    end

    Screen->>Speech: Dừng lắng nghe & TTS lời chào ngắn
    Speech-->>Guest: "Rora cảm ơn quý khách! Quý khách chấm điểm dịch vụ giúp em nhé."
    Screen->>Screen: Mở "Quick Feedback Modal" (Thang điểm 1-5 sao + Đếm ngược 8s)

    alt Khách chọn đánh giá (1 - 5 sao)
        Guest->>Screen: Chạm 1-5 sao (hoặc nói "5 sao")
        Screen->>Backend: POST /api/v1/ai/feedback (session_id, rating, tags, comment)
        Screen->>Backend: POST /api/v1/ai/sessions/{id}/flush (Lưu toàn bộ hội thoại)
        Backend->>DB: Ghi bản ghi feedbacks & chat_messages (is_active = False)
        
        alt Đánh giá tiêu cực (Rating <= 3 sao)
            Backend->>Concierge: WebSocket Urgent Alert (Room, Stars, Session ID)
            Concierge->>Backend: GET /api/v1/ai/sessions/{id}/messages
            Backend-->>Concierge: Trả transcript cuộc hội thoại
            Note over Concierge: Nhân viên gọi điện / hỗ trợ khách ngay lập tức
        end
        Screen-->>Guest: "Rora cảm ơn quý khách! Chúc quý khách kỳ nghỉ tuyệt vời!"
    else Khách không đánh giá & bỏ đi
        Note over Screen: Đếm ngược 8s kết thúc hoặc Camera kích hoạt onGuestLeft
        Screen->>Backend: POST /api/v1/ai/sessions/{id}/flush (Lưu hội thoại không kèm rating)
    end

    Screen->>Screen: Trở về chế độ chờ / ngủ nhẹ (RT-01/RT-02)
```

---

## 3. Thiết Kế Giao Diện Kiosk (Kiosk UX Standards)

### 3.1. Nút "Kết thúc cuộc trò chuyện" trên màn hình chính
- **Vị trí:** Góc trên bên phải hoặc dưới thanh điều khiển giọng nói.
- **Phong cách thị giác:** 
  - Nút bấm dạng pill: viền kim loại/gradient (`border border-emerald-500/40 bg-emerald-950/30 text-emerald-300`).
  - Icon: CheckCircle hoặc Sparkles từ thư viện Lucide.
  - Nhãn: `Hoàn tất / Đánh giá` (kèm phụ đề tiếng Anh `Finish & Rate`).

### 3.2. Modal Đánh giá Nhanh (Quick Feedback Modal)
Giao diện xuất hiện phủ nhẹ lên giao diện chính của Robot với các thành phần:
1. **Tiêu đề lịch thiệp:** *"Quý khách có hài lòng với trợ lý Rora không ạ?"*
2. **Bộ chọn 5 sao kích thước lớn:** 
   - 1 sao (Rất tệ) | 2 sao (Chưa tốt) | 3 sao (Bình thường) | 4 sao (Tốt) | 5 sao (Tuyệt vời)
3. **Thẻ lý do nhanh (Quick Tags) khi chọn từ 3 sao trở xuống:**
   - [Âm thanh nhỏ] [Robot nghe chưa rõ] [Chưa giải quyết được việc] [Cần nhân viên trực tiếp]
4. **Thanh đếm ngược tự đóng (Progress Bar 8 giây):**
   - Đảm bảo nếu khách chấm xong rồi rời đi, sau 8 giây Kiosk tự đóng và chào kết thúc, sẵn sàng phục vụ lượt khách tiếp theo.

---

## 4. Cấu Trúc Dữ Liệu & API

### 4.1. Cơ sở dữ liệu (PostgreSQL)
Hệ thống sử dụng liên kết khoá ngoại chặt chẽ giữa 3 bảng:

```sql
-- 1. Phiên hội thoại tổng thể
chat_sessions (
    id VARCHAR(64) PRIMARY KEY,
    room_number VARCHAR(20),
    guest_name VARCHAR(100),
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 2. Từng lượt nói của khách và Robot
chat_messages (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender VARCHAR(20),       -- 'user' | 'assistant'
    text TEXT,
    language VARCHAR(20),
    intent_action VARCHAR(50),
    created_at TIMESTAMP
);

-- 3. Bảng phản hồi và đánh giá
feedbacks (
    id VARCHAR(50) PRIMARY KEY, -- 'FB-XXXXXXXX'
    chat_session_id VARCHAR(64) REFERENCES chat_sessions(id) ON DELETE SET NULL,
    room_number VARCHAR(50),
    guest_name VARCHAR(100),
    rating INTEGER,            -- 1 đến 5
    category VARCHAR(50),      -- 'Robot Concierge', 'Service', 'F&B'
    comment TEXT,              -- Ghi chú hoặc Quick tags
    created_at TIMESTAMP
);
```

### 4.2. API Đánh Giá & Tự Động Kích Hoạt Cảnh Báo Concierge
Tại endpoint `POST /api/v1/ai/feedback`:

```python
# backend/app/api/v1/endpoints/ai.py

@router.post("/feedback", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def submit_feedback(fb_in: FeedbackCreate, db: AsyncSession = Depends(get_db)):
    """
    Lưu đánh giá từ Kiosk Robot. 
    Nếu rating <= 3 -> Bắn WebSocket khẩn cấp tới Concierge / Lễ tân để can thiệp hỗ trợ.
    """
    new_fb = Feedback(
        chat_session_id=fb_in.chat_session_id,
        rating=fb_in.rating,
        category=fb_in.category or "Robot Concierge",
        comment=fb_in.comment,
        guest_name=fb_in.guest_name,
        room_number=fb_in.room_number,
    )
    db.add(new_fb)
    await db.flush()

    # XỬ LÝ ĐÁNH GIÁ TIÊU CỰC (SERVICE RECOVERY DISPATCH)
    if new_fb.rating <= 3:
        room_label = f"Phòng {new_fb.room_number}" if new_fb.room_number else "Kiosk Sảnh"
        
        await create_department_notification(
            db=db,
            department="Concierge",
            title=f"[CANH BAO] Danh gia tieu cuc ({room_label}) - {new_fb.rating} Sao",
            description=(
                f"Khách tại {room_label} vừa đánh giá {new_fb.rating}/5 sao. "
                f"Phản hồi: \"{new_fb.comment or 'Không có ghi chú'}\". "
                f"Vui lòng mở lịch sử hội thoại để hỗ trợ khách kịp thời!"
            ),
            request_id=new_fb.chat_session_id, # Liên kết trực tiếp tới chat_session_id
            request_type="bad_feedback",
            type="UrgentAlert",
        )
        
        # Đồng thời thông báo cho bộ phận Lễ tân
        await create_department_notification(
            db=db,
            department="Reception",
            title=f"[CANH BAO] Danh gia thap ({room_label})",
            description=f"Khách phản hồi {new_fb.rating}/5 sao về Robot. Session ID: {new_fb.chat_session_id}",
            request_id=new_fb.chat_session_id,
            request_type="bad_feedback",
            type="UrgentAlert",
        )

    await db.commit()
    await db.refresh(new_fb)
    return new_fb
```

---

## 5. Triển Khai Frontend Trên Robot Screen

### 5.1. Nút kết thúc hội thoại trên màn hình Robot
Tích hợp trực tiếp vào thanh điều khiển chính của Robot (`RobotScreenPage.jsx`):

```jsx
{/* Nút Hoàn tất cuộc trò chuyện */}
{currentState !== 'RT-01' && (
  <button
    type="button"
    onClick={handleOpenFeedback}
    className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold backdrop-blur-md transition-all active:scale-95 shadow-lg shadow-emerald-950/40"
  >
    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
    <span>Hoàn tất & Đánh giá</span>
  </button>
)}
```

### 5.2. Component Modal Đánh Giá Nhanh (`RobotQuickFeedbackModal.jsx`)

```jsx
import React, { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { submitFeedback } from '../../services/aiApi';

export const RobotQuickFeedbackModal = ({
  isOpen,
  onClose,
  sessionId,
  roomNumber,
  onCompleted,
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [countdown, setCountdown] = useState(8);
  const [submitting, setSubmitting] = useState(false);

  const quickBadTags = [
    'Robot nghe chưa rõ',
    'Chưa đúng ý',
    'Âm thanh nhỏ',
    'Cần nhân viên hỗ trợ',
  ];

  // Đếm ngược 8 giây tự động đóng nếu khách không chạm
  useEffect(() => {
    if (!isOpen) return;
    setCountdown(8);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleAutoSubmit = async () => {
    await handleSubmit(rating);
  };

  const handleSubmit = async (selectedRating) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitFeedback({
        chat_session_id: sessionId,
        rating: selectedRating,
        category: 'Robot Concierge',
        comment: comment.trim() || undefined,
        room_number: roomNumber || undefined,
      });
    } catch (err) {
      console.warn('Submit feedback failed:', err);
    } finally {
      setSubmitting(false);
      onCompleted?.();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-stone-900 border border-cyan-500/30 rounded-3xl p-6 shadow-2xl text-center space-y-5">
        
        {/* Nút đóng nhanh */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề & Đếm ngược */}
        <div className="space-y-1">
          <div className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase">
            Khao sat nhanh - Tu dong sau {countdown}s
          </div>
          <h3 className="text-xl font-bold text-white">
            Quý khách hài lòng với Rora chứ?
          </h3>
          <p className="text-xs text-stone-400">
            Đánh giá của quý khách giúp khách sạn nâng cao chất lượng dịch vụ
          </p>
        </div>

        {/* 5 Ngôi sao lớn */}
        <div className="flex justify-center items-center gap-3 py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => {
                setRating(star);
                if (star >= 4) {
                  // Đánh giá tốt 4-5 sao -> Gửi ngay không cần gõ chữ
                  handleSubmit(star);
                }
              }}
              className="p-2 transition-transform hover:scale-125 active:scale-95"
            >
              <Star
                className={`w-10 h-10 ${
                  star <= rating
                    ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                    : 'text-stone-600'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Thẻ góp ý nhanh khi đánh giá thấp */}
        {rating <= 3 && (
          <div className="space-y-2 text-left animate-in fade-in">
            <div className="text-[11px] font-semibold text-rose-300">
              Điều gì khiến quý khách chưa hài lòng?
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickBadTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setComment(tag)}
                  className={`text-xs px-2.5 py-1 rounded-xl border transition-all ${
                    comment === tag
                      ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                      : 'bg-stone-800/80 border-stone-700 text-stone-300 hover:border-stone-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nút Xác nhận */}
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubmit(rating)}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all"
        >
          {submitting ? 'Đang gửi...' : 'Gửi Đánh Giá & Kết Thúc'}
        </button>
      </div>
    </div>
  );
};
```

---

## 6. Quy Trình Phản Ứng Khủng Hoảng Của Concierge (Service Recovery Workflow)

Khi có đánh giá tệ (1 - 3 sao):
1. **Âm thanh & Visual Alert:** Màn hình của nhân viên Concierge hiển thị Popup màu đỏ viền vàng:
   ```
   [URGENT] Đánh giá không hài lòng từ Phòng 402: 2/5 Sao
   Lý do: "Robot nghe chưa rõ"
   [Xem đoạn hội thoại]  [Liên hệ phòng 402]
   ```
2. **Xem Transcript tức thì:**
   - Nhân viên bấm vào **[Xem đoạn hội thoại]**, hệ thống fetch các bản ghi từ bảng `chat_messages` theo `session_id`.
   - Nhân viên đọc được nguyên văn câu hỏi của khách và câu trả lời của Robot để nắm bắt chính xác khúc mắc (ví dụ: khách xin thêm 2 chăn nhưng robot hiểu nhầm thành xin nước suối).
3. **Can thiệp chủ động:**
   - Nhân viên Concierge gọi điện thoại bàn lên phòng hoặc cử nhân viên mang chăn lên tận phòng kèm lời xin lỗi: *"Chào anh/chị, em thấy robot Rora vừa hỗ trợ chưa được như ý, em mang chăn lên ngay cho phòng mình đây ạ"*.
   - Khách hàng sẽ đánh giá cao sự chu đáo và chuyên nghiệp của khách sạn (chuyển đổi từ sự cố thành điểm cộng lớn trong trải nghiệm khách hàng).

---

## 7. Checklist Kiểm Thử (QA / Test Scenarios)

| STT | Kịch Bản Kiểm Thử | Hành Vi Mong Muốn | Kết Quả Đạt |
|:---:|:---|:---|:---:|
| 1 | Khách bấm nút "Hoàn tất & Đánh giá" | Dừng micro, mở Modal 5 sao, phát lời cảm ơn ngắn | [x] |
| 2 | Khách chấm 5 sao | Tự động gửi feedback, đóng modal sau 1s, flush lưu DB, chuyển robot về RT-02/RT-01 | [x] |
| 3 | Khách chấm 2 sao + chọn tag | Gửi feedback kèm tag, hệ thống backend bắn WebSocket alert tới Concierge trong < 200ms | [x] |
| 4 | Khách không chấm điểm và bỏ đi | Sau đếm ngược 8s hoặc camera báo `onGuestLeft`: tự động flush session lưu DB, không báo lỗi | [x] |
| 5 | Concierge click vào thông báo cảnh báo | Mở đúng modal chi tiết hội thoại của phiên đó kèm đầy đủ các tin nhắn user/assistant | [x] |

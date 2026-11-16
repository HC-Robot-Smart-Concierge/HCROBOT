import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, X, Check, RefreshCw } from 'lucide-react';
import { submitFeedback, fetchFeedbacks } from '../../services/aiApi';

export const FeedbackModal = ({ isOpen, onClose, onNotify = () => {}, sessionId = 'default_session', roomNumber = null }) => {
  const [activeTab, setActiveTab] = useState('write'); // 'write' | 'view'
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState('Service');
  const [guestName, setGuestName] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false);

  const loadFeedbacks = async () => {
    setIsLoadingFeedbacks(true);
    try {
      const data = await fetchFeedbacks();
      setFeedbacks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[FeedbackModal] Error fetching feedbacks:', err);
    } finally {
      setIsLoadingFeedbacks(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'view') {
      loadFeedbacks();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        chat_session_id: sessionId,
        rating,
        category,
        comment,
        guest_name: guestName || 'Khách lưu trú',
        room_number: roomNumber || 'Sảnh Kiosk',
      };
      const res = await submitFeedback(payload);
      if (res) {
        onNotify('Cảm ơn bạn đã gửi đánh giá trải nghiệm!');
        setComment('');
        setActiveTab('view');
        loadFeedbacks();
      }
    } catch (err) {
      onNotify('Không thể gửi đánh giá lúc này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <h2 className="text-base font-bold text-stone-900">Đánh Giá & Phản Hồi Trải Nghiệm</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:bg-stone-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-2 my-4 border-b border-stone-100 pb-2">
          <button
            onClick={() => setActiveTab('write')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'write' ? 'bg-amber-600 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Gửi đánh giá mới
          </button>
          <button
            onClick={() => setActiveTab('view')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'view' ? 'bg-amber-600 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Xem tất cả đánh giá ({feedbacks.length})
          </button>
        </div>

        {activeTab === 'write' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">Mức độ hài lòng</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 rounded hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating ? 'text-amber-500 fill-amber-500' : 'text-stone-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-stone-700 ml-2">
                  {rating === 5 ? 'Tuyệt vời' : rating === 4 ? 'Hài lòng' : rating === 3 ? 'Bình thường' : 'Chưa tốt'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-stone-600 block mb-1">Danh mục dịch vụ</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                >
                  <option value="Service">Dịch vụ chung</option>
                  <option value="Robot">Trợ lý Robot Kiosk</option>
                  <option value="Cleanliness">Vệ sinh & Buồng phòng</option>
                  <option value="F&B">Ẩm thực & Nhà hàng</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-600 block mb-1">Họ tên của bạn</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Khách lưu trú"
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">Nhận xét chi tiết</label>
              <textarea
                rows="3"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ý kiến đóng góp giúp chúng tôi hoàn thiện chất lượng phục vụ..."
                className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg font-semibold"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
              <span>Đánh giá từ khách hàng</span>
              <button onClick={loadFeedbacks} className="text-amber-600 hover:underline flex items-center gap-1 font-semibold">
                <RefreshCw className={`w-3 h-3 ${isLoadingFeedbacks ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>

            {feedbacks.length === 0 ? (
              <div className="text-center py-8 text-xs text-stone-400">
                Chưa có đánh giá nào được lưu lại.
              </div>
            ) : (
              feedbacks.map((fb) => (
                <div key={fb.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[...Array(fb.rating || 5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      ))}
                      <span className="text-[11px] font-bold text-stone-700 ml-1.5">
                        {fb.guest_name || 'Khách'}
                      </span>
                      {fb.room_number && (
                        <span className="text-[10px] text-stone-400">({fb.room_number})</span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-stone-500 bg-white px-2 py-0.5 rounded border border-stone-200">
                      {fb.category || 'Service'}
                    </span>
                  </div>
                  {fb.comment && (
                    <p className="text-xs text-stone-600 mt-2 font-sans italic">
                      "{fb.comment}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

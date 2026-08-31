import React, { useState } from 'react';
import {
  MessageSquare,
  Search,
  Download,
  Eye,
} from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';

export const HistoryPage = ({ currentUser, onNotify = () => {} }) => {
  const [ratingFilter, setRatingFilter] = useState('All'); // 'All' | '5Star' | '4Star' | 'NeedsImp'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const staffName = currentUser?.full_name || currentUser?.name || 'Hotel Staff';

  // Sample Guest & Robot Conversation Logs with Ratings
  const sampleConversations = [
    {
      id: 'SESS-9042',
      room: 'Room 402',
      guestName: 'Mr. A. Sterling',
      guestTier: 'VIP Gold',
      time: '10:15 AM - Hôm nay',
      duration: '1 phút 45 giây',
      rating: 5.0,
      feedback: 'Robot phục vụ rất nhanh, trả lời thông minh và lịch sự.',
      interactionType: 'Voice Conversation',
      robotUnit: 'HCRobot Unit 01',
      transcript: [
        { time: '10:15:02', speaker: 'guest', text: 'Chào em, cho anh hỏi nhà hàng buffet sáng mở cửa đến mấy giờ?' },
        { time: '10:15:06', speaker: 'robot', text: 'Dạ chào anh Sterling. Nhà hàng Buffet Sáng tại Tầng 2 phục vụ từ 06:00 đến 10:30 sáng hằng ngày.' },
        { time: '10:15:18', speaker: 'guest', text: 'Cho anh xin thêm 2 chai nước suối lên phòng 402 luôn nhé.' },
        { time: '10:15:23', speaker: 'robot', text: 'Dạ vâng. Em đã tạo yêu cầu gửi 2 chai nước suối tới phòng 402. Xe tự hành đang chuẩn bị di chuyển.' },
      ],
    },
    {
      id: 'SESS-9038',
      room: 'Suite 501',
      guestName: 'Ms. Elena Rostova',
      guestTier: 'Premium VIP',
      time: '09:30 AM - Hôm nay',
      duration: '2 phút 10 giây',
      rating: 5.0,
      feedback: 'Mang khăn tắm và đồ dùng phòng siêu nhanh, robot lịch sự.',
      interactionType: 'Voice & Touchscreen',
      robotUnit: 'HCRobot Unit 02',
      transcript: [
        { time: '09:30:10', speaker: 'guest', text: 'Robot ơi, phòng chị cần thêm khăn tắm với bộ bàn chải đánh răng.' },
        { time: '09:30:15', speaker: 'robot', text: 'Dạ vâng, em chào chị Elena. Em đã ghi nhận mang 2 bộ khăn tắm cao cấp và đồ dùng cá nhân lên Suite 501.' },
        { time: '09:30:28', speaker: 'guest', text: 'Cảm ơn em nhé.' },
        { time: '09:30:31', speaker: 'robot', text: 'Dạ chúc chị có một ngày nghỉ dưỡng tuyệt vời tại Aurora Hotel.' },
      ],
    },
    {
      id: 'SESS-9025',
      room: 'Room 310',
      guestName: 'Dr. Robert Chen',
      guestTier: 'Standard Member',
      time: '08:45 AM - Hôm nay',
      duration: '1 phút 15 giây',
      rating: 4.0,
      feedback: 'Robot trả lời ổn, tuy nhiên âm thanh nói hơi nhỏ khi đứng ngoài hành lang.',
      interactionType: 'Voice Assistant',
      robotUnit: 'HCRobot Unit 01',
      transcript: [
        { time: '08:45:00', speaker: 'guest', text: 'Tôi muốn đặt bữa sáng lên phòng.' },
        { time: '08:45:05', speaker: 'robot', text: 'Dạ vâng, anh Chen có thể chọn món trên màn hình cảm ứng hoặc bảo em gửi thực đơn F&B qua ứng dụng.' },
        { time: '08:45:15', speaker: 'guest', text: 'Gửi thực đơn cho tôi.' },
        { time: '08:45:18', speaker: 'robot', text: 'Dạ em đã gửi thực đơn điện tử tới ứng dụng phòng 310. Anh vui lòng kiểm tra.' },
      ],
    },
    {
      id: 'SESS-9012',
      room: 'Room 502',
      guestName: 'Mr. John Smith',
      guestTier: 'VIP Platinum',
      time: '07:50 AM - Hôm nay',
      duration: '3 phút 20 giây',
      rating: 3.0,
      feedback: 'Robot trả lời đúng lịch trình nhưng sự cố thảm bẩn cần nhân viên hỗ trợ.',
      interactionType: 'Escalated to Support',
      robotUnit: 'Bot Unit Alpha',
      transcript: [
        { time: '07:50:05', speaker: 'guest', text: 'Phòng tôi bị đổ rượu ra thảm, cần nhân viên qua xử lý gấp.' },
        { time: '07:50:11', speaker: 'robot', text: 'Dạ em rất tiếc về sự cố này. Em đang chuyển yêu cầu trực tiếp tới bộ phận Buồng phòng Housekeeping đến hỗ trợ anh Smith ngay.' },
        { time: '07:50:25', speaker: 'guest', text: 'Bao lâu thì nhân viên tới?' },
        { time: '07:50:30', speaker: 'robot', text: 'Dạ nhân viên trực ca Housekeeping sẽ có mặt tại phòng 502 trong vòng 5 phút.' },
      ],
    },
  ];

  const [conversations] = useState(sampleConversations);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const matchRating = (() => {
      if (ratingFilter === 'All') return true;
      if (ratingFilter === '5Star') return c.rating >= 5.0;
      if (ratingFilter === '4Star') return c.rating >= 4.0 && c.rating < 5.0;
      if (ratingFilter === 'NeedsImp') return c.rating < 4.0;
      return true;
    })();

    const matchSearch =
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.feedback.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.transcript.some((t) => t.text.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchRating && matchSearch;
  });

  // Calculate statistics
  const totalCalls = conversations.length;
  const avgRating = (
    conversations.reduce((acc, curr) => acc + curr.rating, 0) / totalCalls
  ).toFixed(1);
  const fiveStarCount = conversations.filter((c) => c.rating >= 5.0).length;
  const satisfactionRate = Math.round((fiveStarCount / totalCalls) * 100);

  // Pagination
  const paginatedConversations = filteredConversations.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-[#FCFAF7] font-sans select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[#1A1917]">
              Lịch Sử Đánh Giá & Trò Chuyện Khách - HCRobot
            </h2>
            <p className="text-[12px] text-[#78716C] mt-0.5">
              Theo dõi nhật ký đối thoại AI, phản hồi ý kiến và điểm đánh giá của khách hàng sau tương tác.
            </p>
          </div>

          <button
            onClick={() => onNotify('Đang xuất báo cáo lịch sử cuộc trò chuyện')}
            className="px-4 py-2 rounded-xl bg-white border border-[#E0DCD3] text-xs font-semibold text-[#1A1917] hover:bg-[#F4F3F0] transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5 text-[#78716C]" />
            <span>Xuất Báo Cáo Hội Thoại</span>
          </button>
        </div>

        {/* 4 Neutral Metric KPI Cards (Strict White & Gray) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-[#E8E5E0] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
              Tổng Số Hội Thoại
            </span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xl font-bold text-[#1A1917]">{totalCalls}</span>
              <span className="text-[10px] font-semibold text-[#666] bg-[#F4F3F0] px-2 py-0.5 rounded border border-[#E0DCD3]">
                Tích lũy
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E8E5E0] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
              Đánh Giá Trung Bình
            </span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xl font-bold text-[#1A1917]">{avgRating} / 5.0</span>
              <span className="text-[10px] font-semibold text-[#666] bg-[#F4F3F0] px-2 py-0.5 rounded border border-[#E0DCD3]">
                {fiveStarCount} lượt 5.0
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E8E5E0] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
              Tỷ Lệ Hài Lòng
            </span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xl font-bold text-[#1A1917]">{satisfactionRate}%</span>
              <span className="text-[10px] font-semibold text-[#666] bg-[#F4F3F0] px-2 py-0.5 rounded border border-[#E0DCD3]">
                Phản hồi tốt
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E8E5E0] space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">
              Robot Tương Tác
            </span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xl font-bold text-[#1A1917]">100%</span>
              <span className="text-[10px] font-semibold text-[#666] bg-[#F4F3F0] px-2 py-0.5 rounded border border-[#E0DCD3]">
                Sẵn sàng
              </span>
            </div>
          </div>
        </div>

        {/* Search & Select Dropdown Bar */}
        <div className="p-4 rounded-xl bg-white border border-[#E8E5E0] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo mã phiên, phòng, tên khách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-[#F4F3F0] border border-[#E0DCD3] text-xs font-medium text-[#1A1917] outline-none focus:border-[#78716C]"
            />
          </div>

          {/* Select Dropdown Filter (NO EMOJIS) */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-bold text-[#78716C] shrink-0">Lọc đánh giá:</label>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="w-full md:w-56 px-3.5 py-1.5 rounded-lg bg-[#F4F3F0] border border-[#E0DCD3] text-xs font-semibold text-[#1A1917] outline-none cursor-pointer focus:border-[#78716C]"
            >
              <option value="All">Tất cả đánh giá</option>
              <option value="5Star">Đánh giá 5.0 (Tuyệt vời)</option>
              <option value="4Star">Đánh giá 4.0 (Khá tốt)</option>
              <option value="NeedsImp">Cần cải thiện (&lt; 4.0)</option>
            </select>
          </div>

          <div className="text-xs font-bold text-[#78716C]">
            Hiển thị: <span className="text-[#1A1917] font-bold">{filteredConversations.length}</span> phiên
          </div>
        </div>

        {/* Conversation List Cards (White & Gray Theme) */}
        <div className="space-y-4">
          {paginatedConversations.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-[#E8E5E0] text-xs text-[#78716C]">
              Không tìm thấy cuộc trò chuyện nào phù hợp với tìm kiếm.
            </div>
          ) : (
            paginatedConversations.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-xl bg-white border border-[#E8E5E0] space-y-4"
              >
                {/* Banner Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0ECE6]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#1A1917]">{item.id}</span>
                    <span className="px-2.5 py-0.5 rounded bg-[#18181B] text-white text-[10px] font-bold">
                      {item.room}
                    </span>
                  </div>

                  {/* Rating Badge & Time */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] text-[#78716C]">{item.time}</span>
                    <span className="px-3 py-1 rounded bg-[#F4F3F0] text-[#1A1917] text-xs font-bold border border-[#E0DCD3]">
                      Đánh giá: {item.rating.toFixed(1)} / 5.0
                    </span>
                  </div>
                </div>

                {/* Feedback Comment */}
                {item.feedback && (
                  <div className="p-3 rounded-lg bg-[#F4F3F0] border border-[#E8E5E0] text-xs text-[#2B2825]">
                    <span className="font-bold text-[#1A1917]">Đánh giá từ khách hàng: </span>
                    <span className="italic">"{item.feedback}"</span>
                  </div>
                )}

                {/* Footer Action */}
                <div className="pt-2 flex items-center justify-between border-t border-[#F0ECE6] text-xs">
                  <span className="text-[#78716C]">
                    Thời lượng đàm thoại: <strong className="text-[#1A1917]">{item.duration}</strong>
                  </span>

                  <button
                    onClick={() => setSelectedConversation(item)}
                    className="px-4 py-1.5 rounded-lg bg-[#F4F3F0] hover:bg-[#EBE8E3] text-[#1A1917] border border-[#E0DCD3] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#78716C]" />
                    <span>Xem Chi Tiết Transcript</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        {filteredConversations.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredConversations.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            className="rounded-xl border border-[#E8E5E0] bg-white"
          />
        )}
      </div>

      {/* Modal: Full Conversation Transcript (Monochrome Gray/White Theme) */}
      {selectedConversation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white p-6 rounded-2xl border border-[#E8E5E0] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E5E0] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1A1917]">
                  Chi Tiết Cuộc Trò Chuyện {selectedConversation.id}
                </h3>
                <p className="text-[11px] text-[#78716C]">
                  {selectedConversation.room} • {selectedConversation.guestName}
                </p>
              </div>

              <button
                onClick={() => setSelectedConversation(null)}
                className="w-8 h-8 rounded-full bg-[#F4F3F0] text-[#78716C] hover:bg-[#EBE8E3] flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[#F4F3F0] border border-[#E8E5E0] flex items-center justify-between">
                <span className="font-bold text-[#1A1917]">
                  Điểm đánh giá: {selectedConversation.rating.toFixed(1)} / 5.0
                </span>
                <span className="text-[11px] text-[#666]">
                  {selectedConversation.interactionType}
                </span>
              </div>

              {selectedConversation.feedback && (
                <div className="p-3 rounded-lg bg-[#FAF8F5] border border-[#E8E5E0] text-[#2B2825]">
                  <span className="font-bold">Ý kiến đóng góp: </span>
                  <span className="italic">"{selectedConversation.feedback}"</span>
                </div>
              )}

              {/* Full Transcript */}
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar p-3 rounded-lg bg-[#F4F3F0] border border-[#E8E5E0]">
                {selectedConversation.transcript.map((line, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-white border border-[#E8E5E0] space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#78716C] font-mono">
                      <span className="font-bold text-[#1A1917]">
                        {line.speaker === 'robot' ? 'HCRobot' : selectedConversation.guestName}
                      </span>
                      <span>{line.time}</span>
                    </div>
                    <p className="text-[#1A1917] font-medium text-xs">"{line.text}"</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedConversation(null)}
                className="px-5 py-2 rounded-lg bg-[#18181B] hover:bg-black text-white text-xs font-bold transition-all cursor-pointer"
              >
                Đóng Cửa Sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

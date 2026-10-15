import { Move, Smile, Volume2, Monitor, Mic, Sliders, Send, Star } from 'lucide-react';

/**
 * Standard 8 Otto Step Types for Hotel Concierge Robot
 */
export const OTTO_STEP_TYPES = [
  {
    type: 'MOVE',
    label: '1. MOVE (Di chuyển vị trí)',
    desc: 'Robot di chuyển tự hành đến điểm mốc Waypoint hoặc tọa độ quy định',
    defaultParams: {
      from_waypoint: 'CURRENT',
      from_waypoint_name: 'Vị trí hiện tại của Robot',
      target_waypoint_id: 'FRONT_DESK',
      target_value: 'FRONT_DESK',
      waypoint_name: 'Trước Quầy Lễ Tân (Front Desk)',
      target_x: 5.2,
      target_y: 2.0,
      speed: 0.35,
      timeout_sec: 30,
    },
  },
  {
    type: 'GREET',
    label: '2. GREET (Chào hỏi & Biểu cảm)',
    desc: 'Chủ động chào khách bằng giọng nói, biểu cảm khuôn mặt mỉm cười & đèn LED',
    defaultParams: {
      greeting_text: 'Xin chào quý khách! Welcome to our hotel.',
      face_expression: 'HAPPY_SMILE',
      led_color: 'CYAN',
      enable_language_picker: true,
    },
  },
  {
    type: 'SPEAK',
    label: '3. SPEAK (Phát âm thanh / Đọc thông báo)',
    desc: 'Xuất phản hồi dạng giọng nói TTS qua loa thông báo hoặc hướng dẫn đường đi',
    defaultParams: {
      speech_text: 'Em là Robot Concierge. Em có thể giúp quý khách kiểm tra tiện ích và đặt dịch vụ.',
      voice_speed: 1.0,
      language: 'vi-VN',
    },
  },
  {
    type: 'SHOW',
    label: '4. SHOW (Hiển thị nội dung màn hình)',
    desc: 'Bật thực đơn dịch vụ, poster quảng cáo, hình ảnh nhà hàng, bản đồ tiện ích',
    defaultParams: {
      screen_mode: 'SERVICES_GRID',
      display_banner: 'Dịch vụ nghỉ dưỡng 5 sao & Ẩm thực thượng hạng',
      slide_duration_sec: 10,
    },
  },
  {
    type: 'LISTEN',
    label: '5. LISTEN (Lắng nghe & Ghi nhận)',
    desc: 'Chờ khách nói qua micro hoặc chạm nút chọn trên màn hình cảm ứng',
    defaultParams: {
      input_mode: 'VOICE_AND_TOUCH',
      timeout_sec: 15,
      prompt_hint: 'Quý khách vui lòng chạm màn hình hoặc nói yêu cầu...',
    },
  },
  {
    type: 'RECOMMEND',
    label: '6. RECOMMEND (Gợi ý thông minh)',
    desc: 'Xử lý logic tự động đề xuất món ăn, dịch vụ spa hoặc điểm tham quan',
    defaultParams: {
      recommend_category: 'DINING_AND_SPA',
      ai_suggestion: true,
      highlight_item: 'Set Trà Chiều & Dịch Vụ Spa Tầng 3',
    },
  },
  {
    type: 'CREATE_REQUEST',
    label: '7. CREATE_REQUEST (Khởi tạo yêu cầu dịch vụ)',
    desc: 'Đóng gói phiếu dịch vụ gửi tới bộ phận buồng phòng, gọi taxi, gọi nhân viên',
    defaultParams: {
      target_department: 'Housekeeping',
      fallback_staff: true,
    },
  },
  {
    type: 'FEEDBACK',
    label: '8. FEEDBACK (Thu thập đánh giá)',
    desc: 'Hiện màn hình chấm điểm 1 - 5 sao để đo lường mức độ hài lòng của khách',
    defaultParams: {
      survey_type: '5_STAR_RATING',
      question_text: 'Quý khách có hài lòng với sự phục vụ của Robot không?',
      thank_you_message: 'Cảm ơn quý khách đã đánh giá! Chúc quý khách kỳ nghỉ vui vẻ.',
    },
  },
];

/**
 * Clean Neutral Palette Definitions for Otto Steps (Minimalist Slate / Stone)
 */
export const STEP_SCRATCH_THEMES = {
  MOVE: { label: 'Motion', bg: '#ffffff', border: '#cbd5e1', accent: '#334155', icon: Move },
  GREET: { label: 'Looks', bg: '#ffffff', border: '#cbd5e1', accent: '#475569', icon: Smile },
  SPEAK: { label: 'Voice', bg: '#ffffff', border: '#cbd5e1', accent: '#475569', icon: Volume2 },
  SHOW: { label: 'Display', bg: '#ffffff', border: '#cbd5e1', accent: '#334155', icon: Monitor },
  LISTEN: { label: 'Sensing', bg: '#ffffff', border: '#cbd5e1', accent: '#475569', icon: Mic },
  RECOMMEND: { label: 'Logic', bg: '#ffffff', border: '#cbd5e1', accent: '#334155', icon: Sliders },
  CREATE_REQUEST: { label: 'Dispatch', bg: '#ffffff', border: '#cbd5e1', accent: '#475569', icon: Send },
  FEEDBACK: { label: 'Feedback', bg: '#ffffff', border: '#cbd5e1', accent: '#334155', icon: Star },
};

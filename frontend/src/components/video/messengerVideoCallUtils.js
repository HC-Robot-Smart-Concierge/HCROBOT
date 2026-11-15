export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:relay.metered.ca:80' },
    {
      urls: 'turn:relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:relay.metered.ca:80?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

export function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Thời gian chờ im lặng chuẩn theo mô hình đàm thoại Voice AI (Conversational Turn-taking)
// - 1.000ms (1.0s) là chuẩn vàng trong Voice Bot (Google Assistant, Retell, Vapi):
//   + Đủ hấp thu khoảng ngắt nghỉ tự nhiên (~700ms - 800ms) giữa các vế câu mà không cướp lời.
//   + Khi người nói dừng lời, chốt câu dứt khoát sau 1.0s, không bị trễ và không cộng dồn các lượt nói riêng biệt.
export const STAFF_CONVERSATIONAL_SILENCE_MS = 1000;

// 1. Tạo Canvas Stream giả lập trong trường hợp máy tính KHÔNG CÓ WEBCAM (Tương thích iOS Safari)
export const createFakeVideoStream = (label = 'Khách hàng') => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (!ctx) return;
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#2d2d2d';
      ctx.beginPath();
      ctx.arc(320, 240, 90, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#444444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#f4f4f5';
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, 320, 247);
    };

    draw();
    let stream;
    if (typeof canvas.captureStream === 'function') {
      stream = canvas.captureStream(5);
      stream._canvasInterval = setInterval(draw, 500);
    } else if (typeof canvas.webkitCaptureStream === 'function') {
      stream = canvas.webkitCaptureStream(5);
      stream._canvasInterval = setInterval(draw, 500);
    } else {
      stream = new MediaStream();
    }
    return stream;
  };


export const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };


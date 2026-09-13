import { useEffect, useRef, useCallback } from 'react';

/**
 * Phát âm thanh chuông "Ting ting" thanh nhã khi có thông báo mới từ Robot AI.
 * Sử dụng Web Audio API chuẩn (zero external dependency, 0ms latency).
 */
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Nốt 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Nốt 2: A5 (880.00 Hz) tạo âm Ting thanh thoát
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, ctx.currentTime + 0.1);
    gain2.gain.setValueAtTime(0.18, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (err) {
    // Trình duyệt có thể chặn audio nếu chưa có user gesture, bỏ qua an toàn
  }
}

/**
 * Custom Hook quản lý kết nối WebSocket Realtime Notification Hub.
 *
 * @param {Object} options
 * @param {string} options.department - Tên phòng ban cần lắng nghe (vd: 'Housekeeping', 'F&B', 'All')
 * @param {Function} options.onNotificationReceived - Callback nhận object thông báo mới
 * @param {boolean} options.enabled - Bật/tắt kết nối (vd: khi user đã login)
 */
export function useNotificationWebSocket({
  department = 'All',
  onNotificationReceived,
  enabled = true,
}) {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const onNotificationReceivedRef = useRef(onNotificationReceived);

  // Giữ callback mới nhất mà không trigger re-connect
  useEffect(() => {
    onNotificationReceivedRef.current = onNotificationReceived;
  }, [onNotificationReceived]);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Xác định URL WebSocket tương thích môi trường Dev (Vite proxy) và Production
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const deptParam = encodeURIComponent(department || 'All');
    const wsUrl = `${protocol}//${host}/api/v1/operations/ws/notifications?department=${deptParam}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log(`🔔 [NotificationWS] Connected to Hub for dept: '${department}'`);
        // Bắt đầu heartbeat ping mỗi 25s để giữ kết nối qua router/firewall
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;

          const payload = JSON.parse(event.data);
          if (payload.type === 'NEW_NOTIFICATION' && payload.data) {
            console.log('⚡ [NotificationWS] Incoming real-time notification:', payload.data);
            playNotificationChime();
            if (onNotificationReceivedRef.current) {
              onNotificationReceivedRef.current(payload.data);
            }
          }
        } catch (err) {
          console.warn('[NotificationWS] Error parsing payload:', err);
        }
      };

      ws.onclose = () => {
        console.log(`⚠️ [NotificationWS] Closed. Reconnecting in 3s... (dept: ${department})`);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Tự động kết nối lại sau 3 giây
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn('[NotificationWS] Socket error encountered:', err);
        ws.close();
      };
    } catch (err) {
      console.warn('[NotificationWS] Init connection error:', err);
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, [department, enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null; // Tránh gọi reconnect khi unmount
        socketRef.current.close();
      }
    };
  }, [connect]);
}

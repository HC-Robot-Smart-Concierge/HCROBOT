/**
 * Pipecat Audio Streaming & Realtime Barge-In WebSocket Service Client.
 */

class PipecatAudioClient {
  constructor() {
    this.socket = null;
    this.sessionId = 'pipecat_kiosk';
    this.audioRef = null;
    this.isConnected = false;
    this.onAudioStreamCallback = null;
    this.onInterruptedCallback = null;
  }

  connect(sessionId = 'pipecat_kiosk', callbacks = {}) {
    this.sessionId = sessionId;
    this.onAudioStreamCallback = callbacks.onAudioStream || null;
    this.onInterruptedCallback = callbacks.onInterrupted || null;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ai/ws/pipecat?session_id=${encodeURIComponent(sessionId)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        console.log(`[PipecatClient] Connected to Pipecat WebSocket stream (${wsUrl})`);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.event === 'interrupted') {
            console.log('[PipecatClient] Interruption acknowledged by server (Barge-In)');
            if (this.audioRef) {
              this.audioRef.pause();
              this.audioRef = null;
            }
            if (this.onInterruptedCallback) this.onInterruptedCallback(data);
          } else if (data.event === 'audio_stream') {
            if (this.onAudioStreamCallback) this.onAudioStreamCallback(data.payload);
          }
        } catch (e) {
          console.warn('[PipecatClient] Error parsing WebSocket message:', e);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[PipecatClient] WebSocket Error:', err);
        this.isConnected = false;
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        console.log('[PipecatClient] WebSocket closed');
      };
    } catch (err) {
      console.warn('[PipecatClient] Failed to initialize WebSocket connection:', err);
    }
  }

  sendBargeIn() {
    if (this.audioRef) {
      try {
        this.audioRef.pause();
        this.audioRef.currentTime = 0;
      } catch (e) {}
      this.audioRef = null;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ event: 'barge_in', session_id: this.sessionId }));
    }
  }

  sendSpeech(text, roomNumber = null) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          event: 'speech',
          session_id: this.sessionId,
          text,
          room_number: roomNumber,
        })
      );
    }
  }

  disconnect() {
    this.sendBargeIn();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }
}

export const pipecatAudioClient = new PipecatAudioClient();

/**
 * Pipecat Audio Streaming & Realtime Barge-In WebSocket Service Client.
 * Hỗ trợ 2 chế độ:
 * - Legacy: sendSpeech() → nhận JSON + Base64 audio
 * - Streaming: sendSpeechStream() → nhận text_chunk JSON + Binary audio chunks tức thì
 */

class PipecatAudioClient {
  constructor() {
    this.socket = null;
    this.sessionId = 'pipecat_kiosk';
    this.audioRef = null;
    this.isConnected = false;
    this.onAudioStreamCallback = null;
    this.onInterruptedCallback = null;
    this.onTextChunkCallback = null;
    this.onStreamDoneCallback = null;
    this.onErrorCallback = null;

    // Audio Queue cho Streaming Pipeline
    this._audioContext = null;
    this._audioQueue = [];
    this._isPlaying = false;
  }

  connect(sessionId = 'pipecat_kiosk', callbacks = {}) {
    this.sessionId = sessionId;
    this.onAudioStreamCallback = callbacks.onAudioStream || null;
    this.onInterruptedCallback = callbacks.onInterrupted || null;
    this.onTextChunkCallback = callbacks.onTextChunk || null;
    this.onStreamDoneCallback = callbacks.onStreamDone || null;
    this.onErrorCallback = callbacks.onError || null;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ai/ws/pipecat?session_id=${encodeURIComponent(sessionId)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        console.log(`[PipecatClient] Connected to Pipecat WebSocket stream (${wsUrl})`);
      };

      this.socket.onmessage = async (event) => {
        try {
          if (event.data instanceof Blob) {
            // Binary Frame → Audio chunk từ Streaming Pipeline
            const arrayBuffer = await event.data.arrayBuffer();
            if (arrayBuffer.byteLength > 0) {
              this._enqueueAudioChunk(arrayBuffer);
            }
            return;
          }

          const data = JSON.parse(event.data);

          if (data.event === 'interrupted') {
            this._stopAudioQueue();
            if (this.audioRef) {
              this.audioRef.pause();
              this.audioRef = null;
            }
            if (this.onInterruptedCallback) this.onInterruptedCallback(data);
          } else if (data.event === 'audio_stream') {
            // Legacy mode
            if (this.onAudioStreamCallback) this.onAudioStreamCallback(data.payload);
          } else if (data.event === 'text' || data.event === 'text_chunk') {
            if (this.onTextChunkCallback) this.onTextChunkCallback(data);
          } else if (data.event === 'stream_done') {
            if (this.onStreamDoneCallback) this.onStreamDoneCallback(data);
          } else if (data.event === 'error') {
            console.warn('[PipecatClient] Server error:', data.message);
            if (this.onErrorCallback) this.onErrorCallback(data);
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
    this._stopAudioQueue();

    if (this.audioRef) {
      try {
        this.audioRef.pause();
        this.audioRef.currentTime = 0;
      } catch (e) { /* no-op */ }
      this.audioRef = null;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ event: 'barge_in', session_id: this.sessionId }));
    }
  }

  /**
   * Legacy mode: gửi text, nhận JSON + Base64 audio (blocking full response)
   */
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

  /**
   * Streaming mode: gửi text, nhận text_chunk JSON + Binary audio chunks tức thì
   * TTFA (Time-to-First-Audio) < 1 giây
   */
  sendSpeechStream(text, roomNumber = null, language = 'auto') {
    this._stopAudioQueue();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          event: 'speech_stream',
          session_id: this.sessionId,
          text,
          room_number: roomNumber,
          language,
        })
      );
    }
  }

  // =====================================================
  // Audio Queue Manager — Phát nối tiếp các audio chunks
  // =====================================================

  _getAudioContext() {
    if (!this._audioContext || this._audioContext.state === 'closed') {
      try {
        this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('[PipecatClient] AudioContext not supported:', e);
        return null;
      }
    }
    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume();
    }
    return this._audioContext;
  }

  _enqueueAudioChunk(arrayBuffer) {
    this._audioQueue.push(arrayBuffer);
    if (!this._isPlaying) {
      this._playNextChunk();
    }
  }

  async _playNextChunk() {
    const ctx = this._getAudioContext();
    if (!ctx || this._audioQueue.length === 0) {
      this._isPlaying = false;
      return;
    }

    this._isPlaying = true;
    const buffer = this._audioQueue.shift();

    try {
      const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        this._playNextChunk();
      };
      source.start(0);
    } catch (e) {
      // MP3 decodeAudioData có thể fail trên 1 số browser cũ
      // Fallback: dùng Audio element
      try {
        const blob = new Blob([buffer], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          this._playNextChunk();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          this._playNextChunk();
        };
        await audio.play();
      } catch (fallbackErr) {
        console.warn('[PipecatClient] Audio playback fallback failed:', fallbackErr);
        this._playNextChunk();
      }
    }
  }

  _stopAudioQueue() {
    this._audioQueue = [];
    this._isPlaying = false;
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

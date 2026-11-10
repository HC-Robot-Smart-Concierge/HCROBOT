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
    this.onAudioStartedCallback = null;
    this.onAudioEndedCallback = null;
    this.onSTTInterimEchoCallback = null;
    this.onSTTProcessingCallback = null;
    this.onErrorCallback = null;

    // Audio Queue cho Streaming Pipeline
    this._audioContext = null;
    this._audioQueue = [];
    this._isPlaying = false;
    this._audioChunksInCurrentStream = 0;
    this._isStreamDone = true;
    this._currentSource = null;
    this._streamEpoch = 0;
    this._messagePromise = Promise.resolve();
  }

  prime() {
    try {
      const ctx = this._getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        // Unlock iOS / Android mobile browser Web Audio pipeline
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch (e) {}
  }

  updateCallbacks(callbacks = {}) {
    if (callbacks.onAudioStream !== undefined) this.onAudioStreamCallback = callbacks.onAudioStream;
    if (callbacks.onInterrupted !== undefined) this.onInterruptedCallback = callbacks.onInterrupted;
    if (callbacks.onToken !== undefined) this.onTokenCallback = callbacks.onToken;
    if (callbacks.onTextChunk !== undefined) this.onTextChunkCallback = callbacks.onTextChunk;
    if (callbacks.onStreamDone !== undefined) this.onStreamDoneCallback = callbacks.onStreamDone;
    if (callbacks.onAudioStarted !== undefined) this.onAudioStartedCallback = callbacks.onAudioStarted;
    if (callbacks.onAudioEnded !== undefined) this.onAudioEndedCallback = callbacks.onAudioEnded;
    if (callbacks.onSTTInterimEcho !== undefined) this.onSTTInterimEchoCallback = callbacks.onSTTInterimEcho;
    if (callbacks.onSTTProcessing !== undefined) this.onSTTProcessingCallback = callbacks.onSTTProcessing;
    if (callbacks.onError !== undefined) this.onErrorCallback = callbacks.onError;
    this._savedCallbacks = { ...(this._savedCallbacks || {}), ...callbacks };
  }

  connect(sessionId = 'pipecat_kiosk', callbacks = {}) {
    this.sessionId = sessionId;
    this.updateCallbacks(callbacks);
    this._manuallyClosed = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ai/ws/pipecat?session_id=${encodeURIComponent(sessionId)}`;

    try {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        return; // Already connected
      }

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        console.log(`[PipecatClient] Connected to Pipecat WebSocket stream (${wsUrl})`);
      };

      this.socket.onmessage = (event) => {
        try {
          if (event.data instanceof Blob) {
            // Binary Frame → Audio chunk từ Streaming Pipeline (xử lý tuần tự blob)
            const currentEpoch = this._streamEpoch;
            this._messagePromise = this._messagePromise.then(async () => {
              if (this._streamEpoch !== currentEpoch) return;
              try {
                const arrayBuffer = await event.data.arrayBuffer();
                if (this._streamEpoch !== currentEpoch) return;
                if (arrayBuffer.byteLength > 0) {
                  this._audioChunksInCurrentStream += 1;
                  this._enqueueAudioChunk(arrayBuffer);
                }
              } catch (e) {
                console.warn('[PipecatClient] Error reading audio blob:', e);
              }
            });
            return;
          }

          // JSON Control Frame: Xử lý ngay lập tức, không bị chặn bởi các blob đang đọc
          const data = JSON.parse(event.data);

          if (data.event === 'interrupted') {
            this._streamEpoch += 1;
            this._stopAudioQueue();
            if (this.audioRef) {
              this.audioRef.pause();
              this.audioRef = null;
            }
            if (this.onInterruptedCallback) this.onInterruptedCallback(data);
          } else if (data.event === 'token') {
            if (this.onTokenCallback) this.onTokenCallback(data.token);
          } else if (data.event === 'stt_interim_echo') {
            if (this.onSTTInterimEchoCallback) this.onSTTInterimEchoCallback(data.text);
          } else if (data.event === 'stt_processing') {
            this._streamEpoch += 1;
            this._audioChunksInCurrentStream = 0;
            this._isStreamDone = false;
            if (this.onSTTProcessingCallback) this.onSTTProcessingCallback(data.text);
          } else if (data.event === 'audio_stream') {
            // Legacy mode
            if (this.onAudioStreamCallback) this.onAudioStreamCallback(data.payload);
          } else if (data.event === 'text' || data.event === 'text_chunk') {
            if (this.onTextChunkCallback) this.onTextChunkCallback(data);
          } else if (data.event === 'stream_done') {
            const currentEpoch = this._streamEpoch;
            this._messagePromise = this._messagePromise.then(() => {
              if (this._streamEpoch !== currentEpoch) return;
              this._isStreamDone = true;
              data.audioChunksCount = this._audioChunksInCurrentStream;
              if (this.onStreamDoneCallback) this.onStreamDoneCallback(data);
              if (!this._isPlaying && this._audioQueue.length === 0) {
                if (this.onAudioEndedCallback) this.onAudioEndedCallback();
              } else {
                clearTimeout(this._streamPlaybackSafetyTimer);
                this._streamPlaybackSafetyTimer = setTimeout(() => {
                  if (this._isPlaying) {
                    console.warn('[PipecatClient] Stream playback safety timer expired, forcing audio end');
                    this._stopAudioQueue();
                    if (this.onAudioEndedCallback) this.onAudioEndedCallback();
                  }
                }, 20000);
              }
            });
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
        if (!this._manuallyClosed) {
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = setTimeout(() => {
            console.log('[PipecatClient] Reconnecting to WebSocket...');
            this.connect(this.sessionId, this._savedCallbacks || {});
          }, 2000);
        }
      };
    } catch (err) {
      console.warn('[PipecatClient] Failed to initialize WebSocket connection:', err);
    }
  }

  sendBargeIn() {
    this._streamEpoch += 1;
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
   * STT Streaming: gửi interim transcript lên server để buffer và reset VAD timer
   */
  sendSTTInterim(text, roomNumber = null, language = 'auto') {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          event: 'stt_interim',
          session_id: this.sessionId,
          text,
          room_number: roomNumber,
          language,
        })
      );
    }
  }

  /**
   * STT Final: gửi final transcript để server hủy VAD timer và trigger AI pipeline ngay
   */
  sendSTTFinal(text, roomNumber = null, language = 'auto') {
    this._stopAudioQueue();
    this._audioChunksInCurrentStream = 0;

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          event: 'stt_final',
          session_id: this.sessionId,
          text,
          room_number: roomNumber,
          language,
        })
      );
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
    this._audioChunksInCurrentStream = 0;
    this._isStreamDone = false;

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
      return true;
    } else {
      console.warn('[PipecatClient] Cannot send speech_stream: WebSocket is not open! State:', this.socket?.readyState);
      if (this.onErrorCallback) {
        this.onErrorCallback({ message: 'WebSocket is not connected' });
      }
      return false;
    }
  }

  isPlaying() {
    return this._isPlaying;
  }

  hasReceivedAudioInCurrentStream() {
    return this._audioChunksInCurrentStream > 0 || this._isPlaying || this._audioQueue.length > 0;
  }

  getAudioQueueLength() {
    return this._audioQueue.length;
  }

  // =====================================================
  // Audio Queue Manager — Phát nối tiếp các audio chunks
  // =====================================================

  _getAudioContext() {
    if (!this._audioContext || this._audioContext.state === 'closed') {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this._audioContext = new AudioCtx();
        }
      } catch (e) {
        console.warn('[PipecatClient] AudioContext not supported:', e);
        return null;
      }
    }
    if (this._audioContext && this._audioContext.state === 'suspended') {
      this._audioContext.resume().catch(() => {});
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
      const wasPlaying = this._isPlaying;
      this._isPlaying = false;
      if (wasPlaying && this._isStreamDone && this.onAudioEndedCallback) {
        this.onAudioEndedCallback();
      }
      return;
    }

    if (!this._isPlaying && this.onAudioStartedCallback) {
      this.onAudioStartedCallback();
    }
    this._isPlaying = true;
    const buffer = this._audioQueue.shift();

    let chunkTimer = null;
    let chunkEnded = false;
    const advanceNext = () => {
      if (chunkEnded) return;
      chunkEnded = true;
      if (chunkTimer) {
        clearTimeout(chunkTimer);
        chunkTimer = null;
      }
      if (this._currentSource) {
        this._currentSource = null;
      }
      if (this.audioRef) {
        try { this.audioRef.pause(); } catch (e) {}
        this.audioRef = null;
      }
      this._playNextChunk();
    };

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      this._currentSource = source;
      source.onended = advanceNext;
      source.start(0);

      // Duration safety timeout: chỉ can thiệp nếu audio bị treo cứng không bắn onended (dự phòng thêm 3s)
      const durationMs = Math.max(3500, ((audioBuffer.duration || 4) + 3.0) * 1000);
      chunkTimer = setTimeout(() => {
        if (!chunkEnded && this._currentSource === source) {
          advanceNext();
        }
      }, durationMs);

    } catch (e) {
      // Fallback: dùng HTML Audio element
      try {
        const blob = new Blob([buffer], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        this.audioRef = audio;
        
        const onFallbackEnded = () => {
          URL.revokeObjectURL(url);
          advanceNext();
        };

        audio.onended = onFallbackEnded;
        audio.onerror = onFallbackEnded;

        // Kích hoạt phát âm thanh fallback và bắt lỗi chặn autoplay trên mobile
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((playErr) => {
            console.warn('[PipecatClient] Audio play() blocked on mobile:', playErr);
            setTimeout(onFallbackEnded, 1500);
          });
        }
      } catch (fallbackErr) {
        console.warn('[PipecatClient] Audio playback fallback failed on mobile:', fallbackErr);
        setTimeout(advanceNext, 1200);
      }
    }
  }

  _stopAudioQueue() {
    clearTimeout(this._streamPlaybackSafetyTimer);
    this._audioQueue = [];
    this._isPlaying = false;
    this._isStreamDone = true;
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch (e) {}
      this._currentSource = null;
    }
    if (this.audioRef) {
      try {
        this.audioRef.pause();
        this.audioRef.currentTime = 0;
      } catch (e) {}
      this.audioRef = null;
    }
  }

  disconnect() {
    this._manuallyClosed = true;
    clearTimeout(this._reconnectTimer);
    this.sendBargeIn();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }
}

export const pipecatAudioClient = new PipecatAudioClient();

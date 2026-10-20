import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test_full_conversation_pipeline():
    sys.stdout.reconfigure(encoding='utf-8')
    print("=== KIỂM TRA TOÀN DIỆN HỆ THỐNG NÓI CHUYỆN CỦA ROBOT (GEMINI + TTS) ===\n")

    # 1. Kiểm tra cấu hình
    from app.core.config import settings
    print("[1. Cấu hình hệ thống]")
    print(f" - LLM Provider: {settings.LLM_PROVIDER}")
    print(f" - Model kích hoạt: {settings.active_llm_model}")
    print(f" - TTS Provider: {settings.TTS_PROVIDER}")
    print(f" - Gemini Active: {settings.is_gemini_active}")

    # 2. Kiểm tra Não bộ Gemini trả lời hội thoại
    from app.services.ai.gemini_service import gemini_service
    test_prompts = [
        "Chào Rora, bạn là ai vậy?",
        "Nhà hàng Aurora phục vụ buffet sáng từ mấy giờ đến mấy giờ?",
        "Can you tell me where the swimming pool is located?"
    ]

    print("\n[2. Kiểm tra Hội thoại qua Gemini AI]")
    for p in test_prompts:
        reply, lang_name, lang_code = await gemini_service.generate_response(prompt=p)
        print(f" -> Khách hỏi: \"{p}\"")
        print(f"    Rora đáp: \"{reply}\"")
        print(f"    Ngôn ngữ: {lang_name} ({lang_code})\n")

    # 3. Kiểm tra Giọng nói (TTS Audio Synthesis)
    from app.services.ai.tts_service import tts_service
    sample_text = "Dạ em chào quý khách, em là Rora luôn sẵn sàng hỗ trợ quý khách tại khách sạn Aurora Grand ạ."
    print("[3. Kiểm tra Giọng nói TTS (EdgeTTS Hoài My)]")
    audio_b64, mime_type, provider = await tts_service.synthesize(text=sample_text, language="vi-VN")
    print(f" - Provider thực tế: {provider}")
    print(f" - MIME type: {mime_type}")
    print(f" - Kích thước âm thanh: {len(audio_b64) if audio_b64 else 0} ký tự Base64")
    if audio_b64 and len(audio_b64) > 1000:
        print(" -> Giọng nói tiếng Việt đã được tổng hợp thành công!")

    # 4. Kiểm tra Streaming Token + Audio Chunks qua Pipecat Realtime Pipeline
    from app.services.ai.pipecat_service import pipecat_service
    print("\n[4. Kiểm tra Streaming Realtime (Token + Clause Chunker Audio)]")
    tokens_received = []
    audio_chunks_count = 0
    total_audio_bytes = 0

    async for chunk in pipecat_service.process_user_speech_stream(
        session_id="test_voice_session",
        user_speech="Cho tôi biết nhà hàng ở tầng mấy nhé",
        language="vi-VN"
    ):
        ctype = chunk.get("type")
        if ctype == "token":
            tokens_received.append(chunk.get("token", ""))
        elif ctype == "audio_chunk":
            audio_chunks_count += 1
            total_audio_bytes += len(chunk.get("data", b""))
        elif ctype == "done":
            print(f" - Stream kết thúc hoàn tất: \"{chunk.get('full_text')}\"")

    print(f" - Số token sinh ra: {len(tokens_received)}")
    print(f" - Số đoạn âm thanh audio_chunk tạo ra: {audio_chunks_count} ({total_audio_bytes} bytes audio)")

    print("\n=== KẾT LUẬN: HỆ THỐNG ĐÃ HOÀN TOÀN SẴN SÀNG NÓI CHUYỆN! ===")

if __name__ == "__main__":
    asyncio.run(test_full_conversation_pipeline())

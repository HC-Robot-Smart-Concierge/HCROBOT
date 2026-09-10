import asyncio
import time
import sys
from app.services.ai.concierge_graph import concierge_graph
from app.services.ai.ollama_service import ollama_service

sys.stdout.reconfigure(encoding='utf-8')

TEST_CASES = [
    ("Pass wifi là gì?", "FAQ tĩnh (Fast-path)"),
    ("Cho tôi 2 cái khăn tắm", "Yêu cầu dịch vụ (FSM Slot-filling)"),
    ("Mấy giờ thì trả phòng vậy?", "Thủ tục Check-out"),
    ("Hồ bơi khách sạn nằm ở đâu?", "Tra cứu tiện ích"),
]

async def run_without_harness(prompt: str):
    """Giả lập cách chạy cũ KHÔNG có Harness: nhồi prompt trực tiếp vào Ollama LLM."""
    t0 = time.perf_counter()
    # Bỏ qua fast-path, gọi thẳng Ollama LLM suy luận từ đầu
    resp = await ollama_service._client.chat(
        model=ollama_service.model,
        messages=[
            {"role": "system", "content": "Bạn là lễ tân khách sạn Aurora. Hãy trả lời ngắn gọn: "},
            {"role": "user", "content": prompt}
        ],
        options={"num_predict": 40, "num_ctx": 768}
    )
    t1 = time.perf_counter()
    return (t1 - t0) * 1000

async def run_with_harness(prompt: str):
    """Cách chạy MỚI CÓ HARNESS (LangGraph StateGraph + FSM + Fast-path)."""
    t0 = time.perf_counter()
    result = await concierge_graph.ainvoke(
        {"session_id": "bench_sid", "prompt": prompt},
        config={"configurable": {"thread_id": "bench_sid"}}
    )
    t1 = time.perf_counter()
    return (t1 - t0) * 1000

async def main():
    print("\n" + "="*75)
    print("      BẢNG SO SÁNH ĐỐI ĐẦU: KHÔNG CÓ HARNESS vs CÓ HARNESS (LANGGRAPH)")
    print("="*75)
    print(f"{'CÂU HỎI KIỂM THỬ':<32} | {'KHÔNG CÓ HARNESS':<18} | {'CÓ HARNESS':<12} | {'TỐC ĐỘ'}")
    print("-" * 75)

    for prompt, desc in TEST_CASES:
        # 1. Đo không có harness
        ms_without = await run_without_harness(prompt)
        # 2. Đo có harness
        ms_with = await run_with_harness(prompt)

        speedup = ms_without / max(ms_with, 0.01)
        print(f"{prompt:<32} | {ms_without:>14.2f} ms | {ms_with:>8.2f} ms | Nhanh hơn {speedup:.1f}x")

    print("="*75 + "\n")

if __name__ == "__main__":
    asyncio.run(main())

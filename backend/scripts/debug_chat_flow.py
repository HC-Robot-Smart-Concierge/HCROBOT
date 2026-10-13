import asyncio
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')

from app.services.ai.concierge_graph import concierge_graph
from app.services.ai.tts_service import tts_service

async def test():
    print("Testing prompt: 'Xin chào'")
    t0 = time.time()
    state = {'session_id': 'test_debug', 'prompt': 'Xin chào', 'language': 'Tiếng Việt', 'chat_history': []}
    res = await concierge_graph.ainvoke(state, config={'configurable': {'thread_id': 'test_debug'}})
    reply = res.get("response", "")
    print(f"Graph time: {time.time()-t0:.2f}s | Reply: {reply}")

    t1 = time.time()
    a_b64, mime, _ = await tts_service.synthesize(reply, provider='edge', language='vi-VN')
    print(f"TTS time: {time.time()-t1:.2f}s | Audio len: {len(a_b64) if a_b64 else 0}")

if __name__ == "__main__":
    asyncio.run(test())

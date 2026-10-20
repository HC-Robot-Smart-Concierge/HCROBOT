import asyncio
import sys
import os
import json
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings

async def main():
    sys.stdout.reconfigure(encoding='utf-8')
    key = settings.GEMINI_API_KEY
    model = settings.GEMINI_MODEL
    
    print(f"Testing Gemini Streaming with model: {model}")
    stream_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": "Chào Rora, hãy nói 1 câu chào khách ngắn gọn."}]}]
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", stream_url, json=payload, headers={"Content-Type": "application/json"}) as resp:
                print(f"Stream HTTP Status: {resp.status_code}")
                full_text = ""
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        raw = line[6:].strip()
                        if raw and raw != "[DONE]":
                            data = json.loads(raw)
                            for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []):
                                token = part.get("text", "")
                                full_text += token
                                sys.stdout.write(token)
                                sys.stdout.flush()
                print("\nFull Text Received:", full_text)
    except Exception as e:
        print("\nSTREAM EXCEPTION:", repr(e))

if __name__ == "__main__":
    asyncio.run(main())

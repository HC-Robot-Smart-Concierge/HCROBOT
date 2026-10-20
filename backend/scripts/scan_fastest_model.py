import asyncio
import sys
import os
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings

candidates = [
    ("v1beta", "gemini-3.5-flash-lite"),
    ("v1beta", "gemini-flash-latest"),
    ("v1beta", "gemini-3.1-flash-lite"),
    ("v1beta", "gemini-2.5-flash"),
    ("v1beta", "gemini-3.8-flash"),
    ("v1beta", "gemma-4-26b-a4b-it"),
    ("v1", "gemini-2.5-flash"),
    ("v1", "gemini-1.5-flash"),
]

async def check():
    sys.stdout.reconfigure(encoding='utf-8')
    key = settings.GEMINI_API_KEY
    payload = {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}

    for ver, mod in candidates:
        url = f"https://generativelanguage.googleapis.com/{ver}/models/{mod}:generateContent?key={key}"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                print(f"[{ver}] {mod}: HTTP {r.status_code}")
                if r.status_code == 200:
                    ans = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                    print(f"   -> Thành công! Phản hồi: {ans.strip()[:60]}")
                    return ver, mod
                else:
                    print(f"   -> Lỗi {r.status_code}: {r.text[:80]}")
        except Exception as e:
            print(f"[{ver}] {mod}: Exception {type(e).__name__}")
    return None

if __name__ == "__main__":
    asyncio.run(check())

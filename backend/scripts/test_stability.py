import asyncio
import sys
import os
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings

models_to_test = [
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemma-4-26b-a4b-it"
]

async def test_all():
    sys.stdout.reconfigure(encoding='utf-8')
    key = settings.GEMINI_API_KEY
    payload = {"contents": [{"role": "user", "parts": [{"text": "1+1=?"}]}]}

    print(f"Kiểm tra tính ổn định của {len(models_to_test)} models...")
    for m in models_to_test:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={key}"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if r.status_code == 200:
                    ans = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    print(f" -> [200 OK] {m:30} : {ans[:20]}")
                else:
                    print(f" -> [{r.status_code}] {m:30} : {r.text[:60]}")
        except Exception as e:
            print(f" -> [ERR] {m:30} : {type(e).__name__}")

if __name__ == "__main__":
    asyncio.run(test_all())

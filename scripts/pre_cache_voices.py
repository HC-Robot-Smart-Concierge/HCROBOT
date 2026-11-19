import asyncio
import os
import sys

# Đảm bảo đường dẫn import tới backend
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, os.path.join(project_root, "backend"))

from app.core.database import AsyncSessionLocal
from app.services.ai.scenario_service import scenario_service
from app.services.ai.tts_service import tts_service


async def main():
    print("=" * 65)
    print("HC-ROBOT: DONG BO TOAN BO GIONG NOI OFFLINE VAO FOLDER BACKEND")
    print("Thư mục lưu trữ: backend/static/audio_cache")
    print("=" * 65)

    async with AsyncSessionLocal() as db:
        items = await scenario_service.list_scenarios(db=db)
        total = len(items)
        print(f"\nTim thay tong cong {total} kich ban trong Database.\n")

        newly_created = 0
        already_cached = 0
        failed = 0

        for idx, sc in enumerate(items, 1):
            title = sc.title or sc.id
            vi_text = sc.response_vi or ""
            en_text = sc.response_en or ""

            # 1. Kiem tra va sinh giong Tieng Viet
            vi_info = tts_service.get_audio_cache_info(vi_text, language="vi-VN")
            if vi_info["exists"]:
                vi_status = "DA CO (Cache Hit)"
                already_cached += 1
            else:
                try:
                    await tts_service.pre_generate_audio_file(vi_text, language="vi-VN")
                    vi_status = "DA SINH MOI (Saved)"
                    newly_created += 1
                except Exception as e:
                    vi_status = f"LOI ({e})"
                    failed += 1

            # 2. Kiem tra va sinh giong Tieng Anh (neu co)
            en_status = ""
            if en_text:
                en_info = tts_service.get_audio_cache_info(en_text, language="en-US")
                if en_info["exists"]:
                    en_status = " | EN: DA CO"
                    already_cached += 1
                else:
                    try:
                        await tts_service.pre_generate_audio_file(en_text, language="en-US")
                        en_status = " | EN: DA SINH MOI"
                        newly_created += 1
                    except Exception as e:
                        en_status = f" | EN: LOI ({e})"
                        failed += 1

            print(f"[{idx:3d}/{total:3d}] {title[:32]:<32} -> VI: {vi_status}{en_status}")

            # Nghi ngan 50ms de khong bi chan WebSocket
            await asyncio.sleep(0.05)

        print("\n" + "=" * 65)
        print(f"HOAN TAT DONG BO!")
        print(f"- File moi sinh thanh cong: {newly_created}")
        print(f"- File da co san tu truoc : {already_cached}")
        print(f"- File loi (neu co)       : {failed}")
        print(f"- Tong so file trong cache : {len(os.listdir(tts_service._cache_dir))}")
        print("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"))
        tables = [r[0] for r in res.fetchall()]
        print("All tables in public schema:")
        for t in tables:
            print(f"  - {t}")
            
        print("\nChecking specifically for maps:")
        r = await conn.execute(text("SELECT to_regclass('public.maps');"))
        print(f"to_regclass('public.maps') = {r.scalar()}")

if __name__ == '__main__':
    asyncio.run(main())

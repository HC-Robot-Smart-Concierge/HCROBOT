import asyncio
import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(text("""
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'menu_items'::regclass;
        """))
        for row in res.fetchall():
            print(f"{row[0]}: {row[1]}")

if __name__ == '__main__':
    asyncio.run(check())

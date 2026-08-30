import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath("."))
from app.core.database import engine
from sqlalchemy import text

async def alter_col():
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE staff ALTER COLUMN avatar_url TYPE TEXT;"))
    print("SUCCESS: ALTER TABLE staff ALTER COLUMN avatar_url TYPE TEXT;")

if __name__ == "__main__":
    asyncio.run(alter_col())

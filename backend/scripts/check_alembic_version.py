import asyncio
import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT version_num FROM alembic_version;"))
        rows = res.fetchall()
        print("Alembic current version:", [r[0] for r in rows])

if __name__ == '__main__':
    asyncio.run(check())

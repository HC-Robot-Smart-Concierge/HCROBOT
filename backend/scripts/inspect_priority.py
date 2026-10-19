import asyncio
import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

async def inspect():
    async with engine.connect() as c:
        for tbl in ['support_requests', 'service_types', 'management_directives', 'room_service_orders']:
            res = await c.execute(text(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '{tbl}' AND column_name LIKE '%prio%';
            """))
            rows = res.fetchall()
            print(f"Table '{tbl}': {rows}")

if __name__ == '__main__':
    asyncio.run(inspect())

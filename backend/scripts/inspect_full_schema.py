import asyncio
import sys
import json
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

async def inspect():
    async with engine.connect() as conn:
        # Get all tables
        tables_res = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """))
        tables = [r[0] for r in tables_res.fetchall()]
        
        schema_info = {}
        for table in tables:
            # Columns
            cols_res = await conn.execute(text("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = :t
                ORDER BY ordinal_position;
            """), {"t": table})
            columns = [
                {
                    "name": r[0],
                    "type": r[1],
                    "nullable": r[2],
                    "default": str(r[3]) if r[3] is not None else None
                }
                for r in cols_res.fetchall()
            ]
            
            # Primary Key
            pk_res = await conn.execute(text("""
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY' 
                  AND tc.table_name = :t;
            """), {"t": table})
            pks = [r[0] for r in pk_res.fetchall()]

            # Foreign Keys
            fk_res = await conn.execute(text("""
                SELECT
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name,
                    tc.constraint_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_name = :t;
            """), {"t": table})
            fks = [
                {
                    "column": r[0],
                    "ref_table": r[1],
                    "ref_column": r[2],
                    "constraint_name": r[3]
                }
                for r in fk_res.fetchall()
            ]

            # Row count
            try:
                count_res = await conn.execute(text(f'SELECT count(*) FROM "{table}"'))
                row_count = count_res.scalar()
            except Exception as e:
                row_count = -1

            schema_info[table] = {
                "columns": columns,
                "pks": pks,
                "fks": fks,
                "row_count": row_count
            }

        with open('scripts/schema_dump.json', 'w', encoding='utf-8') as f:
            json.dump(schema_info, f, indent=2, ensure_ascii=False)
        print("Schema successfully dumped to scripts/schema_dump.json")

if __name__ == '__main__':
    asyncio.run(inspect())


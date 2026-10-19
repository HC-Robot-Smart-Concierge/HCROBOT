import asyncio
import sys
import json
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')
from app.core.database import engine
from sqlalchemy import text

async def inspect():
    with open('scripts/schema_dump.json', 'r', encoding='utf-8') as f:
        schema = json.load(f)

    # All foreign keys defined in DB
    all_fks = []
    for tbl, info in schema.items():
        for fk in info['fks']:
            all_fks.append((tbl, fk['column'], fk['ref_table'], fk['ref_column'], fk['constraint_name']))

    print(f"Total Foreign Keys in PostgreSQL: {len(all_fks)}")
    print("=" * 80)
    for tbl, col, ref_t, ref_c, name in sorted(all_fks):
        print(f"{tbl}.{col} -> {ref_t}.{ref_c}  [{name}]")
    print("=" * 80)

    # Check for columns named *_id that DO NOT have a Foreign Key
    potential_missing_fks = []
    async with engine.connect() as conn:
        for tbl, info in schema.items():
            existing_fk_cols = {fk['column'] for fk in info['fks']}
            for col in info['columns']:
                cname = col['name']
                if cname.endswith('_id') and cname != 'id' and cname not in existing_fk_cols:
                    # check if there's any non-null data
                    try:
                        res = await conn.execute(text(f'SELECT count("{cname}") FROM "{tbl}";'))
                        non_null_cnt = res.scalar()
                    except Exception:
                        non_null_cnt = -1
                    potential_missing_fks.append((tbl, cname, non_null_cnt))

    print("\nColumns ending in '_id' WITHOUT Foreign Key constraint:")
    for tbl, col, cnt in sorted(potential_missing_fks):
        print(f"  - {tbl}.{col} (non-null rows: {cnt})")

if __name__ == '__main__':
    asyncio.run(inspect())

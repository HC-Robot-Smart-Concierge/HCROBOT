import asyncio
import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

sys.stdout.reconfigure(encoding='utf-8')

async def drop_columns():
    async with engine.begin() as conn:
        print("[INFO] Starting drop of unused columns from 'accounts' table...")
        columns_to_drop = [
            "current_tasks_count",
            "shift",
            "assigned_floors",
            "notification_channels",
        ]
        
        # Check current existing columns in accounts
        res = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'accounts';
        """))
        existing_cols = {row[0] for row in res.fetchall()}
        print(f"[INFO] Current columns in 'accounts': {sorted(list(existing_cols))}")
        
        for col in columns_to_drop:
            if col in existing_cols:
                print(f"[DROPPING] Column '{col}' exists. Executing ALTER TABLE accounts DROP COLUMN {col}...")
                await conn.execute(text(f"ALTER TABLE accounts DROP COLUMN IF EXISTS {col};"))
                print(f"  -> Column '{col}' dropped successfully.")
            else:
                print(f"[SKIP] Column '{col}' is already not in table 'accounts'.")

        # Verify after drop
        res_after = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'accounts';
        """))
        remaining_cols = {row[0] for row in res_after.fetchall()}
        print(f"[SUCCESS] Remaining columns in 'accounts': {sorted(list(remaining_cols))}")

if __name__ == "__main__":
    asyncio.run(drop_columns())

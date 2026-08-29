import asyncio
import sys
import os

# Set root backend path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, AsyncSessionLocal
from app.db.init_db import init_db


def ensure_postgres_db():
    """Ensures that the target database exists in PostgreSQL."""
    print(f"[*] Checking PostgreSQL Database '{settings.POSTGRES_DB}'...")
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{settings.POSTGRES_DB}';")
        exists = cursor.fetchone()
        
        if not exists:
            print(f"[+] Creating PostgreSQL Database '{settings.POSTGRES_DB}'...")
            cursor.execute(f'CREATE DATABASE "{settings.POSTGRES_DB}";')
            print(f"[SUCCESS] Database '{settings.POSTGRES_DB}' created!")
        else:
            print(f"[INFO] Database '{settings.POSTGRES_DB}' already exists.")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[WARNING] Could not verify/create DB via psycopg2: {e}")


async def main():
    print("=" * 60)
    print("AURORA OS - HCROBOT DATABASE INITIALIZATION & SEEDING")
    print("=" * 60)
    
    # 1. Ensure DB exists
    ensure_postgres_db()
    
    # 2. Run Code-First table creation & seeding
    print("\n[*] Initializing tables and seeding hotel operations data...")
    try:
        async with AsyncSessionLocal() as session:
            await init_db(session)
            print("[SUCCESS] All tables created and seed data initialized successfully!")
    except Exception as e:
        print(f"[FAIL] Error initializing database: {e}")
        sys.exit(1)
        
    print("\n" + "=" * 60)
    print("DATABASE SETUP COMPLETED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

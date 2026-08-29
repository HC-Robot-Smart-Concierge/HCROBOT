import asyncio
import sys
import io

# Reconfigure stdout for UTF-8 encoding on Windows terminal if needed
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

from app.core.config import settings
from app.core.database import engine
from app.db.chroma import get_concierge_collection, get_chroma_client


def ensure_postgres_db_exists():
    """Checks if target PostgreSQL database exists; if not, creates it using administrative connection."""
    print("[1/4] Checking PostgreSQL Database existence...")
    try:
        # Connect to default 'postgres' database
        conn = psycopg2.connect(
            dbname="postgres",
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if target DB exists
        cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{settings.POSTGRES_DB}';")
        exists = cursor.fetchone()
        
        if not exists:
            print(f"[+] Database '{settings.POSTGRES_DB}' does not exist. Creating now...")
            cursor.execute(f'CREATE DATABASE "{settings.POSTGRES_DB}";')
            print(f"[SUCCESS] Database '{settings.POSTGRES_DB}' created successfully!")
        else:
            print(f"[INFO] Database '{settings.POSTGRES_DB}' already exists.")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[WARNING] Error checking/creating database: {e}")
        print("[HINT] Please ensure PostgreSQL service is running on your local machine.")


async def test_postgres_async_connection():
    """Tests Async SQLAlchemy connection to PostgreSQL."""
    print("\n[2/4] Testing Async PostgreSQL Connection via SQLAlchemy & asyncpg...")
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1;"))
            val = result.scalar()
            if val == 1:
                print(f"[SUCCESS] PostgreSQL Async Connection SUCCESSFUL! (Target DB: {settings.POSTGRES_DB})")
            else:
                print(f"[FAIL] PostgreSQL returned unexpected scalar: {val}")
                return False
    except Exception as e:
        print(f"[FAIL] PostgreSQL Connection FAILED: {e}")
        return False
    return True


def test_chromadb_operations():
    """Tests ChromaDB Vector Store initialization, document indexing, and querying."""
    print("\n[3/4] Testing ChromaDB Vector Store (Concierge Knowledge Base)...")
    try:
        client = get_chroma_client()
        collection = get_concierge_collection("test_concierge_kb")
        
        # Add sample knowledge docs
        sample_id = "kb_doc_001"
        sample_doc = "Ho boi tang 5 khach san mo cua tu 06:00 den 22:00 hang ngay. Khan tam mien phi tai quay."
        
        collection.add(
            ids=[sample_id],
            documents=[sample_doc],
            metadatas=[{"category": "facilities", "facility": "pool"}]
        )
        print("[SUCCESS] Added sample Concierge document to ChromaDB collection.")
        
        # Query sample document
        results = collection.query(
            query_texts=["May gio ho boi dong cua?"],
            n_results=1
        )
        
        retrieved_doc = results["documents"][0][0]
        print(f"[QUERY RESULT] Vector Query Result: '{retrieved_doc}'")
        print("[SUCCESS] ChromaDB Operations SUCCESSFUL!")
        
        # Clean up test collection
        client.delete_collection("test_concierge_kb")
        
    except Exception as e:
        print(f"[FAIL] ChromaDB Operations FAILED: {e}")
        return False
    return True


async def main():
    print("=" * 60)
    print("HC-ROBOT BACKEND DATABASE TEST SUITE")
    print("=" * 60)
    
    # Step 1: Ensure Postgres DB exists
    ensure_postgres_db_exists()
    
    # Step 2: Test Async Postgres
    pg_success = await test_postgres_async_connection()
    
    # Step 3: Test ChromaDB
    chroma_success = test_chromadb_operations()
    
    # Step 4: Summary
    print("\n" + "=" * 60)
    print("DATABASE TEST SUMMARY")
    print("=" * 60)
    print(f"1. PostgreSQL (Async Engine) : {'SUCCESS' if pg_success else 'FAILED'}")
    print(f"2. ChromaDB (Vector Store)   : {'SUCCESS' if chroma_success else 'FAILED'}")
    print("=" * 60)
    
    if pg_success and chroma_success:
        print("ALL DATABASE TESTS PASSED! Backend is ready for development.")
        sys.exit(0)
    else:
        print("SOME TESTS FAILED. Please review the log output above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

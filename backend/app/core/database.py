import os
import sys
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from sqlalchemy.engine import make_url

from app.core.config import settings


def connection_pool_limits(database_url):
    url = make_url(database_url)
    # Supavisor session mode keeps one server-side client for every pooled
    # connection, including idle ones. Leave room for other backend sessions.
    if (url.host or '').endswith('pooler.supabase.com') and url.port != 6543:
        return {"pool_size": 3, "max_overflow": 2}
    return {"pool_size": 10, "max_overflow": 10}

connect_args = {}
# Supabase Pooler (Transaction Mode port 6543 / PgBouncer) requires statement_cache_size=0 for asyncpg
if "6543" in str(settings.async_database_url) or "pooler.supabase.com" in str(settings.async_database_url):
    connect_args["statement_cache_size"] = 0

# In tests or CI, use NullPool so connections aren't tied to closed event loops
engine_kwargs = {
    "echo": False,
    "future": True,
    "connect_args": connect_args,
}
if os.getenv("TESTING") == "1" or "pytest" in sys.modules:
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs.update(connection_pool_limits(settings.async_database_url))

# Create Async SQLAlchemy Engine
engine = create_async_engine(
    settings.async_database_url,
    **engine_kwargs
)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy ORM models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency generator for getting Async SQLAlchemy DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create missing database tables and apply backward-compatible schema patches."""
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Workflow schedule settings are metadata, separate from executable steps.
        from sqlalchemy import inspect
        workflow_columns = await conn.run_sync(lambda connection: inspect(connection).get_columns("robot_workflows"))
        if not any(column["name"] == "execution_config" for column in workflow_columns):
            await conn.execute(text("ALTER TABLE robot_workflows ADD COLUMN execution_config JSON NOT NULL DEFAULT '{}'"))
        # Existing installations must retain the orientation when editing zones.
        # Keep this additive patch independent of the legacy optional patches below.
        if conn.dialect.name == "postgresql":
            await conn.execute(text("ALTER TABLE zones ADD COLUMN IF NOT EXISTS yaw DOUBLE PRECISION NOT NULL DEFAULT 0"))
        else:
            from sqlalchemy import inspect
            columns = await conn.run_sync(lambda connection: inspect(connection).get_columns("zones"))
            if not any(column["name"] == "yaw" for column in columns):
                await conn.execute(text("ALTER TABLE zones ADD COLUMN yaw FLOAT NOT NULL DEFAULT 0"))
        try:
            await conn.execute(text("ALTER TABLE human_support_sessions ADD COLUMN IF NOT EXISTS chat_session_id VARCHAR(64);"))
            await conn.execute(text("ALTER TABLE human_support_sessions ADD COLUMN IF NOT EXISTS account_id VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE human_support_sessions ADD COLUMN IF NOT EXISTS recording_url TEXT;"))
            await conn.execute(text("ALTER TABLE human_support_sessions ADD COLUMN IF NOT EXISTS recording_public_id VARCHAR(150);"))
            await conn.execute(text("ALTER TABLE human_support_sessions ADD COLUMN IF NOT EXISTS recording_duration INTEGER;"))
            await conn.execute(text("ALTER TABLE human_support_sessions ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;"))
            await conn.execute(text("ALTER TABLE human_support_sessions ADD COLUMN IF NOT EXISTS call_started_at TIMESTAMP;"))
            await conn.execute(text("ALTER TABLE human_support_sessions ADD COLUMN IF NOT EXISTS call_ended_at TIMESTAMP;"))
            await conn.execute(text("ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL';"))
            await conn.execute(text("ALTER TABLE robots ADD COLUMN IF NOT EXISTS serial_number VARCHAR(80);"))
            await conn.execute(text("ALTER TABLE robots ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE robots ADD COLUMN IF NOT EXISTS notes TEXT;"))
            # Xóa bảng maps theo yêu cầu không lưu bản đồ vào CSDL
            await conn.execute(text("DROP TABLE IF EXISTS maps CASCADE;"))
        except Exception:
            pass



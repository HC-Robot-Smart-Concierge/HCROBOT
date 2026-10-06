import os
import sys
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

# In tests or CI, use NullPool so connections aren't tied to closed event loops
engine_kwargs = {
    "echo": False,
    "future": True,
}
if os.getenv("TESTING") == "1" or "pytest" in sys.modules:
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_pre_ping"] = True

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
        # An toàn cho database cũ: bổ sung cột thiếu nếu bảng đã tồn tại
        try:
            await conn.execute(text("ALTER TABLE room_service_orders ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;"))
        except Exception:
            pass



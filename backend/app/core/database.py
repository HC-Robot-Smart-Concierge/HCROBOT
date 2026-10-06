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
        try:
            await conn.execute(text("ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS items JSON DEFAULT '[]'::json;"))
            await conn.execute(text("ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS total_amount DOUBLE PRECISION DEFAULT 0.0;"))
            await conn.execute(text("ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;"))
            await conn.execute(text("ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS est_completion VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS extra_data JSON DEFAULT '{}'::json;"))
            await conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS account_id VARCHAR(50);"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS food_item_id VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;"))
            await conn.execute(text("ALTER TABLE menu_items ALTER COLUMN name DROP NOT NULL;"))
            await conn.execute(text("ALTER TABLE menu_items ALTER COLUMN category DROP NOT NULL;"))
            await conn.execute(text("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS food_item_id VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor_id VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE maps ADD COLUMN IF NOT EXISTS floor_id VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE facilities ADD COLUMN IF NOT EXISTS floor_id VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE amenities ADD COLUMN IF NOT EXISTS floor_id VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE room_service_orders ADD COLUMN IF NOT EXISTS support_request_id VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE management_directives ADD COLUMN IF NOT EXISTS account_id VARCHAR(50);"))
            await conn.execute(text("INSERT INTO service_types (id, code, name, department_id, description, default_priority, is_active) VALUES ('ST-ROOM-SERVICE', 'ROOM_SERVICE', 'Dịch vụ phục vụ phòng (Room Service)', 'DEP-ROOMSERVICE', 'Dịch vụ đặt món phòng', 'NORMAL', true) ON CONFLICT (id) DO NOTHING;"))
        except Exception:
            pass



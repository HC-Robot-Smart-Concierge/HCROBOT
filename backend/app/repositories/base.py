from typing import Generic, TypeVar, Type, Optional, List, Any, Sequence
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, desc, asc, func

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    """
    Generic Base Repository providing standard asynchronous CRUD operations
    for SQLAlchemy ORM models.
    """

    def __init__(self, db: AsyncSession, model: Type[ModelType]):
        self.db = db
        self.model = model

    async def get_by_id(self, id: Any) -> Optional[ModelType]:
        """Fetch a single record by primary key."""
        return await self.db.get(self.model, id)

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[Any] = None,
    ) -> Sequence[ModelType]:
        """Fetch all records with optional pagination and ordering."""
        stmt = select(self.model).offset(skip).limit(limit)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def create(self, obj: ModelType, autocommit: bool = False) -> ModelType:
        """Add a new model instance to session."""
        self.db.add(obj)
        if autocommit:
            await self.db.commit()
            await self.db.refresh(obj)
        else:
            await self.db.flush()
        return obj

    async def update(self, obj: ModelType, autocommit: bool = False) -> ModelType:
        """Update an existing model instance in session."""
        self.db.add(obj)
        if autocommit:
            await self.db.commit()
            await self.db.refresh(obj)
        else:
            await self.db.flush()
        return obj

    async def delete(self, obj: ModelType, autocommit: bool = False) -> None:
        """Remove a model instance from session."""
        await self.db.delete(obj)
        if autocommit:
            await self.db.commit()
        else:
            await self.db.flush()

    async def commit(self) -> None:
        """Commit the current active transaction."""
        await self.db.commit()

    async def flush(self) -> None:
        """Flush pending changes to the database within transaction."""
        await self.db.flush()

    async def refresh(
        self,
        obj: ModelType,
        attribute_names: Optional[Sequence[str]] = None,
    ) -> ModelType:
        """Refresh instance state from database."""
        if attribute_names is not None:
            await self.db.refresh(obj, attribute_names=attribute_names)
        else:
            await self.db.refresh(obj)
        return obj

    async def count(self) -> int:
        """Count total rows in the table."""
        stmt = select(func.count()).select_from(self.model)
        res = await self.db.execute(stmt)
        return res.scalar_one() or 0

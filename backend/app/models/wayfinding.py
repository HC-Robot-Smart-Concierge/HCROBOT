from sqlalchemy import JSON, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WayfindingPublication(Base):
    __tablename__ = "wayfinding_publications"

    id: Mapped[int] = mapped_column(primary_key=True)
    revision: Mapped[int]
    config: Mapped[dict] = mapped_column(JSON)


class WayfindingImage(Base):
    __tablename__ = "wayfinding_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    content_type: Mapped[str] = mapped_column(String(32))
    content: Mapped[bytes] = mapped_column(LargeBinary)

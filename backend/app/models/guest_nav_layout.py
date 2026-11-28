from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class GuestNavLayout(Base):
    """Layout 2D vẽ tay cho màn hình chỉ đường của khách, đặt chồng lên map Nav2.

    Toạ độ lưu theo MÉT trong frame `map` của Nav2 (cùng hệ với /tf, /amcl_pose,
    waypoint), nên khớp với vị trí robot mà không cần hiệu chỉnh.
    Bảng riêng, không đụng bảng waypoint/zone mà robot tự hành đang dùng.
    """

    __tablename__ = "guest_nav_layouts"

    # Trùng map_id của file robot/maps/<map_id>.yaml
    map_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    # { version, walls: [{id, points: [[x,y],...], thickness}], objects: [{id,type,x,y,w,h,rotation,flip,label}] }
    layout: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

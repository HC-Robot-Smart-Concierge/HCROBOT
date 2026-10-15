import logging
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.feedback import Feedback
from app.models.chat_session import ChatSession
from app.schemas.ai import FeedbackCreate
from app.api.v1.endpoints.operations.shared import create_department_notification

logger = logging.getLogger(__name__)


async def submit_guest_feedback(db: AsyncSession, fb_in: FeedbackCreate) -> Feedback:
    """
    Lưu đánh giá và nhận xét của khách hàng vào bảng feedbacks trong cơ sở dữ liệu.
    Nếu rating <= 3 sao: Tự động kích hoạt quy trình Service Recovery (Cảnh báo khẩn cấp tới Concierge và Lễ tân).
    """
    session_id_val = fb_in.chat_session_id
    if session_id_val:
        chk_stmt = select(ChatSession).where(ChatSession.id == session_id_val)
        chk_res = await db.execute(chk_stmt)
        if not chk_res.scalar_one_or_none():
            new_session = ChatSession(
                id=session_id_val,
                room_number=fb_in.room_number,
                guest_name=fb_in.guest_name or "Khách tại Kiosk",
                is_active=False,
            )
            db.add(new_session)
            await db.flush()

    new_fb = Feedback(
        chat_session_id=session_id_val,
        rating=fb_in.rating,
        category=fb_in.category or "Robot Concierge",
        comment=fb_in.comment,
        guest_name=fb_in.guest_name,
        room_number=fb_in.room_number,
    )
    db.add(new_fb)
    await db.flush()

    # XỬ LÝ ĐÁNH GIÁ TIÊU CỰC (SERVICE RECOVERY DISPATCH)
    if new_fb.rating <= 3:
        room_label = f"Phòng {new_fb.room_number}" if new_fb.room_number else "Kiosk Sảnh"
        comment_text = new_fb.comment or "Khách không để lại ghi chú chi tiết"

        try:
            # Cảnh báo khẩn cấp tới bộ phận Concierge
            await create_department_notification(
                db=db,
                department="Concierge",
                title=f"[CẢNH BÁO] Đánh giá tiêu cực ({room_label}) - {new_fb.rating} Sao",
                description=(
                    f"Khách tại {room_label} vừa đánh giá {new_fb.rating}/5 sao. "
                    f"Phản hồi: \"{comment_text}\". "
                    f"Vui lòng mở lịch sử hội thoại để can thiệp hỗ trợ ngay!"
                ),
                request_id=new_fb.chat_session_id,
                request_type="bad_feedback",
                type="UrgentAlert",
            )

            # Đồng thời cảnh báo tới bộ phận Lễ tân (Reception)
            await create_department_notification(
                db=db,
                department="Reception",
                title=f"[CẢNH BÁO] Đánh giá thấp ({room_label}) - {new_fb.rating} Sao",
                description=(
                    f"Khách phản hồi {new_fb.rating}/5 sao về Robot Kiosk. "
                    f"Session ID: {new_fb.chat_session_id}"
                ),
                request_id=new_fb.chat_session_id,
                request_type="bad_feedback",
                type="UrgentAlert",
            )
        except Exception as alert_err:
            logger.warning(f"[FeedbackService Service Recovery Alert Error] {alert_err}")

    await db.commit()
    await db.refresh(new_fb)
    return new_fb


async def get_feedbacks(
    db: AsyncSession,
    category: Optional[str] = None,
    limit: int = 50
) -> List[Feedback]:
    """Lấy danh sách đánh giá của khách hàng từ cơ sở dữ liệu."""
    stmt = select(Feedback).order_by(Feedback.created_at.desc()).limit(limit)
    if category:
        stmt = stmt.where(Feedback.category == category)
    res = await db.execute(stmt)
    return list(res.scalars().all())

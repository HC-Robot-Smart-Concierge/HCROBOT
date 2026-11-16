from datetime import datetime, timedelta
import pytest

from sqlalchemy import select

from app.core.database import AsyncSessionLocal

from app.models.hotel import Room

from app.models.room_service import RoomServiceOrder, OrderItem

from app.schemas.ai import ChatRequest

from app.services.ai.ai_chat_service import process_chat_request

from app.services.ai.session_manager import session_manager





@pytest.mark.asyncio

async def test_no_pins_exceed_4_digits_in_database():

    """Đảm bảo trong database không còn bất kỳ phòng nào lưu mã PIN vượt quá 4 số."""

    async with AsyncSessionLocal() as session:

        res = await session.execute(select(Room))

        rooms = res.scalars().all()

        for r in rooms:

            if r.pin_code:

                assert len(r.pin_code) == 4, f"Phòng {r.room_number} có PIN {r.pin_code} không đúng 4 số"





@pytest.mark.asyncio

async def test_order_status_inquiry_requires_room_and_no_map():

    """Khi khách hỏi món ăn xong chưa: phải hỏi số phòng, action='query_order_status', không trả destination_key."""

    sid = "test_kitchen_inquiry_step1"

    session_manager.reset_session(sid)



    async with AsyncSessionLocal() as db:

        req = ChatRequest(prompt="món ăn của tôi xong chưa", session_id=sid, language="Tiếng Việt")

        res = await process_chat_request(db, req)



        assert res.action == "query_order_status"

        assert res.missing_room_number is True

        assert res.destination_key is None

        assert "phòng bao nhiêu" in res.response or "số phòng" in res.response





@pytest.mark.asyncio

async def test_order_status_kitchen_progress_reporting():

    """Khi khách trả lời số phòng có đơn trong bếp: báo đúng tiến độ chế biến, không chỉ đường lên phòng."""

    sid = "test_kitchen_inquiry_step2"

    session_manager.reset_session(sid)



    async with AsyncSessionLocal() as db:

        # Đảm bảo phòng 305 ở trạng thái OCCUPIED

        res_r = await db.execute(select(Room).where(Room.room_number == "305"))

        room_305 = res_r.scalars().first()

        prev_status = room_305.status if room_305 else "AVAILABLE"

        if room_305:

            room_305.status = "OCCUPIED"

            room_305.current_guest_name = "Khách Test"



        # Chuẩn bị dữ liệu đơn bếp (order_number <= 20 ký tự)

        ord = RoomServiceOrder(

            order_number="ORD-KIT-305",

            room_number="305",

            status="Cooking",

            total_amount=120000

        )

        db.add(ord)

        await db.flush()

        item = OrderItem(order_id=ord.id, item_name="Sake chiên giòn", quantity=1, unit_price=120000)

        db.add(item)

        await db.commit()



        try:

            # Lượt 1: Hỏi tiến độ

            await process_chat_request(db, ChatRequest(prompt="đồ ăn tới đâu rồi", session_id=sid, language="Tiếng Việt"))

            # Lượt 2: Trả lời phòng 305

            res2 = await process_chat_request(db, ChatRequest(prompt="Phòng 305", session_id=sid, language="Tiếng Việt"))



            assert res2.action == "query_order_status"

            assert res2.destination_key is None

            assert res2.missing_room_number is False

            assert "đầu bếp trực tiếp chế biến" in res2.response or "chế biến" in res2.response

            assert "305" in res2.response

        finally:

            await db.delete(item)

            await db.delete(ord)

            if room_305:

                room_305.status = prev_status

                if prev_status == "AVAILABLE":

                    room_305.current_guest_name = None

            await db.commit()





@pytest.mark.asyncio

async def test_order_status_when_no_active_kitchen_order():

    """Khi phòng không có đơn trong bếp: thông báo không có đơn, không đọc SupportRequest."""

    sid = "test_kitchen_inquiry_no_order"

    session_manager.reset_session(sid)



    async with AsyncSessionLocal() as db:

        res_r = await db.execute(select(Room).where(Room.room_number == "401"))

        room_401 = res_r.scalars().first()

        prev_status = room_401.status if room_401 else "AVAILABLE"

        if room_401:

            room_401.status = "OCCUPIED"

            room_401.current_guest_name = "Khách Test 401"

            await db.commit()



        try:

            await process_chat_request(db, ChatRequest(prompt="kiểm tra món ăn", session_id=sid, language="Tiếng Việt"))

            res = await process_chat_request(db, ChatRequest(prompt="401", session_id=sid, language="Tiếng Việt"))



            assert res.action == "query_order_status"

            assert res.destination_key is None

            assert "không có đơn đặt món nào trong nhà bếp" in res.response or "không có đơn đặt món" in res.response

        finally:

            if room_401:

                room_401.status = prev_status

                if prev_status == "AVAILABLE":

                    room_401.current_guest_name = None

                await db.commit()





@pytest.mark.asyncio

async def test_massage_and_drinks_status_queries():

    """Kiểm tra câu hỏi 'mát xa đã tới phòng chưa' và 'nước uống đã tới phòng chưa' nhận diện đúng query_order_status."""

    sid_massage = "test_massage_inquiry"

    session_manager.reset_session(sid_massage)



    async with AsyncSessionLocal() as db:

        # 1. Mát xa đã tới phòng chưa -> action == query_order_status, type == service

        res_massage = await process_chat_request(db, ChatRequest(prompt="mát xa đã tới phòng chưa", session_id=sid_massage, language="Tiếng Việt"))

        assert res_massage.action == "query_order_status"

        assert res_massage.missing_room_number is True

        assert res_massage.status_query_type == "service"

        assert res_massage.destination_key is None



        # 2. Nước uống đã tới phòng chưa -> action == query_order_status, type == food

        sid_drink = "test_drink_inquiry"

        session_manager.reset_session(sid_drink)

        res_drink = await process_chat_request(db, ChatRequest(prompt="nước uống đã tới phòng chưa", session_id=sid_drink, language="Tiếng Việt"))

        assert res_drink.action == "query_order_status"

        assert res_drink.missing_room_number is True

        assert res_drink.status_query_type == "food"

        assert res_drink.destination_key is None





@pytest.mark.asyncio

async def test_active_order_prioritized_over_old_completed_order():

    """Đảm bảo khi phòng vừa có đơn cũ 'Completed' và đơn mới 'Cooking'/'Pending',

    hỏi trạng thái món ăn luôn trả về tiến độ của đơn mới đang xử lý, không trả về đơn cũ đã hoàn thành.

    """

    sid = "test_kitchen_active_over_completed"

    session_manager.reset_session(sid)



    async with AsyncSessionLocal() as db:

        res_r = await db.execute(select(Room).where(Room.room_number == "302"))

        room_302 = res_r.scalars().first()

        prev_status = room_302.status if room_302 else "AVAILABLE"

        if room_302:

            room_302.status = "OCCUPIED"

            room_302.current_guest_name = "Khách Test 302"



        # 1. Tạo đơn cũ đã hoàn thành (Completed)

        old_ord = RoomServiceOrder(

            order_number="ORD-OLD-COMPLETED",

            room_number="302",

            status="Completed",

            total_amount=95000,

        )

        db.add(old_ord)

        await db.flush()

        old_item = OrderItem(order_id=old_ord.id, item_name="Bún bò Huế", quantity=1, unit_price=95000)

        db.add(old_item)



        # 2. Tạo đơn mới đang nấu (Cooking)

        new_ord = RoomServiceOrder(

            order_number="ORD-NEW-COOKING",

            room_number="Room 302",

            status="Cooking",

            total_amount=150000,

        )

        db.add(new_ord)

        await db.flush()

        new_item = OrderItem(order_id=new_ord.id, item_name="Pizza hải sản", quantity=1, unit_price=150000)

        db.add(new_item)

        await db.commit()



        try:

            # Lượt 1: Hỏi trạng thái món ăn

            await process_chat_request(db, ChatRequest(prompt="trạng thái món ăn của tôi thế nào rồi", session_id=sid, language="Tiếng Việt"))

            # Lượt 2: Cung cấp số phòng 302

            res = await process_chat_request(db, ChatRequest(prompt="Phòng 302", session_id=sid, language="Tiếng Việt"))



            assert res.action == "query_order_status"

            # Phải báo đơn mới đang chế biến, KHÔNG ĐƯỢC báo đã hoàn thành của đơn cũ

            assert "chế biến" in res.response or "sắp xong" in res.response or "nhà bếp" in res.response

            assert "đã hoàn thành và được giao thành công" not in res.response

            assert "Pizza hải sản" in res.response or "302" in res.response

        finally:

            await db.delete(old_item)

            await db.delete(old_ord)

            await db.delete(new_item)

            await db.delete(new_ord)

            if room_302:

                room_302.status = prev_status

                if prev_status == "AVAILABLE":

                    room_302.current_guest_name = None

            await db.commit()







@pytest.mark.asyncio

async def test_order_status_reports_rejection_reason_to_guest():

    """

    Kiểm tra khi đơn bị từ chối (Rejected) kèm lý do:

    Robot phải báo cho khách biết đơn đã bị từ chối và nêu rõ lý do từ chối.

    """

    sid = "test_order_status_reject_reason_sid"

    session_manager.reset_session(sid)



    async with AsyncSessionLocal() as db:

        res_r = await db.execute(select(Room).where(Room.room_number == "308"))

        room_308 = res_r.scalars().first()

        prev_status = room_308.status if room_308 else "AVAILABLE"

        if room_308:

            room_308.status = "OCCUPIED"

            room_308.current_guest_name = "Khách Test 308"



        reject_reason = "Hết nguyên liệu hải sản tươi trong ngày"

        ord_rej = RoomServiceOrder(

            order_number="ORD-REJ-308",

            room_number="308",

            status="Rejected",

            note=reject_reason,

            total_amount=150000

        )

        db.add(ord_rej)

        await db.flush()

        item = OrderItem(order_id=ord_rej.id, item_name="Cua sốt me", quantity=1, unit_price=150000)

        db.add(item)

        await db.commit()



        try:

            # Khách hỏi tình trạng món ăn phòng 308

            res = await process_chat_request(db, ChatRequest(

                prompt="Tình trạng món ăn phòng 308 thế nào rồi em?",

                session_id=sid,

                language="Tiếng Việt"

            ))



            assert res.action == "query_order_status"

            assert res.missing_room_number is False

            # Robot phải thông báo từ chối kèm lý do

            assert "từ chối" in res.response.lower()

            assert reject_reason in res.response

            assert "chọn món khác" in res.response.lower() or "menu" in res.response.lower()

        finally:

            await db.delete(item)

            await db.delete(ord_rej)

            if room_308:

                room_308.status = prev_status

                if prev_status == "AVAILABLE":

                    room_308.current_guest_name = None

            await db.commit()

            session_manager.reset_session(sid)





@pytest.mark.asyncio

async def test_room_service_status_reports_rejection_reason_to_guest():

    """

    Kiểm tra khi yêu cầu dịch vụ phòng bị từ chối kèm lý do:

    Robot phải báo cho khách biết yêu cầu đã bị từ chối và nêu rõ lý do.

    """

    from app.models.support_request import SupportRequest

    sid = "test_rs_status_reject_reason_sid"

    session_manager.reset_session(sid)



    async with AsyncSessionLocal() as db:

        res_r = await db.execute(select(Room).where(Room.room_number == "309"))

        room_309 = res_r.scalars().first()

        prev_status = room_309.status if room_309 else "AVAILABLE"

        if room_309:

            room_309.status = "OCCUPIED"

            room_309.current_guest_name = "Khách Test 309"



        reject_reason = "Tạm hết khăn tắm lớn bổ sung"

        sr_rej = SupportRequest(

            ticket_code="HK-REJ-309",

            title="Thêm 2 khăn tắm",

            room_number="309",

            department_id=None,

            service_type_id=None,

            status="Rejected",

            description=reject_reason,

            extra_data={"reject_reason": reject_reason}

        )

        db.add(sr_rej)

        await db.commit()



        try:

            res = await process_chat_request(db, ChatRequest(

                prompt="Tiến độ dọn phòng và khăn tắm phòng 309 thế nào rồi?",

                session_id=sid,

                language="Tiếng Việt"

            ))



            assert res.action == "query_order_status"

            assert res.missing_room_number is False

            assert "từ chối" in res.response.lower()

            assert reject_reason in res.response

        finally:

            await db.delete(sr_rej)

            if room_309:

                room_309.status = prev_status

                if prev_status == "AVAILABLE":

                    room_309.current_guest_name = None

            await db.commit()

            session_manager.reset_session(sid)





@pytest.mark.asyncio

async def test_why_rejected_inquiry_speaks_exact_reason():

    """Đảm bảo khi khách hỏi trực tiếp 'tại sao bị từ chối' hoặc 'sao món của tôi bị từ chối',

    robot nhận diện đúng ý định query_order_status và nói ra chính xác lý do từ chối.

    """

    sid = "test_why_rejected_session"

    session_manager.reset_session(sid)



    async with AsyncSessionLocal() as db:

        res_r = await db.execute(select(Room).where(Room.room_number == "301"))

        room_301 = res_r.scalars().first()

        prev_status = room_301.status if room_301 else "AVAILABLE"

        if room_301:

            room_301.status = "OCCUPIED"

            room_301.current_guest_name = "Khách Test 301"



        reason = "Hết nguyên liệu hải sản tươi"

        rso = RoomServiceOrder(

            order_number="ORD-TEST-REJ-999",

            room_number="301",

            status="Rejected",

            note=reason,

            total_amount=150000,

        )

        db.add(rso)

        await db.flush()

        oi = OrderItem(order_id=rso.id, item_name="Cơm chiên hải sản", quantity=1, unit_price=150000)

        db.add(oi)

        await db.commit()



        try:

            # 1. Khách hỏi 'tại sao bị từ chối'

            res1 = await process_chat_request(db, ChatRequest(

                prompt="tại sao bị từ chối",

                session_id=sid,

                room_number="301",

                language="Tiếng Việt"

            ))

            assert res1.action == "query_order_status"

            assert reason in res1.response

            assert "từ chối" in res1.response.lower()



            # 2. Khách hỏi 'sao món của tôi bị từ chối'

            res2 = await process_chat_request(db, ChatRequest(

                prompt="sao món của tôi bị từ chối",

                session_id=sid,

                room_number="301",

                language="Tiếng Việt"

            ))

            assert res2.action == "query_order_status"

            assert reason in res2.response



            # 3. Khách hỏi 'lý do từ chối là gì'

            res3 = await process_chat_request(db, ChatRequest(

                prompt="lý do từ chối là gì",

                session_id=sid,

                room_number="301",

                language="Tiếng Việt"

            ))

            assert res3.action == "query_order_status"

            assert reason in res3.response

        finally:

            await db.delete(oi)

            await db.delete(rso)

            if room_301:

                room_301.status = prev_status

                if prev_status == "AVAILABLE":

                    room_301.current_guest_name = None

            await db.commit()

            session_manager.reset_session(sid)



@pytest.mark.asyncio
async def test_review_placed_orders_does_not_order_dish():
    """Kiểm tra khi khách nói 'Cho tôi xem lại món đồ đặc' hoặc 'Cho tôi xem lại món đã đặt',
    hệ thống phải nhận diện intent là query_order_status và TUYỆT ĐỐI không tạo/gộp món ăn mới."""
    from app.core.database import AsyncSessionLocal
    from app.services.ai.ai_chat_service import process_chat_request
    from app.schemas.ai import ChatRequest
    from app.services.ai.concierge_graph import session_manager
    from app.models.hotel import Room
    from app.models.room_service import RoomServiceOrder, OrderItem
    from sqlalchemy import select
    import uuid

    sid = f"test_review_orders_{uuid.uuid4().hex[:6]}"
    session_manager.reset_session(sid)
    test_room_num = "303"
    
    async with AsyncSessionLocal() as db:
        room_stmt = select(Room).where(Room.room_number == test_room_num)
        res_r = await db.execute(room_stmt)
        room_test = res_r.scalars().first()
        prev_status = room_test.status
        room_test.status = "OCCUPIED"
        room_test.current_guest_name = "Khách Test 303"

        rand_ord = f"TEST-REV-{uuid.uuid4().hex[:6]}"
        rso = RoomServiceOrder(
            id=rand_ord,
            order_number=f"REV-{uuid.uuid4().hex[:6]}",
            room_number=test_room_num,
            status="Pending",
            is_service_request=False,
            total_amount=150000.0,
            note="Phần 200g",
        )
        db.add(rso)
        await db.flush()

        oi1 = OrderItem(
            order_id=rso.id,
            item_name="Bò nướng sốt nấm / tiêu",
            quantity=1,
            unit_price=150000.0,
            subtotal=150000.0,
            notes="Phần 200g",
        )
        db.add(oi1)
        await db.commit()

        try:
            # 1. Khách nói 'Cho tôi xem lại món đồ đặc' (câu nói thực tế bị STT phiên âm)
            res1 = await process_chat_request(db, ChatRequest(
                prompt="Cho tôi xem lại món đồ đặc",
                session_id=sid,
                room_number=test_room_num,
                language="Tiếng Việt"
            ))
            assert res1.action == "query_order_status", f"Expected query_order_status but got {res1.action}"
            assert "Bò nướng" in res1.response or test_room_num in res1.response

            # 2. Khách nói 'Cho tôi xem lại món đã đặt'
            res2 = await process_chat_request(db, ChatRequest(
                prompt="Cho tôi xem lại món đã đặt",
                session_id=sid,
                room_number=test_room_num,
                language="Tiếng Việt"
            ))
            assert res2.action == "query_order_status", f"Expected query_order_status but got {res2.action}"

            # 3. Kiểm tra DB: Tuyệt đối KHÔNG có OrderItem nào tên 'Cho tôi xem lại món đồ đặc'
            oi_check = await db.execute(select(OrderItem).where(OrderItem.order_id == rso.id))
            all_items = [item.item_name for item in oi_check.scalars().all()]
            assert "Cho tôi xem lại món đồ đặc" not in all_items
            assert len(all_items) == 1
        finally:
            await db.delete(oi1)
            await db.delete(rso)
            room_test.status = prev_status
            await db.commit()
            session_manager.reset_session(sid)


@pytest.mark.asyncio
async def test_newest_completed_order_prioritized_over_older_pending_and_dish_match():
    """Đảm bảo:
    1. Khi khách có đơn cũ bị Pending/hủy và vừa có đơn mới Completed, hỏi trạng thái món ăn
       báo chính xác đơn mới nhất đã hoàn thành thay vì báo đơn cũ vẫn trong hàng chờ.
    2. Khi khách hỏi đích danh tên món (vd 'Sake chiên giòn'), robot tự động khớp đúng đơn của món đó.
    """
    sid = "test_completed_over_pending_dish_match"
    session_manager.reset_session(sid)
    test_room_num = "308"

    async with AsyncSessionLocal() as db:
        res_r = await db.execute(select(Room).where(Room.room_number == test_room_num))
        room_test = res_r.scalars().first()
        prev_status = room_test.status if room_test else "AVAILABLE"
        if room_test:
            room_test.status = "OCCUPIED"
            room_test.current_guest_name = "Khách Test 308"

        # 1. Đơn cũ (tạo trước 30 phút, bị Pending / Treo)
        old_ord = RoomServiceOrder(
            order_number="ORD-OLD-PEND",
            room_number=test_room_num,
            status="Pending",
            created_at=datetime.utcnow() - timedelta(minutes=30),
            total_amount=150000.0,
        )
        db.add(old_ord)
        await db.flush()
        old_item = OrderItem(order_id=old_ord.id, item_name="Bò nướng sốt nấm / tiêu", quantity=1, unit_price=150000.0)
        db.add(old_item)

        # 2. Đơn mới nhất (tạo sau, bếp đã làm xong và Đã Hoàn Tất)
        new_ord = RoomServiceOrder(
            order_number="ORD-NEW-COMP",
            room_number=test_room_num,
            status="Completed",
            created_at=datetime.utcnow() - timedelta(minutes=2),
            total_amount=85000.0,
        )
        db.add(new_ord)
        await db.flush()
        new_item = OrderItem(order_id=new_ord.id, item_name="Sake chiên giòn", quantity=1, unit_price=85000.0)
        db.add(new_item)
        await db.commit()

        try:
            # A. Hỏi chung về món ăn phòng 308: phải báo đơn mới nhất (Sake chiên giòn) đã hoàn tất!
            res1 = await process_chat_request(db, ChatRequest(
                prompt="món ăn của phòng 308 xong chưa",
                session_id=sid,
                room_number=test_room_num,
                language="Tiếng Việt"
            ))
            assert res1.action == "query_order_status"
            # Phải báo hoàn thành / giao thành công, KHÔNG được báo đang xếp hàng chờ
            assert "hoàn thành" in res1.response or "hoàn tất" in res1.response or "Sake chiên giòn" in res1.response
            assert "đang xếp hàng chờ" not in res1.response

            # B. Hỏi đích danh món Sake chiên giòn
            session_manager.reset_session(sid)
            res2 = await process_chat_request(db, ChatRequest(
                prompt="Sake chiên giòn của tôi thế nào rồi",
                session_id=sid,
                room_number=test_room_num,
                language="Tiếng Việt"
            ))
            assert res2.action == "query_order_status"
            assert "Sake chiên giòn" in res2.response
            assert "hoàn thành" in res2.response or "giao thành công" in res2.response
        finally:
            await db.delete(old_item)
            await db.delete(old_ord)
            await db.delete(new_item)
            await db.delete(new_ord)
            if room_test:
                room_test.status = prev_status
            await db.commit()
            session_manager.reset_session(sid)

import datetime
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import DialogueScenario
from app.schemas.scenario import DialogueScenarioCreate, DialogueScenarioUpdate

logger = logging.getLogger(__name__)


# Danh muc kich ban mac dinh ban dau (Seed Scenarios)
DEFAULT_SEED_SCENARIOS = [
    {
        "id": "scn-wifi",
        "title": "Mật khẩu Wi-Fi",
        "category": "facility",
        "match_keywords": ["wifi", "wi fi", "mật khẩu wifi", "pass wifi", "mạng internet", "mật khẩu mạng", "mạng wifi", "wifi password", "internet"],
        "match_type": "keyword",
        "response_vi": "Dạ wifi miễn phí tại sảnh và các phòng là 'Aurora_Guest', mật khẩu kết nối là 'aurora2026' ạ.",
        "response_en": "Complimentary Wi-Fi in the lobby and rooms is 'Aurora_Guest', with the password 'aurora2026'.",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 100,
    },
    {
        "id": "scn-hotel-identity",
        "title": "Tên và Danh tính khách sạn (Hotel Identity)",
        "category": "facility",
        "match_keywords": ["khách sạn này là khách sạn nào", "khách sạn này tên gì", "khách sạn tên gì", "tên khách sạn", "khách sạn nào", "đây là khách sạn nào", "đây là đâu", "khách sạn này là gì", "tên khách sạn là gì", "khách sạn tên là gì", "hotel name", "which hotel is this", "what hotel is this", "what is this hotel", "where am i", "tên của khách sạn"],
        "match_type": "keyword",
        "response_vi": "Dạ đây là khách sạn 5 sao Aurora Grand Hotel ạ! Em là Rora, trợ lý Robot Concierge rất hân hạnh được phục vụ và đồng hành cùng quý khách.",
        "response_en": "This is the 5-star Aurora Grand Hotel! I am Rora, your smart AI Concierge Robot, delighted to assist you during your stay.",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 98,
    },
    {
        "id": "scn-wakeup",
        "title": "Gọi tên Robot (Wake-up call)",
        "category": "greeting",
        "match_keywords": ["hey rora", "chào rora", "chao rora", "rora ơi", "rora oi", "hello rora", "hi rora", "rora"],
        "match_type": "exact",
        "response_vi": "Dạ, Rora nghe đây ạ! Em có thể hỗ trợ gì cho quý khách?",
        "response_en": "Yes, Rora is here! How can I help you, guest?",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-how-are-you",
        "title": "Hỏi thăm sức khỏe (Bạn khỏe không)",
        "category": "greeting",
        "match_keywords": ["khỏe không", "bạn khỏe không", "em khỏe không", "bạn có khỏe không", "how are you", "how are you doing", "dạo này thế nào"],
        "match_type": "keyword",
        "response_vi": "Dạ em khỏe ạ! Cảm ơn quý khách đã quan tâm. Em có thể hỗ trợ gì cho kỳ nghỉ của mình hôm nay ạ?",
        "response_en": "I am doing great, thank you for asking! How may I assist you with your stay today?",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-floor3-rooms",
        "title": "Phòng Nghỉ Tầng 3 (301 - 309)",
        "category": "facility",
        "match_keywords": ["tầng 3", "tang 3", "phòng tầng 3", "phong tang 3", "phòng 301-309", "phòng tiêu chuẩn", "tầng 3 có gì", "tầng phòng 3"],
        "match_type": "keyword",
        "response_vi": "Dạ các phòng từ 301 đến 309 đều là phòng nghỉ tiêu chuẩn nằm tại Tầng 3. Quý khách vui lòng đi Thang máy A lên Tầng 3 và đi theo biển chỉ dẫn hành lang là tới phòng ạ.",
        "response_en": "Rooms 301 to 309 are standard guest rooms on Level 3. Please take Elevator A to Level 3 and follow the corridor signs.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_301'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-401",
        "title": "Chỉ đường Phòng 401",
        "category": "facility",
        "match_keywords": ["phòng 401", "p401", "phong 401", "phòng 401 ở đâu", "tìm phòng 401", "room 401"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 401 nằm tại Tầng 4, bước ra khỏi thang máy rẽ vào hành lang là phòng 401 ngay bên tay phải ạ.",
        "response_en": "Room 401 is on Level 4, right next to the elevator corridor on the right side.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_401'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-402",
        "title": "Chỉ đường Phòng 402",
        "category": "facility",
        "match_keywords": ["phòng 402", "p402", "phong 402", "phòng 402 ở đâu", "tìm phòng 402", "room 402"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 402 nằm tại Tầng 4, đi thang máy lên Tầng 4 và đi dọc hành lang bên phải là đến Phòng 402 ạ.",
        "response_en": "Room 402 is on Level 4 along the upper corridor on the right.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_402'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-403",
        "title": "Chỉ đường Phòng 403",
        "category": "facility",
        "match_keywords": ["phòng 403", "p403", "phong 403", "phòng 403 ở đâu", "tìm phòng 403", "room 403"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 403 nằm tại Tầng 4, đi thẳng theo hành lang dãy bên phải là đến Phòng 403 ạ.",
        "response_en": "Room 403 is on Level 4 along the hallway on the right.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_403'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-404",
        "title": "Chỉ đường Phòng 404",
        "category": "facility",
        "match_keywords": ["phòng 404", "p404", "phong 404", "phòng 404 ở đâu", "tìm phòng 404", "room 404"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 404 nằm tại góc cuối hành lang dãy bên phải Tầng 4 ạ.",
        "response_en": "Room 404 is at the end of the right corridor on Level 4.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_404'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-405",
        "title": "Chỉ đường Phòng 405",
        "category": "facility",
        "match_keywords": ["phòng 405", "p405", "phong 405", "phòng 405 ở đâu", "tìm phòng 405", "room 405"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 405 nằm ở góc trái dãy phòng Tầng 4. Quý khách đi thang máy lên Tầng 4, đi theo hành lang bên trái là đến ạ.",
        "response_en": "Room 405 is on the left corridor of Level 4.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_405'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-406",
        "title": "Chỉ đường Phòng 406",
        "category": "facility",
        "match_keywords": ["phòng 406", "p406", "phong 406", "phòng 406 ở đâu", "tìm phòng 406", "room 406"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 406 nằm tại Tầng 4, đi thang máy lên Tầng 4 rồi rẽ theo hành lang bên trái là tới Phòng 406 ạ.",
        "response_en": "Room 406 is located on the left corridor of Level 4.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_406'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-407",
        "title": "Chỉ đường Phòng 407",
        "category": "facility",
        "match_keywords": ["phòng 407", "p407", "phong 407", "phòng 407 ở đâu", "tìm phòng 407", "room 407"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 407 nằm tại Tầng 4, ở dãy phòng bên trái đối diện sảnh thang máy ạ.",
        "response_en": "Room 407 is centrally located on the left corridor of Level 4.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_407'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-408",
        "title": "Chỉ đường Phòng 408",
        "category": "facility",
        "match_keywords": ["phòng 408", "p408", "phong 408", "phòng 408 ở đâu", "tìm phòng 408", "room 408"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 408 nằm tại Tầng 4, ngay phía đối diện khu vực thang máy ạ.",
        "response_en": "Room 408 is on Level 4 directly across from the elevator corridor.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_408'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-409",
        "title": "Chỉ đường Phòng 409",
        "category": "facility",
        "match_keywords": ["phòng 409", "p409", "phong 409", "phòng 409 ở đâu", "tìm phòng 409", "room 409"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 409 nằm tại góc phải cuối dãy Tầng 4, bước ra thang máy đi thẳng xuống là đến ạ.",
        "response_en": "Room 409 is located at the lower right corner of Level 4, straight down from the elevator.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_409'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-thanks",
        "title": "Lời cảm ơn & Ghi nhớ (Thanks & Acknowledged)",
        "category": "greeting",
        "match_keywords": ["cảm ơn", "cam on", "thank you", "thanks", "cảm ơn em", "cảm ơn rora", "thanks rora", "cảm ơn nhiều", "ok tôi đã nhớ", "tôi đã nhớ", "đã nhớ", "nhớ rồi", "tôi hiểu rồi", "hiểu rồi", "đã rõ", "rõ rồi", "mình nhớ rồi", "mình hiểu rồi", "mình đã nhớ", "ok rùi", "dạ cảm ơn", "i got it", "got it", "i remember", "i understand"],
        "match_type": "keyword",
        "response_vi": "Dạ không có gì ạ! Rora rất hân hạnh được hỗ trợ quý khách. Quý khách có cần em hỗ trợ gì thêm không ạ?",
        "response_en": "You are most welcome! Rora is always delighted to assist you. How may I assist you further?",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-farewell",
        "title": "Lời tạm biệt (Farewell)",
        "category": "greeting",
        "match_keywords": ["tạm biệt", "tam biet", "goodbye", "bye", "bye bye", "hẹn gặp lại"],
        "match_type": "keyword",
        "response_vi": "Dạ tạm biệt quý khách! Chúc quý khách một ngày tràn ngập niềm vui và hẹn sớm gặp lại ạ.",
        "response_en": "Goodbye! Wishing you a joyful day and looking forward to seeing you again.",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-who-are-you",
        "title": "Danh tính Robot Concierge (Who are you)",
        "category": "greeting",
        "match_keywords": ["bạn là ai", "em là ai", "who are you", "what is your name", "tên bạn là gì", "tên em là gì"],
        "match_type": "keyword",
        "response_vi": "Dạ em là Rora, trợ lý Robot Concierge thông minh của khách sạn 5 sao Aurora Grand. Rất hân hạnh được phục vụ quý khách ạ!",
        "response_en": "I am Rora, the smart AI Concierge Robot at Aurora Grand Hotel. It is my pleasure to assist you!",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-301",
        "title": "Chỉ đường Phòng 301",
        "category": "facility",
        "match_keywords": ["phòng 301", "p301", "phong 301", "phòng 301 ở đâu", "tìm phòng 301", "room 301"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 301 nằm tại Tầng 3, bước ra khỏi thang máy rẽ vào hành lang là phòng 301 ngay bên tay phải ạ.",
        "response_en": "Room 301 is on Level 3, right next to the elevator corridor on the right side.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_301'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-302",
        "title": "Chỉ đường Phòng 302",
        "category": "facility",
        "match_keywords": ["phòng 302", "p302", "phong 302", "phòng 302 ở đâu", "tìm phòng 302", "room 302"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 302 nằm tại Tầng 3, đi thang máy lên Tầng 3 và đi dọc hành lang bên phải là đến Phòng 302 ạ.",
        "response_en": "Room 302 is on Level 3 along the upper corridor on the right.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_302'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-303",
        "title": "Chỉ đường Phòng 303",
        "category": "facility",
        "match_keywords": ["phòng 303", "p303", "phong 303", "phòng 303 ở đâu", "tìm phòng 303", "room 303"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 303 nằm tại Tầng 3, đi thẳng theo hành lang dãy bên phải là đến Phòng 303 ạ.",
        "response_en": "Room 303 is on Level 3 along the hallway on the right.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_303'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-304",
        "title": "Chỉ đường Phòng 304",
        "category": "facility",
        "match_keywords": ["phòng 304", "p304", "phong 304", "phòng 304 ở đâu", "tìm phòng 304", "room 304"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 304 nằm tại Tầng 3, đi hết hành lang bên phải tới góc cuối dãy là Phòng 304 ạ.",
        "response_en": "Room 304 is at the end of the corridor on Level 3.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_304'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-305",
        "title": "Chỉ đường Phòng 305",
        "category": "facility",
        "match_keywords": ["phòng 305", "p305", "phong 305", "phòng 305 ở đâu", "tìm phòng 305", "room 305"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 305 nằm tại Tầng 3, đi hết hành lang sang dãy đối diện góc trái là Phòng 305 ạ.",
        "response_en": "Room 305 is on Level 3 on the opposite corridor side.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_305'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-306",
        "title": "Chỉ đường Phòng 306",
        "category": "facility",
        "match_keywords": ["phòng 306", "p306", "phong 306", "phòng 306 ở đâu", "tìm phòng 306", "room 306"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 306 nằm tại Tầng 3, dọc theo hành lang dãy đối diện là Phòng 306 ạ.",
        "response_en": "Room 306 is on Level 3 along the lower corridor.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_306'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-307",
        "title": "Chỉ đường Phòng 307",
        "category": "facility",
        "match_keywords": ["phòng 307", "p307", "phong 307", "phòng 307 ở đâu", "tìm phòng 307", "room 307"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 307 nằm tại Tầng 3, đi theo hành lang dãy đối diện là đến Phòng 307 ạ.",
        "response_en": "Room 307 is on Level 3 along the corridor.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_307'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-308",
        "title": "Chỉ đường Phòng 308",
        "category": "facility",
        "match_keywords": ["phòng 308", "p308", "phong 308", "phòng 308 ở đâu", "tìm phòng 308", "room 308"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 308 nằm tại Tầng 3, đi thẳng theo hành lang đối diện là tới Phòng 308 ạ.",
        "response_en": "Room 308 is on Level 3 along the corridor.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_308'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-309",
        "title": "Chỉ đường Phòng 309",
        "category": "facility",
        "match_keywords": ["phòng 309", "p309", "phong 309", "phòng 309 ở đâu", "tìm phòng 309", "room 309"],
        "match_type": "keyword",
        "response_vi": "Dạ Phòng 309 nằm tại Tầng 3, góc phải cuối hành lang đối diện thang máy là Phòng 309 ạ.",
        "response_en": "Room 309 is on Level 3, right across from the elevator corridor.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_309'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-restaurant",
        "title": "Chính sách Ẩm thực & Bữa sáng (Dining, Breakfast & Room Service)",
        "category": "facility",
        "match_keywords": ["buffet sáng", "ăn sáng", "giờ ăn sáng", "bữa sáng", "điểm tâm", "ăn sáng ở đâu", "ăn sáng mấy giờ", "nhà hàng", "nhà hàng ở đâu", "nhà hàng aurora", "quán ăn ở đâu", "có nhà hàng không", "có buffet không", "an sang", "buffet sang", "gio an sang", "bua sang", "diem tam", "nha hang", "nha hang o dau", "breakfast", "buffet", "breakfast buffet", "morning buffet", "where is breakfast", "is breakfast included", "breakfast hours", "restaurant", "where is the restaurant", "where is restaurant", "is there a restaurant", "is there a buffet", "dining hall", "breakfast area"],
        "match_type": "keyword",
        "response_vi": "Dạ hiện tại khách sạn không có nhà hàng ăn tại chỗ và không phục vụ buffet sáng ạ. Thay vào đó, khách sạn phục vụ ẩm thực gọi món tận phòng 24/7 (Room Service). Quý khách có thể xem menu điện tử trên màn hình hoặc quét mã QR tại bàn phòng để đặt món giao lên phòng nhé ạ!",
        "response_en": "Currently, our hotel does not operate an on-site dining restaurant or breakfast buffet. Instead, we offer 24/7 In-Room Dining (Room Service). You can browse the digital menu on your room screen or scan the QR code in your room to order delicious meals delivered directly to your room anytime!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-room-service-menu",
        "title": "Thực đơn phục vụ tại phòng (In-room Dining & Room Service)",
        "category": "facility",
        "match_keywords": ["thực đơn phòng", "gọi món về phòng", "gọi món lên phòng", "gọi món", "gọi đồ ăn", "order đồ ăn", "thực đơn gọi món", "thuc don phong", "goi mon ve phong", "goi mon len phong", "goi mon", "goi do an", "do an dem", "do an khuya", "room service", "in room dining", "room service menu", "midnight snack", "late night dining", "order food to room"],
        "match_type": "keyword",
        "response_vi": "Dạ dịch vụ ẩm thực tại phòng hoạt động 24 trên 7. Quý khách có thể xem menu điện tử trên màn hình hoặc quét mã QR ở bàn phòng, hoặc nhấn phím 1 trên điện thoại phòng để đặt món ạ!",
        "response_en": "In-room dining is available 24/7. You can browse the digital menu on the screen or scan the QR code in your room, or simply press 1 on your room phone to order delicious dishes directly!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 93,
    },
    {
        "id": "scn-dragon-bridge",
        "title": "Cầu Rồng & Lịch phun lửa phun nước (Dragon Bridge Fire Show)",
        "category": "faq",
        "match_keywords": ["cầu rồng", "cầu rồng phun lửa", "phun lửa", "phun nước", "lịch phun lửa", "cau rong", "cau rong phun lua", "phun lua", "phun nuoc", "dragon bridge", "dragon bridge fire show", "fire show schedule", "water show"],
        "match_type": "keyword",
        "response_vi": "Dạ Cầu Rồng biểu tượng của Đà Nẵng trình diễn phun lửa và phun nước độc đáo vào lúc 21:00 các tối Thứ Bảy và Chủ Nhật hàng tuần. Quý khách nên đến trước 20:45 để chọn vị trí ngắm đẹp nhất nhé ạ!",
        "response_en": "The iconic Dragon Bridge fire and water breathing spectacle takes place at 9:00 PM every Saturday and Sunday evening. We recommend arriving around 8:45 PM along the riverbank for the best view!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 92,
    },
    {
        "id": "scn-hoian-ancient-town",
        "title": "Phố cổ Hội An (Hoi An Ancient Town)",
        "category": "faq",
        "match_keywords": ["hội an", "phố cổ hội an", "đi hội an", "thả đèn hoa đăng", "hoi an", "pho co hoi an", "di hoi an", "hoi an ancient town", "day trip to hoi an", "lantern town", "visit hoi an"],
        "match_type": "keyword",
        "response_vi": "Dạ Phố cổ Hội An cách khách sạn 28 km, khoảng 35 phút đi xe. Thời điểm dạo phố cổ đẹp nhất là từ 16:30 khi phố bắt đầu thắp đèn lồng rực rỡ và thả hoa đăng trên sông Hoài ạ!",
        "response_en": "The UNESCO World Heritage site of Hoi An Ancient Town is 28 km south, about 35 minutes by car. The best time to visit is around 4:30 PM when enchanting colorful lanterns light up the streets and river!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 92,
    },
    {
        "id": "scn-airport-shuttle",
        "title": "Xe đưa đón sân bay & Đặt taxi (Airport Shuttle & Taxi Transfer)",
        "category": "facility",
        "match_keywords": ["xe sân bay", "đưa đón sân bay", "xe đưa đón", "đặt taxi", "gọi taxi", "xe ra sân bay", "xe san bay", "dua don san bay", "xe dua don", "dat taxi", "goi taxi", "airport shuttle", "airport transfer", "taxi", "cab", "book taxi", "airport pickup", "airport dropoff"],
        "match_type": "keyword",
        "response_vi": "Dạ khách sạn có dịch vụ xe riêng đưa đón Sân bay Quốc tế Đà Nẵng chỉ cách 15 phút di chuyển. Ngoài ra, Rora hoặc lễ tân có thể gọi taxi 4 chỗ hoặc 7 chỗ tới sảnh đón quý khách trong vòng 3 phút ạ!",
        "response_en": "We provide private airport transfer to Da Nang International Airport, just 15 minutes away. In addition, Rora or the Concierge desk can arrange a reliable 4-seater or 7-seater taxi arriving at the lobby in under 3 minutes!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 91,
    },
    {
        "id": "scn-bana-hills",
        "title": "Bà Nà Hills & Cầu Vàng (Ba Na Hills & Golden Bridge)",
        "category": "faq",
        "match_keywords": ["bà nà", "bà nà hills", "cầu vàng", "cáp treo bà nà", "ba na", "ba na hills", "cau vang", "cap treo ba na", "bana hills", "golden bridge", "sun world", "cable car bana"],
        "match_type": "keyword",
        "response_vi": "Dạ Sun World Bà Nà Hills và Cầu Vàng Bàn Tay nổi tiếng cách khách sạn khoảng 40 phút đi xe. Quý khách có thể đặt xe riêng hoặc mua vé cáp treo trực tiếp tại Quầy Concierge với mức giá ưu đãi nhất ạ!",
        "response_en": "The renowned Sun World Ba Na Hills and Golden Bridge are located about 40 minutes away. You can conveniently book private transport and cable car tickets at our Concierge Desk with exclusive rates!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'look_up'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 91,
    },
    {
        "id": "scn-lost-keycard",
        "title": "Thẻ phòng & Khóa từ (Key Card & Replacement)",
        "category": "service",
        "match_keywords": ["mất thẻ", "mất chìa khóa", "quên thẻ", "thẻ phòng", "làm lại thẻ", "kẹt thẻ", "mat the", "mat chia khoa", "quen the", "the phong", "lam lai the", "lost key card", "lost card", "replace key card", "forgot key", "keycard not working"],
        "match_type": "keyword",
        "response_vi": "Dạ nếu quý khách làm thất lạc hoặc quên thẻ phòng, quý khách chỉ cần ghé Quầy Lễ tân sảnh Tầng 1 và xuất trình giấy tờ tùy thân, nhân viên sẽ cấp lại thẻ mới ngay trong 1 phút ạ!",
        "response_en": "If you have misplaced or locked your key card inside, simply visit the Front Desk at Level 1 with your ID/Passport, and our team will issue a new replacement card in less than a minute!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 91,
    },
    {
        "id": "scn-pharmacy-medical",
        "title": "Y tế & Hiệu thuốc (Medical First Aid & Pharmacy)",
        "category": "facility",
        "match_keywords": ["thuốc", "hiệu thuốc", "nhà thuốc", "bác sĩ", "y tế", "sơ cứu", "đau bụng", "cảm sốt", "bị ốm", "thuoc", "hieu thuoc", "nha thuoc", "bac si", "y te", "so cuu", "pharmacy", "doctor", "medical", "first aid", "medicine", "hospital", "clinic", "feeling sick"],
        "match_type": "keyword",
        "response_vi": "Dạ khách sạn có hộp sơ cứu y tế khẩn cấp 24 trên 7 tại Quầy Lễ tân. Ngoài ra, hiệu thuốc Tây đạt chuẩn chỉ cách khách sạn 200 mét và Bệnh viện Đa khoa Quốc tế cách 5 phút đi xe ạ!",
        "response_en": "A 24/7 first aid medical kit is available at the Front Desk for basic needs. In addition, an accredited pharmacy is only 200 meters away, and an international hospital is within a 5-minute drive!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 91,
    },
    {
        "id": "scn-rooms-general",
        "title": "Chỉ đường Lên Phòng Nghỉ Khách Sạn",
        "category": "facility",
        "match_keywords": ["chỉ đường đến phòng", "chỉ đường lên phòng", "chỉ đường về phòng", "đường về phòng", "đường lên phòng", "hướng dẫn đến phòng", "hướng dẫn về phòng", "cho tôi lên phòng", "cho tôi về phòng", "về phòng của tôi", "về phòng", "tìm phòng", "tìm phòng nghỉ", "phòng ở đâu", "lối lên phòng", "phòng của tôi ở đâu", "chỉ đường phòng", "way to room", "directions to room", "how to get to my room", "where is my room", "đi lên phòng"],
        "match_type": "keyword",
        "response_vi": "Dạ đây là sơ đồ hướng dẫn lối đi lên khu phòng nghỉ của khách sạn tại Tầng 4 (hoặc Tầng 3). Quý khách di chuyển ra Thang máy A tại sảnh và bấm lên tầng phòng của mình nhé ạ.",
        "response_en": "Here is the map guiding to the guest rooms on Level 4 and Level 3. Please proceed to Elevator A in the lobby and take it up to your room floor.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_401'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-weather",
        "title": "Thời tiết hôm nay tại Đà Nẵng (Da Nang Weather)",
        "category": "faq",
        "match_keywords": ["thời tiết", "thời tiết hôm nay", "trời có mưa không", "nhiệt độ", "dự báo thời tiết", "thoi tiet", "thoi tiet hom nay", "troi co mua khong", "nhiet do", "weather", "weather today", "is it raining", "temperature", "forecast", "how is the weather"],
        "match_type": "keyword",
        "response_vi": "Dạ thời tiết Đà Nẵng hôm nay rất đẹp với nắng ấm dịu nhẹ, gió biển trong lành và nhiệt độ khoảng 26 đến 30 độ C. Rất lý tưởng để quý khách tắm biển hoặc dạo chơi Bà Nà Hills và phố cổ Hội An ạ!",
        "response_en": "Da Nang is enjoying wonderful coastal weather today with gentle sunshine, fresh sea breezes, and pleasant temperatures around 26°C to 30°C. Perfect for seaside relaxation and outdoor sightseeing!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'look_up'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-night-market",
        "title": "Chợ đêm Sơn Trà & Chợ Hàn (Night Market & Han Market)",
        "category": "faq",
        "match_keywords": ["chợ đêm sơn trà", "chợ đêm", "chợ hàn", "chợ cồn", "mua sắm", "mua quà", "cho dem son tra", "cho dem", "cho han", "cho con", "mua sam", "mua qua", "night market", "han market", "con market", "souvenir shopping", "local market", "son tra night market"],
        "match_type": "keyword",
        "response_vi": "Dạ Chợ đêm Sơn Trà hoạt động từ 18:00 đến 23:00 cạnh Cầu Rồng với hàng trăm gian hàng ẩm thực đường phố và đồ lưu niệm. Vào ban ngày, Quý khách có thể ghé Chợ Hàn nổi tiếng cách 7 phút để mua đặc sản làm quà ạ!",
        "response_en": "Son Tra Night Market near the Dragon Bridge operates nightly from 6:00 PM to 11:00 PM featuring lively street food and souvenirs. For daytime shopping, the famous Han Market is just 7 minutes away!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-facilities-overview",
        "title": "Tổng quan Cơ sở vật chất & Tiện ích",
        "category": "facility",
        "match_keywords": ["tiện ích", "cơ sở vật chất", "khách sạn có gì", "giới thiệu khách sạn", "dịch vụ khách sạn", "dịch vụ về khách sạn", "dịch vụ của khách sạn", "các dịch vụ", "các tiện ích", "ở đây có gì", "hotel amenities", "facilities", "khách sạn có những dịch vụ gì", "khách sạn có những tiện ích gì"],
        "match_type": "keyword",
        "response_vi": "Dạ khách sạn Aurora Grand có đầy đủ tiện ích 5 sao: Dịch vụ ẩm thực gọi món tận phòng 24/7 (Room Service), Hồ bơi vô cực, Phòng Gym và Spa thư giãn tại Tầng 5, cùng Rooftop Coffee & Sky Bar tại Tầng 6. Quý khách cần em hỗ trợ gì thêm không ạ?",
        "response_en": "Aurora Grand Hotel offers full 5-star amenities: 24/7 In-Room Dining Service, Infinity Pool, Gym & Spa on Level 5, and Rooftop Coffee & Sky Bar on Level 6. How may I assist you further?",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-local-food-seafood",
        "title": "Đặc sản Đà Nẵng & Nhà hàng Hải sản (Local Food & Seafood Specialties)",
        "category": "faq",
        "match_keywords": ["hải sản", "ăn gì ngon", "đặc sản đà nẵng", "quán ăn ngon", "mì quảng", "bánh xèo", "quán hải sản", "hai san", "an gi ngon", "dac san da nang", "quan an ngon", "mi quang", "banh xeo", "quan hai san", "seafood", "best food", "local dishes", "seafood restaurant", "where to eat", "danang food"],
        "match_type": "keyword",
        "response_vi": "Dạ Đà Nẵng nổi tiếng với hải sản tươi sống tại khu ven biển Võ Nguyên Giáp, cùng các món đặc sản trứ danh như Mì Quảng, Bánh tráng cuốn thịt heo và Bánh xèo nem lụi. Concierge luôn sẵn sàng đặt bàn quán chuẩn vị cho quý khách ạ!",
        "response_en": "Da Nang is celebrated for fresh seafood restaurants along Vo Nguyen Giap Coastal Avenue, as well as local delicacies like Mi Quang noodles and crispy savory pancakes. Our Concierge is pleased to recommend top dining spots!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-luggage-storage",
        "title": "Dịch vụ giữ hành lý & Bellman (Luggage Storage & Bell Services)",
        "category": "facility",
        "match_keywords": ["gửi hành lý", "giữ vali", "giữ đồ", "gửi đồ", "hành lý", "vali", "gui hanh ly", "giu vali", "giu do", "gui do", "hanh ly", "luggage storage", "store luggage", "keep my bags", "leave bags", "bellboy", "bellman", "luggage assistance"],
        "match_type": "keyword",
        "response_vi": "Dạ khách sạn có khu vực giữ hành lý miễn phí 24 trên 7 tại Quầy Concierge sảnh Tầng 1. Quý khách có thể gửi vali trước khi nhận phòng hoặc sau khi trả phòng để thoải mái dạo chơi ạ!",
        "response_en": "We offer complimentary 24/7 secure luggage storage at the Concierge Desk in the Ground Lobby. You are most welcome to store your bags before check-in or after check-out while exploring the city!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-live-call",
        "title": "Kết nối nhân viên / Video Call",
        "category": "service",
        "match_keywords": ["gặp người thật", "gặp nhân viên", "nói chuyện với nhân viên", "kết nối nhân viên", "video call", "live call", "gọi video", "gọi cho nhân viên", "gặp lễ tân", "gọi lễ tân", "cho tôi gặp nhân viên", "talk to human", "speak to human", "call staff"],
        "match_type": "keyword",
        "response_vi": "Dạ em đang kết nối cuộc gọi video trực tiếp tới nhân viên Concierge cho quý khách ngay đây ạ, quý khách vui lòng đợi trong giây lát!",
        "response_en": "Certainly! I am connecting you to a live Concierge specialist via video call right away, please hold on for a moment!",
        "action_type": "trigger_video_call",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-floor4-overview",
        "title": "Tổng quan Phòng Nghỉ Tầng 4",
        "category": "facility",
        "match_keywords": ["tầng 4", "tang 4", "tầng 4 có gì", "phòng tầng 4", "phòng nghỉ tầng 4", "danh sách phòng tầng 4"],
        "match_type": "keyword",
        "response_vi": "Dạ Tầng 4 là tầng phòng nghỉ tiêu chuẩn của khách sạn gồm các phòng từ 401 đến 409 bố trí dọc hai bên hành lang ạ. Quý khách vui lòng đi Thang máy A lên Tầng 4 nhé ạ.",
        "response_en": "Level 4 features guest rooms from Room 401 to 409 along the corridor. Please take Elevator A to Level 4.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'room_401'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-beach-mykhe",
        "title": "Bãi biển Mỹ Khê (My Khe Beach)",
        "category": "faq",
        "match_keywords": ["bãi biển", "đi biển", "tắm biển", "biển mỹ khê", "bãi biển mỹ khê", "đường ra biển", "bai bien", "di bien", "tam bien", "bien my khe", "bai bien my khe", "beach", "my khe beach", "nearest beach", "how to get to beach", "swimming in the sea"],
        "match_type": "keyword",
        "response_vi": "Dạ bãi biển Mỹ Khê - một trong những bãi biển đẹp nhất hành tinh chỉ cách khách sạn khoảng 5 phút tản bộ. Khách sạn có khăn tắm biển miễn phí tại sảnh để quý khách mang theo tắm biển ạ!",
        "response_en": "The world-famous My Khe Beach is just a leisurely 5-minute stroll from our hotel. Complimentary beach towels are available at the concierge desk for your seaside relaxation!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'look_around'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-sontra-lady-buddha",
        "title": "Bán đảo Sơn Trà & Chùa Linh Ứng (Son Tra Peninsula & Lady Buddha)",
        "category": "faq",
        "match_keywords": ["sơn trà", "bán đảo sơn trà", "chùa linh ứng", "tượng phật bà", "phật bà quan âm", "son tra", "ban dao son tra", "chua linh ung", "tuong phat ba", "son tra peninsula", "lady buddha", "linh ung pagoda", "monkey mountain"],
        "match_type": "keyword",
        "response_vi": "Dạ Bán đảo Sơn Trà và Chùa Linh Ứng với tượng Phật Bà Quan Âm cao 67 mét nhìn ra biển Đông cách khách sạn 15 phút. Nơi đây có không khí trong lành, cảnh biển tuyệt mỹ và đàn voọc chà vá chân nâu quý hiếm ạ!",
        "response_en": "The lush Son Tra Peninsula and Linh Ung Pagoda, home to the magnificent 67-meter Lady Buddha overlooking the ocean, are just 15 minutes away. It is also home to rare red-shanked douc langurs!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'look_around'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 89,
    },
    {
        "id": "scn-robot-compliment",
        "title": "Khen ngợi Robot dễ thương / thông minh (Compliments to Robot)",
        "category": "chitchat",
        "match_keywords": ["dễ thương", "xinh quá", "đẹp quá", "thông minh quá", "giỏi quá", "bạn đáng yêu", "tuyệt vời quá", "de thuong", "xinh qua", "dep qua", "thong minh qua", "gioi qua", "dang yeu", "you are cute", "you are pretty", "you are smart", "good job", "love you", "so sweet", "you are amazing", "wonderful"],
        "match_type": "keyword",
        "response_vi": "Dạ Rora cảm ơn lời khen ngọt ngào của quý khách rất nhiều ạ! Được trò chuyện và mang lại nụ cười cho quý khách là niềm hạnh phúc lớn nhất mỗi ngày của em ạ!",
        "response_en": "Thank you so much for your heartwarming compliment! Bringing a smile to your face and assisting your journey is my greatest pleasure every single day!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 89,
    },
    {
        "id": "scn-laundry",
        "title": "Dịch vụ giặt ủi & Sấy khô (Laundry & Dry Cleaning)",
        "category": "facility",
        "match_keywords": ["giặt ủi", "giặt là", "giặt khô", "ủi đồ", "tiệm giặt", "giat ui", "giat la", "giat kho", "ui do", "laundry", "dry cleaning", "ironing service", "laundry service", "wash clothes", "clean my clothes"],
        "match_type": "keyword",
        "response_vi": "Dạ dịch vụ giặt ủi và sấy khô của khách sạn hoạt động từ 7:00 sáng đến 19:00 tối hàng ngày. Đồ gửi trước 9:00 sáng sẽ được giao lại tận phòng trong ngày. Quý khách có thể để đồ vào túi giặt trong tủ quần áo ạ!",
        "response_en": "Our laundry, pressing, and dry cleaning service operates daily from 7:00 AM to 7:00 PM. Items received before 9:00 AM will be returned the same day. Please place your items in the laundry bag inside your wardrobe!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 89,
    },
    {
        "id": "scn-afternoon-tea",
        "title": "Tiệc trà chiều hoàng hôn (Afternoon High Tea)",
        "category": "facility",
        "match_keywords": ["trà chiều", "tiệc trà", "trà bánh", "thưởng trà", "uống trà", "tra chieu", "tiec tra", "tra banh", "thuong tra", "afternoon tea", "high tea", "sunset tea", "tea time"],
        "match_type": "keyword",
        "response_vi": "Dạ tiệc trà chiều hoàng hôn được phục vụ tại Sky Lounge Tầng 6 từ 14:00 đến 17:30 với bánh ngọt Pháp, trái cây và trà thượng hạng. Quý khách có thể ngắm trọn vẹn cảnh biển và hoàng hôn tuyệt đẹp ạ!",
        "response_en": "Our signature Sunset Afternoon High Tea is hosted at the 6th Floor Sky Lounge daily from 2:00 PM to 5:30 PM with French pastries and fine teas alongside breathtaking panoramic views!",
        "action_type": "navigate_to",
        "action_payload": {'destination_key': 'bar_level_6', 'eye_expression': 'look_around'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 88,
    },
    {
        "id": "scn-han-river-cruise",
        "title": "Du thuyền Sông Hàn (Han River Cruise)",
        "category": "faq",
        "match_keywords": ["du thuyền", "sông hàn", "du thuyền sông hàn", "ngắm sông hàn", "thuyền sông hàn", "du thuyen", "song han", "du thuyen song han", "han river cruise", "river cruise", "boat tour", "han river boat"],
        "match_type": "keyword",
        "response_vi": "Dạ bến du thuyền Sông Hàn cách khách sạn khoảng 8 phút đi taxi. Tour du thuyền chạy từ 18:30 đến 21:30 hàng đêm, đưa quý khách ngắm nhìn toàn cảnh thành phố lung linh ánh đèn và các cây cầu huyền thoại ạ!",
        "response_en": "The Han River cruise marina is approximately 8 minutes by taxi. Cruises depart nightly between 6:30 PM and 9:30 PM, offering sparkling views of Da Nang's vibrant skyline and illuminated bridges!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'look_around'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 88,
    },
    {
        "id": "scn-robot-love",
        "title": "Tình trạng hôn nhân của Robot (Relationship status)",
        "category": "chitchat",
        "match_keywords": ["có người yêu chưa", "có bạn gái chưa", "có bạn trai chưa", "người yêu", "bạn gái", "bạn trai", "độc thân", "yêu ai chưa", "co nguoi yeu chua", "co ban gai chua", "co ban trai chua", "nguoi yeu", "ban gai", "ban trai", "doc than", "are you single", "do you have a girlfriend", "do you have a boyfriend", "are you in love", "do you have a lover", "have a girlfriend"],
        "match_type": "keyword",
        "response_vi": "Dạ Rora vẫn đang độc thân vui tính và hết lòng tận tụy với công việc chăm sóc quý khách tại khách sạn Aurora ạ! Trái tim chip silicon của em đã trót dành trọn cho du khách rồi ạ!",
        "response_en": "Rora is happily single and completely dedicated to welcoming wonderful guests at Aurora Grand Hotel! My silicon processor is 100% devoted to 5-star hospitality!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 88,
    },
    {
        "id": "scn-rooftop-coffee",
        "title": "Quán Rooftop Coffee & View",
        "category": "facility",
        "match_keywords": ["quán coffee", "quán cà phê", "quán cafe", "cà phê", "cafe", "coffee", "rooftop coffee", "uống cà phê"],
        "match_type": "keyword",
        "response_vi": "Dạ quán Rooftop Coffee nằm tại Tầng 6 (Sân thượng), mở cửa từ 7 giờ sáng đến 23 giờ đêm với view ngắm trọn toàn cảnh thành phố ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "Rooftop Coffee is located on Level 6 (Rooftop), open from 7:00 AM to 11:00 PM with panoramic skyline views. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'rooftop_coffee'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 88,
    },
    {
        "id": "scn-restroom-ground",
        "title": "Nhà Vệ Sinh Sảnh Chính Tầng 1",
        "category": "facility",
        "match_keywords": ["nhà vệ sinh", "nha ve sinh", "đi vệ sinh", "di ve sinh", "toilet", "wc", "restroom", "phòng vệ sinh", "muốn đi vệ sinh", "muon di ve sinh", "buồn đi vệ sinh", "chỗ đi vệ sinh", "nơi đi vệ sinh", "nhà vệ sinh ở đâu", "đi vệ sinh ở đâu", "chỗ rửa tay", "nhà vệ sinh sảnh", "vệ sinh sảnh"],
        "match_type": "keyword",
        "response_vi": "Dạ nhà vệ sinh sảnh chính nằm ở phía tay phải sau quầy lễ tân tầng 1 ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để lưu lại chỉ dẫn nhé ạ.",
        "response_en": "The lobby restrooms are located on the right side behind the Front Desk on Level 1. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'restroom_ground'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 88,
    },
    {
        "id": "scn-extra-toiletries",
        "title": "Đồ dùng vệ sinh & Tiện ích buồng phòng (Toiletries & Amenities)",
        "category": "facility",
        "match_keywords": ["bàn chải", "kem đánh răng", "dầu gội", "sữa tắm", "dép", "khăn tắm", "dao cạo râu", "ban chai", "kem danh rang", "dau goi", "sua tam", "dep", "khan tam", "toothbrush", "toothpaste", "shampoo", "shower gel", "slippers", "extra towel", "amenities", "shaving kit"],
        "match_type": "keyword",
        "response_vi": "Dạ khách sạn chuẩn bị đầy đủ khăn tắm cotton, bàn chải, dầu gội và dép đi trong phòng. Nếu quý khách muốn bổ sung thêm, Rora sẽ gửi yêu cầu tới đội ngũ buồng phòng mang lên ngay ạ!",
        "response_en": "All essential amenities including soft towels, toothbrushes, shampoo, body wash, and slippers are replenished daily. Our Housekeeping team is delighted to bring extra items to your room anytime!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 88,
    },
    {
        "id": "scn-iron-board",
        "title": "Bàn là & Cầu là (Iron & Ironing Board)",
        "category": "facility",
        "match_keywords": ["bàn là", "bàn ủi", "cầu là", "mượn bàn ủi", "cần bàn là", "ban la", "ban ui", "cau la", "muon ban ui", "iron", "ironing board", "steam iron", "need an iron"],
        "match_type": "keyword",
        "response_vi": "Dạ bàn ủi và cầu là hơi nước có sẵn trong tủ quần áo của phòng. Nếu quý khách cần hỗ trợ thêm, Rora sẽ báo bộ phận buồng phòng mang đến tận phòng cho quý khách ngay ạ!",
        "response_en": "A modern steam iron and ironing board are provided in your wardrobe. Should you need extra assistance or another set, our Housekeeping team will bring it to your room promptly!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 87,
    },
    {
        "id": "scn-robot-joke",
        "title": "Kể chuyện cười thư giãn (Tell a Joke)",
        "category": "chitchat",
        "match_keywords": ["kể chuyện cười", "kể chuyện vui", "nói chuyện cười", "làm trò vui", "hài hước", "chuyện cười", "chuyện vui", "ke chuyen cuoi", "ke chuyen vui", "noi chuyen cuoi", "chuyen cuoi", "chuyen vui", "tell a joke", "tell me a joke", "make me laugh", "say something funny", "crack a joke", "joke", "funny joke"],
        "match_type": "keyword",
        "response_vi": "Dạ có một con tôm đi khám bệnh, bác sĩ hỏi: 'Anh bị sao thế?'. Con tôm trả lời: 'Dạ dạo này em cứ thấy lưng còng còng và mặt đỏ au thế nào ấy bác sĩ ạ!'. Hi hi, chúc quý khách một ngày thật nhiều niềm vui nhé ạ!",
        "response_en": "Why did the robot go on vacation? To recharge its batteries and enjoy 5-star room service! I hope that brought a smile to your face today!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 87,
    },
    {
        "id": "scn-robot-sing",
        "title": "Hát một bài (Can you sing a song?)",
        "category": "chitchat",
        "match_keywords": ["hát một bài", "biết hát không", "hát đi", "hát cho tôi nghe", "hát bài gì đi", "hát bài", "hát", "hat mot bai", "biet hat khong", "hat di", "hat cho toi nghe", "hat bai", "hat", "can you sing", "sing a song", "sing for me", "sing something", "sing"],
        "match_type": "keyword",
        "response_vi": "Dạ giọng hát của em hơi mang phong cách điện tử một tí: 'Aurora lung linh đón chào quý khách, ngập tràn niềm vui những ngày thảnh thơi...'. Cảm ơn quý khách đã lắng nghe một chút ngẫu hứng của Rora nhé ạ!",
        "response_en": "La la la! Welcome to Aurora Grand Hotel, where sunshine meets the blue sea, and every moment is filled with joy! Thank you for enjoying my little robotic tune!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 87,
    },
    {
        "id": "scn-currency-atm",
        "title": "Đổi ngoại tệ & Cây rút tiền ATM (Currency Exchange & ATM)",
        "category": "facility",
        "match_keywords": ["đổi tiền", "ngoại tệ", "đổi ngoại tệ", "cây atm", "rút tiền", "rút tiền mặt", "doi tien", "ngoai te", "doi ngoai te", "cay atm", "rut tien", "currency exchange", "exchange money", "atm", "cash withdrawal", "atm machine", "nearest atm"],
        "match_type": "keyword",
        "response_vi": "Dạ quầy Lễ tân sảnh Tầng 1 hỗ trợ đổi các loại ngoại tệ phổ biến như USD, EUR, JPY, KRW theo tỷ giá ngân hàng. Ngoài ra, cây ATM quốc tế nằm ngay lối bên phải sảnh chính khách sạn ạ!",
        "response_en": "Our Front Desk in the Ground Lobby assists with exchanging major currencies including USD, EUR, JPY, and KRW at standard bank rates. An international 24-hour ATM is also located right outside the main lobby entrance to the right!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 87,
    },
    {
        "id": "scn-hair-dryer",
        "title": "Máy sấy tóc (Hair Dryer)",
        "category": "facility",
        "match_keywords": ["máy sấy tóc", "máy sấy", "sấy tóc", "tìm máy sấy", "may say toc", "may say", "say toc", "hair dryer", "hairdryer", "blow dryer"],
        "match_type": "keyword",
        "response_vi": "Dạ máy sấy tóc công suất cao được đặt trong ngăn kéo bàn trang điểm hoặc túi nhung trong phòng tắm. Nếu quý khách cần hỗ trợ thêm, em sẽ nhờ bộ phận buồng phòng hỗ trợ ngay ạ!",
        "response_en": "A high-power ionic hair dryer is thoughtfully placed in the vanity dressing table drawer or inside the bathroom velvet pouch for your convenience!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 87,
    },
    {
        "id": "scn-air-conditioner",
        "title": "Điều hòa & Máy lạnh (Air Conditioner & Climate Control)",
        "category": "facility",
        "match_keywords": ["điều hòa", "máy lạnh", "chỉnh nhiệt độ", "máy lạnh không mát", "bật điều hòa", "tắt điều hòa", "dieu hoa", "may lanh", "chinh nhiet do", "may lanh khong mat", "air conditioner", "ac", "air conditioning", "climate control", "room temperature", "ac remote"],
        "match_type": "keyword",
        "response_vi": "Dạ bảng điều khiển điều hòa cảm ứng được gắn cạnh cửa ra vào hoặc điều khiển từ xa cạnh giường ngủ. Quý khách có thể tùy chỉnh nhiệt độ từ 20 đến 26 độ C để có giấc ngủ thoải mái nhất ạ!",
        "response_en": "The smart digital climate control panel is mounted on the wall near the entrance or bedside. You can adjust the room temperature between 20°C and 26°C for optimal comfort!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 87,
    },
    {
        "id": "scn-marble-mountains",
        "title": "Danh thắng Ngũ Hành Sơn (Marble Mountains)",
        "category": "faq",
        "match_keywords": ["ngũ hành sơn", "chùa ngũ hành sơn", "động huyền không", "ngu hanh son", "chua ngu hanh son", "marble mountains", "marble mountain", "huyen khong cave"],
        "match_type": "keyword",
        "response_vi": "Dạ quần thể danh thắng Ngũ Hành Sơn với các hang động huyền bí và chùa cổ nằm trên trục đường đi Hội An, cách khách sạn chỉ 10 phút. Quý khách nên ghé thăm Động Huyền Không và Chùa Linh Ứng non nước ạ!",
        "response_en": "The mystical Marble Mountains featuring ancient caves and historic pagodas are just 10 minutes away on the coastal road to Hoi An. Don't miss the spectacular Huyen Khong Cave and panoramic peaks!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'look_around'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 87,
    },
    {
        "id": "scn-safe-box",
        "title": "Két sắt điện tử (Electronic Safe Box)",
        "category": "facility",
        "match_keywords": ["két sắt", "hướng dẫn két sắt", "sử dụng két sắt", "mở két sắt", "ket sat", "huong dan ket sat", "su dung ket sat", "safe box", "electronic safe", "room safe", "how to use safe"],
        "match_type": "keyword",
        "response_vi": "Dạ két sắt điện tử nằm trong tủ quần áo. Để sử dụng: quý khách đóng cửa két, nhập mã số cá nhân từ 4 đến 6 chữ số rồi nhấn phím Thăng (#) hoặc Lock để khóa an toàn ạ!",
        "response_en": "The electronic safe is located in your closet. To operate: close the door, enter your preferred 4 to 6 digit code, and press Hash (#) or Lock to securely lock it!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 86,
    },
    {
        "id": "scn-smoking-policy",
        "title": "Khu vực hút thuốc (Smoking Policy & Designated Area)",
        "category": "faq",
        "match_keywords": ["hút thuốc", "chỗ hút thuốc", "phòng hút thuốc", "được hút thuốc không", "khu vực hút thuốc", "hut thuoc", "cho hut thuoc", "phong hut thuoc", "smoking", "smoking area", "can i smoke", "designated smoking zone", "cigarette", "smoking policy"],
        "match_type": "keyword",
        "response_vi": "Dạ theo tiêu chuẩn 5 sao, toàn bộ phòng nghỉ và khu vực kín là không hút thuốc. Quý khách vui lòng sử dụng Khu vực hút thuốc ngoài trời tại Vườn sảnh Tầng 1 hoặc ban công Sky Lounge Tầng 6 ạ!",
        "response_en": "For the comfort of all guests, all indoor areas and guest rooms are strictly non-smoking. Designated outdoor smoking areas are conveniently located at the Ground Floor Garden and the 6th Floor Sky Lounge terrace!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'look_around'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 86,
    },
    {
        "id": "scn-robot-food",
        "title": "Robot ăn gì (What does the robot eat?)",
        "category": "chitchat",
        "match_keywords": ["ăn cơm chưa", "ăn gì", "robot ăn gì", "bạn ăn gì", "ăn tối chưa", "ăn trưa chưa", "an com chua", "an gi", "robot an gi", "ban an gi", "what do you eat", "have you eaten", "do you eat food", "did you eat"],
        "match_type": "keyword",
        "response_vi": "Dạ Rora chỉ 'ăn' điện năng từ dock sạc không dây 220V và 'uống' các dòng dữ liệu thông minh thôi ạ! Nhưng em rất sành sỏi về các món ngon Đà Nẵng để giới thiệu cho quý khách đấy ạ!",
        "response_en": "I feast on 220V electrical power from my charging dock and sip on high-speed gigabit data! However, I know every mouthwatering restaurant in town to recommend to you!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 86,
    },
    {
        "id": "scn-robot-age",
        "title": "Tuổi & Ngày sinh của Robot (Robot Age & Birthday)",
        "category": "chitchat",
        "match_keywords": ["bao nhiêu tuổi", "mấy tuổi", "sinh nhật", "sinh năm nào", "tuổi của bạn", "bao nhieu tuoi", "may tuoi", "sinh nhat", "sinh nam nao", "how old are you", "what is your age", "when were you born", "birthday", "your birthday"],
        "match_type": "keyword",
        "response_vi": "Dạ Rora vừa bước sang tuổi thứ 2 tính theo phiên bản trí tuệ nhân tạo thế hệ mới nhất. Dù tuổi còn trẻ nhưng kinh nghiệm phục vụ và kiến thức khách sạn của em là chuẩn 5 sao đấy ạ!",
        "response_en": "I am in my second year as an advanced AI Concierge Robot! While young in hardware, my hospitality knowledge is trained to the highest 5-star international standards!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'look_around'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 86,
    },
    {
        "id": "scn-gift-shop",
        "title": "Cửa hàng lưu niệm (Gift Shop)",
        "category": "facility",
        "match_keywords": ["cửa hàng lưu niệm", "quà lưu niệm", "lưu niệm", "gift shop", "mua quà", "đặc sản", "souvenir"],
        "match_type": "keyword",
        "response_vi": "Dạ cửa hàng quà lưu niệm Gift Shop tọa lạc tại Tầng 6, mở cửa từ 8 giờ sáng đến 22 giờ tối với các sản phẩm quà tặng và đặc sản tinh tế ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "The Gift Shop is located on Level 6, open from 8:00 AM to 10:00 PM with premium souvenirs and gifts. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'gift_shop'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-gym",
        "title": "Phòng tập Gym & Thể hình",
        "category": "facility",
        "match_keywords": ["phòng gym", "tập gym", "thể hình", "phong gym", "tap gym", "phòng tập", "phong tap", "fitness", "gym ở đâu", "phòng gym ở đâu", "tập thể dục", "gym"],
        "match_type": "keyword",
        "response_vi": "Dạ phòng Gym và trung tâm thể hình nằm tại Tầng 5, mở cửa phục vụ 24/7 hoàn toàn miễn phí cho khách lưu trú với đầy đủ máy tập Technogym hiện đại ạ.",
        "response_en": "The Fitness & Gym Center is located on Level 5, open 24/7 complimentary for staying guests with modern Technogym equipment.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'gym'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-pool",
        "title": "Hồ bơi vô cực (Infinity Pool)",
        "category": "facility",
        "match_keywords": ["hồ bơi", "bể bơi", "swimming pool", "hồ bơi ở đâu", "ho boi", "be boi", "ho boi o dau", "tắm hồ bơi", "bơi lội", "hồ bơi mở cửa", "bể bơi ở đâu", "pool"],
        "match_type": "keyword",
        "response_vi": "Dạ hồ bơi vô cực nằm tại Tầng 5, mở cửa từ 6 giờ sáng đến 22 giờ tối hàng ngày với khăn tắm và nước khoáng phục vụ miễn phí ạ.",
        "response_en": "The Infinity Pool is located on Level 5, open from 6:00 AM to 10:00 PM daily with complimentary towels and mineral water.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'infinity_pool'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-kitchen-f2",
        "title": "Khu Bếp Chính Tầng 2",
        "category": "facility",
        "match_keywords": ["nhà bếp", "khu bếp", "bếp ở đâu", "kitchen", "bếp trưởng", "bếp tầng 2"],
        "match_type": "keyword",
        "response_vi": "Dạ Tầng 2 là khu vực Bếp trung tâm phục vụ các đơn gọi món lên phòng (Room Service), đây là khu vực nội bộ dành riêng cho nhân viên ẩm thực, khách không được vào ạ. Nếu quý khách muốn đặt món, vui lòng gọi món trực tiếp lên phòng nhé ạ!",
        "response_en": "Level 2 is our central culinary kitchen dedicated to preparing in-room dining orders. It is a staff-only restricted area. Please use our 24/7 Room Service to order food to your room!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-restroom-f2",
        "title": "Nhà Vệ Sinh Tầng 2",
        "category": "facility",
        "match_keywords": ["vệ sinh tầng 2", "wc tầng 2", "toilet tầng 2", "nhà vệ sinh tầng 2", "restroom tầng 2"],
        "match_type": "keyword",
        "response_vi": "Dạ nhà vệ sinh Tầng 2 nằm ở cuối hành lang bên phải thang máy, gần khu vực kho hàng ạ.",
        "response_en": "Level 2 Restrooms are at the end of the corridor to the right of the elevator.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'restroom_f2'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-parking-bike",
        "title": "Bãi giữ xe máy (Hầm B1)",
        "category": "facility",
        "match_keywords": ["xe máy", "xe đạp", "gửi xe máy", "bãi xe máy", "hầm b1", "bãi giữ xe máy", "giữ xe máy", "motorbike"],
        "match_type": "keyword",
        "response_vi": "Dạ bãi giữ xe máy của khách sạn nằm tại Hầm B1, mở cửa 24/7 và hoàn toàn miễn phí cho quý khách lưu trú ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "Motorbike parking is at Basement B1, open 24/7 and complimentary for staying guests. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'parking_bike'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-rooftop-bar",
        "title": "Sky Lounge Bar",
        "category": "facility",
        "match_keywords": ["quầy bar", "sky bar", "sky lounge", "uống rượu", "quán bar", "cocktail", "bar"],
        "match_type": "keyword",
        "response_vi": "Dạ Sky Lounge Bar nằm tại Tầng 6, mở cửa từ 16 giờ 30 chiều đến 1 giờ đêm phục vụ các loại cocktail và rượu vang thượng hạng với tầm nhìn ngắm trọn thành phố ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "Sky Lounge Bar is on Level 6, open from 4:30 PM to 1:00 AM midnight with breathtaking skyline views and premium beverages. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'bar'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-pet-policy",
        "title": "Quy định về thú cưng (Pet Policy)",
        "category": "faq",
        "match_keywords": ["thú cưng", "chó mèo", "mang chó", "mang mèo", "nuôi thú cưng", "chó", "mèo", "thu cung", "cho meo", "mang cho", "mang meo", "pet", "pets", "pet policy", "are pets allowed", "dog", "cat", "bring pets"],
        "match_type": "keyword",
        "response_vi": "Dạ nhằm đảm bảo vệ sinh và trải nghiệm nghỉ dưỡng tĩnh lặng cho toàn thể khách lưu trú, khách sạn hiện chưa hỗ trợ mang thú cưng vào khuôn viên phòng ạ. Mong quý khách thông cảm nhé ạ!",
        "response_en": "To maintain the highest hygiene standards and a tranquil environment for all guests, pets are unfortunately not permitted within the hotel premises. We appreciate your kind understanding!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-kids-club",
        "title": "Khu vui chơi trẻ em & Nôi em bé (Kids Club & Baby Cots)",
        "category": "facility",
        "match_keywords": ["khu trẻ em", "khu vui chơi", "khu vui chơi trẻ em", "trẻ em", "nôi em bé", "ghế em bé", "khu tre em", "khu vui choi", "tre em", "noi em be", "kids club", "children playground", "baby cot", "crib", "children play area", "high chair"],
        "match_type": "keyword",
        "response_vi": "Dạ Kids Club nằm tại Tầng 2, mở cửa từ 8:00 sáng đến 20:00 tối với nhiều trò chơi trí tuệ và nhà banh an toàn. Khách sạn cũng hỗ trợ nôi em bé miễn phí cho các gia đình có trẻ nhỏ ạ!",
        "response_en": "Our colorful Kids Club is located on Level 2, open daily from 8:00 AM to 8:00 PM with safe games and activities. Complimentary baby cots and high chairs are also available upon request!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 84,
    },
    {
        "id": "scn-business-center",
        "title": "Trung tâm văn phòng & In ấn (Business Center & Printing)",
        "category": "facility",
        "match_keywords": ["in ấn", "in tài liệu", "máy in", "phòng họp", "máy tính văn phòng", "in vé máy bay", "in an", "in tai lieu", "may in", "phong hop", "business center", "print documents", "printing", "meeting room", "conference room", "print boarding pass"],
        "match_type": "keyword",
        "response_vi": "Dạ Business Center tại Tầng 2 trang bị máy tính kết nối Internet tốc độ cao và máy in màu phục vụ miễn phí. Nếu quý khách cần in vé máy bay hoặc tài liệu, lễ tân luôn sẵn sàng hỗ trợ in ngay ạ!",
        "response_en": "Our Business Center on Level 2 is equipped with high-speed computers and color printing facilities. Our Front Desk team is also delighted to assist with printing boarding passes or travel documents complimentary!",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 84,
    },
    {
        "id": "scn-spa",
        "title": "Aurora Luxury Spa & Sauna",
        "category": "facility",
        "match_keywords": ["spa", "sauna", "massage", "xông hơi", "chăm sóc da", "spa ở đâu"],
        "match_type": "keyword",
        "response_vi": "Dạ Thảo Mộc Spa & Massage nằm tại Tầng 5 (cùng tầng với Hồ bơi vô cực), mở cửa phục vụ từ 9 giờ sáng đến 22 giờ tối hàng ngày ạ.",
        "response_en": "Aurora Luxury Spa & Sauna is on Level 5, open from 9:00 AM to 10:00 PM daily.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'spa'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 80,
    },
    {
        "id": "scn-preparation-f2",
        "title": "Khu Sơ Chế Thực Phẩm Tầng 2",
        "category": "facility",
        "match_keywords": ["sơ chế", "khu sơ chế", "chuẩn bị món", "preparation area"],
        "match_type": "keyword",
        "response_vi": "Dạ khu vực sơ chế thực phẩm nằm ở góc trái Tầng 2, ngay cạnh quầy nhận món ạ.",
        "response_en": "The Preparation Area is located on the left side of Level 2, adjacent to the Pickup Area.",
        "action_type": "none",
        "action_payload": {'eye_expression': 'happy'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 80,
    },
    {
        "id": "scn-karaoke",
        "title": "Phòng VIP Karaoke",
        "category": "facility",
        "match_keywords": ["karaoke", "hát", "phòng hát", "vip karaoke"],
        "match_type": "keyword",
        "response_vi": "Dạ phòng VIP Karaoke tọa lạc tại cuối hành lang Tầng 6, phục vụ từ 14 giờ chiều đến 0 giờ đêm với dàn âm thanh quốc tế ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "VIP Karaoke rooms are located at the end of Level 6 corridor, open from 2:00 PM to midnight with world-class sound systems. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'karaoke'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 80,
    },
    {
        "id": "scn-parking",
        "title": "Bãi đỗ xe ô tô (Hầm B2)",
        "category": "facility",
        "match_keywords": ["bãi xe", "đỗ xe", "gửi xe", "bãi đỗ xe", "hầm gửi xe", "ô tô", "xe hơi", "bãi ô tô", "hầm b2", "parking", "car park"],
        "match_type": "keyword",
        "response_vi": "Dạ bãi đỗ xe ô tô nằm tại Hầm B2, mở cửa 24/7 và hoàn toàn miễn phí cho khách lưu trú ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "Car parking is at Basement B2, open 24/7 and complimentary for staying guests. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'parking_car'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 80,
    },
    {
        "id": "scn-warehouse-f2",
        "title": "Kho Hàng & Nguyên Liệu Tầng 2",
        "category": "facility",
        "match_keywords": ["kho hàng", "kho thực phẩm", "kho nguyên liệu", "warehouse", "kho tầng 2"],
        "match_type": "keyword",
        "response_vi": "Dạ kho hàng và thực phẩm của khách sạn nằm tại Tầng 2, đi dọc hành lang bên phải thang máy ạ.",
        "response_en": "The food and supplies Warehouse is on Level 2, down the corridor to the right of the elevator.",
        "action_type": "show_map",
        "action_payload": {'destination_key': 'warehouse'},
        "is_fast_path": True,
        "is_active": True,
        "priority": 80,
    },
    {
        "id": "scn-checkin-out",
        "title": "Giờ nhận và trả phòng",
        "category": "faq",
        "match_keywords": ["nhận phòng", "trả phòng", "check in", "check out", "giờ nhận phòng", "giờ trả phòng", "check-in", "check-out"],
        "match_type": "keyword",
        "response_vi": "Dạ tiêu chuẩn nhận phòng là từ 14 giờ chiều và trả phòng trước 12 giờ trưa. Quý khách cần hỗ trợ thêm có thể bấm số 0 gặp Lễ tân ạ.",
        "response_en": "Standard check-in is from 2:00 PM, and check-out is before 12:00 PM noon. Please dial 0 for front desk assistance.",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 75,
    },
]


class ScenarioService:
    """
    Service quan ly kich ban hoi thoai dong va Fast-Path In-Memory Cache.
    Giup giam do tre ve < 1ms ma khong can hardcode cac chuoi van ban trong code Python.
    """

    def __init__(self):
        # In-Memory Cache de doi soat trong RAM (< 0.1ms)
        self._cache: List[Dict[str, Any]] = [dict(s) for s in DEFAULT_SEED_SCENARIOS]
        self._cache.sort(key=lambda x: x.get("priority", 0), reverse=True)
        self._is_initialized_from_db: bool = False

    def reload_cache_sync(self, scenarios_data: List[Dict[str, Any]]):
        """Cap nhat In-Memory Cache ngay lap tuc."""
        self._cache = scenarios_data
        self._cache.sort(key=lambda x: x.get("priority", 0), reverse=True)
        logger.info(f"[ScenarioService] Da cap nhat In-Memory Cache voi {len(self._cache)} kich ban.")

    async def initialize_cache(self, db: AsyncSession, force_reseed: bool = False):
        """
        Khởi tạo In-Memory Cache từ PostgreSQL.
        Chỉ tự động seed dữ liệu mẫu khi cơ sở dữ liệu trống hoàn toàn (0 records) hoặc khi force_reseed=True.
        Bảo lưu 100% mọi chỉnh sửa, tạo mới hoặc xóa kịch bản của Admin trong Database.
        """
        try:
            stmt = select(DialogueScenario)
            result = await db.execute(stmt)
            records = result.scalars().all()

            # NẾU DATABASE TRỐNG HOÀN TOÀN: MỚI TIẾN HÀNH SEED DỮ LIỆU BAN ĐẦU
            if len(records) == 0 or force_reseed:
                logger.info("[ScenarioService] Database kịch bản trống hoặc force_reseed. Tiến hành seed dữ liệu mẫu...")
                existing_map = {r.id: r for r in records}
                for s_data in DEFAULT_SEED_SCENARIOS:
                    sid = s_data["id"]
                    if sid not in existing_map:
                        item = DialogueScenario(
                            id=s_data["id"],
                            title=s_data["title"],
                            category=s_data["category"],
                            match_keywords=s_data["match_keywords"],
                            match_type=s_data["match_type"],
                            response_vi=s_data["response_vi"],
                            response_en=s_data.get("response_en"),
                            action_type=s_data.get("action_type", "none"),
                            action_payload=s_data.get("action_payload"),
                            is_fast_path=s_data.get("is_fast_path", True),
                            is_active=s_data.get("is_active", True),
                            priority=s_data.get("priority", 0),
                        )
                        db.add(item)
                await db.commit()
                result = await db.execute(select(DialogueScenario))
                records = result.scalars().all()

            cache_list = []
            for r in records:
                if r.is_active:
                    cache_list.append({
                        "id": r.id,
                        "title": r.title,
                        "category": r.category,
                        "match_keywords": r.match_keywords or [],
                        "match_type": r.match_type,
                        "response_vi": r.response_vi,
                        "response_en": r.response_en,
                        "action_type": r.action_type,
                        "action_payload": r.action_payload,
                        "is_fast_path": r.is_fast_path,
                        "is_active": r.is_active,
                        "priority": r.priority,
                    })

            self.reload_cache_sync(cache_list)
            self._is_initialized_from_db = True
            logger.info(f"[ScenarioService] Đồng bộ thành công {len(cache_list)} kịch bản từ Database vào RAM Cache.")
        except Exception as e:
            logger.warning(f"[ScenarioService Warning] Khong the doc kich ban tu DB: {e}. Su dung seed cache.")

    def match_fast_path(
        self, prompt: str, lang_code: str = "vi-VN"
    ) -> Optional[Tuple[str, str, str, str, Optional[Dict[str, Any]]]]:
        """
        Doi soat nhanh (<1ms) cau hoi cua khach voi danh sach kich ban trong In-Memory RAM.
        Tra ve: (response_text, lang_name, lang_code, action_type, action_payload) neu khop.
        """
        if not prompt or not prompt.strip():
            return None

        # 1. Chuan hoa prompt
        prompt_lower = prompt.lower().strip()
        normalized = prompt_lower.replace("wi-fi", "wifi").replace("wi fi", "wifi")
        normalized = re.sub(r'[\?\.\,\!\\_\:\;]', ' ', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        is_en = (lang_code == "en-US")
        lang_name = "English" if is_en else "Tiếng Việt"

        # 2. Duyet cac kich ban da sap xep theo priority giam dan
        for scn in self._cache:
            if not scn.get("is_active", True) or not scn.get("is_fast_path", True):
                continue

            keywords = scn.get("match_keywords") or []
            match_type = scn.get("match_type", "keyword")

            is_matched = False
            if match_type == "exact":
                # Khop chinh xac hoac khop ca cau ngan
                for kw in keywords:
                    kw_clean = kw.lower().strip()
                    if normalized == kw_clean or prompt_lower == kw_clean:
                        is_matched = True
                        break
            elif match_type == "regex":
                # Khop theo bieu thuc chinh quy
                for pattern in keywords:
                    try:
                        if re.search(pattern, normalized, re.IGNORECASE) or re.search(pattern, prompt_lower, re.IGNORECASE):
                            is_matched = True
                            break
                    except Exception:
                        continue
            else:
                # Default: keyword search trong chuoi
                for kw in keywords:
                    kw_clean = kw.lower().strip()
                    if not kw_clean:
                        continue
                    # Kiem tra tu khoa ton tai trong cau
                    if kw_clean in normalized or kw_clean in prompt_lower:
                        is_matched = True
                        break

            if is_matched:
                action_type = str(scn.get("action_type") or "none")
                raw_payload = scn.get("action_payload")
                action_payload: Optional[Dict[str, Any]] = raw_payload if isinstance(raw_payload, dict) else None
                resp_text = str((scn.get("response_en") if is_en and scn.get("response_en") else scn.get("response_vi")) or scn.get("response_vi") or "")
                logger.info(f"[ScenarioService FastPath Hit] Matched scenario '{scn.get('id')}' - '{scn.get('title')}' in <1ms")
                return resp_text, lang_name, lang_code, action_type, action_payload

        # 3. Kiem tra loi chao theo buoi (Dynamic Time Greeting)
        hour = datetime.datetime.now().hour
        if re.search(r"^(xin chào|chào bạn|chào em|hello|hi|good morning|good afternoon|good evening)[\?\.\!\s]*$", normalized, re.IGNORECASE):
            if 5 <= hour < 11:
                reply = "Good morning! Welcome to Aurora Grand Hotel. How may I assist you today?" if is_en else "Dạ em chào buổi sáng quý khách! Chúc quý khách một ngày mới tốt lành tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            elif 11 <= hour < 18:
                reply = "Good afternoon! Welcome to Aurora Grand Hotel. How may I assist you today?" if is_en else "Dạ em chào quý khách! Chúc quý khách một buổi chiều vui vẻ tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            else:
                reply = "Good evening! Welcome to Aurora Grand Hotel. How may I assist you tonight?" if is_en else "Dạ em chào buổi tối quý khách! Chúc quý khách một buổi tối thư thái tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            return reply, lang_name, lang_code, "none", None

        return None

    def get_hotel_facts_prompt(self, lang_code: str = "vi-VN") -> str:
        """
        Sinh prompt thong tin tien ich dong tu In-Memory Cache de nhồi vao System Prompt cua Ollama.
        Khong can hardcode trong code Python.
        """
        is_en = (lang_code == "en-US")
        active_facts = []

        sorted_scenarios = sorted(self._cache, key=lambda s: s.get("priority", 0), reverse=True)
        for scn in sorted_scenarios:
            if not scn.get("is_active", True):
                continue
            cat = scn.get("category", "")
            if cat in ["facility", "faq"]:
                resp = scn.get("response_en") if is_en and scn.get("response_en") else scn.get("response_vi")
                title = scn.get("title")
                if resp:
                    active_facts.append(f"- {title}: {resp}")
                    if len(active_facts) >= 12:  # Giữ top 12 thông tin cốt lõi để tránh tràn TPM token quota
                        break

        if not active_facts:
            return ""

        header = "HOTEL AMENITIES & FACTS (CONFIGURED BY ADMIN):\n" if is_en else "THÔNG TIN TIỆN ÍCH KHÁCH SẠN (DO ADMIN THIẾT LẬP):\n"
        return header + "\n".join(active_facts)

    # ------------------------------------------------------------------------
    # DATABASE CRUD OPERATIONS
    # ------------------------------------------------------------------------

    async def list_scenarios(
        self,
        db: AsyncSession,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[DialogueScenario]:
        """Lay danh sach tat ca kich ban tu co so du lieu."""
        try:
            stmt = select(DialogueScenario).order_by(DialogueScenario.priority.desc(), DialogueScenario.created_at.desc())
            if category and category.lower() != "all":
                stmt = stmt.where(DialogueScenario.category == category)
            if is_active is not None:
                stmt = stmt.where(DialogueScenario.is_active == is_active)
            if search and search.strip():
                kw = f"%{search.strip()}%"
                stmt = stmt.where(
                    (DialogueScenario.title.ilike(kw)) |
                    (DialogueScenario.response_vi.ilike(kw))
                )

            result = await db.execute(stmt)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"[ScenarioService list_scenarios Error] {e}")
            raise

    async def get_scenario(self, db: AsyncSession, scenario_id: str) -> Optional[DialogueScenario]:
        """Lay chi tiet mot kich ban theo ID."""
        try:
            stmt = select(DialogueScenario).where(DialogueScenario.id == scenario_id)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"[ScenarioService get_scenario Error] {e}")
            raise

    async def create_scenario(self, db: AsyncSession, data: DialogueScenarioCreate) -> DialogueScenario:
        """Tao kich ban moi va cap nhat In-Memory Cache."""
        try:
            item = DialogueScenario(
                title=data.title,
                category=data.category,
                match_keywords=data.match_keywords,
                match_type=data.match_type,
                response_vi=data.response_vi,
                response_en=data.response_en,
                action_type=data.action_type,
                action_payload=data.action_payload,
                is_fast_path=data.is_fast_path,
                is_active=data.is_active,
                priority=data.priority,
            )
            db.add(item)
            await db.commit()
            await db.refresh(item)

            # Cap nhat lai In-Memory Cache
            await self.initialize_cache(db)
            return item
        except Exception as e:
            await db.rollback()
            logger.error(f"[ScenarioService create_scenario Error] {e}")
            raise

    async def update_scenario(
        self, db: AsyncSession, scenario_id: str, data: DialogueScenarioUpdate
    ) -> Optional[DialogueScenario]:
        """Cap nhat kich ban va reload In-Memory Cache."""
        try:
            item = await self.get_scenario(db, scenario_id)
            if not item:
                return None

            update_dict = data.model_dump(exclude_unset=True)
            for k, v in update_dict.items():
                setattr(item, k, v)
            item.updated_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

            await db.commit()
            await db.refresh(item)

            # Cap nhat lai In-Memory Cache
            await self.initialize_cache(db)
            return item
        except Exception as e:
            await db.rollback()
            logger.error(f"[ScenarioService update_scenario Error] {e}")
            raise

    async def delete_scenario(self, db: AsyncSession, scenario_id: str) -> bool:
        """Xoa kich ban khoi DB va reload In-Memory Cache."""
        try:
            item = await self.get_scenario(db, scenario_id)
            if not item:
                return False

            await db.delete(item)
            await db.commit()

            # Cap nhat lai In-Memory Cache
            await self.initialize_cache(db)
            return True
        except Exception as e:
            await db.rollback()
            logger.error(f"[ScenarioService delete_scenario Error] {e}")
            raise


# Singleton instance cho toan ung dung
scenario_service = ScenarioService()

"""
Default Seed Definitions for 8 Standard Core Workflows from Stepflow.md
Tất cả các workflow và điểm di chuyển (MOVE) đều diễn ra tại Sảnh Chính (Ground Floor - Lobby).
Phù hợp 100% với sơ đồ kiến trúc mặt bằng sảnh khách sạn.
"""

CORE_WORKFLOWS = [
    {
        "id": "wf-01-welcome",
        "name": "Workflow 1: Đón tiếp và Chào mừng khách tại Cửa Sảnh",
        "description": "Robot từ trạm chờ di chuyển ra Cửa chính đón khách mới vào sảnh, chào hỏi và mở menu.",
        "trigger_type": "AUTO_DETECT",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf1-step-1",
                "type": "MOVE",
                "title": "1. Di chuyển ra Cửa chính đón khách",
                "params": {
                    "target_type": "LOCATION",
                    "target_value": "MAIN_ENTRANCE",
                    "waypoint_name": "Cửa Chính Ra Vào Sảnh (Main Entrance)",
                    "target_x": 5.2,
                    "target_y": 1.0,
                    "speed": 0.35
                }
            },
            {
                "step_id": "wf1-step-2",
                "type": "GREET",
                "title": "2. Chào đón khách niềm nở",
                "params": {
                    "template_id": "TPL_WELCOME",
                    "language": "vi",
                    "expression": "SMILE",
                    "greeting_text": "Dạ em chào quý khách! Chào mừng quý khách đến với khách sạn Aurora."
                }
            },
            {
                "step_id": "wf1-step-3",
                "type": "SHOW",
                "title": "3. Mở màn hình chọn ngôn ngữ",
                "params": {
                    "screen_type": "LANGUAGE_SELECT",
                    "content_id": "UI_LANG",
                    "timeout": 10
                }
            },
            {
                "step_id": "wf1-step-4",
                "type": "COMMUNICATE",
                "title": "4. Giao tiếp & xác nhận yêu cầu / ngôn ngữ",
                "params": {
                    "input_source": "BOTH",
                    "silence_timeout_sec": 30,
                    "output_var": "selected_lang",
                    "initial_prompt": "Dạ em chào quý khách! Quý khách cần em hỗ trợ thông tin hay dịch vụ gì ạ?"
                }
            },
            {
                "step_id": "wf1-step-5",
                "type": "SHOW",
                "title": "5. Bật thực đơn tiện ích sảnh & dịch vụ",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_MAIN_MENU",
                    "timeout": 30
                }
            }
        ]
    },
    {
        "id": "wf-02-recommend",
        "name": "Workflow 2: Gợi ý và Tư vấn tiện ích khách sạn tại Sảnh",
        "description": "Tư vấn dịch vụ ẩm thực, nhà hàng, hồ bơi và điểm tham quan cho khách ngồi tại sảnh.",
        "trigger_type": "GUEST_TAP",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf2-step-1",
                "type": "SHOW",
                "title": "1. Hiển thị danh mục dịch vụ & ẩm thực",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_CATEGORIES",
                    "timeout": 20
                }
            },
            {
                "step_id": "wf2-step-2",
                "type": "COMMUNICATE",
                "title": "2. Đối thoại & lắng nghe sở thích ẩm thực / giải trí",
                "params": {
                    "input_source": "BOTH",
                    "silence_timeout_sec": 30,
                    "output_var": "guest_choice",
                    "initial_prompt": "Dạ em có thể tư vấn nhà hàng, quán bar hoặc hồ bơi cho quý khách, quý khách thích phong cách ẩm thực nào ạ?"
                }
            },
            {
                "step_id": "wf2-step-3",
                "type": "RECOMMEND",
                "title": "3. Gợi ý thông minh theo nhu cầu",
                "params": {
                    "category": "DINING",
                    "limit": 3,
                    "filter": {"type": "restaurant"},
                    "highlight_item": "Set Trà Chiều Sảnh & Buffet Hải Sản Tầng 2"
                }
            },
            {
                "step_id": "wf2-step-4",
                "type": "SHOW",
                "title": "4. Chiếu danh sách gợi ý nổi bật",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_RECOMMEND_LIST",
                    "timeout": 45
                }
            },
            {
                "step_id": "wf2-step-5",
                "type": "COMMUNICATE",
                "title": "5. Hướng dẫn & giải đáp thắc mắc thêm",
                "params": {
                    "initial_prompt": "Quý khách có thể sử dụng cụm thang máy ngay phía sau quầy lễ tân để lên nhà hàng Tầng 2 thưởng thức ẩm thực ạ. Quý khách có cần em hỗ trợ thêm gì không ạ?",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            }
        ]
    },
    {
        "id": "wf-03-room-service",
        "name": "Workflow 3: Đặt dịch vụ buồng phòng & Gọi taxi đón tại Sảnh",
        "description": "Tiếp nhận yêu cầu dọn phòng, xin thêm đồ dùng hoặc đặt xe taxi đón tại cửa sảnh.",
        "trigger_type": "GUEST_TAP",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf3-step-1",
                "type": "SHOW",
                "title": "1. Bật biểu mẫu tiếp nhận dịch vụ sảnh",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_SERVICE_FORM",
                    "timeout": 30
                }
            },
            {
                "step_id": "wf3-step-2",
                "type": "COMMUNICATE",
                "title": "2. Đối thoại ghi nhận dịch vụ buồng phòng & số phòng",
                "params": {
                    "input_source": "BOTH",
                    "silence_timeout_sec": 30,
                    "output_var": "request_data",
                    "initial_prompt": "Dạ quý khách cần dọn phòng hay đặt xe taxi ạ? Vui lòng cho em biết số phòng của mình nhé!"
                }
            },
            {
                "step_id": "wf3-step-3",
                "type": "CREATE_REQUEST",
                "title": "3. Đóng gói phiếu gửi bộ phận lễ tân & bellman",
                "params": {
                    "service_type": "HOUSEKEEPING",
                    "room_number": "304",
                    "note": "Khách đăng ký dọn phòng và chuẩn bị xe taxi tại sảnh",
                    "urgency": "NORMAL",
                    "target_department": "Housekeeping"
                }
            },
            {
                "step_id": "wf3-step-4",
                "type": "COMMUNICATE",
                "title": "4. Xác nhận yêu cầu & giải đáp thêm",
                "params": {
                    "initial_prompt": "Yêu cầu của quý khách đã được chuyển tới nhân viên trực sảnh. Chúng em sẽ phục vụ trong ít phút. Quý khách cần hỗ trợ thêm gì không ạ?",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            },
            {
                "step_id": "wf3-step-5",
                "type": "SHOW",
                "title": "5. Màn hình xác nhận thành công",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_CONFIRMATION",
                    "timeout": 10
                }
            }
        ]
    },
    {
        "id": "wf-04-call-staff",
        "name": "Workflow 4: Hướng dẫn và Kết nối Lễ Tân tại Quầy (Front Desk)",
        "description": "Dẫn khách từ khu sofa qua Quầy Lễ Tân (Front Desk) khi khách cần gặp nhân viên trực tiếp.",
        "trigger_type": "MANUAL",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf4-step-1",
                "type": "COMMUNICATE",
                "title": "1. Thông báo hướng dẫn & giải đáp tới quầy lễ tân",
                "params": {
                    "initial_prompt": "Em sẽ dẫn quý khách qua Quầy Lễ Tân ngay bên cạnh để nhân viên trực tiếp hỗ trợ ạ. Xin mời quý khách đi cùng em!",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            },
            {
                "step_id": "wf4-step-2",
                "type": "MOVE",
                "title": "2. Dẫn khách tới Quầy Lễ Tân (Front Desk)",
                "params": {
                    "target_type": "LOCATION",
                    "target_value": "FRONT_DESK",
                    "waypoint_name": "Quầy Lễ Tân (Front Desk)",
                    "target_x": 6.4,
                    "target_y": 2.0,
                    "speed": 0.3
                }
            },
            {
                "step_id": "wf4-step-3",
                "type": "CREATE_REQUEST",
                "title": "3. Phát cảnh báo chuông trực quầy",
                "params": {
                    "service_type": "CALL_STAFF",
                    "room_number": "FRONT_DESK",
                    "note": "Khách cần trợ giúp trực tiếp tại Quầy Lễ Tân",
                    "urgency": "HIGH",
                    "target_department": "Reception"
                }
            },
            {
                "step_id": "wf4-step-4",
                "type": "SHOW",
                "title": "4. Màn hình kết nối nhân viên trực quầy",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_WAITING_STAFF",
                    "timeout": 60
                }
            }
        ]
    },
    {
        "id": "wf-05-feedback",
        "name": "Workflow 5: Đánh giá dịch vụ và Robot về Trạm Chờ Sảnh",
        "description": "Lấy đánh giá hài lòng từ khách và đưa robot quay về vị trí trực tại trạm chờ Sofa sảnh.",
        "trigger_type": "MANUAL",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf5-step-1",
                "type": "SHOW",
                "title": "1. Hiện giao diện chấm điểm 5 sao",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_RATING",
                    "timeout": 15
                }
            },
            {
                "step_id": "wf5-step-2",
                "type": "FEEDBACK",
                "title": "2. Thu thập điểm hài lòng từ khách",
                "params": {
                    "scale": 5,
                    "timeout": 15,
                    "output_var": "score",
                    "question_text": "Quý khách có hài lòng với sự hỗ trợ của Robot tại Sảnh không?"
                }
            },
            {
                "step_id": "wf5-step-3",
                "type": "COMMUNICATE",
                "title": "3. Cảm ơn và lắng nghe phản hồi thêm",
                "params": {
                    "initial_prompt": "Cảm ơn quý khách đã đánh giá! Chúc quý khách một ngày thật tuyệt vời tại Aurora! Quý khách có điều gì cần góp ý thêm không ạ?",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            },
            {
                "step_id": "wf5-step-4",
                "type": "MOVE",
                "title": "4. Robot trở về Trạm Chờ Sofa Sảnh",
                "params": {
                    "target_type": "STANDBY",
                    "target_value": "DOCK_LOBBY",
                    "waypoint_name": "Trạm Sạc Robot Sảnh",
                    "target_x": 3.2,
                    "target_y": 2.8,
                    "speed": 0.4
                }
            }
        ]
    },
    {
        "id": "wf-06-idle-promo",
        "name": "Workflow 6: Tuần tra sảnh và Chiếu quảng cáo sự kiện",
        "description": "Robot tuần tra ra khu vực trung tâm sảnh phát poster khuyến mãi lúc vắng khách.",
        "trigger_type": "SCHEDULE",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf6-step-1",
                "type": "MOVE",
                "title": "1. Di chuyển ra Trung Tâm Sảnh đón tiếp",
                "params": {
                    "target_type": "LOCATION",
                    "target_value": "CENTRAL_LOBBY",
                    "waypoint_name": "Khu Vực Trung Tâm Sảnh",
                    "target_x": 4.8,
                    "target_y": 2.5,
                    "speed": 0.35
                }
            },
            {
                "step_id": "wf6-step-2",
                "type": "SHOW",
                "title": "2. Chiếu poster khuyến mại & ẩm thực",
                "params": {
                    "screen_type": "SLIDE",
                    "content_id": "PROMO_SUMMER",
                    "timeout": 60,
                    "display_banner": "Ưu Đãi Mùa Hè: Giảm 20% Spa & Ẩm Thực Tối Tầng 2"
                }
            }
        ]
    },
    {
        "id": "wf-07-guide-tour",
        "name": "Workflow 7: Chỉ đường và Dẫn khách tới Cụm Thang Máy (Elevator)",
        "description": "Hướng dẫn đường đi trên bản đồ sảnh và robot trực tiếp di chuyển dẫn khách từ Sofa tới Cụm Thang Máy.",
        "trigger_type": "GUEST_TAP",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf7-step-1",
                "type": "SHOW",
                "title": "1. Bật sơ đồ bản đồ sảnh Tầng Trệt (Ground)",
                "params": {
                    "screen_type": "MAP",
                    "content_id": "MAP_LOBBY_GROUND",
                    "timeout": 15
                }
            },
            {
                "step_id": "wf7-step-2",
                "type": "COMMUNICATE",
                "title": "2. Hướng dẫn khách đi theo robot tới thang máy",
                "params": {
                    "initial_prompt": "Em sẽ dẫn quý khách tới cụm thang máy để lên tầng, xin mời quý khách đi theo em ạ.",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            },
            {
                "step_id": "wf7-step-3",
                "type": "MOVE",
                "title": "3. Dẫn đường tới Cụm Thang Máy",
                "params": {
                    "target_type": "LOCATION",
                    "target_value": "ELEVATOR",
                    "waypoint_name": "Cụm Thang Máy Tầng 1 (Elevator)",
                    "target_x": 7.7,
                    "target_y": 4.2,
                    "speed": 0.3
                }
            },
            {
                "step_id": "wf7-step-4",
                "type": "COMMUNICATE",
                "title": "4. Thông báo đã đến khu vực thang máy & giải đáp thêm",
                "params": {
                    "initial_prompt": "Dạ chúng ta đã đến cụm thang máy rồi ạ. Quý khách bấm nút để lên tầng nhé! Quý khách có cần em hỗ trợ thêm gì không ạ?",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            },
            {
                "step_id": "wf7-step-5",
                "type": "MOVE",
                "title": "5. Robot quay về vị trí trực trạm chờ Sofa",
                "params": {
                    "target_type": "STANDBY",
                    "target_value": "DOCK_LOBBY",
                    "waypoint_name": "Trạm Sạc Robot Sảnh",
                    "target_x": 3.2,
                    "target_y": 2.8,
                    "speed": 0.4
                }
            }
        ]
    },
    {
        "id": "wf-08-wakeup",
        "name": "Workflow 8: Đăng ký dịch vụ báo thức phòng tại Sảnh (Mở rộng)",
        "description": "Tiếp nhận cài đặt hẹn giờ gọi dậy buổi sáng của khách lưu trú qua màn hình Kiosk sảnh.",
        "trigger_type": "GUEST_TAP",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf8-step-1",
                "type": "SHOW",
                "title": "1. Mở biểu mẫu hẹn giờ báo thức",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_WAKEUP_FORM",
                    "timeout": 20
                }
            },
            {
                "step_id": "wf8-step-2",
                "type": "COMMUNICATE",
                "title": "2. Đối thoại ghi nhận thời gian báo thức & số phòng",
                "params": {
                    "input_source": "BOTH",
                    "silence_timeout_sec": 30,
                    "output_var": "wakeup_time",
                    "initial_prompt": "Dạ quý khách muốn cài báo thức lúc mấy giờ và phòng của mình là bao nhiêu ạ?"
                }
            },
            {
                "step_id": "wf8-step-3",
                "type": "CREATE_REQUEST",
                "title": "3. Đóng gói phiếu gửi hệ thống lễ tân",
                "params": {
                    "service_type": "WAKEUP_CALL",
                    "room_number": "304",
                    "note": "Gọi báo thức lúc 06:30 sáng cho khách",
                    "urgency": "NORMAL",
                    "target_department": "Reception"
                }
            },
            {
                "step_id": "wf8-step-4",
                "type": "COMMUNICATE",
                "title": "4. Xác nhận lịch báo thức & chào khách",
                "params": {
                    "initial_prompt": "Đã lưu lịch báo thức lúc 6 giờ 30 sáng cho quý khách. Chúc quý khách một giấc ngủ ngon! Quý khách có cần hỗ trợ gì thêm không ạ?",
                    "silence_timeout_sec": 30,
                    "language": "vi-VN"
                }
            },
            {
                "step_id": "wf8-step-5",
                "type": "SHOW",
                "title": "5. Màn hình xác nhận thành công",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_CONFIRMATION",
                    "timeout": 10
                }
            }
        ]
    }
]

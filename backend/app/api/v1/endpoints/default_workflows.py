"""
Default Seed Definitions for 7 Standard Core Workflows from Stepflow.md
"""

CORE_WORKFLOWS = [
    {
        "id": "wf-01-welcome",
        "name": "Workflow 1: Đón tiếp và Chào mừng khách chủ động",
        "description": "Tự động tiếp cận khi thấy khách vào sảnh để chào hỏi và mở menu.",
        "trigger_type": "AUTO_DETECT",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf1-step-1",
                "type": "MOVE",
                "title": "1. Di chuyển lại gần khách tại Sảnh",
                "params": {
                    "target_type": "GUEST",
                    "target_value": "ZONE_LOBBY",
                    "waypoint_name": "Sảnh Đón Khách",
                    "target_x": 1.5,
                    "target_y": 0.0,
                    "speed": 0.3
                }
            },
            {
                "step_id": "wf1-step-2",
                "type": "GREET",
                "title": "2. Chào hỏi và làm quen",
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
                "type": "LISTEN",
                "title": "4. Chờ khách chọn ngôn ngữ",
                "params": {
                    "input_source": "TOUCH",
                    "timeout": 10,
                    "output_var": "selected_lang"
                }
            },
            {
                "step_id": "wf1-step-5",
                "type": "SHOW",
                "title": "5. Bật thực đơn Menu chính",
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
        "name": "Workflow 2: Gợi ý và Tư vấn dịch vụ thông minh",
        "description": "Tra cứu, gợi ý tiện ích nội khu hoặc nhà hàng, điểm tham quan lân cận.",
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
                "type": "LISTEN",
                "title": "2. Lắng nghe nhu cầu của khách",
                "params": {
                    "input_source": "BOTH",
                    "timeout": 15,
                    "output_var": "guest_choice"
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
                    "highlight_item": "Set Trà Chiều & Buffet Hải Sản Tầng 2"
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
                "type": "SPEAK",
                "title": "5. Phát âm thanh tư vấn chi tiết",
                "params": {
                    "text": "Dưới đây là các gợi ý nhà hàng nổi bật và dịch vụ thư giãn cho bạn tối nay.",
                    "language": "vi-VN",
                    "speed": 1.0
                }
            }
        ]
    },
    {
        "id": "wf-03-room-service",
        "name": "Workflow 3: Đặt dịch vụ buồng phòng / Gọi xe",
        "description": "Tạo phiếu yêu cầu dọn phòng, xin thêm đồ dùng hoặc đặt taxi.",
        "trigger_type": "GUEST_TAP",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf3-step-1",
                "type": "SHOW",
                "title": "1. Bật biểu mẫu yêu cầu dịch vụ",
                "params": {
                    "screen_type": "MENU",
                    "content_id": "UI_SERVICE_FORM",
                    "timeout": 30
                }
            },
            {
                "step_id": "wf3-step-2",
                "type": "LISTEN",
                "title": "2. Ghi nhận thông tin phòng & đồ cần gọi",
                "params": {
                    "input_source": "BOTH",
                    "timeout": 30,
                    "output_var": "request_data"
                }
            },
            {
                "step_id": "wf3-step-3",
                "type": "CREATE_REQUEST",
                "title": "3. Đóng gói phiếu gửi buồng phòng",
                "params": {
                    "service_type": "HOUSEKEEPING",
                    "room_number": "402",
                    "note": "Thêm 2 chai nước suối và 1 khăn tắm",
                    "urgency": "NORMAL",
                    "target_department": "Housekeeping"
                }
            },
            {
                "step_id": "wf3-step-4",
                "type": "SPEAK",
                "title": "4. Thông báo xác nhận tới khách",
                "params": {
                    "text": "Yêu cầu của quý khách đã được gửi tới nhân viên buồng phòng. Chúng em sẽ phục vụ trong ít phút.",
                    "language": "vi-VN",
                    "speed": 1.0
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
        "name": "Workflow 4: Nhờ nhân viên hỗ trợ khẩn cấp (Call Staff)",
        "description": "Kết nối lễ tân khi robot không xử lý được hoặc khách cần người trực tiếp.",
        "trigger_type": "MANUAL",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf4-step-1",
                "type": "SPEAK",
                "title": "1. Thông báo kết nối lễ tân",
                "params": {
                    "text": "Em đang kết nối quý khách với lễ tân trực sảnh, vui lòng đợi giây lát ạ.",
                    "language": "vi-VN",
                    "speed": 1.0
                }
            },
            {
                "step_id": "wf4-step-2",
                "type": "CREATE_REQUEST",
                "title": "2. Phát cảnh báo gọi nhân viên khẩn cấp",
                "params": {
                    "service_type": "CALL_STAFF",
                    "room_number": "LOBBY",
                    "note": "Khách cần trợ giúp trực tiếp tại quầy",
                    "urgency": "HIGH",
                    "target_department": "Reception"
                }
            },
            {
                "step_id": "wf4-step-3",
                "type": "SHOW",
                "title": "3. Màn hình chờ nhân viên đến",
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
        "name": "Workflow 5: Đánh giá và Kết thúc phiên",
        "description": "Lấy đánh giá hài lòng từ khách và đưa robot về trạm chờ.",
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
                    "question_text": "Quý khách có hài lòng với sự hỗ trợ của Robot không?"
                }
            },
            {
                "step_id": "wf5-step-3",
                "type": "SPEAK",
                "title": "3. Lời cảm ơn chân thành",
                "params": {
                    "text": "Cảm ơn quý khách đã đánh giá! Chúc quý khách một ngày thật tuyệt vời tại Aurora!",
                    "language": "vi-VN",
                    "speed": 1.0
                }
            },
            {
                "step_id": "wf5-step-4",
                "type": "MOVE",
                "title": "4. Robot trở về trạm chờ",
                "params": {
                    "target_type": "STANDBY",
                    "target_value": "DOCK_01",
                    "waypoint_name": "Trạm Chờ Sảnh (Dock 01)",
                    "target_x": 0.0,
                    "target_y": 0.0,
                    "speed": 0.5
                }
            }
        ]
    },
    {
        "id": "wf-06-idle-promo",
        "name": "Workflow 6: Chế độ rảnh và Chiếu quảng cáo",
        "description": "Di chuyển ra điểm đông người phát khuyến mãi lúc vắng khách.",
        "trigger_type": "SCHEDULE",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf6-step-1",
                "type": "MOVE",
                "title": "1. Di chuyển ra điểm đông người tại sảnh",
                "params": {
                    "target_type": "LOCATION",
                    "target_value": "HOTSPOT_LOBBY",
                    "waypoint_name": "Điểm Đông Người Sảnh",
                    "target_x": 2.5,
                    "target_y": 4.0,
                    "speed": 0.4
                }
            },
            {
                "step_id": "wf6-step-2",
                "type": "SHOW",
                "title": "2. Chiếu poster khuyến mại mùa hè",
                "params": {
                    "screen_type": "SLIDE",
                    "content_id": "PROMO_SUMMER",
                    "timeout": 60,
                    "display_banner": "Khuyến Mãi Mùa Hè: Giảm 20% Spa & Ẩm Thực Tối"
                }
            }
        ]
    },
    {
        "id": "wf-07-guide-tour",
        "name": "Workflow 7: Chỉ đường và Dẫn khách đến tiện ích",
        "description": "Hướng dẫn đường đi trên bản đồ và robot trực tiếp di chuyển dẫn khách đến khu vực tiện ích.",
        "trigger_type": "GUEST_TAP",
        "is_active": True,
        "steps": [
            {
                "step_id": "wf7-step-1",
                "type": "SHOW",
                "title": "1. Bật sơ đồ bản đồ sảnh tầng 1",
                "params": {
                    "screen_type": "MAP",
                    "content_id": "MAP_LOBBY_FLOOR1",
                    "timeout": 15
                }
            },
            {
                "step_id": "wf7-step-2",
                "type": "SPEAK",
                "title": "2. Hướng dẫn khách đi theo robot",
                "params": {
                    "text": "Em sẽ dẫn quý khách đến nhà hàng Tầng 1, xin mời quý khách đi theo em ạ.",
                    "language": "vi-VN",
                    "speed": 1.0
                }
            },
            {
                "step_id": "wf7-step-3",
                "type": "MOVE",
                "title": "3. Dẫn đường tới cửa nhà hàng",
                "params": {
                    "target_type": "LOCATION",
                    "target_value": "RESTAURANT_GATE",
                    "waypoint_name": "Cửa Nhà Hàng Tầng 1",
                    "target_x": 5.0,
                    "target_y": 2.5,
                    "speed": 0.3
                }
            },
            {
                "step_id": "wf7-step-4",
                "type": "SPEAK",
                "title": "4. Thông báo đã đến nơi",
                "params": {
                    "text": "Dạ chúng ta đã đến nơi rồi ạ. Chúc quý khách có một bữa ăn ngon miệng!",
                    "language": "vi-VN",
                    "speed": 1.0
                }
            },
            {
                "step_id": "wf7-step-5",
                "type": "MOVE",
                "title": "5. Robot quay về vị trí trực",
                "params": {
                    "target_type": "STANDBY",
                    "target_value": "DOCK_01",
                    "waypoint_name": "Quầy Lễ Tân (Trạm Chờ)",
                    "target_x": 0.0,
                    "target_y": 0.0,
                    "speed": 0.5
                }
            }
        ]
    }
]

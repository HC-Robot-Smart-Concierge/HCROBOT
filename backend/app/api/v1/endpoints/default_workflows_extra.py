from typing import Any, Callable, Dict, List


def build_extra_workflows(_move_target: Callable[[str], Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Trả về các kịch bản mặc định bổ sung WF-07 đến WF-10."""
    return [
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
                        "timeout": 15,
                    },
                },
                {
                    "step_id": "wf7-step-2",
                    "type": "COMMUNICATE",
                    "title": "2. Hướng dẫn khách đi theo robot tới thang máy",
                    "params": {
                        "initial_prompt": "Em sẽ dẫn quý khách tới cụm thang máy để lên tầng, xin mời quý khách đi theo em ạ.",
                        "silence_timeout_sec": 30,
                        "language": "vi-VN",
                    },
                },
                {
                    "step_id": "wf7-step-3",
                    "type": "MOVE",
                    "title": "3. Dẫn đường tới Cụm Thang Máy",
                    "params": {
                        "target_type": "LOCATION",
                        **_move_target("ELEVATOR"),
                        "speed": 0.3,
                    },
                },
                {
                    "step_id": "wf7-step-4",
                    "type": "COMMUNICATE",
                    "title": "4. Thông báo đã đến khu vực thang máy & giải đáp thêm",
                    "params": {
                        "initial_prompt": "Dạ chúng ta đã đến cụm thang máy rồi ạ. Quý khách bấm nút để lên tầng nhé! Quý khách có cần em hỗ trợ thêm gì không ạ?",
                        "silence_timeout_sec": 30,
                        "language": "vi-VN",
                    },
                },
                {
                    "step_id": "wf7-step-5",
                    "type": "MOVE",
                    "title": "5. Robot quay về Vị Trí Chờ Sảnh",
                    "params": {
                        "target_type": "STANDBY",
                        **_move_target("ROBOT_STANDBY"),
                        "speed": 0.4,
                    },
                },
            ],
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
                        "next_step_id": "wf8-step-3",
                        "timeout": 20,
                    },
                },
                {
                    "step_id": "wf8-step-2",
                    "type": "COMMUNICATE",
                    "title": "2. Đối thoại ghi nhận thời gian báo thức & số phòng",
                    "params": {
                        "input_source": "BOTH",
                        "silence_timeout_sec": 30,
                        "output_var": "wakeup_time",
                        "initial_prompt": "Dạ quý khách muốn cài báo thức lúc mấy giờ và phòng của mình là bao nhiêu ạ?",
                    },
                },
                {
                    "step_id": "wf8-step-3",
                    "type": "CREATE_REQUEST",
                    "title": "3. Đóng gói phiếu gửi hệ thống lễ tân",
                    "params": {
                        "service_type": "WAKEUP_CALL",
                        "room_source": "verified_guest",
                        "urgency": "NORMAL",
                        "target_department": "Reception",
                    },
                },
                {
                    "step_id": "wf8-step-4",
                    "type": "COMMUNICATE",
                    "title": "4. Xác nhận lịch báo thức & chào khách",
                    "params": {
                        "initial_prompt": "Đã lưu lịch báo thức lúc 6 giờ 30 sáng cho quý khách. Chúc quý khách một giấc ngủ ngon! Quý khách có cần hỗ trợ gì thêm không ạ?",
                        "silence_timeout_sec": 30,
                        "language": "vi-VN",
                    },
                },
                {
                    "step_id": "wf8-step-5",
                    "type": "SHOW",
                    "title": "5. Màn hình xác nhận thành công",
                    "params": {
                        "screen_type": "MENU",
                        "content_id": "UI_CONFIRMATION",
                        "timeout": 10,
                    },
                },
            ],
        },
        {
            # Demo đầu tiên: ghép WF01 + WF02 + WF07 + WF05, có rẽ nhánh theo lựa chọn của khách.
            # Hai nhánh cùng quay về bước hỏi khách còn cần gì, rồi đánh giá và về vị trí chờ một lần.
            "id": "wf-09-dinner-guide",
            "name": "Workflow 9: Khách hỏi chỗ ăn tối, xem bản đồ hoặc được dẫn tới thang máy",
            "description": "Đón khách ở cửa trước, gợi ý nhà hàng Tầng 2, cho khách chọn xem bản đồ tại chỗ hoặc được dẫn tới cụm thang máy, rồi hỏi thêm, đánh giá và về vị trí chờ.",
            "trigger_type": "AUTO_DETECT",
            "is_active": False,
            "steps": [
                {
                    "step_id": "wf9-move-entrance",
                    "type": "MOVE",
                    "title": "1. Ra cửa chính đón khách",
                    "params": {"target_type": "LOCATION", **_move_target("MAIN_ENTRANCE"), "speed": 0.35},
                },
                {
                    "step_id": "wf9-greet",
                    "type": "GREET",
                    "title": "2. Chào đón khách",
                    "params": {
                        "template_id": "TPL_WELCOME",
                        "language": "vi",
                        "expression": "SMILE",
                        "greeting_text": "Dạ em chào quý khách! Chào mừng quý khách đến với khách sạn Aurora.",
                    },
                },
                {
                    "step_id": "wf9-language",
                    "type": "SHOW",
                    "title": "3. Khách chọn ngôn ngữ",
                    "params": {"screen_type": "LANGUAGE_SELECT", "content_id": "UI_LANG", "timeout": 10},
                },
                {
                    "step_id": "wf9-ask",
                    "type": "COMMUNICATE",
                    "title": "4. Hỏi nhu cầu của khách",
                    "params": {
                        "input_source": "BOTH",
                        "silence_timeout_sec": 30,
                        "output_var": "guest_request",
                        "initial_prompt": "Quý khách cần em hỗ trợ gì ạ? Ví dụ quý khách có thể hỏi em nên ăn tối ở đâu.",
                    },
                },
                {
                    "step_id": "wf9-recommend",
                    "type": "RECOMMEND",
                    "title": "5. Gợi ý nhà hàng cho bữa tối",
                    "params": {
                        "category": "DINING",
                        "limit": 3,
                        "filter": {"type": "restaurant"},
                        "highlight_item": "Nhà hàng Tầng 2 · Buffet Hải Sản buổi tối",
                    },
                },
                {
                    "step_id": "wf9-dining-list",
                    "type": "SHOW",
                    "title": "6. Chiếu danh sách gợi ý ẩm thực",
                    "params": {"screen_type": "MENU", "content_id": "UI_RECOMMEND_LIST", "timeout": 15},
                },
                {
                    "step_id": "wf9-route-choice",
                    "type": "CHOICE",
                    "title": "7. Khách chọn xem bản đồ hoặc được dẫn đường",
                    "params": {
                        "prompt": "Nhà hàng ở Tầng 2, đi bằng cụm thang máy sau quầy lễ tân. Quý khách muốn xem bản đồ hay để em dẫn tới thang máy ạ?",
                        "prompt_en": "The restaurant is on Floor 2, by the lifts behind the front desk. Would you like the map, or shall I walk you there?",
                        "timeout_sec": 30,
                        "options": [
                            {
                                "id": "map",
                                "label": "Xem bản đồ",
                                "label_en": "Show me the map",
                                "keywords": ["bản đồ", "sơ đồ", "map"],
                                "next_step_id": "wf9-show-map",
                            },
                            {
                                "id": "guide",
                                "label": "Dẫn tới thang máy",
                                "label_en": "Walk me there",
                                "keywords": ["dẫn đường", "dẫn tôi", "đưa tôi", "đi cùng", "thang máy", "walk me", "take me"],
                                "next_step_id": "wf9-guide-move",
                            },
                        ],
                        "timeout_next_step_id": "wf9-anything-else",
                        "cancel_next_step_id": "wf9-anything-else",
                    },
                },
                {
                    "step_id": "wf9-show-map",
                    "type": "SHOW",
                    "title": "8. Nhánh bản đồ: hiển thị đường tới nhà hàng tại chỗ",
                    "params": {
                        "screen_type": "MAP",
                        "content_id": "MAP_LOBBY_GROUND",
                        "destination_key": "restaurant",
                        "timeout": 20,
                        "speech_text": "Dạ đây là đường tới nhà hàng. Quý khách đi qua quầy lễ tân tới cụm thang máy rồi lên Tầng 2 ạ. Quý khách có thể quét mã QR để xem đường trên điện thoại.",
                        "next_step_id": "wf9-anything-else",
                    },
                },
                {
                    "step_id": "wf9-guide-move",
                    "type": "MOVE",
                    "title": "9. Nhánh dẫn đường: đưa khách tới cụm thang máy",
                    "params": {
                        "target_type": "LOCATION",
                        **_move_target("ELEVATOR"),
                        "speed": 0.3,
                        "broadcast_speech": "Mời quý khách đi theo em tới cụm thang máy ạ.",
                    },
                },
                {
                    "step_id": "wf9-guide-arrived",
                    "type": "SHOW",
                    "title": "10. Báo đã tới thang máy",
                    "params": {
                        "screen_type": "MAP",
                        "content_id": "MAP_LOBBY_GROUND",
                        "destination_key": "restaurant",
                        "timeout": 10,
                        "speech_text": "Dạ chúng ta đã tới cụm thang máy. Quý khách lên Tầng 2 là tới nhà hàng ạ.",
                    },
                },
                {
                    "step_id": "wf9-anything-else",
                    "type": "CHOICE",
                    "title": "11. Hỏi khách còn cần hỗ trợ gì",
                    "params": {
                        "prompt": "Quý khách còn cần em hỗ trợ gì thêm không ạ?",
                        "prompt_en": "Is there anything else I can help with?",
                        "timeout_sec": 20,
                        "options": [
                            {
                                "id": "done",
                                "label": "Không, cảm ơn",
                                "label_en": "No, thank you",
                                "keywords": ["cảm ơn", "xong rồi", "hết rồi", "không cần", "thank"],
                                "next_step_id": "wf9-feedback",
                            },
                            {
                                "id": "more",
                                "label": "Hỏi thêm",
                                "label_en": "Ask something else",
                                "keywords": ["hỏi thêm", "còn nữa", "có ạ", "more", "yes"],
                                "next_step_id": "wf9-free-talk",
                            },
                        ],
                        "timeout_next_step_id": "wf9-feedback",
                        "cancel_next_step_id": "wf9-feedback",
                    },
                },
                {
                    "step_id": "wf9-free-talk",
                    "type": "COMMUNICATE",
                    "title": "12. Trò chuyện thêm với khách",
                    "params": {
                        "input_source": "BOTH",
                        "silence_timeout_sec": 30,
                        "ai_agent_enabled": True,
                        "initial_prompt": "Dạ quý khách cứ hỏi, em đang nghe ạ.",
                        "next_step_id": "wf9-anything-else",
                    },
                },
                {
                    "step_id": "wf9-feedback",
                    "type": "FEEDBACK",
                    "title": "13. Khách đánh giá sau tương tác",
                    "params": {
                        "scale": 5,
                        "timeout": 15,
                        "output_var": "score",
                        "question_text": "Quý khách có hài lòng với sự hỗ trợ của em không ạ?",
                    },
                },
                {
                    "step_id": "wf9-goodbye",
                    "type": "GREET",
                    "title": "14. Chào tạm biệt khách",
                    "params": {
                        "language": "vi",
                        "expression": "SMILE",
                        "greeting_text": "Cảm ơn quý khách! Chúc quý khách bữa tối ngon miệng tại Aurora.",
                    },
                },
                {
                    "step_id": "wf9-return",
                    "type": "MOVE",
                    "title": "15. Robot về Vị Trí Chờ Sảnh",
                    "params": {"target_type": "STANDBY", **_move_target("ROBOT_STANDBY"), "speed": 0.4},
                },
            ],
        },
        {
            # Kịch bản hệ thống: Studio và màn hình robot tự chạy khi pin ước tính còn 20%
            # (sau khi phục vụ xong khách) hoặc 10% (dừng ngay). Xem frontend/src/utils/batteryPolicy.js.
            # MOVE loại CHARGER đi tới điểm trạm sạc đang hiển thị trên map.
            "id": "wf-10-low-battery",
            "name": "Workflow 10: Pin yếu, robot về trạm sạc chờ nhân viên cắm sạc",
            "description": "Robot về trạm sạc trên sảnh và báo nhân viên tới cắm sạc tay cho cả pin động cơ và pin Pi 5.",
            "trigger_type": "LOW_BATTERY",
            "is_active": True,
            "steps": [
                {
                    "step_id": "wf10-go-charger",
                    "type": "MOVE",
                    "title": "1. Về trạm sạc",
                    "params": {
                        "target_type": "CHARGER",
                        **_move_target("CHARGER_STATION"),
                        "speed": 0.35,
                        "broadcast_speech": "Em sắp hết pin nên xin phép về trạm sạc. Quý khách cần hỗ trợ vui lòng tới quầy lễ tân ạ.",
                    },
                },
                {
                    "step_id": "wf10-call-staff",
                    "type": "CREATE_REQUEST",
                    "title": "2. Báo nhân viên cắm sạc",
                    "params": {
                        "service_type": "ROBOT_CHARGING",
                        "room_number": "Trạm Sạc Robot Sảnh",
                        "note": "Robot sắp hết pin và đang chờ ở trạm sạc. Nhờ nhân viên cắm sạc cả pin động cơ và pin Pi 5.",
                        "urgency": "HIGH",
                        "target_department": "Maintenance",
                    },
                },
            ],
        },
    ]

from typing import Dict, List

# Tập trung toàn bộ từ khóa phân loại ý định dịch vụ khách sạn (DRY Principle)
SERVICE_KEYWORDS: Dict[str, List[str]] = {
    "cancel_service": [
        "hủy", "huy", "hủy yêu cầu", "huy yeu cau", "hủy phòng", "huy phong",
        "hủy đơn", "huy don", "hủy món", "huy mon", "không cần nữa", "khong can nua",
        "thôi không cần", "thoi khong can", "không lấy nữa", "khong lay nua",
        "bỏ yêu cầu", "bo yeu cau", "cancel", "cancellation", "cancel request",
        "cancel order"
    ],
    "laundry": [
        "giặt", "giat", "giặt ủi", "giat ui", "giặt là", "giat la",
        "giặt sấy", "giat say", "ủi đồ", "ui do", "ủi quần áo", "giặt hấp",
        "laundry", "dry cleaning", "giặt áo", "giặt quần", "là quần áo"
    ],
    "wake_up": [
        "báo thức", "bao thuc", "gọi dậy", "goi day", "đánh thức", "danh thuc",
        "wake up", "wake-up", "wake up call"
    ],
    "housekeeping": [
        "khăn", "khan", "dọn phòng", "don phong", "gối", "goi", "chăn", "chan",
        "nệm", "nem", "dọn dẹp", "dọn vệ sinh", "vệ sinh phòng", "làm vệ sinh",
        "towel", "clean room", "cleaning", "bàn ủi", "máy sấy", "dao cạo", "kem đánh răng",
        "bàn chải", "dầu gội", "sữa tắm", "giấy vệ sinh", "nước suối trong phòng",
        "massage tại phòng", "mát xa tại phòng", "mat xa tai phong", "đặt massage", "gọi massage", "spa tại phòng"
    ],
    "room_service": [
        "cơm", "com", "nước", "nuoc", "ăn", "an", "uống", "uong", "đồ ăn", "do an",
        "trà", "tra", "cà phê", "ca phe", "pizza", "phở", "pho", "bánh", "banh",
        "mì", "mi", "mì xào", "mi xao", "hải sản", "hai san", "bún", "bun", "cháo", "chao", "súp", "sup",
        "món", "mon", "món ăn", "mon an", "đồ ăn thức uống",
        "food", "drink", "nước uống", "nuoc uong", "bữa sáng", "gọi món", "đặt món", "nước ngọt", "bia", "trái cây",
        "đặt đồ ăn", "dat do an", "gọi đồ ăn", "goi do an", "order món", "order đồ ăn", "mang lên", "giao lên", "đem lên",
        "đặt dịch vụ", "dat dich vu", "đặt thêm dịch vụ", "dat them dich vu",
        "dịch vụ lên phòng", "dich vu len phong", "dịch vụ phòng", "dich vu phong",
        "muốn đặt dịch vụ", "muon dat dich vu", "muốn đặt thêm", "muon dat them",
        "thêm dịch vụ", "them dich vu", "room service", "tiện ích phòng", "tien ich phong",
        "ly", "tách", "muỗng", "nĩa", "chén", "đĩa", "đá lạnh", "xô đá", "tableware", "ice"
    ],
    "bellman": [
        "hành lý", "hanh ly", "vali", "túi", "tui", "chuyển phòng", "chuyen phong",
        "mang đồ", "xách đồ", "luggage", "bag", "mang hành lý", "gửi hành lý",
        "hỗ trợ hành lý", "ho tro hanh ly", "xách vali", "mang vali", "kéo vali", "bellman", "bellboy",
        "đồ thất lạc", "do that lac", "thất lạc", "that lac", "báo mất đồ", "bao mat do",
        "mất đồ", "mat do", "quên đồ", "quen do", "để quên đồ", "de quen do",
        "rơi đồ", "roi do", "tìm đồ", "tim do", "bỏ quên đồ", "bo quen do",
        "lost and found", "lost item", "missing item", "forgot item", "lost property"
    ],
    "maintenance": [
        "hư", "hu", "bị hư", "bi hu", "hư hỏng", "hu hong", "hư đồ", "hu do", "đồ bị hư", "do bi hu",
        "phòng bị hư", "phong bi hu", "phòng tôi bị hư", "phong toi bi hu",
        "phòng bị hỏng", "phong bi hong", "phòng tôi bị hỏng", "phong toi bi hong",
        "báo hư", "bao hu", "hỏng", "hong", "bị hỏng", "bi hong", "sửa", "sua",
        "điều hòa", "dieu hoa", "bóng đèn", "bong den",
        "nước rò", "nuoc ro", "máy lạnh", "may lanh", "tủ lạnh", "tu lanh", "kẹt", "ket",
        "fix", "repair", "vòi sen", "vòi nước", "bồn cầu", "tắc", "mất điện", "không lạnh", "cháy bóng",
        "báo hỏng", "báo sự cố", "bảo trì", "bao tri", "sửa chữa", "sua chua", "hỏng hóc", "hong hoc",
        "menu bảo trì", "menu sua chua", "báo sửa", "maintenance menu", "open maintenance", "repair menu",
        "broken", "not working", "chập điện", "hỏng điện", "không sáng", "bị nghẹt", "bị tắc"
    ],
    "restaurant": [
        "đặt bàn", "dat ban", "bàn ăn", "ban an", "nhà hàng", "table", "restaurant"
    ],
    "taxi": [
        "đặt taxi", "dat taxi", "gọi taxi", "goi taxi", "bắt taxi", "bat taxi",
        "xe taxi", "taxi", "đặt xe", "dat xe", "gọi xe", "goi xe",
        "sân bay", "cab", "ride", "xe đón", "xe dua don", "xe đưa đón", "grab", "book taxi"
    ],
    "concierge": [
        "concierge", "gặp người", "trợ giúp trực tiếp", "nhân viên hỗ trợ",
        "live call", "video call", "tổng đài", "gọi cho nhân viên",
        "gọi nhân viên", "gặp nhân viên", "kết nối nhân viên", "nói chuyện với nhân viên",
        "cho tôi gặp nhân viên", "gặp người thật", "nói chuyện với người thật", "kết nối người thật",
        "gọi tổng đài", "gọi hỗ trợ", "hỗ trợ viên", "gọi video",
        "gọi cho lễ tân", "gặp trực tiếp", "kết nối trực tiếp", "human support",
        "nhân viên tư vấn", "cho tôi gặp lễ tân", "gặp trực ban", "gọi trực ban", "gọi can thiệp",
        "call staff", "call human", "talk to human", "speak to human",
        "connect staff", "video call support", "talk to staff", "call receptionist",
        "human agent", "live agent", "talk to a person", "speak to a person", "live support"
    ],
        "query_order_status": [
        # Taxi & Vận chuyển (Taxi & Transport status query)
        "taxi tới chưa", "taxi toi chua", "taxi đến chưa", "taxi den chua", "xe tới chưa", "xe toi chua",
        "xe đến chưa", "xe den chua", "trạng thái taxi", "trang thai taxi", "kiểm tra taxi", "kiem tra taxi",
        "kiểm tra đặt taxi", "kiem tra dat taxi", "trạng thái đặt taxi", "trang thai dat taxi",
        "đã đặt taxi chưa", "da dat taxi chua", "xe taxi tới đâu rồi", "xe taxi toi dau roi",
        "taxi status", "check taxi", "cab status",
        # Xem lại món / đơn đã đặt (Review placed orders)
        "xem lại", "xem lai", "xem lại món", "xem lai mon", "xem lại đơn", "xem lai don", "xem lại đồ", "xem lai do",
        "cho tôi xem lại", "cho toi xem lai", "cho tôi xem lại món", "cho toi xem lai mon",
        "cho tôi xem lại đơn", "cho toi xem lai don", "cho tôi xem món", "cho toi xem mon",
        "cho tôi xem đơn", "cho toi xem don", "cho xem món", "cho xem don", "cho tôi xem", "cho toi xem", "cho xem",
        "xem món", "xem mon", "xem đơn", "xem don",
        "xem lại món đồ đặc", "xem lai mon do dac", "xem lại món đồ đạc", "xem lai mon do dac",
        "món đồ đặc", "mon do dac", "món đồ đạc", "mon do dac", "đồ đặc", "do dac", "đồ đạc",
        "món đã đặt", "mon da dat", "đơn đã đặt", "don da dat", "đồ đã đặt", "do da dat",
        "món nào đã đặt", "mon nao da dat", "những món đã đặt", "nhung mon da dat",
        "tôi đã đặt món gì", "toi da dat mon gi", "tôi đã gọi món gì", "toi da goi mon gi",
        "tôi đã đặt những gì", "toi da dat nhung gi", "tôi đã gọi những gì", "toi da goi nhung gi",
        "đã đặt món gì", "da dat mon gi", "đã gọi món gì", "da goi mon gi",
        "đã đặt những gì", "da dat nhung gi", "đã gọi những gì", "da goi nhung gi",
        "danh sách món đã đặt", "danh sach mon da dat", "danh sách đồ đã đặt", "danh sach do da dat",
        "danh sách món", "danh sach mon", "danh sách đơn", "danh sach don",
        "review my order", "review order", "show my order", "view my order", "what did i order",
        "check my order", "check order", "see my order", "see what i ordered",
        "trạng thái", "trang thai", "tình trạng", "tinh trang", "tiến độ", "tien do", "kiểm tra món", "kiem tra mon", "kiểm tra đơn", "kiem tra don",
        "đến đâu rồi", "den dau roi", "tới đâu rồi", "toi dau roi", "tới đâu", "toi dau", "đến đâu", "den dau",
        "thế nào rồi", "the nao roi", "sao rồi", "sao roi", "như thế nào rồi", "nhu the nao roi", "ra sao rồi", "ra sao roi",
        "xong chưa", "xong chua", "làm xong chưa", "lam xong chua", "nấu xong chưa", "nau xong chua", "chế biến",
        "làm tới đâu", "lam toi dau", "làm đến đâu", "lam den dau", "nấu tới đâu", "nau toi dau",
        "dọn phòng tới đâu", "don phong toi dau", "dọn phòng xong chưa", "don phong xong chua",
        "tiến độ dọn phòng", "tien do don phong", "trạng thái dọn phòng", "trang thai don phong",
        "dọn phòng đến đâu", "don phong den dau", "dọn dẹp tới đâu", "don dep toi dau", "dọn dẹp xong chưa",
        "khăn tắm mang lên chưa", "khan tam mang len chua", "tiến độ dịch vụ", "tien do dich vu",
        "tiến độ room service", "tien do room service", "room service tới đâu", "room service xong chưa",
        "tình trạng phục vụ phòng", "tinh trang phuc vu phong", "tình trạng dọn phòng", "tinh trang don phong",
        "housekeeping status", "room cleaning status",
        # Bảo trì & Kỹ thuật (Maintenance & Repair status query)
        "sửa chữa tới đâu", "sua chua toi dau", "bảo trì tới đâu", "bao tri toi dau",
        "sửa điều hòa tới đâu", "sua dieu hoa toi dau", "sửa máy lạnh tới đâu", "sua may lanh toi dau",
        "tiến độ sửa chữa", "tien do sua chua", "tiến độ bảo trì", "tien do bao tri",
        "sửa xong chưa", "sua xong chua", "bảo trì xong chưa", "bao tri xong chua",
        "kỹ thuật lên chưa", "ky thuat len chua", "thợ tới chưa", "tho toi chua", "thợ lên chưa", "tho len chua",
        "kỹ thuật viên tới chưa", "ky thuat vien toi chua", "tình trạng sửa chữa", "tinh trang sua chua",
        "tình trạng bảo trì", "tinh trang bao tri", "trạng thái bảo trì", "trang thai bao tri",
        "maintenance status", "repair status", "fix status", "is technician coming",
        "repair progress", "maintenance progress", "how is my repair", "how is the repair", "is it fixed", "repaired yet", "is the repair done",
        "giao chưa", "giao chua", "đang giao chưa", "đem lên chưa", "mang lên chưa",
        "tới phòng chưa", "toi phong chua", "đến phòng chưa", "den phong chua",
        "đã tới phòng chưa", "da toi phong chua", "đã đến phòng chưa", "da den phong chua",
        "lên phòng chưa", "len phong chua", "đã lên phòng chưa", "da len phong chua",
        "tới chưa", "toi chua", "đến chưa", "den chua", "đã tới chưa", "da toi chua",
        "đã đến chưa", "da den chua", "mang tới chưa", "mang toi chua",
        "giao tới chưa", "giao toi chua", "có chưa", "co chua", "đã có chưa", "da co chua",
        "mát xa tới chưa", "mat xa toi chua", "massage tới chưa", "massage toi chua",
        "nước uống tới chưa", "nuoc uong toi chua", "đồ ăn tới chưa", "do an toi chua",
        "khi nào có", "bao giờ có", "sắp có chưa", "chờ lâu", "đợi lâu",
        "kiểm tra đơn", "kiem tra don", "kiểm tra món", "kiem tra mon", "kiểm tra đồ ăn", "kiem tra do an",
        "tình trạng đơn", "tinh trang don", "tình trạng món", "tinh trang mon", "tình trạng dịch vụ", "tinh trang dich vu",
        "đơn hàng của tôi", "món ăn của tôi", "đồ ăn của tôi", "món tôi đặt", "đồ tôi đặt", "đơn tôi đặt",
        "tại sao từ chối", "tai sao tu choi", "sao từ chối", "sao tu choi", "sao lại từ chối", "sao lai tu choi",
        "vì sao từ chối", "vi sao tu choi", "tại sao bị từ chối", "tai sao bi tu choi", "sao bị từ chối", "sao bi tu choi",
        "vì sao bị từ chối", "vi sao bi tu choi", "lý do từ chối", "ly do tu choi", "lý do bị từ chối", "ly do bi tu choi",
        "lý do gì", "ly do gi", "sao món của tôi bị từ chối", "tại sao món của tôi bị từ chối", "sao đơn của tôi bị từ chối",
        "tại sao đơn của tôi bị từ chối", "sao không nhận đơn", "sao khong nhan don", "tại sao không nhận", "tai sao khong nhan",
        "tại sao bị hủy", "tai sao bi huy", "sao bị hủy", "sao bi huy", "lý do hủy", "ly do huy", "lý do bị hủy",
        "why was it rejected", "why was my order rejected", "reason for rejection", "why declined", "why rejected",
        "order status", "food status", "status of my order", "where is my order", "is my order ready",
        "check my order", "check order"
    ],
    "reception": [
        "lễ tân", "check out", "checkout", "check in", "checkin",
        "đổi phòng", "doi phong", "trả phòng", "tra phong", "front desk", "reception",
        "gia hạn phòng", "mất chìa khóa", "khóa phòng"
    ],
}

import re

# Menu trigger keyword sets (Single Source of Truth)
MAINTENANCE_MENU_TRIGGER_KEYWORDS: List[str] = sorted(list(set([
    "menu bảo trì", "menu bao tri", "menu sửa chữa", "menu sua chua",
    "danh mục bảo trì", "danh muc bao tri", "danh mục sửa chữa", "danh muc sua chua",
    "danh mục sự cố", "danh muc su co", "mở bảo trì", "mo bao tri",
    "báo hỏng", "bao hong", "báo sự cố", "bao su co",
    "báo hư", "bao hu",
    "hỏng hóc", "hong hoc", "kỹ thuật phòng", "ky thuat phong",
    "bị hư", "bi hu", "hư", "hu", "hư hỏng", "hu hong", "hư đồ", "hu do", "đồ bị hư", "do bi hu",
    "phòng bị hư", "phong bi hu", "phòng tôi bị hư", "phong toi bi hu",
    "phòng bị hỏng", "phong bi hong", "phòng tôi bị hỏng", "phong toi bi hong",
    "bị hỏng", "bi hong",
    "maintenance menu", "repair menu", "open maintenance", "fix issue", "report issue"
])))

ROOM_SERVICE_MENU_TRIGGER_KEYWORDS: List[str] = sorted(list(set(
    SERVICE_KEYWORDS["housekeeping"] + [
        "dịch vụ phòng", "dich vu phong", "room service", "tiện ích phòng", "tien ich phong",
        "menu dịch vụ", "menu dich vu", "open room service"
    ]
)))

FOOD_MENU_TRIGGER_KEYWORDS: List[str] = sorted(list(set(
    SERVICE_KEYWORDS["room_service"] + [
        "menu đồ ăn", "thực đơn", "menu món ăn", "food menu", "đặt món", "gọi món", "order món", "open food menu"
    ]
)))


def build_keyword_regex(keywords: List[str]) -> re.Pattern:
    """Build a fast, case-insensitive, boundary-aware regex from a list of keywords."""
    escaped = [re.escape(k) for k in sorted(keywords, key=len, reverse=True) if k]
    return re.compile(rf"(?<!\w)({'|'.join(escaped)})(?!\w)", re.IGNORECASE)


MAINTENANCE_REGEX: re.Pattern = build_keyword_regex(SERVICE_KEYWORDS["maintenance"])
HOUSEKEEPING_REGEX: re.Pattern = build_keyword_regex(SERVICE_KEYWORDS["housekeeping"])
ROOM_SERVICE_FOOD_REGEX: re.Pattern = build_keyword_regex(SERVICE_KEYWORDS["room_service"])
STATUS_QUERY_REGEX: re.Pattern = build_keyword_regex(SERVICE_KEYWORDS["query_order_status"])
TAXI_REGEX: re.Pattern = build_keyword_regex(SERVICE_KEYWORDS["taxi"])
CANCEL_SERVICE_REGEX: re.Pattern = build_keyword_regex(SERVICE_KEYWORDS["cancel_service"])

# Compiled exclusion regex for wayfinding / map routing to NEVER intercept orders or maintenance requests
ORDER_OR_SERVICE_EXCLUSION_KEYWORDS: List[str] = sorted(list(set(
    SERVICE_KEYWORDS["maintenance"] +
    SERVICE_KEYWORDS["housekeeping"] +
    SERVICE_KEYWORDS["room_service"] +
    SERVICE_KEYWORDS["laundry"] +
    SERVICE_KEYWORDS["cancel_service"] +
    [
        "đặt", "dat", "order", "gọi món", "goi mon", "gọi", "goi", "mang", "giao",
        "lấy", "lay", "đem", "gửi", "thêm", "mượn", "cần", "can", "muốn", "xin",
        "cho tôi", "cho mình", "cho em", "yêu cầu", "sự cố", "broken", "repair", "fix"
    ]
)))

ORDER_OR_SERVICE_EXCLUSION_REGEX: re.Pattern = build_keyword_regex(ORDER_OR_SERVICE_EXCLUSION_KEYWORDS)


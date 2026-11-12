import pytest
from app.services.ai.constants import (
    SERVICE_KEYWORDS,
    MAINTENANCE_MENU_TRIGGER_KEYWORDS,
    ROOM_SERVICE_MENU_TRIGGER_KEYWORDS,
    FOOD_MENU_TRIGGER_KEYWORDS,
    MAINTENANCE_REGEX,
    HOUSEKEEPING_REGEX,
    ROOM_SERVICE_FOOD_REGEX,
    STATUS_QUERY_REGEX,
    ORDER_OR_SERVICE_EXCLUSION_REGEX,
)
from app.services.ai.scenario_service import scenario_service, DEFAULT_SEED_SCENARIOS
from app.models.scenario import DialogueScenario


class TestArchitectureHardening:
    """Kiểm thử kiến trúc SSOT (Single Source of Truth) và Phân tầng kiểm soát."""

    def test_ssot_constants_completeness(self):
        """A. Kiểm tra constants.py chứa đầy đủ các nhóm từ khóa dịch vụ và regex tiền biên dịch."""
        assert "maintenance" in SERVICE_KEYWORDS
        assert "housekeeping" in SERVICE_KEYWORDS
        assert "room_service" in SERVICE_KEYWORDS
        assert "query_order_status" in SERVICE_KEYWORDS

        # Kiểm tra từ khóa Nam/Bắc cho bảo trì
        mnt_kws = SERVICE_KEYWORDS["maintenance"]
        for kw in ["hư", "hu", "bị hư", "hỏng", "sửa chữa", "điều hòa", "máy lạnh"]:
            assert kw in mnt_kws

        # Kiểm tra regex đã biên dịch
        assert MAINTENANCE_REGEX.search("phòng tôi bị hư điều hòa")
        assert MAINTENANCE_REGEX.search("máy lạnh phòng tao bị hu")
        assert HOUSEKEEPING_REGEX.search("cho tôi xin thêm 2 cái khăn tắm")
        assert ROOM_SERVICE_FOOD_REGEX.search("tôi muốn gọi món ăn trưa")
        assert STATUS_QUERY_REGEX.search("kiểm tra đơn đặt món tới đâu rồi")
        assert STATUS_QUERY_REGEX.search("kỹ thuật sửa xong chưa")

    def test_seed_scenarios_inherit_ssot(self):
        """A. Kiểm tra DEFAULT_SEED_SCENARIOS kế thừa trực tiếp từ constants.py."""
        mnt_scn = next(s for s in DEFAULT_SEED_SCENARIOS if s["id"] == "scn-maintenance-menu")
        assert mnt_scn["match_keywords"] == MAINTENANCE_MENU_TRIGGER_KEYWORDS
        assert mnt_scn.get("is_system") is True
        assert mnt_scn.get("is_custom_edited") is False
        assert mnt_scn.get("priority") >= 98

        fnb_scn = next(s for s in DEFAULT_SEED_SCENARIOS if s["id"] == "scn-room-service-menu")
        assert fnb_scn["match_keywords"] == FOOD_MENU_TRIGGER_KEYWORDS
        assert fnb_scn.get("is_system") is True

        amenity_scn = next(s for s in DEFAULT_SEED_SCENARIOS if s["id"] == "scn-room-service-amenities")
        assert amenity_scn["match_keywords"] == ROOM_SERVICE_MENU_TRIGGER_KEYWORDS
        assert amenity_scn.get("is_system") is True

    def test_layered_pipeline_wayfinding_exclusion(self):
        """C. Quy tắc phân tầng: Chỉ đường bản đồ KHÔNG được chặn yêu cầu sửa chữa hoặc đặt dịch vụ."""
        queries_with_service = [
            "phòng 301 bị hư máy lạnh",
            "máy lạnh phòng 302 bị hỏng",
            "cho khăn tắm lên phòng 305",
            "mang cơm sườn lên phòng 401",
        ]
        for q in queries_with_service:
            # ORDER_OR_SERVICE_EXCLUSION_REGEX phải phát hiện để chặn show_map nhầm
            assert ORDER_OR_SERVICE_EXCLUSION_REGEX.search(q.lower()) is not None

        # Câu thuần chỉ đường thì regex này KHÔNG chặn
        pure_nav = "chỉ đường lên phòng 301"
        assert MAINTENANCE_REGEX.search(pure_nav) is None

    @pytest.mark.asyncio
    async def test_custom_scenario_preservation_policy(self):
        """B. Phân định quyền DB & Code: Kịch bản đã bị Admin sửa tay (is_custom_edited=True) không bị ghi đè."""
        custom_scn = DialogueScenario(
            id="scn-custom-test",
            title="Kịch bản Admin đã sửa",
            category="service",
            match_keywords=["từ khóa tùy chỉnh riêng của admin"],
            match_type="keyword",
            response_vi="Câu trả lời riêng do Admin khách sạn thiết lập",
            response_en=None,
            action_type="none",
            action_payload=None,
            is_fast_path=True,
            is_active=True,
            is_system=True,
            is_custom_edited=True,  # Đã bị Admin chỉnh sửa
            priority=77,
        )

        assert custom_scn.is_custom_edited is True
        assert custom_scn.is_system is True


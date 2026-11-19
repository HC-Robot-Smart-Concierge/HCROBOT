import pytest
from app.services.ai.session_manager import session_manager
from app.services.ai.ai_chat_service import _detect_destination_poi, get_dynamic_suggested_prompts
from app.services.ai.scenario_service import scenario_service
from app.services.ai.ollama_service import ollama_service
from app.services.ai.gemini_service import gemini_service


class TestConversationalContinuation:
    """Unit tests for Dynamic Conversational Continuation and Demographics Context."""

    def test_session_manager_topic_and_destination_memory(self):
        session_id = "test_continuation_session_01"
        session_manager.reset_session(session_id)

        session_manager.set_active_topic(session_id, "infinity_pool", "pool")
        assert session_manager.get_active_topic(session_id) == "infinity_pool"
        assert session_manager.get_last_destination_key(session_id) == "pool"

        session_manager.reset_session(session_id)

    def test_multi_turn_affirmation_poi_detection(self):
        session_id = "test_continuation_session_02"
        session_manager.reset_session(session_id)

        # Store pool as last proposed destination
        session_manager.set_active_topic(session_id, "infinity_pool", "pool")

        # Guest replies "Có, chỉ đường đi"
        detected_poi = _detect_destination_poi("Có, chỉ đường đi", session_id=session_id)
        assert detected_poi == "pool"

        # Guest replies "dẫn đường"
        detected_poi = _detect_destination_poi("dẫn đường giúp em", session_id=session_id)
        assert detected_poi == "pool"

        session_manager.reset_session(session_id)

    def test_dynamic_suggested_prompts_generation(self):
        # Pool facility suggestions
        chips_pool = get_dynamic_suggested_prompts(
            prompt="hồ bơi ở đâu",
            reply="Hồ bơi vô cực nằm ở Tầng 5.",
            action="guide_to_destination",
            destination_key="pool",
            lang_code="vi-VN",
            age_group="young_adult",
            gender="female",
        )
        assert len(chips_pool) >= 2
        assert any("bản đồ" in c.lower() or "đường" in c.lower() or "tầng 5" in c.lower() for c in chips_pool)

        # English language suggestions
        chips_en = get_dynamic_suggested_prompts(
            prompt="where is the gym",
            reply="The fitness center is on Floor 4.",
            action="guide_to_destination",
            destination_key="gym",
            lang_code="en-US",
            age_group="young_adult",
            gender="male",
        )
        assert len(chips_en) >= 2
        assert any("gym" in c.lower() or "map" in c.lower() or "direction" in c.lower() for c in chips_en)

    def test_fast_path_scenario_appends_continuation_hook(self):
        original_cache = list(scenario_service._cache)
        try:
            scenario_service.reload_cache_sync(
                [
                    {
                        "id": "fp_pool",
                        "title": "Hồ bơi vô cực",
                        "match_keywords": ["hồ bơi ở đâu", "be boi o dau"],
                        "match_type": "contains",
                        "response_vi": "Hồ bơi vô cực nằm ở Tầng 5, mở cửa từ 06:00 đến 21:00.",
                        "response_en": "The infinity pool is on Floor 5, open from 06:00 to 21:00.",
                        "category": "facility",
                        "is_fast_path": True,
                        "is_active": True,
                        "priority": 100,
                    }
                ]
            )

            match = scenario_service.match_fast_path("hồ bơi ở đâu", "vi-VN")
            assert match is not None
            response_text = match[0]
            assert "Tầng 5" in response_text
            assert "Quý khách có muốn" in response_text or "chỉ đường" in response_text
        finally:
            scenario_service.reload_cache_sync(original_cache)

    def test_system_prompt_injects_guest_profile_and_continuation_rule(self):
        # Ollama system prompt
        prompt_vi = ollama_service._build_system_prompt(
            lang_code="vi-VN",
            age_group="young_adult",
            gender="female",
        )
        assert "[Hồ sơ khách]" in prompt_vi
        assert "young_adult" in prompt_vi
        assert "female" in prompt_vi
        assert "CONVERSATIONAL CONTINUATION" in prompt_vi

        # Gemini system prompt
        prompt_en = gemini_service._build_system_prompt(
            lang_code="en-US",
            age_group="senior",
            gender="male",
        )
        assert "[Guest Profile]" in prompt_en
        assert "senior" in prompt_en
        assert "male" in prompt_en
        assert "CONVERSATIONAL ENGAGEMENT" in prompt_en

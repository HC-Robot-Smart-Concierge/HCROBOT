import pytest
from app.services.ai.scenario_service import scenario_service
from app.services.ai.ollama_service import ollama_service


def test_fast_path_identity_and_self_intro():
    queries = [
        "bạn là ai",
        "Bạn là ai",
        "em là ai",
        "who are you",
        "what is your name",
        "tên bạn là gì",
        "tên em là gì",
        "bạn tên gì",
        "em tên gì",
        "giới thiệu bản thân",
        "giới thiệu về bản thân",
        "bạn giới thiệu bản thân được không",
        "Bạn có thể giới thiệu bản thân được không",
        "Bạn có thể giới thiệu về bản thân được không",
        "giới thiệu về bạn",
        "giới thiệu về em",
        "giới thiệu về mình",
        "tự giới thiệu",
        "introduce yourself",
        "tell me about yourself",
    ]

    for q in queries:
        m = scenario_service.match_fast_path(q, "vi-VN")
        assert m is not None, f"Scenario fast path failed to match: '{q}'"
        assert "Rora" in m[0], f"Response should contain Rora: '{m[0]}'"

        o = ollama_service.check_fast_path_full(q, "vi-VN")
        assert o is not None, f"Ollama fast path fallback failed to match: '{q}'"
        assert "Rora" in o[0], f"Response should contain Rora: '{o[0]}'"


def test_general_knowledge_distinction():
    # General knowledge queries about external entities should NOT match robot self-identity
    general_queries = [
        "Sơn Tùng M-TP là ai",
        "tổng thống Mỹ là ai",
        "cầu thủ Messi là ai",
        "diễn viên Tom Cruise là ai",
    ]
    for q in general_queries:
        m = scenario_service.match_fast_path(q, "vi-VN")
        assert m is None, f"General knowledge query should not match fast path: '{q}'"


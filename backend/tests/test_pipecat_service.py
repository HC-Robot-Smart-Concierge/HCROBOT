import pytest
from app.services.ai.pipecat_service import PipecatPipelineService, pipecat_service


@pytest.mark.asyncio
async def test_pipecat_session_creation_and_close():
    """Unit test kiểm tra tạo và đóng phiên làm việc Pipecat Audio Stream"""
    session_id = "test_session_pipecat"
    session = pipecat_service.create_pipeline_session(session_id)
    
    assert session["session_id"] == session_id
    assert session["is_speaking"] is False
    assert session["is_interrupted"] is False

    pipecat_service.close_session(session_id)
    assert session_id not in pipecat_service.active_sessions


@pytest.mark.asyncio
async def test_pipecat_barge_in_handling():
    """Unit test kiểm tra cơ chế ngắt lời Barge-in khi Robot đang phát giọng thoại"""
    session_id = "barge_in_test"
    pipecat_service.create_pipeline_session(session_id)
    
    # Kích hoạt ngắt lời
    pipecat_service.handle_barge_in(session_id)
    session = pipecat_service.active_sessions.get(session_id)
    
    assert session["is_interrupted"] is True
    assert session["is_speaking"] is False

    pipecat_service.close_session(session_id)

"""Central TypedDict state schema for HCRobot Concierge LangGraph."""

from typing import Dict, List, Optional
from typing_extensions import TypedDict


class ConciergeState(TypedDict, total=False):
    """







    Trạng thái hội thoại trung tâm (Central Agent State) do LangGraph Harness quản lý.







    """
    session_id: str
    prompt: str
    current_query: Optional[str]
    language: Optional[str]
    lang_name: str
    lang_code: str
    emotion: Optional[str]
    room_number: Optional[str]
    chat_history: List[Dict[str, str]]
    fast_path_hit: bool
    intent_category: str       # 'fast_path' | 'conversation'
    action: Optional[str]
    items: Optional[str]
    rag_context: Optional[str]
    missing_room_number: bool
    ticket_code: Optional[str]
    trigger_video_call: Optional[bool]
    destination_key: Optional[str]
    response: str
    require_room_pin: Optional[bool]
    target_room_number: Optional[str]
    pending_service_action: Optional[str]
    pending_service_items: Optional[str]
    status_query_type: Optional[str]
    query_type: Optional[str]
    is_room_authenticated: Optional[bool]
    trigger_menu: Optional[str]

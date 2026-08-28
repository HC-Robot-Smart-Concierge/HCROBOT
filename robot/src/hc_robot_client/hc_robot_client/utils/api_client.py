import logging
from typing import Any, Dict, Optional
import httpx

logger = logging.getLogger(__name__)


class BackendAPIClient:
    """
    HTTP Client chịu trách nhiệm kết nối từ Pi 5 tới Laptop FastAPI Backend Server.
    """

    def __init__(self, host: str = "127.0.0.1", port: int = 8000, timeout_seconds: float = 15.0):
        self.base_url = f"http://{host}:{port}"
        self.timeout = timeout_seconds

    async def check_health(self) -> bool:
        """
        Kiểm tra trạng thái sẵn sàng của Laptop Backend Server.
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/")
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Connected to backend server: {data.get('system', 'HCRobot')}")
                    return True
                logger.warning(f"Backend returned non-200 status: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error connecting to backend at {self.base_url}: {e}")
            return False

    async def send_chat_prompt(self, prompt: str, rag_context: Optional[str] = None) -> Dict[str, Any]:
        """
        Gửi câu hỏi của người dùng tới endpoint /api/v1/ai/chat trên Laptop Server.
        """
        url = f"{self.base_url}/api/v1/ai/chat"
        payload = {
            "prompt": prompt,
            "rag_context": rag_context
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    return response.json()
                
                error_msg = f"API chat failed with status code {response.status_code}: {response.text}"
                logger.error(error_msg)
                return {"response": "Rất tiếc, server đang bận. Vui lòng thử lại sau.", "error": error_msg}
        except Exception as e:
            logger.error(f"Network error in send_chat_prompt: {e}")
            return {"response": "Không thể kết nối tới server xử lý AI.", "error": str(e)}

    async def extract_intent(self, user_speech: str) -> Dict[str, Any]:
        """
        Gửi văn bản nhận dạng giọng nói tới /api/v1/ai/intent để bóc tách ý định dịch vụ.
        """
        url = f"{self.base_url}/api/v1/ai/intent"
        payload = {
            "user_speech": user_speech
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    return response.json()
                
                error_msg = f"API intent failed with status code {response.status_code}: {response.text}"
                logger.error(error_msg)
                return {"action": "unknown", "error": error_msg}
        except Exception as e:
            logger.error(f"Network error in extract_intent: {e}")
            return {"action": "unknown", "error": str(e)}

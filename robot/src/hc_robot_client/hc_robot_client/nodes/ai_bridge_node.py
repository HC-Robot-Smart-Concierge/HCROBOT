import asyncio
import json
import os
import sys
import yaml

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from hc_robot_client.utils.api_client import BackendAPIClient


class AIBridgeNode(Node):
    """
    ROS 2 Node đóng vai trò cầu nối giữa Topic Giọng nói trên Pi 5 và AI Server trên Laptop.
    """

    def __init__(self):
        super().__init__('ai_bridge_node')
        
        # Load cấu hình từ file settings.yaml
        config_path = self.get_config_path()
        server_host = "192.168.1.100"
        server_port = 8000
        speech_in_topic = "/speech/text"
        speech_out_topic = "/robot/speech_reply"
        intent_out_topic = "/robot/intent"

        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f)
                    server_host = config.get('server', {}).get('host', server_host)
                    server_port = config.get('server', {}).get('port', server_port)
                    topics = config.get('topics', {})
                    speech_in_topic = topics.get('speech_input', speech_in_topic)
                    speech_out_topic = topics.get('speech_reply', speech_out_topic)
                    intent_out_topic = topics.get('intent_output', intent_out_topic)
            except Exception as e:
                self.get_logger().error(f"Lỗi đọc file config {config_path}: {e}")

        self.api_client = BackendAPIClient(host=server_host, port=server_port)

        # ROS 2 Publishers & Subscribers
        self.speech_sub = self.create_subscription(
            String,
            speech_in_topic,
            self.on_speech_received,
            10
        )
        self.reply_pub = self.create_publisher(String, speech_out_topic, 10)
        self.intent_pub = self.create_publisher(String, intent_out_topic, 10)

        self.get_logger().info(f"AIBridgeNode đã khởi chạy. Backend URL: http://{server_host}:{server_port}")
        self.get_logger().info(f"Lắng nghe topic '{speech_in_topic}', Publish tới '{speech_out_topic}'")

    def get_config_path() -> str:
        """
        Lấy đường dẫn tương đối hoặc tuyệt đối của config/settings.yaml
        """
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../../'))
        return os.path.join(base_dir, 'config', 'settings.yaml')

    def on_speech_received(self, msg: String):
        """
        Callback xử lý khi nhận văn bản nhận dạng từ giọng nói người dùng.
        """
        user_text = msg.data.strip()
        if not user_text:
            return

        self.get_logger().info(f"Nhận được prompt giọng nói: '{user_text}'")
        asyncio.run(self.process_speech_and_reply(user_text))

    async def process_speech_and_reply(self, user_text: str):
        """
        Gửi yêu cầu tới Laptop Backend Server và publish phản hồi.
        """
        try:
            # 1. Gửi chat prompt lấy phản hồi văn bản từ Ollama LLM
            chat_result = await self.api_client.send_chat_prompt(prompt=user_text)
            reply_text = chat_result.get("response", "Xin lỗi, tôi không thể xử lý yêu cầu lúc này.")

            # Publish phản hồi cho node TTS đọc
            reply_msg = String()
            reply_msg.data = reply_text
            self.reply_pub.publish(reply_msg)
            self.get_logger().info(f"Phản hồi AI công bố tới topic: '{reply_text}'")

            # 2. Phân tích Intent phục vụ các dịch vụ khách sạn
            intent_result = await self.api_client.extract_intent(user_speech=user_text)
            intent_msg = String()
            intent_msg.data = json.dumps(intent_result, ensure_ascii=False)
            self.intent_pub.publish(intent_msg)

        except Exception as e:
            self.get_logger().error(f"Lỗi khi gọi Backend API từ node: {e}")


def main(args=None):
    rclpy.init(args=args)
    node = AIBridgeNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()

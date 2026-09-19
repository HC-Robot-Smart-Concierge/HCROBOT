"""
ROS 2 Nodes for HC-Robot Client.
"""

try:
    from .ai_bridge_node import AIBridgeNode
except ImportError:
    AIBridgeNode = None

try:
    from .motor_driver_node import MotorDriverNode
except ImportError:
    MotorDriverNode = None

try:
    from .person_detection_node import PersonDetectionNode
except ImportError:
    PersonDetectionNode = None

try:
    from .person_fusion_tracker import PersonFusionTrackerNode
except ImportError:
    PersonFusionTrackerNode = None

try:
    from .safety_controller_node import SafetyControllerNode
except ImportError:
    SafetyControllerNode = None

__all__ = [
    "AIBridgeNode",
    "MotorDriverNode",
    "PersonDetectionNode",
    "PersonFusionTrackerNode",
    "SafetyControllerNode",
]

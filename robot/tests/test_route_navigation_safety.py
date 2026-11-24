"""Regression checks for continuous-route cancellation and its actual BT configuration."""
import ast
from pathlib import Path
from types import SimpleNamespace as NS
from unittest.mock import Mock
import xml.etree.ElementTree as ET

CONFIG = Path(__file__).resolve().parents[1] / 'ros2_configs'


def load_method(file, class_name, name, **environment):
    tree = ast.parse((CONFIG / file).read_text(encoding='utf-8'))
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == class_name)
    fn = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == name)
    exec(compile(ast.Module(body=[fn], type_ignores=[]), file, 'exec'), environment)
    return environment[name]


def test_manual_stop_cancels_route_action_as_well_as_endpoint_action():
    cancel = load_method('lidar_ws_to_ros2.py', 'LidarWsToRos2Bridge', 'on_nav_cancel', CancelGoal=NS(Request=object))
    node = NS(nav_cancel_client=Mock(), route_cancel_client=Mock(), get_logger=Mock(), _send_udp_to_pi5=Mock())
    cancel(node)
    node.nav_cancel_client.call_async.assert_called_once()
    node.route_cancel_client.call_async.assert_called_once()
    node._send_udp_to_pi5.assert_called_once_with('stop')
    assert node.current_vx == node.current_wz == 0


def test_localization_gate_keeps_route_active_when_pose_action_is_idle():
    status = load_method('localization_manager.py', 'LocalizationManager', '_on_goal_status', ACTIVE_GOAL=(1, 2))
    node = NS(active_goals_by_action={}, active_goals=0, _gate_goals=Mock())
    status(node, NS(status_list=[NS(status=2)]), 'route')
    status(node, NS(status_list=[]))
    assert node.active_goals == 1
    node._gate_goals.assert_called()


def test_lost_localization_cancels_both_action_types_and_brakes():
    cancel = load_method('localization_manager.py', 'LocalizationManager', '_cancel_goals',
                         time=NS(monotonic=lambda: 10), CancelGoal=NS(Request=object), Empty=object)
    node = NS(last_cancel=0, get_logger=Mock(), cancel_client=Mock(), route_cancel_client=Mock(), stop_pub=Mock())
    cancel(node, 'mất định vị')
    node.cancel_client.call_async.assert_called_once()
    node.route_cancel_client.call_async.assert_called_once()
    node.stop_pub.publish.assert_called_once()


def test_route_bt_passes_intermediates_without_single_pose_actions_or_spin_recovery():
    tree = ET.parse(CONFIG / 'nav2' / 'physical_route.xml')
    assert len(tree.findall('.//ComputePathThroughPoses')) == 1
    assert not tree.findall('.//ComputePathToPose')
    assert not tree.findall('.//Spin')
    assert tree.find('.//RemovePassedGoals').attrib['radius'] == '0.25'
    assert tree.find('.//FollowPath').attrib['path'] == '{path}'
    for clear in tree.findall('.//ClearEntireCostmap'):
        service = clear.attrib['service_name']
        if service.startswith('local_costmap/'):
            assert service == 'local_costmap/clear_entirely_local_costmap'
        else:
            assert service == 'global_costmap/clear_entirely_global_costmap'

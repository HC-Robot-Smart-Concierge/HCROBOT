import ast
import math
from pathlib import Path
import sys
import time
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

CONFIG = Path(__file__).resolve().parents[1] / 'ros2_configs'
sys.path.insert(0, str(CONFIG))
from encoder_guard import EncoderSampleGuard

SIGNS = dict.fromkeys(('m1', 'm2', 'm3', 'm4'), 1)


def counts(a=0, b=0, c=0, d=0):
    return dict(zip(SIGNS, (a, b, c, d)))


def check(guard, current, previous=None, expected=None):
    return guard.check(current, previous or counts(), SIGNS, .1, .033, 330, expected=expected)


def sustain(guard, current, samples):
    """Feed the same per-sample tick deltas for `samples` samples (0.1 s each)."""
    result = None
    for i in range(samples):
        result = check(guard, {w: v * (i + 1) for w, v in current.items()},
                       {w: v * i for w, v in current.items()})
    return result


def test_stationary_and_real_forward_reverse_spin_remain_valid():
    for ticks in [counts(), counts(10, 10, 10, 10), counts(-10, -10, -10, -10), counts(-10, -10, 10, 10)]:
        guard = EncoderSampleGuard()
        assert check(guard, ticks)
        assert guard.valid


def test_reproduces_m1_noise_seen_on_parked_robot():
    # A single spike is tolerated; the same noise lasting over 1 s is a fault.
    guard = EncoderSampleGuard()
    assert check(guard, counts(-400, 0, 0, 0))
    assert sustain(EncoderSampleGuard(), counts(-400, 0, 0, 0), 10)
    guard = EncoderSampleGuard()
    assert not sustain(guard, counts(-400, 0, 0, 0), 11)
    assert 'M1' in guard.fault
    assert not guard.valid


def test_same_side_disagreement_and_missing_channels_are_not_averaged():
    guard = EncoderSampleGuard()
    assert not sustain(guard, counts(100, 0, 0, 0), 11)
    assert 'DISAGREEMENT' in guard.fault
    assert 'M1=+0.63' in guard.fault
    assert 'M2=+0.00' in guard.fault
    assert not check(guard, {'m1': 0})
    assert not check(guard, counts(math.nan))


def test_fault_requires_five_clean_samples_and_rebases_current_ticks():
    guard = EncoderSampleGuard()
    sustain(guard, counts(-400), 11)
    assert guard.fault
    for _ in range(4):
        assert not check(guard, counts(-400), counts(-400))
    assert check(guard, counts(-400), counts(-400))
    assert guard.valid


def bridge_method(name):
    tree = ast.parse((CONFIG / 'lidar_ws_to_ros2.py').read_text(encoding='utf-8'))
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'LidarWsToRos2Bridge')
    method = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == name)
    env = {'time': time, 'math': math, 'Twist': object}
    exec(compile(ast.Module(body=[method], type_ignores=[]), 'bridge', 'exec'), env)
    return env[name]


def test_invalid_encoder_blocks_autonomy_and_manual_takes_priority():
    node = SimpleNamespace(manual_active_until=0, encoder_guard=EncoderSampleGuard(),
        _send_udp_to_pi5=Mock(), _apply_cmd_vel=Mock())
    bridge_method('on_cmd_vel_received')(node, object())
    node._send_udp_to_pi5.assert_called_with('stop')
    node._apply_cmd_vel.assert_not_called()
    check(node.encoder_guard, counts())
    node.manual_active_until = time.monotonic() + 10
    bridge_method('on_cmd_vel_received')(node, object())
    node._apply_cmd_vel.assert_not_called()
    node.manual_active_until = 0
    bridge_method('on_cmd_vel_received')(node, 'nav-message')
    node._apply_cmd_vel.assert_called_once_with('nav-message')


def test_manual_reverse_cancels_nav_once_then_reaches_existing_motor_interlock():
    node = SimpleNamespace(manual_active_until=0, on_nav_cancel=Mock(), _apply_cmd_vel=Mock())
    message = SimpleNamespace(linear=SimpleNamespace(x=-.12), angular=SimpleNamespace(z=0))
    callback = bridge_method('on_manual_cmd_vel')
    callback(node, message)
    callback(node, message)
    node.on_nav_cancel.assert_called_once()
    assert node._apply_cmd_vel.call_count == 2
    assert node.manual_active_until > time.monotonic()


def test_single_spike_on_one_wheel_uses_its_partner():
    guard = EncoderSampleGuard()
    assert check(guard, counts(-400, 10, 10, 10))
    assert guard.side_tick_deltas == {'left': 10, 'right': 10}
    assert guard.dropped['m1'] == 1 and guard.dropped['m2'] == 0


def test_disagreeing_pair_trusts_the_wheel_closer_to_the_command():
    guard = EncoderSampleGuard()
    assert check(guard, counts(60, 10, 10, 10), expected={'left': .38, 'right': .06})
    assert guard.side_tick_deltas['left'] == 60
    assert guard.dropped['m2'] == 1
    guard = EncoderSampleGuard()
    assert check(guard, counts(60, 10, 10, 10), expected={'left': .06, 'right': .06})
    assert guard.side_tick_deltas['left'] == 10


def test_agreeing_pair_is_averaged():
    guard = EncoderSampleGuard()
    assert check(guard, counts(10, 12, 20, 20))
    assert guard.side_tick_deltas == {'left': 11, 'right': 20}


def test_both_wheels_of_a_side_bad_fault_immediately():
    guard = EncoderSampleGuard()
    assert not check(guard, counts(-400, -400, 0, 0))
    assert 'IMPOSSIBLE_SPEED' in guard.fault


def test_a_clean_sample_resets_the_suspect_timer():
    guard = EncoderSampleGuard()
    for _ in range(3):
        assert sustain(guard, counts(-400, 0, 0, 0), 8)
        assert check(guard, counts())
    assert guard.valid


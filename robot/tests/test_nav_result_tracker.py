import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ros2_configs"))

from nav_result_tracker import NavResultTracker  # noqa: E402


class TestNavResultTracker(unittest.TestCase):
    def test_first_message_only_primes(self):
        t = NavResultTracker()
        self.assertEqual(t.update([(b"old", 4)]), [])
        # goal cu khong bi bao lai o message sau
        self.assertEqual(t.update([(b"old", 4)]), [])

    def test_reports_terminal_once(self):
        t = NavResultTracker()
        t.update([])
        self.assertEqual(t.update([(b"g1", 2)]), [])
        self.assertEqual(t.update([(b"g1", 4)]), [(b"g1", "SUCCEEDED")])
        self.assertEqual(t.update([(b"g1", 4)]), [])

    def test_preempted_and_new_goal(self):
        t = NavResultTracker()
        t.update([])
        result = t.update([(b"g1", 6), (b"g2", 2)])
        self.assertEqual(result, [(b"g1", "ABORTED")])
        self.assertEqual(t.update([(b"g2", 5)]), [(b"g2", "CANCELED")])

    def test_memory_bounded(self):
        t = NavResultTracker(max_remembered=3)
        t.update([])
        for i in range(10):
            t.update([(bytes([i]), 4)])
        self.assertLessEqual(len(t._reported), 3)


if __name__ == "__main__":
    unittest.main()

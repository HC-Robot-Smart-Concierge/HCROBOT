"""Theo dõi kết quả goal Nav2 từ topic /navigate_to_pose/_action/status.

bt_navigator (Jazzy) tự nhận /goal_pose và tự gửi goal cho chính nó, nên không ai
giữ goal handle để biết kết quả. Topic status của action thì luôn có: mỗi goal có
UUID và trạng thái; khi một goal vào trạng thái kết thúc lần đầu => báo đúng 1 lần.
Áp dụng cho mọi nguồn goal (Web Admin, Foxglove, frontier explorer).
"""

from __future__ import annotations

from typing import Iterable, List, Tuple

# action_msgs/msg/GoalStatus
STATUS_NAMES = {
    1: "ACCEPTED",
    2: "EXECUTING",
    3: "CANCELING",
    4: "SUCCEEDED",
    5: "CANCELED",
    6: "ABORTED",
}
TERMINAL = {4, 5, 6}


class NavResultTracker:
    def __init__(self, max_remembered: int = 200):
        self._reported: List[bytes] = []
        self._max = max_remembered
        self._primed = False

    def update(self, statuses: Iterable[Tuple[bytes, int]]) -> List[Tuple[bytes, str]]:
        """statuses: (uuid, status) của mọi goal trong message. Trả về goal mới kết thúc.

        Message đầu tiên (topic transient-local, có thể chứa goal của phiên trước)
        chỉ ghi nhớ, không báo, để web không nhận kết quả cũ khi bridge vừa khởi động.
        """
        new = []
        for uuid, status in statuses:
            if status not in TERMINAL or uuid in self._reported:
                continue
            self._reported.append(uuid)
            if self._primed:
                new.append((uuid, STATUS_NAMES[status]))
        self._primed = True
        if len(self._reported) > self._max:
            del self._reported[: len(self._reported) - self._max]
        return new

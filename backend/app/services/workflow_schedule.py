"""Schedule preview only. This module does not dispatch or move a robot."""
from datetime import datetime, timedelta, timezone

from app.schemas.workflow import WorkflowExecutionConfig


# These supported zones have fixed offsets and no daylight-saving transitions.
# Explicit offsets also work on Windows without a system IANA timezone database.
ZONE_OFFSETS = {"Asia/Ho_Chi_Minh": 7, "Asia/Bangkok": 7, "UTC": 0}


def preview_schedule(config: WorkflowExecutionConfig, now=None, limit=5):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must include a timezone")
    upcoming = set()
    for schedule in config.schedules:
        if not schedule.enabled:
            continue
        tz = timezone(timedelta(hours=ZONE_OFFSETS[schedule.timezone]))
        today = now.astimezone(tz).date()
        hour, minute = map(int, schedule.time.split(":"))
        # Five weekly occurrences can span more than one month.
        for offset in range(limit * 7 + 1):
            day = today + timedelta(days=offset)
            if day.weekday() not in schedule.days:
                continue
            candidate = datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz)
            if candidate > now:
                upcoming.add(candidate.astimezone(timezone.utc))
    return sorted(upcoming)[:limit]

"""Diagnostic only: exercise Windows->WSL lease files without ROS or robot access."""
import asyncio
import contextlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def reader(path):
    sequences = set()
    max_age = 0.0
    errors = 0
    expired = False
    until = time.monotonic() + 8
    while time.monotonic() < until:
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
            sequences.add(data['sequence'])
            max_age = max(max_age, time.time() - data['issued_at'])
            expired |= data['expires_at'] < time.time()
        except (OSError, ValueError, KeyError):
            errors += 1
        time.sleep(.05)
    print(json.dumps(dict(distinct_updates=len(sequences), max_age_sec=round(max_age, 3),
                          expired=expired, read_errors=errors)), flush=True)


async def writer():
    root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(root / 'backend'))
    from app.services.workflow_runtime import WorkflowRuntime
    runtime = WorkflowRuntime(sessions=lambda: None, root=root)
    directory = root / 'output/runtime/lease-probe'
    directory.mkdir(parents=True, exist_ok=True)
    control = directory / 'probe.control.json'
    item = dict(control=control, db_confirmed_at=time.monotonic(), cancel_requested=False)
    runtime.refresh_control(item)
    def wsl(path):
        return '/mnt/' + path.drive[0].lower() + str(path)[2:].replace('\\', '/')
    child = subprocess.Popen(['wsl.exe', '--exec', 'python3', wsl(Path(__file__).resolve()),
                              '--reader', wsl(control)], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             text=True, encoding='utf-8')
    item['process'] = child
    runtime.running['diagnostic-only'] = item
    task = asyncio.create_task(runtime.control_loop())
    try:
        output, error = await asyncio.to_thread(child.communicate, timeout=15)
        print(output.strip())
        if error:
            print(error.strip(), file=sys.stderr)
        if child.returncode:
            raise SystemExit(child.returncode)
        result = json.loads(output)
        assert result['distinct_updates'] >= 5 and not result['expired'], result
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


if __name__ == '__main__':
    if '--reader' in sys.argv:
        reader(Path(sys.argv[-1]))
    elif os.name == 'nt':
        asyncio.run(writer())

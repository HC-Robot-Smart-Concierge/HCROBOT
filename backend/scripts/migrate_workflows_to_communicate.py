import asyncio
import os
import sys

# Ensure backend root is in sys.path and stdout uses UTF-8
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding="utf-8")

from app.core.database import AsyncSessionLocal
from app.models.workflow import RobotWorkflow
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified


def convert_steps_to_communicate(steps):
    """
    Transforms workflow steps by merging / converting 'LISTEN' and 'SPEAK' into 'COMMUNICATE'.
    Applies silence_timeout_sec = 30.
    """
    if not steps:
        return []

    new_steps = []
    i = 0
    n = len(steps)

    while i < n:
        curr = dict(steps[i])
        curr_type = curr.get("type", "").upper()

        # Check if current and next step are a pair of (SPEAK, LISTEN) or (LISTEN, SPEAK)
        if i + 1 < n:
            nxt = dict(steps[i + 1])
            nxt_type = nxt.get("type", "").upper()

            if (curr_type == "SPEAK" and nxt_type == "LISTEN") or (curr_type == "LISTEN" and nxt_type == "SPEAK"):
                # Merge into a single COMMUNICATE step
                speak_step = curr if curr_type == "SPEAK" else nxt
                listen_step = curr if curr_type == "LISTEN" else nxt

                merged_params = {}
                # Copy from speak
                speak_params = speak_step.get("params", {})
                merged_params["initial_prompt"] = (
                    speak_params.get("speech_text")
                    or speak_params.get("text")
                    or speak_params.get("greeting_text")
                    or "Dạ em chào quý khách! Em có thể hỗ trợ gì cho quý khách ạ?"
                )
                merged_params["language"] = speak_params.get("language", "vi-VN")
                merged_params["speed"] = speak_params.get("speed", 1.0)

                # Copy from listen
                listen_params = listen_step.get("params", {})
                merged_params["silence_timeout_sec"] = 30
                merged_params["input_source"] = listen_params.get("input_source", "BOTH")
                if "output_var" in listen_params:
                    merged_params["output_var"] = listen_params["output_var"]
                merged_params["ai_agent_enabled"] = True

                merged_step = {
                    "step_id": curr.get("step_id", f"step-comm-{i+1}"),
                    "type": "COMMUNICATE",
                    "title": f"{i+1}. Đối thoại thông minh & Lắng nghe yêu cầu khách",
                    "params": merged_params,
                }
                new_steps.append(merged_step)
                i += 2
                continue

        if curr_type == "LISTEN":
            old_params = curr.get("params", {})
            curr["type"] = "COMMUNICATE"
            curr["title"] = curr.get("title", f"{i+1}. Đối thoại & Lắng nghe khách").replace("LISTEN", "COMMUNICATE")
            new_params = dict(old_params)
            new_params["silence_timeout_sec"] = 30
            new_params["input_source"] = old_params.get("input_source", "BOTH")
            new_params["ai_agent_enabled"] = True
            if "initial_prompt" not in new_params:
                new_params["initial_prompt"] = old_params.get("prompt_hint") or "Dạ em đang lắng nghe, quý khách cần hỗ trợ gì ạ?"
            curr["params"] = new_params
            new_steps.append(curr)
            i += 1
            continue

        if curr_type == "SPEAK":
            old_params = curr.get("params", {})
            curr["type"] = "COMMUNICATE"
            curr["title"] = curr.get("title", f"{i+1}. Thông báo & Đối thoại với khách").replace("SPEAK", "COMMUNICATE")
            new_params = dict(old_params)
            new_params["silence_timeout_sec"] = 30
            new_params["input_source"] = "BOTH"
            new_params["ai_agent_enabled"] = True
            new_params["initial_prompt"] = (
                old_params.get("speech_text")
                or old_params.get("text")
                or old_params.get("greeting_text")
                or "Dạ em hỗ trợ được gì thêm cho quý khách không ạ?"
            )
            curr["params"] = new_params
            new_steps.append(curr)
            i += 1
            continue

        # Keep other steps as-is
        new_steps.append(curr)
        i += 1

    return new_steps


async def migrate_all_workflows_to_communicate():
    print("=== BẮT ĐẦU MIGRATE WORKFLOW DATABASE SANG COMMUNICATE ===")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(RobotWorkflow).order_by(RobotWorkflow.id))
        workflows = result.scalars().all()
        print(f"Tìm thấy {len(workflows)} workflows trong bảng robot_workflows.")

        migrated_count = 0
        for wf in workflows:
            old_types = [s.get("type") for s in (wf.steps or [])]
            new_steps = convert_steps_to_communicate(wf.steps or [])
            new_types = [s.get("type") for s in new_steps]

            if old_types != new_types or wf.steps != new_steps:
                print(f"\n[CẬP NHẬT] Workflow '{wf.id}' ({wf.name}):")
                print(f"  - Trước: {old_types}")
                print(f"  - Sau:   {new_types}")
                wf.steps = new_steps
                flag_modified(wf, "steps")
                migrated_count += 1
            else:
                print(f"\n[GIỮ NGUYÊN] Workflow '{wf.id}': Đã chuẩn hóa trước đó.")

        await session.commit()
        print(f"\nĐÃ COMMIT THÀNH CÔNG! Tổng số workflows đã cập nhật: {migrated_count}/{len(workflows)}")


if __name__ == "__main__":
    asyncio.run(migrate_all_workflows_to_communicate())

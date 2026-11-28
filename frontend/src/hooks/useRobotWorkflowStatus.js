import { useEffect, useRef, useState } from 'react';
import { reportScreenWorkflow } from '../services/workflowApi';

export function useRobotWorkflowStatus(source, workflowId, workflowName, stepTitle, stepIndex) {
  const [screenId] = useState(() => globalThis.crypto?.randomUUID?.() ?? `screen-${Date.now()}-${Math.random()}`);
  const sequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const publish = () => reportScreenWorkflow({
      screen_id: screenId,
      source,
      sequence: ++sequence.current,
      workflow_id: workflowId || null,
      workflow_name: workflowName?.slice(0, 200),
      step_title: stepTitle?.slice(0, 250),
      step_index: Number.isInteger(stepIndex) && stepIndex >= 0 ? stepIndex : undefined,
    }, controller.signal).catch(() => {});
    publish();
    const timer = setInterval(publish, 5000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [source, screenId, workflowId, workflowName, stepTitle, stepIndex]);
}

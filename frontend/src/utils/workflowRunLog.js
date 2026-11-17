// The API returns newest runs first. Each start gets a separate event stream.
export function currentWorkflowRunLog(runs, workflowId, runId) {
  const matching = workflowId ? runs.filter((run) => run.workflow_id === workflowId) : runs;
  if (runId) return matching.filter((run) => run.id === runId).slice(0, 1);
  return matching.slice(0, 1);
}

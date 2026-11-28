import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Background, Controls, MarkerType, MiniMap, ReactFlow, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  BATTERY, GUEST_EVENT, SCREEN_LANE, addBatteryBranch, appendStep, enableParallel, eventBranch, connect, disconnect, markSelected, removeStep, setBatteryThreshold, setPosition, workflowToGraph,
} from '../../../../../utils/workflowGraph';
import { laneIssues, parallelOf } from '../../../../../utils/workflowLanes';
import { stepSetup } from '../../../../../utils/workflowStepSetup';
import { BATTERY_COLOR, ERROR_COLOR, GUEST_COLOR, NODE_TYPES, OK_COLOR, SCREEN_COLOR } from './WorkflowCanvasNodes';
import { NodePalette, createStep } from './NodePalette';

const ROBOT_TYPES = new Set(['MOVE', 'FOLLOW_ROUTE', 'WAIT']);
const LANE_COLORS = { screen: SCREEN_COLOR, guest: GUEST_COLOR };

function edgeStyle(edge) {
  const color = edge.data?.error ? ERROR_COLOR : edge.data?.battery ? BATTERY_COLOR : LANE_COLORS[edge.data?.lane] || OK_COLOR;
  return {
    ...edge, type: 'smoothstep', animated: Boolean(edge.data?.battery || edge.data?.lane),
    style: { stroke: color, strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color },
    labelStyle: { fontSize: 10, fill: color }, labelBgStyle: { fill: '#fff' },
  };
}

/** Keep auto-laid-out nodes where they are when a structural edit would re-run the layout. */
function freezePositions(workflow, nodes) {
  return nodes.reduce((wf, node) => {
    const parallel = parallelOf(wf);
    const unsaved = node.id === BATTERY
      ? !eventBranch(wf, 'LOW_BATTERY')?.ui_position
      : node.id === SCREEN_LANE ? Boolean(parallel) && !parallel.screen_ui_position
      : node.id === GUEST_EVENT ? Boolean(parallel) && !parallel.guest_ui_position
      : node.type === 'step' && !wf.steps.find((s) => s.step_id === node.id)?.params?.ui_position;
    return unsaved ? setPosition(wf, node.id, node.position) : wf;
  }, workflow);
}

/**
 * n8n-style editor. The parent owns the workflow; every edit returns a whole new
 * workflow through onChange. Links are explicit, so branch-only steps never fall through.
 */
export function WorkflowCanvas({ workflow, routes = [], selectedId, onSelect, onChange }) {
  const robotMode = workflow.execution_config?.execution_mode === 'ROBOT';
  const hasBatteryBranch = Boolean(eventBranch(workflow, 'LOW_BATTERY'));
  const hasParallel = Boolean(parallelOf(workflow));

  const graph = useMemo(() => {
    const { nodes, edges } = workflowToGraph(workflow);
    const parallelIssues = laneIssues(workflow);
    const isParallel = Boolean(parallelOf(workflow));
    const decorated = nodes.map((node) => {
      if (node.type === 'battery') {
        return { ...node, data: { ...node.data, onThreshold: (value) => onChange(setBatteryThreshold(workflow, value)) } };
      }
      if (node.type === 'start') {
        return { ...node, draggable: false, data: { ...node.data, onConfigure: () => onSelect(node.id) } };
      }
      if (node.type === 'screenLane' || node.type === 'guestEvent') return node;
      if (node.type !== 'step') return { ...node, draggable: false, selectable: false };
      const issues = [...stepSetup(node.data.step, routes).issues, ...(parallelIssues[node.id] || [])];
      if (robotMode && !isParallel && !ROBOT_TYPES.has(node.data.step.type)) issues.push('Xe thật chưa chạy được loại bước này.');
      return { ...node, data: { ...node.data, issues } };
    });
    return { nodes: decorated, edges: edges.map(edgeStyle) };
  }, [workflow, routes, robotMode, onChange, onSelect]);

  const [nodes, setNodes] = useState(() => markSelected(graph.nodes, selectedId));
  useEffect(() => { setNodes(markSelected(graph.nodes, selectedId)); }, [graph, selectedId]);

  const [edges, setEdges] = useState(graph.edges);
  useEffect(() => { setEdges(graph.edges); }, [graph]);

  const commit = useCallback((edit) => onChange(edit(freezePositions(workflow, nodes))), [workflow, nodes, onChange]);

  const onNodesChange = useCallback((changes) => {
    setNodes((current) => applyNodeChanges(changes.filter((c) => c.type !== 'remove'), current));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((current) => applyEdgeChanges(changes.filter((c) => c.type !== 'remove'), current));
  }, []);

  const addStep = (step) => {
    const last = nodes.filter((n) => n.type === 'step').reduce((max, n) => Math.max(max, n.position.y), 0);
    commit((wf) => appendStep(wf, step, { x: 260, y: last + 160 }));
    onSelect(step.step_id);
  };

  return <div className="relative h-full w-full bg-stone-50" aria-label="Sơ đồ workflow">
    <NodePalette robotMode={robotMode} hasBatteryBranch={hasBatteryBranch} hasParallel={hasParallel} onAdd={addStep}
      onAddBattery={() => { commit((wf) => addBatteryBranch(wf)); onSelect(BATTERY); }}
      onEnableParallel={() => { commit((wf) => enableParallel(wf, createStep)); onSelect(SCREEN_LANE); }} />
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onEdgesChange={onEdgesChange}
      isValidConnection={(c) => c.source !== c.target}
      nodeTypes={NODE_TYPES}
      onNodesChange={onNodesChange}
      onNodeDragStop={(_, node) => onChange(setPosition(workflow, node.id, node.position))}
      onConnect={(connection) => commit((wf) => connect(wf, connection))}
      onDelete={({ nodes: gone = [], edges: cut = [] }) => {
        // One commit: React Flow reports a node's edges too, and two commits from the same
        // workflow snapshot would overwrite each other.
        const removed = new Set(gone.map((node) => node.id));
        commit((wf) => gone.reduce((acc, node) => removeStep(acc, node.id),
          cut.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target))
            .reduce((acc, edge) => disconnect(acc, edge), wf)));
        if (removed.has(selectedId)) onSelect(null);
      }}
      onNodeClick={(_, node) => onSelect(['start', 'step', 'battery', 'screenLane', 'guestEvent'].includes(node.type) ? node.id : null)}
      onPaneClick={() => onSelect(null)}
      deleteKeyCode={['Backspace', 'Delete']}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} color="#d6d3d1" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeStrokeWidth={3} />
    </ReactFlow>
  </div>;
}

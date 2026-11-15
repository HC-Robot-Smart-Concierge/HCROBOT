import React from 'react';
import {
  Sparkles,
  Layers,
  RefreshCw,
  Trash2,
  Plus,
  Save,
  FileText,
  Check,
} from 'lucide-react';

export function AdminLidarWorkflowAndOverlayModals({
  rc,
  isExploreModalOpen,
  setIsExploreModalOpen,
  handleStartExplore,
  isWorkflowModalOpen,
  setIsWorkflowModalOpen,
  newWorkflow,
  setNewWorkflow,
  handleSaveWorkflow,
  loadWorkflows,
  workflowList,
  handleExecuteWorkflow,
  handleDeleteWorkflow,
  isOverlayModalOpen,
  setIsOverlayModalOpen,
  overlayActive,
  overlayWaypoints,
  overlayMapName,
  setOverlayMapName,
  handleGenerateOverlayTemplate,
  handleDisableOverlay,
  handleLoadOverlay,
}) {
  return (
    <>
      {/* Frontier Exploration Modal */}
      {isExploreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col gap-4 border"
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between pb-3 border-b"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600"/>
                <h3 className="text-base font-bold text-stone-900"> {rc("Scan Entire Room (Autonomous SLAM)")} </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExploreModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg cursor-pointer px-2"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-stone-600 space-y-2.5">
              <p> {rc("The robot combines")} <strong>ROS 2 SLAM Toolbox</strong> {rc("with the algorithm")} <strong>Frontier Exploration</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-stone-700">
                <li> {rc("Automatically identify reachable frontiers of unexplored space.")} </li>
                <li> {rc("Navigate to room corners and corridors to extend the map.")} </li>
                <li> {rc("Avoid obstacles in real time using 360° LiDAR A1 and ultrasonic sensors.")} </li>
                <li> {rc("Extend the live SLAM map in Foxglove until the room is covered.")} </li>
              </ul>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]"> {rc("Ensure the floor has no steep steps or holes. You can select \"STOP EXPLORATION\" at any time.")} </div>
            </div>

            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-800 flex items-start gap-2">
              <Save className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"/>
              <span> {rc("No need to name the map first: when the robot finishes scanning (or is stopped), the web app reports the result and opens the")}
                <strong> {rc("Save map")}</strong> {rc("panel so you can name and save it.")}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t"style={{ borderColor: '#BFBFBD'}}>
              <button
                type="button"
                onClick={() => setIsExploreModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer bg-white text-stone-700 hover:bg-stone-100"
                style={{ borderColor: '#BFBFBD'}}
              > {rc("Cancel")} </button>
              <button
                type="button"
                onClick={handleStartExplore}
                className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5"/>
                <span> {rc("Start Full Room Scan")} </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Manager Modal */}
      {isWorkflowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-3xl max-h-[85vh] rounded-xl shadow-2xl p-6 flex flex-col gap-4 border"
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between pb-3 border-b shrink-0"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600"/>
                <h3 className="text-base font-bold text-stone-900"> {rc("Automatic Workflow Manager")} </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkflowModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg cursor-pointer px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto">
              {/* Column 1: Saved Workflows */}
              <div className="flex flex-col gap-2 border-r pr-3"style={{ borderColor: '#E5E4E2'}}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wide"> {rc("Saved workflows (")} {workflowList.length})</span>
                  <button
                    onClick={loadWorkflows}
                    className="text-[11px] text-purple-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3"/> {rc("Refresh")} </button>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[360px] pr-1">
                  {workflowList.length === 0 ? (
                    <div className="text-xs text-stone-400 italic text-center py-8"> {rc("No workflows yet")} </div>
                  ) : (
                    workflowList.map((wf) => (
                      <div
                        key={wf.id}
                        className="p-3 bg-white rounded-lg border flex flex-col gap-2 shadow-xs"
                        style={{ borderColor: '#BFBFBD'}}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-bold text-stone-800">{wf.name}</div>
                            {wf.description && <div className="text-[10px] text-stone-500">{wf.description}</div>}
                            <div className="text-[10px] text-purple-600 font-semibold mt-0.5">
                              {wf.steps?.length || 0} {rc("steps")} </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleExecuteWorkflow(wf.id)}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold cursor-pointer"
                              title={rc("Run workflow")}
                            > {rc("▶ Run")} </button>
                            <button
                              onClick={() => handleDeleteWorkflow(wf.id)}
                              className="p-1 text-red-500 hover:text-red-700 rounded text-[10px] cursor-pointer"
                              title={rc("Delete workflow")}
                            >
                              <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                          </div>
                        </div>

                        {/* Steps preview */}
                        <div className="text-[10px] text-stone-500 bg-stone-50 rounded p-1.5 space-y-0.5">
                          {wf.steps?.map((st, i) => (
                            <div key={i} className="truncate">
                              {i + 1}. <span className="font-semibold text-stone-700">{st.action}</span> - {st.name} {st.x !== undefined && `(${st.x}, ${st.y})`}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: New Workflow Editor */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wide"> {rc("Create Workflow")} </span>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600"> {rc("Workflow name")} </label>
                    <input
                      type="text"
                      value={newWorkflow.name}
                      onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border text-xs bg-white text-stone-800"
                      style={{ borderColor: '#BFBFBD'}}
                      placeholder={rc("E.g. Main lobby patrol")}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-stone-600"> {rc("Workflow steps")} </label>
                      <button
                        type="button"
                        onClick={() =>
                          setNewWorkflow({
                            ...newWorkflow,
                            steps: [
                              ...newWorkflow.steps,
                              { name: rc("Step {0}", [newWorkflow.steps.length + 1]), action: 'navigate', x: 0, y: 0, timeout: 30 },
                            ],
                          })
                        }
                        className="text-[10px] text-purple-600 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3"/> {rc("Add step")} </button>
                    </div>

                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {newWorkflow.steps.map((st, idx) => (
                        <div key={idx} className="p-2 bg-white rounded border text-xs space-y-1"style={{ borderColor: '#E5E4E2'}}>
                          <div className="flex items-center gap-1 justify-between">
                            <span className="font-bold text-[10px] text-purple-700">#{idx + 1}</span>
                            <input
                              type="text"
                              value={st.name}
                              onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].name = e.target.value;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }}
                              className="px-1.5 py-0.5 border rounded text-[11px] flex-1"
                              placeholder={rc("Step name")}
                            />
                            <select
                              value={st.action}
                              onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].action = e.target.value;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }}
                              className="px-1.5 py-0.5 border rounded text-[11px] bg-stone-50"
                            >
                              <option value="navigate">navigate</option>
                              <option value="wait">wait</option>
                              <option value="scan_360">scan_360</option>
                              <option value="return_home">return_home</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = newWorkflow.steps.filter((_, i) => i !== idx);
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }}
                              className="text-red-500 hover:text-red-700 px-1"
                            >
                              ✕
                            </button>
                          </div>

                          {st.action === 'navigate'&& (
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <div>X (m): <input type="number"step="0.1"value={st.x ?? 0} onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].x = parseFloat(e.target.value) || 0;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }} className="w-16 px-1 border rounded"/></div>
                              <div>Y (m): <input type="number"step="0.1"value={st.y ?? 0} onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].y = parseFloat(e.target.value) || 0;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }} className="w-16 px-1 border rounded"/></div>
                            </div>
                          )}

                          {st.action === 'wait'&& (
                            <div className="text-[10px]"> {rc("Wait (seconds):")} <input type="number"value={st.wait_sec ?? 3} onChange={(e) => {
                                const updated = [...newWorkflow.steps];
                                updated[idx].wait_sec = parseInt(e.target.value) || 3;
                                setNewWorkflow({ ...newWorkflow, steps: updated });
                              }} className="w-16 px-1 border rounded"/>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveWorkflow}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5"/>
                    <span> {rc("Save New Workflow")} </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t shrink-0"style={{ borderColor: '#BFBFBD'}}>
              <button
                type="button"
                onClick={() => setIsWorkflowModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer bg-white text-stone-700 hover:bg-stone-100"
                style={{ borderColor: '#BFBFBD'}}
              > {rc("Close")} </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay Map Modal */}
      {isOverlayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col gap-4 border"
            style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD'}}
          >
            <div className="flex items-center justify-between pb-3 border-b"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600"/>
                <h3 className="text-base font-bold text-stone-900"> {rc("Static Map Overlay")} </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOverlayModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold text-lg cursor-pointer px-2"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-stone-600 space-y-2">
              <p> {rc("Overlay the designed floor plan (permanent walls, restricted zones and departments) on the LiDAR SLAM grid.")} </p>
              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-[11px]">
                ️ <strong> {rc("How it works:")} </strong> {rc("Overlay walls are treated as solid obstacles (100%), ensuring A* navigation never routes through them.")} </div>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1"> {rc("Overlay map filename")} </label>
                <input
                  type="text"
                  value={overlayMapName}
                  onChange={(e) => setOverlayMapName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-xs bg-white text-stone-800 outline-none focus:border-teal-500"
                  style={{ borderColor: '#BFBFBD'}}
                  placeholder="floor_plan_overlay"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white rounded border text-xs"style={{ borderColor: '#BFBFBD'}}>
                <span className="font-semibold text-stone-700"> {rc("Status:")} </span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${overlayActive ? 'bg-teal-100 text-teal-800': 'bg-stone-100 text-stone-600'}`}>
                  {overlayActive ? rc("ACTIVE"): rc("INACTIVE")}
                </span>
              </div>

              {overlayWaypoints.length > 0 && (
                <div className="text-xs text-stone-600">
                  <span className="font-semibold"> {rc("Overlay waypoints:")} </span>
                  <div className="mt-1 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {overlayWaypoints.map((wp, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-[10px] font-medium">
                         {wp.name} ({wp.x}, {wp.y})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t"style={{ borderColor: '#BFBFBD'}}>
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={handleGenerateOverlayTemplate}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer bg-white text-stone-700 hover:bg-stone-100 flex items-center gap-1"
                  style={{ borderColor: '#BFBFBD'}}
                  title={rc("Create a sample JSON file on Pi 5")}
                >
                  <FileText className="w-3.5 h-3.5 text-stone-500"/>
                  <span> {rc("Create JSON Template")} </span>
                </button>

                {overlayActive ? (
                  <button
                    type="button"
                    onClick={handleDisableOverlay}
                    className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-red-600 hover:bg-red-700 text-white"
                  > {rc("Disable Overlay")} </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLoadOverlay}
                    className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5"/>
                    <span> {rc("Load Map Overlay")} </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

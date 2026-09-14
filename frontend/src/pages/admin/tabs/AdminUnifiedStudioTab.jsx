import React, { useState, useEffect } from 'react';
import {
  fetchWaypoints,
  saveWaypoint,
  updateWaypoint,
  deleteWaypoint,
  fetchWorkflows,
  saveWorkflow,
} from '../../../services/workflowApi';
import { OTTO_STEP_TYPES } from './AdminWorkflowTab';
import {
  OTTO_ENDPOINT_TEMPLATES,
  getEndpointTemplateInfo,
} from './studio/studioConstants';
import { StudioHeader } from './studio/StudioHeader';
import { StudioMapCanvas } from './studio/StudioMapCanvas';
import { StudioWorkflowPanel } from './studio/StudioWorkflowPanel';
import { StudioEndpointsPanel } from './studio/StudioEndpointsPanel';
import { EndpointModal } from './studio/EndpointModal';
import { DeleteConfirmModal } from './studio/DeleteConfirmModal';

export { OTTO_ENDPOINT_TEMPLATES, getEndpointTemplateInfo };

// Pi5 Connection
const PI5_IP = import.meta.env.VITE_PI5_IP || '100.73.245.66';
const PI5_API = `http://${PI5_IP}:8000/api/v1`;
const PI5_WS = `ws://${PI5_IP}:8000/api/v1`;

export const AdminUnifiedStudioTab = ({ onSwitchToCamera }) => {
  // 1. Data States
  const [workflows, setWorkflows] = useState([]);
  const [activeWf, setActiveWf] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [keepOutZones, setKeepOutZones] = useState([
    { id: 'zone-stairs', name: 'CẦU THANG BỘ', x: 4.5, y: -2.0, width: 1.8, height: 2.2 },
  ]);

  // 2. Telemetry & SLAM
  const [scanPoints, setScanPoints] = useState([]);
  const [gridData, setGridData] = useState([]);
  const [gridMetadata, setGridMetadata] = useState({ width: 200, height: 200, resolution: 0.05, origin_x: -5.0, origin_y: -5.0 });
  const [robotPose, setRobotPose] = useState({ x: 0.0, y: 0.0, yaw: 0.0, battery: 98 });
  const [isWsConnected, setIsWsConnected] = useState(false);

  // 3. Studio Mode & Endpoint Editing (Otto Standard)
  const [isPinMode, setIsPinMode] = useState(false);
  const [isEndpointModalOpen, setIsEndpointModalOpen] = useState(false);
  const [endpointModalMode, setEndpointModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [endpointFormData, setEndpointFormData] = useState({
    id: '',
    name: '',
    floor: 'Tầng 1',
    x: 0,
    y: 0,
    yaw: 0,
    type: 'WAYPOINT',
    description: '',
  });
  const [templateFilter, setTemplateFilter] = useState('ALL');
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [highlightedWpId, setHighlightedWpId] = useState(null);
  const [sideTab, setSideTab] = useState('workflow'); // 'workflow' | 'waypoints'
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null); // { id, name }

  // 4. Live Simulation
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(-1);
  const [simLogs, setSimLogs] = useState([]);

  // 5. Notifications
  const [notification, setNotification] = useState('');

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  // Load Workflows & Waypoints
  const loadAll = async () => {
    try {
      const [wfs, wps] = await Promise.all([fetchWorkflows(), fetchWaypoints()]);
      setWorkflows(wfs || []);
      setWaypoints(wps || []);
      if (wfs && wfs.length > 0 && !activeWf) {
        setActiveWf(wfs[0]);
      }
    } catch {
      showNotification('Không thể tải danh sách Workflows hoặc Waypoints');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // WebSocket for real LiDAR SLAM
  useEffect(() => {
    const ws = new WebSocket(`${PI5_WS}/map/ws`);
    ws.onopen = () => setIsWsConnected(true);
    ws.onclose = () => setIsWsConnected(false);
    ws.onerror = () => setIsWsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'telemetry_update') {
          if (data.robot_pose) {
            setRobotPose({
              x: data.robot_pose.x,
              y: data.robot_pose.y,
              yaw: data.robot_pose.yaw,
              battery: data.battery ?? 98,
            });
          }
          if (data.scan_points) setScanPoints(data.scan_points);
          if (data.grid_data) setGridData(data.grid_data);
          if (data.grid_metadata) setGridMetadata(data.grid_metadata);
        }
      } catch {}
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  // Map Click to Set Goal or Pin Waypoint
  const handleCanvasClickGoal = async (targetX, targetY) => {
    showNotification(`MỤC TIÊU DI CHUYỂN: X=${targetX}m, Y=${targetY}m`);
    try {
      await fetch(`${PI5_API}/map/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_x: targetX, target_y: targetY }),
      });
    } catch {}
  };

  // Open Add Endpoint Modal (from map pin or manual button)
  const handleOpenAddEndpointModal = (coords = null) => {
    const x = coords ? coords.x : Number(robotPose.x || 0);
    const y = coords ? coords.y : Number(robotPose.y || 0);
    const yaw = coords ? 0 : Number(robotPose.yaw || 0);
    setEndpointFormData({
      id: `wp-${Date.now().toString(36)}`,
      name: '',
      floor: 'Tầng 1',
      x: Number(Number(x).toFixed(2)),
      y: Number(Number(y).toFixed(2)),
      yaw: Number(Number(yaw).toFixed(0)),
      type: 'WAYPOINT',
      description: '',
    });
    setEndpointModalMode('CREATE');
    setIsPinMode(false);
    setIsEndpointModalOpen(true);
  };

  // Open Edit Endpoint Modal
  const handleOpenEditEndpointModal = (wp) => {
    setEndpointFormData({
      id: wp.id,
      name: wp.name || '',
      floor: wp.floor || 'Tầng 1',
      x: wp.x ?? 0,
      y: wp.y ?? 0,
      yaw: wp.yaw ?? 0,
      type: wp.type || 'WAYPOINT',
      description: wp.description || '',
    });
    setEndpointModalMode('EDIT');
    setIsEndpointModalOpen(true);
  };

  const handleCanvasClickPin = (x, y) => {
    handleOpenAddEndpointModal({ x, y });
  };

  const handleSelectWaypointFromMap = (wp) => {
    setSelectedWaypoint(wp);
    setHighlightedWpId(wp.id);
  };

  // Save or Update Endpoint to Database
  const handleSaveEndpoint = async (e) => {
    e.preventDefault();
    if (!endpointFormData.name.trim()) {
      showNotification('Vui lòng nhập tên Endpoint');
      return;
    }

    try {
      const payload = {
        id: endpointFormData.id,
        name: endpointFormData.name.trim(),
        floor: endpointFormData.floor,
        x: Number(endpointFormData.x),
        y: Number(endpointFormData.y),
        yaw: Number(endpointFormData.yaw || 0),
        type: endpointFormData.type || 'WAYPOINT',
        description: endpointFormData.description ? endpointFormData.description.trim() : null,
      };

      if (endpointModalMode === 'EDIT') {
        await updateWaypoint(payload.id, payload);
        showNotification(`Đã cập nhật Endpoint "${payload.name}" vào CSDL!`);
      } else {
        await saveWaypoint(payload);
        showNotification(`Đã tạo mới Endpoint "${payload.name}" trong CSDL!`);
      }

      setIsEndpointModalOpen(false);
      await loadAll();
      if (selectedWaypoint?.id === payload.id) {
        setSelectedWaypoint(payload);
      }
    } catch (err) {
      showNotification('Lỗi khi lưu Endpoint: ' + err.message);
    }
  };

  const handleOpenDeleteConfirm = (target) => {
    if (!target) return;
    setDeleteConfirmTarget({ id: target.id, name: target.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { id, name } = deleteConfirmTarget;
    try {
      await deleteWaypoint(id);
      setWaypoints((prev) => prev.filter((w) => w.id !== id));
      if (selectedWaypoint?.id === id) setSelectedWaypoint(null);
      if (highlightedWpId === id) setHighlightedWpId(null);
      if (isEndpointModalOpen && endpointFormData.id === id) {
        setIsEndpointModalOpen(false);
      }
      setDeleteConfirmTarget(null);
      showNotification(`Đã xóa điểm mốc "${name}" khỏi CSDL thành công!`);
      await loadAll();
    } catch (err) {
      showNotification('Lỗi khi xóa điểm mốc: ' + err.message);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmTarget(null);
  };

  // Add Selected Waypoint directly to Active Workflow as a MOVE step
  const handleAddWaypointToWorkflow = (wp) => {
    if (!activeWf) return;
    const newStep = {
      step_id: `step-${Date.now()}`,
      type: 'MOVE',
      title: `Di chuyển tới ${wp.name}`,
      params: {
        target_waypoint_id: wp.id,
        waypoint_name: wp.name,
        target_x: wp.x,
        target_y: wp.y,
        speed: 0.5,
        timeout_sec: 30,
      },
    };

    setActiveWf({
      ...activeWf,
      steps: [...(activeWf.steps || []), newStep],
    });
    showNotification(`Đã thêm bước MOVE tới "${wp.name}" vào kịch bản!`);
  };

  // Step Workflow editing
  const handleAddStep = (stepType) => {
    if (!activeWf) return;
    const stepDef = OTTO_STEP_TYPES.find((s) => s.type === stepType);
    if (!stepDef) return;

    const newStep = {
      step_id: `step-${Date.now()}`,
      type: stepDef.type,
      title: stepDef.label,
      params: { ...stepDef.defaultParams },
    };

    setActiveWf({
      ...activeWf,
      steps: [...(activeWf.steps || []), newStep],
    });
  };

  const handleRemoveStep = (idx) => {
    if (!activeWf) return;
    const steps = [...activeWf.steps];
    steps.splice(idx, 1);
    setActiveWf({ ...activeWf, steps });
  };

  const handleMoveStep = (idx, dir) => {
    if (!activeWf) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= activeWf.steps.length) return;
    const steps = [...activeWf.steps];
    const temp = steps[idx];
    steps[idx] = steps[targetIdx];
    steps[targetIdx] = temp;
    setActiveWf({ ...activeWf, steps });
  };

  const handleSaveCurrentWorkflow = async () => {
    if (!activeWf) return;
    try {
      await saveWorkflow(activeWf);
      showNotification(`Đã lưu kịch bản "${activeWf.name}" thành công!`);
      await loadAll();
    } catch (err) {
      showNotification('Lỗi khi lưu kịch bản: ' + err.message);
    }
  };

  // Live simulation execution on Map
  const handleStartSimulation = async () => {
    if (!activeWf || !activeWf.steps || activeWf.steps.length === 0) {
      showNotification('Kịch bản chưa có bước hành động nào để chạy');
      return;
    }

    setIsSimulating(true);
    setSimLogs([`[00:00] Bắt đầu mô phỏng chu trình "${activeWf.name}" trên bản đồ SLAM...`]);

    for (let i = 0; i < activeWf.steps.length; i++) {
      const step = activeWf.steps[i];
      setSimStepIndex(i);

      if (step.type === 'MOVE') {
        const wp = waypoints.find((w) => w.id === step.params?.target_waypoint_id);
        if (wp) {
          setHighlightedWpId(wp.id);
          // Animate robot position to this waypoint
          setRobotPose((prev) => ({
            ...prev,
            x: wp.x,
            y: wp.y,
            yaw: wp.yaw || 0,
          }));
        }
        setSimLogs((prev) => [
          ...prev,
          `[STEP ${i + 1}: MOVE] Robot di chuyển đến điểm mốc "${step.params?.waypoint_name || 'Đích'}" (X:${step.params?.target_x || 0}m, Y:${step.params?.target_y || 0}m)`,
        ]);
      } else {
        setSimLogs((prev) => [
          ...prev,
          `[STEP ${i + 1}: ${step.type}] Thực thi hành động: ${step.title}`,
        ]);
      }

      await new Promise((resolve) => setTimeout(resolve, 1400));
    }

    setSimLogs((prev) => [...prev, '✅ Hoàn thành toàn bộ kịch bản! Robot sẵn sàng cho chu trình mới.']);
    setIsSimulating(false);
    setSimStepIndex(-1);
    showNotification('Đã hoàn tất mô phỏng chu trình trên bản đồ!');
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none" style={{ backgroundColor: '#F2EFE9', color: '#262626' }}>
      {/* 1. STUDIO HEADER */}
      <StudioHeader
        isWsConnected={isWsConnected}
        notification={notification}
        isPinMode={isPinMode}
        setIsPinMode={setIsPinMode}
        onAddKeepOutZone={() => {
          const newZone = {
            id: `zone-${Date.now().toString(36)}`,
            name: 'VÙNG CẤM MỚI',
            x: robotPose.x + 1.5,
            y: robotPose.y + 1.5,
            width: 1.5,
            height: 1.5,
          };
          setKeepOutZones([...keepOutZones, newZone]);
          showNotification('Đã thêm 1 Vùng Cấm (Keep-Out Zone) lên bản đồ!');
        }}
        isSimulating={isSimulating}
        onStartSimulation={handleStartSimulation}
      />

      {/* 2. MAIN WORKSPACE: SPLIT SCREEN (Map 72% + Otto Workflow Panel 28%) */}
      <div className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">
        {/* LEFT COLUMN: INTERACTIVE SLAM MAP CANVAS */}
        <StudioMapCanvas
          scanPoints={scanPoints}
          gridData={gridData}
          gridMetadata={gridMetadata}
          robotPose={robotPose}
          waypoints={waypoints}
          activeWf={activeWf}
          highlightedWpId={highlightedWpId}
          keepOutZones={keepOutZones}
          isPinMode={isPinMode}
          selectedWaypoint={selectedWaypoint}
          onCanvasClickGoal={handleCanvasClickGoal}
          onCanvasClickPin={handleCanvasClickPin}
          onSelectWaypointFromMap={handleSelectWaypointFromMap}
          onAddWaypointToWorkflow={handleAddWaypointToWorkflow}
          onOpenEditEndpointModal={handleOpenEditEndpointModal}
          onOpenDeleteConfirm={handleOpenDeleteConfirm}
        />

        {/* RIGHT COLUMN: OTTO-STYLE WORKFLOW STUDIO PANEL */}
        <div className="col-span-4 lg:col-span-3 h-full flex flex-col overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
          {/* Top Panel Selector */}
          <div className="p-3 border-b space-y-2 shrink-0" style={{ borderColor: '#BFBFBD', backgroundColor: '#FAF8F5' }}>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
                KỊCH BẢN HOẠT ĐỘNG
              </label>
              <button
                type="button"
                onClick={handleSaveCurrentWorkflow}
                className="px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer hover:bg-stone-100"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                Lưu Kịch Bản
              </button>
            </div>

            <select
              value={activeWf?.id || ''}
              onChange={(e) => {
                const found = workflows.find((w) => w.id === e.target.value);
                if (found) setActiveWf(found);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border focus:outline-none"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
            >
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name} ({wf.steps?.length || 0} bước)
                </option>
              ))}
            </select>

            {/* SubTab Toggle: Workflow Steps vs Endpoints List */}
            <div className="flex rounded-lg border overflow-hidden text-xs" style={{ borderColor: '#BFBFBD' }}>
              <button
                type="button"
                onClick={() => setSideTab('workflow')}
                className="flex-1 py-1 text-center font-bold cursor-pointer transition-colors"
                style={{
                  backgroundColor: sideTab === 'workflow' ? '#262626' : '#FFFFFF',
                  color: sideTab === 'workflow' ? '#FFFFFF' : '#8C8C8C',
                }}
              >
                Chu Trình Steps ({activeWf?.steps?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSideTab('waypoints')}
                className="flex-1 py-1 text-center font-bold cursor-pointer transition-colors"
                style={{
                  backgroundColor: sideTab === 'waypoints' ? '#262626' : '#FFFFFF',
                  color: sideTab === 'waypoints' ? '#FFFFFF' : '#8C8C8C',
                }}
              >
                Điểm Mốc ({waypoints.length})
              </button>
            </div>
          </div>

          {/* TAB 1: WORKFLOW STEPS LIST */}
          {sideTab === 'workflow' && (
            <StudioWorkflowPanel
              activeWf={activeWf}
              onAddStep={handleAddStep}
              onMoveStep={handleMoveStep}
              onRemoveStep={handleRemoveStep}
              isSimulating={isSimulating}
              simStepIndex={simStepIndex}
              simLogs={simLogs}
              setHighlightedWpId={setHighlightedWpId}
            />
          )}

          {/* TAB 2: ENDPOINTS & WAYPOINTS LIST (OTTO CONCEPT) */}
          {sideTab === 'waypoints' && (
            <StudioEndpointsPanel
              waypoints={waypoints}
              templateFilter={templateFilter}
              setTemplateFilter={setTemplateFilter}
              selectedWaypoint={selectedWaypoint}
              highlightedWpId={highlightedWpId}
              setHighlightedWpId={setHighlightedWpId}
              onSelectWaypointFromMap={handleSelectWaypointFromMap}
              onOpenAddEndpointModal={handleOpenAddEndpointModal}
              onOpenEditEndpointModal={handleOpenEditEndpointModal}
              onAddWaypointToWorkflow={handleAddWaypointToWorkflow}
              onCanvasClickGoal={handleCanvasClickGoal}
              onOpenDeleteConfirm={handleOpenDeleteConfirm}
            />
          )}
        </div>
      </div>

      {/* MODAL: THÊM HOẶC CHỈNH SỬA ENDPOINT THEO CHUẨN OTTO MOTORS */}
      <EndpointModal
        isOpen={isEndpointModalOpen}
        onClose={() => setIsEndpointModalOpen(false)}
        mode={endpointModalMode}
        formData={endpointFormData}
        setFormData={setEndpointFormData}
        onSave={handleSaveEndpoint}
        robotPose={robotPose}
        onOpenDeleteConfirm={handleOpenDeleteConfirm}
      />

      {/* MODAL: XÁC NHẬN XÓA ENDPOINT / WAYPOINT */}
      <DeleteConfirmModal
        target={deleteConfirmTarget}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

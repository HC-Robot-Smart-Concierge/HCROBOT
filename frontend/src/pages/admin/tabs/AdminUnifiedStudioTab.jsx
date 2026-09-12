import React, { useState, useEffect, useRef } from 'react';
import { LidarCanvas } from '../../../components/admin/LidarCanvas';
import {
  fetchWaypoints,
  saveWaypoint,
  updateWaypoint,
  deleteWaypoint,
  fetchWorkflows,
  saveWorkflow,
  executeWorkflow,
} from '../../../services/workflowApi';
import { OTTO_STEP_TYPES } from './AdminWorkflowTab';

// Chuẩn Otto Motors: Default Endpoint Templates (Không bao gồm Trạm Sạc theo yêu cầu)
export const OTTO_ENDPOINT_TEMPLATES = [
  {
    type: 'WAYPOINT',
    label: 'Waypoint (Điểm Mốc Hành Trình)',
    badge: 'WAYPOINT',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    borderColor: '#C4B5FD',
    defaultTasks: 'MOVE, WAIT',
    description: 'Điểm mốc định vị trên bản đồ để robot di chuyển qua hoặc căn chỉnh hướng.',
  },
  {
    type: 'PARKING_SPOT',
    label: 'Parking Spot (Bãi Đỗ / Điểm Chờ)',
    badge: 'PARKING',
    color: '#64748B',
    bgColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    defaultTasks: 'MOVE, STANDBY',
    description: 'Khu vực đỗ chờ sẵn của robot khi không có nhiệm vụ khách sạn.',
  },
  {
    type: 'DOCKING_TARGET',
    label: 'Docking Target (Điểm Tiếp Đón / Quầy)',
    badge: 'DOCKING',
    color: '#0284C7',
    bgColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    defaultTasks: 'MOVE, DOCK, GREET, SPEAK',
    description: 'Điểm tiếp cận quầy Lễ tân, bàn tiếp đón với độ chính xác cao.',
  },
  {
    type: 'PICKUP_DROPOFF',
    label: 'Carts & Pallets (Giao Nhận Đồ)',
    badge: 'PICKUP/DROP',
    color: '#059669',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    defaultTasks: 'MOVE, LOAD, TRANSPORT, UNLOAD',
    description: 'Khu vực giao nhận khay hành lý, đồ dùng phòng hoặc giao đồ ăn.',
  },
  {
    type: 'SERVICE_STATION',
    label: 'Service Station (Trạm Tiện Ích)',
    badge: 'SERVICE',
    color: '#6366F1',
    bgColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    defaultTasks: 'MOVE, SHOW, RECOMMEND',
    description: 'Trạm tiện ích khách sạn (Hồ bơi, Nhà hàng, Spa, Thang máy).',
  },
];


export const getEndpointTemplateInfo = (type) => {
  return OTTO_ENDPOINT_TEMPLATES.find((t) => t.type === type) || OTTO_ENDPOINT_TEMPLATES[0];
};

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
      <div
        className="h-12 border-b px-4 shrink-0 flex items-center justify-between gap-3 text-xs"
        style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
      >
        {/* Left Title & Status */}
        <div className="flex items-center gap-2.5">
          <span className="font-black text-sm tracking-tight" style={{ color: '#262626' }}>
            LiDAR SLAM Map &amp; Step Workflow Studio
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
            style={{
              backgroundColor: isWsConnected ? '#262626' : '#FAF8F5',
              color: isWsConnected ? '#FFFFFF' : '#8C8C8C',
              borderColor: '#BFBFBD',
            }}
          >
            {isWsConnected ? 'RPLIDAR COM9 ONLINE' : 'SIMULATION MODE'}
          </span>
          {notification && (
            <span className="text-[11px] font-semibold text-emerald-700 animate-pulse pl-2 border-l" style={{ borderColor: '#BFBFBD' }}>
              {notification}
            </span>
          )}
        </div>

        {/* Right Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Pin Waypoint Tool */}
          <button
            type="button"
            onClick={() => setIsPinMode(!isPinMode)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
            style={{
              backgroundColor: isPinMode ? '#262626' : '#FFFFFF',
              color: isPinMode ? '#F2EFE9' : '#262626',
              borderColor: isPinMode ? '#262626' : '#BFBFBD',
            }}
          >
            {isPinMode ? '● Click bản đồ để ghim...' : '+ Ghim Waypoint'}
          </button>

          {/* Add Keep-out zone */}
          <button
            type="button"
            onClick={() => {
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
            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#DC2626' }}
            title="Thêm vùng cấm di chuyển"
          >
            + Vùng Cấm
          </button>

          {/* Test Run Workflow on Map */}
          <button
            type="button"
            disabled={isSimulating}
            onClick={handleStartSimulation}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-opacity cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: '#262626', color: '#F2EFE9' }}
          >
            {isSimulating ? 'Đang chạy mô phỏng...' : '▶ Chạy kịch bản trên Map'}
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: SPLIT SCREEN (Map 72% + Otto Workflow Panel 28%) */}
      <div className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">
        {/* LEFT COLUMN: INTERACTIVE SLAM MAP CANVAS (Col 8 / 9) */}
        <div className="col-span-8 lg:col-span-9 h-full relative overflow-hidden flex flex-col border-r" style={{ borderColor: '#BFBFBD' }}>
          <div className="w-full flex-1 relative overflow-hidden">
            <LidarCanvas
              scanPoints={scanPoints}
              gridData={gridData}
              gridMetadata={gridMetadata}
              robotPose={{ x: robotPose.x, y: robotPose.y, yaw: robotPose.yaw }}
              waypoints={waypoints}
              workflowSteps={activeWf?.steps || []}
              highlightedWaypointId={highlightedWpId}
              keepOutZones={keepOutZones}
              onCanvasClickGoal={handleCanvasClickGoal}
              onCanvasClickWaypointPin={handleCanvasClickPin}
              onSelectWaypoint={handleSelectWaypointFromMap}
              isPinMode={isPinMode}
              showGridMap={true}
              showGridLines={true}
              showScanRays={true}
              showWaypoints={true}
            />

            {/* Selected Waypoint Floating Action Pill */}
            {selectedWaypoint && (() => {
              const tmpl = getEndpointTemplateInfo(selectedWaypoint.type);
              return (
                <div
                  className="absolute bottom-4 left-4 z-20 p-3 rounded-xl border shadow-xl flex items-center gap-3 animate-fadeIn"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#262626' }}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded border uppercase"
                        style={{
                          backgroundColor: tmpl.bgColor,
                          color: tmpl.color,
                          borderColor: tmpl.borderColor,
                        }}
                      >
                        {tmpl.badge}
                      </span>
                      <span className="text-xs font-bold" style={{ color: '#262626' }}>
                        {selectedWaypoint.name}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: '#8C8C8C' }}>
                      {selectedWaypoint.floor} • X: {Number(selectedWaypoint.x).toFixed(2)}m, Y: {Number(selectedWaypoint.y).toFixed(2)}m • Yaw: {Number(selectedWaypoint.yaw || 0).toFixed(0)}°
                    </div>
                    {selectedWaypoint.description && (
                      <div className="text-[10px] text-stone-500 truncate max-w-xs mt-0.5">
                        {selectedWaypoint.description}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddWaypointToWorkflow(selectedWaypoint)}
                      className="px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors"
                      style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
                      title="Nối điểm này vào Workflow"
                    >
                      + Nối vào Workflow
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditEndpointModal(selectedWaypoint)}
                      className="px-2 py-1 rounded text-xs font-bold border cursor-pointer hover:bg-stone-100"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                      title="Chỉnh sửa thông số Endpoint"
                    >
                      ✎ Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCanvasClickGoal(selectedWaypoint.x, selectedWaypoint.y)}
                      className="px-2 py-1 rounded text-xs font-bold border cursor-pointer hover:bg-stone-100"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                      title="Điều khiển robot đến điểm này"
                    >
                      Đến đây
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteConfirm(selectedWaypoint)}
                      className="px-2 py-1 rounded text-xs border cursor-pointer hover:text-red-700"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                      title="Xóa Endpoint khỏi CSDL"
                    >
                      ✕
                    </button>

                  </div>
                </div>
              );
            })()}

          </div>

          {/* Bottom Telemetry Mini Bar */}
          <div
            className="h-8 border-t px-4 shrink-0 flex items-center justify-between text-[11px] font-mono"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#8C8C8C' }}
          >
            <div className="flex items-center gap-4">
              <span>X: <strong style={{ color: '#262626' }}>{Number(robotPose.x).toFixed(2)}m</strong></span>
              <span>Y: <strong style={{ color: '#262626' }}>{Number(robotPose.y).toFixed(2)}m</strong></span>
              <span>YAW: <strong style={{ color: '#262626' }}>{Number(robotPose.yaw).toFixed(0)}°</strong></span>
              <span>PIN: <strong style={{ color: '#262626' }}>{robotPose.battery}%</strong></span>
            </div>
            <span>CHẾ ĐỘ TÍCH HỢP BẢN ĐỒ &amp; WORKFLOWS</span>
          </div>
        </div>

        {/* RIGHT COLUMN: OTTO-STYLE WORKFLOW STUDIO PANEL (Col 4 / 3) */}
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
            <div className="flex-1 min-h-0 flex flex-col p-3 overflow-y-auto space-y-2">
              {/* Add Step Dropdown */}
              <div className="flex items-center gap-2 shrink-0 pb-1">
                <span className="text-[10px] font-semibold" style={{ color: '#8C8C8C' }}>Thêm Step:</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddStep(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="flex-1 px-2 py-1 rounded text-xs font-bold border cursor-pointer focus:outline-none"
                  style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#262626' }}
                >
                  <option value="" disabled>+ Chọn bước chuẩn Otto</option>
                  {OTTO_STEP_TYPES.map((st) => (
                    <option key={st.type} value={st.type}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Steps Cards */}
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {(activeWf?.steps || []).map((step, idx) => {
                  const isCurrentSim = simStepIndex === idx;
                  const isMove = step.type === 'MOVE';

                  return (
                    <div
                      key={step.step_id || idx}
                      className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                        isCurrentSim ? 'ring-2 ring-emerald-500 shadow-md' : ''
                      }`}
                      style={{
                        backgroundColor: isCurrentSim ? '#F0FDF4' : '#FAF8F5',
                        borderColor: isCurrentSim ? '#10B981' : '#BFBFBD',
                      }}
                      onMouseEnter={() => {
                        if (isMove && step.params?.target_waypoint_id) {
                          setHighlightedWpId(step.params.target_waypoint_id);
                        }
                      }}
                      onMouseLeave={() => setHighlightedWpId(null)}
                    >
                      {/* Step Header */}
                      <div className="flex items-center justify-between gap-1 border-b pb-1.5" style={{ borderColor: '#E9E5DC' }}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                            style={{ backgroundColor: '#262626', color: '#F2EFE9' }}
                          >
                            {idx + 1}
                          </span>
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border uppercase shrink-0"
                            style={{
                              backgroundColor: isMove ? '#8B5CF6' : '#262626',
                              color: '#FFFFFF',
                              borderColor: isMove ? '#7C3AED' : '#262626',
                            }}
                          >
                            {step.type}
                          </span>
                          <span className="font-bold text-xs truncate" style={{ color: '#262626' }}>
                            {step.title}
                          </span>
                        </div>

                        {/* Reorder and Delete */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, -1)}
                            disabled={idx === 0}
                            className="px-1 py-0.2 rounded text-[10px] border disabled:opacity-30 cursor-pointer"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, 1)}
                            disabled={idx === activeWf.steps.length - 1}
                            className="px-1 py-0.2 rounded text-[10px] border disabled:opacity-30 cursor-pointer"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
                            className="px-1.5 py-0.2 rounded text-[10px] border cursor-pointer hover:text-red-700"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Step Details & Waypoint link */}
                      {isMove && (
                        <div className="text-[11px] font-mono" style={{ color: '#6D28D9' }}>
                          Đích đến: <strong>{step.params?.waypoint_name || 'Tọa độ'}</strong> (X:{step.params?.target_x || 0}, Y:{step.params?.target_y || 0})
                        </div>
                      )}
                      {step.type === 'SPEAK' && (
                        <div className="text-[11px] truncate italic" style={{ color: '#8C8C8C' }}>
                          "{step.params?.speech_text || 'Đọc lời chào ra loa'}"
                        </div>
                      )}
                      {step.type === 'GREET' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Biểu cảm: <strong>{step.params?.face_expression || 'SMILE'}</strong> • Đèn: <strong>{step.params?.led_color || 'CYAN'}</strong>
                        </div>
                      )}
                      {step.type === 'SHOW' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Màn hình: <strong>{step.params?.screen_mode || 'MENU'}</strong>
                        </div>
                      )}
                      {step.type === 'LISTEN' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Kênh: <strong>{step.params?.input_mode || 'VOICE/TOUCH'}</strong> (Chờ: {step.params?.timeout_sec || 15}s)
                        </div>
                      )}
                      {step.type === 'RECOMMEND' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Gợi ý: <strong>{step.params?.highlight_item || 'Ẩm thực & Spa'}</strong>
                        </div>
                      )}
                      {step.type === 'CREATE_REQUEST' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Phiếu gửi: <strong>{step.params?.target_department || 'Housekeeping'}</strong>
                        </div>
                      )}
                      {step.type === 'FEEDBACK' && (
                        <div className="text-[11px]" style={{ color: '#8C8C8C' }}>
                          Khảo sát: <strong>1 - 5 Sao</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Simulation Logs Output */}
              {simLogs.length > 0 && (
                <div
                  className="p-2.5 rounded-xl border text-[10px] font-mono space-y-1 max-h-32 overflow-y-auto shrink-0"
                  style={{ backgroundColor: '#1A1917', color: '#E9E5DC', borderColor: '#262626' }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 border-b pb-0.5 mb-1" style={{ borderColor: '#333' }}>
                    LOG MÔ PHỎNG TIẾN TRÌNH:
                  </div>
                  {simLogs.map((log, lIdx) => (
                    <div key={lIdx} className="leading-tight">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ENDPOINTS & WAYPOINTS LIST (OTTO CONCEPT) */}
          {sideTab === 'waypoints' && (
            <div className="flex-1 min-h-0 p-3 overflow-y-auto space-y-2.5 flex flex-col">
              {/* Header & Add Button */}
              <div className="flex items-center justify-between shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
                  ENDPOINTS TRÊN BẢN ĐỒ ({waypoints.length})
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenAddEndpointModal()}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors shadow-sm"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  + Thêm Endpoint
                </button>
              </div>

              {/* Template Filter Pills */}
              <div className="flex flex-wrap gap-1 shrink-0 pb-1 border-b" style={{ borderColor: '#E9E5DC' }}>
                <button
                  type="button"
                  onClick={() => setTemplateFilter('ALL')}
                  className="px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer"
                  style={{
                    backgroundColor: templateFilter === 'ALL' ? '#262626' : '#FFFFFF',
                    color: templateFilter === 'ALL' ? '#FFFFFF' : '#8C8C8C',
                    borderColor: '#BFBFBD',
                  }}
                >
                  Tất cả ({waypoints.length})
                </button>
                {OTTO_ENDPOINT_TEMPLATES.map((tmpl) => {
                  const count = waypoints.filter((w) => (w.type || 'WAYPOINT') === tmpl.type).length;
                  if (count === 0 && templateFilter !== tmpl.type) return null;
                  const isActive = templateFilter === tmpl.type;
                  return (
                    <button
                      key={tmpl.type}
                      type="button"
                      onClick={() => setTemplateFilter(tmpl.type)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer"
                      style={{
                        backgroundColor: isActive ? tmpl.color : '#FFFFFF',
                        color: isActive ? '#FFFFFF' : tmpl.color,
                        borderColor: tmpl.borderColor,
                      }}
                    >
                      {tmpl.badge} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Endpoints List */}
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {waypoints
                  .filter((wp) => templateFilter === 'ALL' || (wp.type || 'WAYPOINT') === templateFilter)
                  .map((wp) => {
                    const tmpl = getEndpointTemplateInfo(wp.type);
                    const isSelected = selectedWaypoint?.id === wp.id;
                    return (
                      <div
                        key={wp.id}
                        className="p-2.5 rounded-xl border text-xs space-y-1.5 transition-colors cursor-pointer hover:bg-stone-50"
                        style={{
                          backgroundColor: isSelected || highlightedWpId === wp.id ? '#F5F3FF' : '#FFFFFF',
                          borderColor: isSelected || highlightedWpId === wp.id ? tmpl.color : '#BFBFBD',
                        }}
                        onClick={() => handleSelectWaypointFromMap(wp)}
                        onMouseEnter={() => setHighlightedWpId(wp.id)}
                        onMouseLeave={() => setHighlightedWpId(null)}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border uppercase shrink-0"
                              style={{
                                backgroundColor: tmpl.bgColor,
                                color: tmpl.color,
                                borderColor: tmpl.borderColor,
                              }}
                            >
                              {tmpl.badge}
                            </span>
                            <span className="font-bold text-xs truncate" style={{ color: '#262626' }}>
                              {wp.name}
                            </span>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditEndpointModal(wp)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:bg-stone-100"
                              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              title="Chỉnh sửa Endpoint"
                            >
                              ✎ Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddWaypointToWorkflow(wp)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                              style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
                              title="Nối điểm này vào Workflow"
                            >
                              + Nối
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCanvasClickGoal(wp.x, wp.y)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:bg-stone-100"
                              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              title="Điều khiển robot đến điểm này"
                            >
                              Đến
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteConfirm(wp)}
                              className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer hover:text-red-700 hover:bg-red-50"
                              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                              title="Xóa Endpoint khỏi CSDL"
                            >
                              ✕
                            </button>

                          </div>
                        </div>

                        {/* Coordinates & Tasks */}
                        <div className="text-[10px] font-mono flex items-center justify-between" style={{ color: '#8C8C8C' }}>
                          <span>{wp.floor} • X: {Number(wp.x).toFixed(2)}m, Y: {Number(wp.y).toFixed(2)}m</span>
                          <span>Yaw: {Number(wp.yaw || 0).toFixed(0)}°</span>
                        </div>

                        {wp.description && (
                          <div className="text-[10px] text-stone-500 italic truncate">
                            {wp.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: THÊM HOẶC CHỈNH SỬA ENDPOINT THEO CHUẨN OTTO MOTORS */}
      {isEndpointModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-2xl animate-fadeIn"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
                  {endpointModalMode === 'EDIT' ? 'Chỉnh Sửa Endpoint (Otto Motors)' : 'Thêm Mới Endpoint (Otto Motors)'}
                </h3>
                <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                  Định nghĩa điểm đích chức năng và cấu hình tác vụ thực thi cho Robot
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEndpointModalOpen(false)}
                className="text-xs font-bold px-2 py-1 rounded border cursor-pointer hover:bg-stone-100"
                style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveEndpoint} className="space-y-3">
              {/* Tên Endpoint */}
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  TÊN ENDPOINT *
                </label>
                <input
                  type="text"
                  required
                  value={endpointFormData.name}
                  onChange={(e) => setEndpointFormData({ ...endpointFormData, name: e.target.value })}
                  placeholder="VD: Quầy Lễ Tân, Trạm Sạc Fast Charger, Bàn VIP 02..."
                  className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                />
              </div>

              {/* Mẫu Endpoint chuẩn Otto */}
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  MẪU ENDPOINT (ENDPOINT TEMPLATE) *
                </label>
                <select
                  value={endpointFormData.type}
                  onChange={(e) => setEndpointFormData({ ...endpointFormData, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs font-bold border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                >
                  {OTTO_ENDPOINT_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.type} value={tmpl.type}>
                      [{tmpl.badge}] {tmpl.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] mt-1 font-medium text-stone-500">
                  {getEndpointTemplateInfo(endpointFormData.type).description}
                </p>
              </div>

              {/* Tầng & Tác vụ */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                    TẦNG
                  </label>
                  <select
                    value={endpointFormData.floor}
                    onChange={(e) => setEndpointFormData({ ...endpointFormData, floor: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  >
                    <option value="Tầng 1">Tầng 1</option>
                    <option value="Tầng 2">Tầng 2</option>
                    <option value="Tầng 3">Tầng 3</option>
                    <option value="Tầng 4">Tầng 4</option>
                    <option value="Sảnh Chính">Sảnh Chính</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                    TÁC VỤ MẶC ĐỊNH (TASKS)
                  </label>
                  <div
                    className="px-2.5 py-2 rounded-lg text-xs font-mono font-bold truncate border"
                    style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                    title={getEndpointTemplateInfo(endpointFormData.type).defaultTasks}
                  >
                    {getEndpointTemplateInfo(endpointFormData.type).defaultTasks}
                  </div>
                </div>
              </div>

              {/* Tọa độ Không Gian X, Y, Yaw */}
              <div className="p-3 rounded-lg border space-y-2" style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
                    TỌA ĐỘ KHÔNG GIAN THỰC TẾ:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEndpointFormData({
                        ...endpointFormData,
                        x: Number(robotPose.x.toFixed(2)),
                        y: Number(robotPose.y.toFixed(2)),
                        yaw: Number(robotPose.yaw.toFixed(0)),
                      });
                    }}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer hover:bg-stone-200"
                    style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                  >
                    Lấy vị trí hiện tại Robot
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-stone-500 mb-0.5">X (mét)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={endpointFormData.x}
                      onChange={(e) => setEndpointFormData({ ...endpointFormData, x: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded text-xs font-mono border focus:outline-none"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-stone-500 mb-0.5">Y (mét)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={endpointFormData.y}
                      onChange={(e) => setEndpointFormData({ ...endpointFormData, y: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded text-xs font-mono border focus:outline-none"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-stone-500 mb-0.5">Yaw (°)</label>
                    <input
                      type="number"
                      step="1"
                      min="-180"
                      max="180"
                      value={endpointFormData.yaw}
                      onChange={(e) => setEndpointFormData({ ...endpointFormData, yaw: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded text-xs font-mono border focus:outline-none"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                    />
                  </div>
                </div>
              </div>

              {/* Mô tả / Ghi chú */}
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  MÔ TẢ CHI TIẾT
                </label>
                <textarea
                  rows="2"
                  value={endpointFormData.description}
                  onChange={(e) => setEndpointFormData({ ...endpointFormData, description: e.target.value })}
                  placeholder="Ghi chú thêm về quy trình phục vụ hoặc đặc điểm vị trí..."
                  className="w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#BFBFBD' }}>
                {endpointModalMode === 'EDIT' ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenDeleteConfirm({ id: endpointFormData.id, name: endpointFormData.name });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-300 text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                  >
                    🗑 Xóa Điểm Này
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEndpointModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-stone-100"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
                    style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                  >
                    {endpointModalMode === 'EDIT' ? 'Cập Nhật Endpoint' : 'Lưu Endpoint'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN XÓA ENDPOINT / WAYPOINT */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className="max-w-sm w-full rounded-2xl border p-5 space-y-4 shadow-2xl animate-fadeIn"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 font-bold text-lg">
                ✕
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: '#262626' }}>
                  Xác Nhận Xóa Điểm Mốc?
                </h4>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  Bạn có chắc chắn muốn xóa vĩnh viễn điểm mốc <strong className="text-stone-900">"{deleteConfirmTarget.name}"</strong>? Điểm này sẽ bị xóa khỏi bản đồ LiDAR và cơ sở dữ liệu.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: '#E9E5DC' }}>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-stone-100"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer transition-colors shadow-sm"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



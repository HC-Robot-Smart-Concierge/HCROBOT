import { startRos2Explore, stopRos2Explore } from '../../services/workflowApi';
import { piRequestErrorMessage } from './exploreResult';
import { PI5_IP, PI5_API } from './adminLidarUtils';

/**
 * Provides navigation goals, emergency stop, autonomous frontier exploration, Pi workflow CRUD, and map overlay handlers.
 */
export function useAdminLidarNavAndWorkflowActions({
  rc,
  rosClientRef,
  exploreStartedAtRef,
  exploreSeenRef,
  teleopIntervalRef,
  activeTeleopCmdRef,
  waitForRos2Runtime,
  isRos2RuntimeBusy,
  setIsRos2RuntimeBusy,
  setActiveNavGoal,
  setNavNotification,
  setSlamActiveMotion,
  setEmergencyStopVersion,
  setIsExploring,
  setTelemetry,
  setIsExploreModalOpen,
  setExploreError,
  setGridData,
  setScanPoints,
  setHasLiveRosMap,
  setExploreResult,
  setSaveFromExplore,
  setExploredCount,
  setMapMode,
  setIsMapLocked,
  setWorkflowList,
  setIsWorkflowModalOpen,
  newWorkflow,
  setIsWorkflowRunning,
  overlayMapName,
  setOverlayActive,
  setOverlayWaypoints,
  setIsOverlayModalOpen,
}) {
  const handleSetGoal = async (targetX, targetY) => {
    setActiveNavGoal({ x: targetX, y: targetY });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishGoal(targetX, targetY, 0);
      setNavNotification(rc('[NAV2] Published /goal_pose -> X: {0}m, Y: {1}m -> Navigating to destination!', [targetX.toFixed(2), targetY.toFixed(2)]));
    } else {
      setNavNotification(`[NAV GOAL SET] X: ${targetX.toFixed(2)}m, Y: ${targetY.toFixed(2)}m`);
      try {
        await fetch(`${PI5_API}/map/navigate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_x: targetX, target_y: targetY }),
        });
      } catch (err) {
        console.error('Navigate command failed:', err);
      }
    }

    setTimeout(() => setNavNotification(''), 4500);
  };

  const handleEmergencyStop = async () => {
    // 0. Tắt ngay bộ tự quét ROS 2 (explorer + Nav2) để ngừng phát /cmd_vel; backend còn
    //    gửi UDP "stop" thẳng tới Pi. Không await để các bước dừng bên dưới chạy ngay.
    exploreStartedAtRef.current = 0;
    stopRos2Explore().catch((err) => console.warn('Lỗi dừng tự quét ROS 2:', err));

    // Dừng vòng lặp lái tay đang giữ phím và báo tab Camera (dùng chung nút lái) dừng theo.
    if (teleopIntervalRef.current) clearInterval(teleopIntervalRef.current);
    teleopIntervalRef.current = null;
    activeTeleopCmdRef.current = null;
    setSlamActiveMotion('stop');
    setEmergencyStopVersion((version) => version + 1);

    // 1. Cập nhật state UI ngay lập tức
    setIsExploring(false);
    setActiveNavGoal(null);
    setTelemetry((prev) => ({
      ...prev,
      status: 'EMERGENCY_STOPPED',
      linearVelocity: 0,
      angularVelocity: 0,
    }));
    setNavNotification(rc('[EMERGENCY STOP] ALL MOTION AND MAPPING STOPPED. THE ROBOT IS STATIONARY.'));

    // 2. Ngắt vận tốc ROS 2 (/cmd_vel = 0)
    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishCmdVel(0, 0);
    }

    // 3. Dừng quét tự hành Frontier Exploration trên Pi 5
    try {
      await fetch(`${PI5_API}/map/explore/stop`, { method: 'POST' });
    } catch (err) {
      console.warn('Lỗi dừng explore:', err);
    }

    // 4. Gửi tín hiệu dừng khẩn cấp / teleop stop tới Pi 5
    try {
      await fetch(`${PI5_API}/map/emergency_stop`, { method: 'POST' });
    } catch {
      fetch(`${PI5_API}/map/teleop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'stop' }),
      }).catch(() => null);
    }

    // 5. Gửi UDP stop động cơ trực tiếp qua Backend operations port 9999
    try {
      await fetch('/api/v1/operations/robot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'stop',
          target_ip: PI5_IP,
          port: 9999,
        }),
      });
    } catch (err) {
      console.warn('Lỗi gửi lệnh dừng khẩn cấp tới động cơ:', err);
    }

    setTimeout(() => setNavNotification(''), 6000);
  };

  // ─── Frontier Exploration (SLAM Tu Hanh Quet Full Phong) ────────────────
  // Xe THAT tu quet: SLAM Toolbox + Nav2 + frontier explorer tren laptop (backend chay
  // start_wsl_slam.sh EXPLORE=1). KHONG dung bo tu quet cu tren Pi (/map/explore/start):
  // hai bo cung lai xe se tranh lenh motor.
  const handleStartExplore = async () => {
    if (isRos2RuntimeBusy) return;
    setIsRos2RuntimeBusy(true);
    setIsExploreModalOpen(false);
    setExploreError('');
    setNavNotification('Đang kiểm tra Pi rồi bật SLAM + Nav2 để robot tự quét map...');
    let failed = false;
    try {
      // Tat bo tu quet cu tren Pi neu dang chay (bo qua loi neu Pi khong co).
      await fetch(`${PI5_API}/map/explore/stop`, { method: 'POST', signal: AbortSignal.timeout(4000) })
        .catch(() => null);
      const lidarResponse = await fetch(`${PI5_API}/map/connect_lidar`, {
        method: 'POST', signal: AbortSignal.timeout(15000),
      }).catch((err) => {
        throw new Error(piRequestErrorMessage(err, PI5_IP));
      });
      const lidarResult = await lidarResponse.json().catch(() => null);
      if (!lidarResponse.ok || lidarResult?.status !== 'SUCCESS') {
        throw new Error(lidarResult?.message || 'Pi đã mở cổng nhưng RPLiDAR không phát dữ liệu scan.');
      }
      setGridData(new Array(200 * 200).fill(-1));
      setScanPoints([]);
      setHasLiveRosMap(false);
      setExploreResult(null);
      setSaveFromExplore(false);
      // Khong tu luu: quet xong Web hien bang de nguoi dung dat ten roi moi luu.
      const result = await startRos2Explore('auto_explored_map', false);
      setExploredCount(0);
      exploreStartedAtRef.current = Date.now();
      exploreSeenRef.current = false;
      setIsExploring(true);
      await waitForRos2Runtime(['MAPPING', 'EXPLORING']);
      setMapMode('MAPPING');
      setIsMapLocked(false);
      rosClientRef.current?.connect();
      setNavNotification(
        result?.message
          || rc('The robot will DRIVE ITSELF after the sensor check and a 10-second countdown. Stand clear; press Stop Exploration / E-STOP to stop.')
      );
    } catch (err) {
      failed = true;
      exploreStartedAtRef.current = 0;
      setIsExploring(false);
      setNavNotification('');
      // Loi hien bang do, giu toi khi nguoi dung tat (toast thuong tu mat sau 10 s - de bo lo)
      setExploreError(rc('Could not enable autonomous scanning: {0}', [err.message]));
    } finally {
      setIsRos2RuntimeBusy(false);
      if (!failed) setTimeout(() => setNavNotification(''), 10000);
    }
  };

  const handleStopExplore = async () => {
    exploreStartedAtRef.current = 0;
    setIsExploring(false);
    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishCmdVel(0, 0);
    }
    try {
      await stopRos2Explore();
      await fetch(`${PI5_API}/map/explore/stop`, { method: 'POST' }).catch(() => null);
      setNavNotification(rc('Automatic scanning stopped. The robot is stationary. SLAM is still running: you can save the map or keep driving manually.'));
    } catch (err) {
      setNavNotification(rc('Could not stop exploration: {0}. Press E-STOP if the robot is still moving!', [err.message]));
    }
    setTimeout(() => setNavNotification(''), 6000);
  };

  // ─── Workflow Manager ────────────────────────────────────────────────
  const loadWorkflows = async () => {
    try {
      // Simplified direct URL:
      const res2 = await fetch(`http://${PI5_IP}:8000/api/v1/workflow/list`);
      if (res2.ok) {
        const data = await res2.json();
        setWorkflowList(data.workflows || []);
      }
    } catch (err) {
      console.warn('Lỗi tải workflow:', err);
    }
  };

  const handleOpenWorkflowModal = async () => {
    setIsWorkflowModalOpen(true);
    await loadWorkflows();
  };

  const handleSaveWorkflow = async () => {
    try {
      const res = await fetch(`http://${PI5_IP}:8000/api/v1/workflow/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorkflow),
      });
      const data = await res.json();
      setNavNotification(rc('Workflow "{0}" saved (ID: {1})', [newWorkflow.name, data.id]));
      await loadWorkflows();
    } catch (err) {
      setNavNotification(rc('Could not save workflow: {0}', [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleExecuteWorkflow = async (wid) => {
    try {
      const res = await fetch(`http://${PI5_IP}:8000/api/v1/workflow/execute/${wid}`, { method: 'POST' });
      const data = await res.json();
      setIsWorkflowRunning(true);
      setNavNotification(`▶️ ${data.message}`);
      setIsWorkflowModalOpen(false);
    } catch (err) {
      setNavNotification(rc('Execution error: {0}', [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleStopWorkflow = async () => {
    try {
      await fetch(`http://${PI5_IP}:8000/api/v1/workflow/stop`, { method: 'POST' });
      setIsWorkflowRunning(false);
      setNavNotification(rc('Workflow stopped.'));
    } catch (err) {
      setNavNotification(`${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 3000);
  };

  const handleDeleteWorkflow = async (wid) => {
    if (!window.confirm(rc('Delete workflow "{0}"?', [wid]))) return;
    try {
      await fetch(`http://${PI5_IP}:8000/api/v1/workflow/${wid}`, { method: 'DELETE' });
      await loadWorkflows();
    } catch (err) {
      console.warn('Lỗi xóa workflow:', err);
    }
  };

  // ─── Overlay Map ─────────────────────────────────────────────────────
  const handleLoadOverlay = async () => {
    try {
      const res = await fetch(`${PI5_API}/map/overlay/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map_name: overlayMapName }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setOverlayActive(true);
        setOverlayWaypoints(data.waypoints || []);
        setNavNotification(rc('Overlay map "{0}" loaded', [overlayMapName]));
        setIsOverlayModalOpen(false);
      } else {
        setNavNotification(`${data.message}`);
      }
    } catch (err) {
      setNavNotification(rc('Error: {0}', [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleDisableOverlay = async () => {
    try {
      await fetch(`${PI5_API}/map/overlay/disable`, { method: 'POST' });
      setOverlayActive(false);
      setOverlayWaypoints([]);
      setNavNotification(rc('Overlay map disabled'));
    } catch (err) {
      setNavNotification(`${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 3000);
  };

  const handleGenerateOverlayTemplate = async () => {
    try {
      const res = await fetch(`${PI5_API}/map/overlay/template?name=${overlayMapName}`);
      const data = await res.json();
      setNavNotification(`${data.message}`);
    } catch (err) {
      setNavNotification(`${err.message}`);
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  return {
    handleSetGoal,
    handleEmergencyStop,
    handleStartExplore,
    handleStopExplore,
    loadWorkflows,
    handleOpenWorkflowModal,
    handleSaveWorkflow,
    handleExecuteWorkflow,
    handleStopWorkflow,
    handleDeleteWorkflow,
    handleLoadOverlay,
    handleDisableOverlay,
    handleGenerateOverlayTemplate,
  };
}

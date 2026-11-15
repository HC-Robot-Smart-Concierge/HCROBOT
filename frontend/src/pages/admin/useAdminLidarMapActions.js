import { useCallback } from 'react';
import {
  listSavedMaps,
  fetchRos2RuntimeStatus,
  startRos2Mapping,
  saveRos2Map,
  startRos2Navigation,
} from '../../services/workflowApi';
import { defaultMapName } from './exploreResult';
import { PI5_API } from './adminLidarUtils';

/**
 * Provides ROS 2 runtime startup, SLAM map locking/resetting, saving, downloading, and saved-map management handlers.
 */
export function useAdminLidarMapActions({
  rc,
  rosClientRef,
  isRos2RuntimeBusy,
  setIsRos2RuntimeBusy,
  setNavNotification,
  setGridData,
  setScanPoints,
  setSensorHealth,
  setHasLiveRosMap,
  setMapMode,
  setIsMapLocked,
  selectedMapId,
  setSelectedMapId,
  setIsExploring,
  setExploredCount,
  setTelemetry,
  mapMode,
  isMapLocked,
  saveMapName,
  setSaveMapName,
  setSaveFromExplore,
  setIsSaveMapModalOpen,
  setIsSavingMap,
  setSavedMapsList,
  setIsSavedMapsModalOpen,
}) {
  const waitForRos2Runtime = useCallback(async (expectedMode) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const statusData = await fetchRos2RuntimeStatus();
        const modeOk = Array.isArray(expectedMode)
          ? expectedMode.includes(statusData?.mode)
          : statusData?.mode === expectedMode;
        if (statusData?.rosbridge_online && statusData?.foxglove_online && modeOk) {
          return statusData;
        }
      } catch {
        // WSL2/ROS 2 đang khởi động; tiếp tục chờ.
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error(rc('ROS 2/Foxglove startup timed out. Check the backend logs.'));
  }, []);

  const handleStartMappingFromWeb = useCallback(async () => {
    if (isRos2RuntimeBusy) return;
    setIsRos2RuntimeBusy(true);
    setNavNotification(rc('Starting WSL2 + SLAM Toolbox + Foxglove for live mapping...'));
    try {
      setGridData(new Array(200 * 200).fill(-1));
      setScanPoints([]);
      setSensorHealth(null);
      setHasLiveRosMap(false);
      // Yêu cầu Pi mở lại motor/luồng đọc RPLiDAR. ROS bridge sau đó vẫn tự
      // kiểm tra dữ liệu thực; phản hồi SUCCESS ở đây không được xem là đủ.
      const lidarResponse = await fetch(`${PI5_API}/map/connect_lidar`, { method: 'POST' });
      const lidarResult = await lidarResponse.json().catch(() => null);
      if (!lidarResponse.ok || lidarResult?.status !== 'SUCCESS') {
        throw new Error(lidarResult?.message || rc('Pi opened the port but RPLiDAR is not producing scan data.'));
      }
      await startRos2Mapping();
      await waitForRos2Runtime('MAPPING');
      setMapMode('MAPPING');
      setIsMapLocked(false);
      rosClientRef.current?.connect();
      setNavNotification(rc('MAPPING is active. Save only when both LiDAR LIVE and ODOM MOVING are green.'));
    } catch (err) {
      setNavNotification(rc('Could not start mapping: {0}', [err.message]));
    } finally {
      setIsRos2RuntimeBusy(false);
      setTimeout(() => setNavNotification(''), 7000);
    }
  }, [isRos2RuntimeBusy, waitForRos2Runtime]);

  const handleStartNavigationFromWeb = useCallback(async (requestedMapName = null) => {
    if (isRos2RuntimeBusy) return;
    const mapName = typeof requestedMapName === 'string' && requestedMapName
      ? requestedMapName
      : (selectedMapId || 'phong_lam_viec');
    setIsRos2RuntimeBusy(true);
    setNavNotification(rc('Loading static map "{0}" and starting AMCL + Nav2...', [mapName]));
    try {
      await startRos2Navigation(mapName);
      await waitForRos2Runtime('NAVIGATION');
      setSelectedMapId(mapName);
      setMapMode('NAVIGATION');
      setIsMapLocked(true);
      rosClientRef.current?.connect();
      setNavNotification(rc('NAVIGATION is ready with static map "{0}".', [mapName]));
    } catch (err) {
      setNavNotification(rc('Could not start Navigation: {0}', [err.message]));
    } finally {
      setIsRos2RuntimeBusy(false);
      setTimeout(() => setNavNotification(''), 7000);
    }
  }, [isRos2RuntimeBusy, selectedMapId, waitForRos2Runtime]);

  // Reset SLAM grid map (xóa sạch bản đồ trên Foxglove & SLAM Toolbox).
  const handleResetGridMap = async () => {
    if (!window.confirm(rc('Clear the current SLAM map and return the robot to (0, 0) to start a new scan?'))) {
      return;
    }

    try {
      setNavNotification(rc('Clearing the SLAM Toolbox map and returning the robot to the origin...'));

      // 1. Gửi tín hiệu Reset tới ROS 2 SLAM Toolbox qua Rosbridge
      if (rosClientRef.current?.isConnected) {
        rosClientRef.current.resetMap();
      }

      // 2. Gửi tín hiệu Reset tới Pi 5 Backend
      try {
        await fetch(`${PI5_API}/map/reset_map`, { method: 'POST' });
      } catch {
        // Fallback ignore if Pi5 endpoint is busy
      }

      // 3. Reset state giao diện Web Admin
      setIsExploring(false);
      setExploredCount(0);
      setGridData(new Array(200 * 200).fill(-1));
      setScanPoints([]);
      setTelemetry((prev) => ({
        ...prev,
        x: 0.0,
        y: 0.0,
        yaw: 0.0,
        linearVelocity: 0.0,
        angularVelocity: 0.0,
        status: 'SLAM_MAP_CLEARED',
      }));

      setNavNotification(rc('SLAM map cleared. Robot is at (0,0), ready for a new scan.'));
    } catch (err) {
      console.error('Reset map error:', err);
      setNavNotification(rc('Could not clear map: {0}', [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4500);
  };

  // Khóa bản đồ gốc / Tiếp tục quét
  const handleToggleLockMap = () => {
    try {
      if (mapMode === 'NAVIGATION') {
        setNavNotification(rc('NAVIGATION is active: the saved map is read-only. Run quet_map_mot_lan.bat to scan again.'));
        setTimeout(() => setNavNotification(''), 5000);
        return;
      }
      if (rosClientRef.current?.isConnected) {
        rosClientRef.current.togglePauseMap();
        const nextLocked = !isMapLocked;
        setIsMapLocked(nextLocked);
        setMapMode(nextLocked ? 'PAUSED' : 'MAPPING');
        setNavNotification(
          nextLocked
            ? rc('Base map locked. The map is fixed and new walls will not be added.')
            : rc('Map unlocked. Scanning and map updates resumed.')
        );
      } else {
        setNavNotification(rc('Not connected to Rosbridge 9090!'));
      }
    } catch (err) {
      setNavNotification(rc('Could not lock/unlock map: {0}', [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleScan360 = async () => {
    setNavNotification(rc('Starting a 360-degree scan of the room walls...'));
    try {
      await fetch(`${PI5_API}/map/scan_360`, { method: 'POST' });
    } catch (err) {
      console.error('Lỗi quét 360:', err);
    }
  };

  const handleOpenSaveMapModal = () => {
    if (mapMode !== 'MAPPING') {
      setNavNotification(
        mapMode === 'NAVIGATION'
          ? rc('Cannot save during NAVIGATION: this is a saved static map. Select "1. START MAPPING" first.')
          : rc('The map is locked. Resume MAPPING before saving.')
      );
      setTimeout(() => setNavNotification(''), 6500);
      return;
    }
    setSaveMapName(defaultMapName());
    setSaveFromExplore(false);
    setIsSaveMapModalOpen(true);
  };

  const triggerMapDownload = async (mapName) => {
    try {
      const res = await fetch(`/api/v1/map/download/${encodeURIComponent(mapName)}?format=zip`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${mapName}_slam_map.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 3000);
      return true;
    } catch (err) {
      console.warn('Lỗi fetch download, chuyển sang direct download link:', err);
      const a = document.createElement('a');
      a.href = `/api/v1/map/download/${encodeURIComponent(mapName)}?format=zip`;
      a.download = `${mapName}_slam_map.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 1000);
      return false;
    }
  };

  const handleSaveMap = async (e) => {
    if (e) e.preventDefault();
    if (mapMode !== 'MAPPING') {
      setNavNotification(rc('Save new maps only while SLAM Toolbox is in MAPPING mode. Navigation reads saved static maps.'));
      setTimeout(() => setNavNotification(''), 6500);
      return;
    }
    const trimmedName = saveMapName.trim();
    if (!trimmedName) return;
    setIsSavingMap(true);
    setNavNotification(rc('Saving ROS 2 map "{0}" as YAML/PGM...', [trimmedName]));

    try {
      // 1. Backend laptop gọi map_saver_cli và chỉ trả SUCCESS khi YAML/PGM đã tồn tại.
      await saveRos2Map(trimmedName);

      setSelectedMapId(trimmedName);
      setIsMapLocked(true);
      setMapMode('PAUSED');
      setNavNotification(rc('Saved "{0}". Switching to static-map Navigation...', [trimmedName]));

      // 2. Kết thúc mapping và tự nạp đúng map vừa lưu bằng Map Server + AMCL + Nav2.
      await startRos2Navigation(trimmedName);
      await waitForRos2Runtime('NAVIGATION');
      setMapMode('NAVIGATION');
      rosClientRef.current?.connect();

      // 3. Tải gói map sau khi file thật đã được tạo xong.
      await triggerMapDownload(trimmedName);
      const listData = await listSavedMaps().catch(() => null);
      if (listData?.maps) setSavedMapsList(listData.maps);
      setNavNotification(rc('Saved and locked "{0}". Navigation is running and the ZIP has been downloaded.', [trimmedName]));
      setIsSaveMapModalOpen(false);
    } catch (err) {
      setNavNotification(rc('Could not save map: {0}', [err.message]));
    } finally {
      setIsSavingMap(false);
      setTimeout(() => setNavNotification(''), 8000);
    }
  };

  const handleOpenSavedMapsModal = async () => {
    setIsSavedMapsModalOpen(true);
    try {
      // 1. Tải danh sách bản đồ từ Pi 5
      const pi5Res = await fetch(`${PI5_API}/map/saved_list`).catch(() => null);
      let pi5Maps = [];
      if (pi5Res && pi5Res.ok) {
        const data = await pi5Res.json();
        pi5Maps = data.maps || [];
      }

      // 2. Tải danh sách bản đồ lưu trên máy tính (backend robot/maps & static/maps)
      const localRes = await fetch('/api/v1/map/list_saved_maps').catch(() => null);
      let localMaps = [];
      if (localRes && localRes.ok) {
        const data = await localRes.json();
        localMaps = data.maps || [];
      }

      // Hợp nhất danh sách bản đồ
      const mergedMap = new Map();
      pi5Maps.forEach((m) => {
        mergedMap.set(m.name, { ...m, source: 'PI5' });
      });
      localMaps.forEach((m) => {
        const existing = mergedMap.get(m.name);
        if (existing) {
          mergedMap.set(m.name, { ...existing, has_local_file: true });
        } else {
          mergedMap.set(m.name, {
            name: m.name,
            floor: m.floor || rc('Floor 1 lobby'),
            width: m.width,
            height: m.height,
            resolution: m.resolution,
            has_ros2_yaml: true,
            has_local_file: true,
            created_at: m.created_at,
            source: 'LOCAL_DISK',
          });
        }
      });

      setSavedMapsList(Array.from(mergedMap.values()));
    } catch (err) {
      console.warn('Lỗi tải danh sách bản đồ:', err);
    }
  };

  const handleLoadSavedMap = async (mapName) => {
    setNavNotification(rc('Loading map "{0}"...', [mapName]));
    try {
      const res = await fetch(`${PI5_API}/map/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mapName }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setNavNotification(rc('Map "{0}" loaded into the system.', [mapName]));
        setIsSavedMapsModalOpen(false);
      } else {
        setNavNotification(rc('Could not load map: {0}', [data.message]));
      }
    } catch (err) {
      setNavNotification(rc('Connection error: {0}', [err.message]));
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  const handleDeleteSavedMap = async (mapName) => {
    if (!window.confirm(rc('Delete map file "{0}"?', [mapName]))) return;
    try {
      await fetch(`/api/v1/map/saved/${encodeURIComponent(mapName)}`, { method: 'DELETE' }).catch(() => null);
      await fetch(`${PI5_API}/map/saved/${mapName}`, { method: 'DELETE' }).catch(() => null);
      setSavedMapsList((prev) => prev.filter((m) => m.name !== mapName));
      setNavNotification(rc('Deleted map file "{0}"', [mapName]));
    } catch (err) {
      setNavNotification(rc('Could not delete: {0}', [err.message]));
    }
  };

  return {
    waitForRos2Runtime,
    handleStartMappingFromWeb,
    handleStartNavigationFromWeb,
    handleResetGridMap,
    handleToggleLockMap,
    handleScan360,
    handleOpenSaveMapModal,
    triggerMapDownload,
    handleSaveMap,
    handleOpenSavedMapsModal,
    handleLoadSavedMap,
    handleDeleteSavedMap,
  };
}

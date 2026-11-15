import { useState, useEffect, useRef } from 'react';
import { DEFAULT_SLAM_SPEED, clampTeleopSpeed, getSlamTeleopMotion } from '../../utils/slamTeleop';
import {
  fetchCurrentMap,
  loadSavedLidarMap,
  listSavedMaps,
  fetchRos2RuntimeStatus,
} from '../../services/workflowApi';
import { defaultMapName } from './exploreResult';
import { PI5_API, EXPLORE_START_GRACE_MS } from './adminLidarUtils';

/**
 * Handles map/explore/power polling, battery calibration, quick map loading, and SLAM keyboard teleop.
 */
export function useAdminLidarPollingAndTeleop({
  rc,
  activeView,
  setActiveView,
  rosClientRef,
  exploreStartedAtRef,
  exploreSeenRef,
  menuDropdownRef,
  setIsMenuDropdownOpen,
  setSavedMapsList,
  setSelectedMapId,
  setIsMapLocked,
  setMapMode,
  setGridData,
  setGridMetadata,
  setIsExploring,
  setSaveMapName,
  setSaveFromExplore,
  setIsSaveMapModalOpen,
  setPiPower,
  setPiBattery,
  batteryInputPercent,
  batteryInputRate,
  setIsBatteryEditOpen,
  setIsSyncingBattery,
  setBatteryInputPercent,
  setBatteryInputRate,
  setNavNotification,
}) {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(event.target)) {
        setIsMenuDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tự động tải danh sách bản đồ và nạp bản đồ tĩnh hiện tại từ Backend
  useEffect(() => {
    const initMaps = async () => {
      try {
        const listData = await listSavedMaps();
        if (listData?.maps && listData.maps.length > 0) {
          setSavedMapsList(listData.maps);
          if (listData.active_map_id) setSelectedMapId(listData.active_map_id);
        }
        if (typeof listData?.is_map_locked === 'boolean') {
          setIsMapLocked(listData.is_map_locked);
          setMapMode(listData.map_mode || (listData.is_map_locked ? 'NAVIGATION' : 'MAPPING'));
        }
        const currMap = await fetchCurrentMap();
        if (currMap?.grid_data && currMap.grid_data.some((v) => v !== -1)) {
          setGridData(currMap.grid_data);
          if (currMap.metadata) setGridMetadata(currMap.metadata);
        }
      } catch (err) {
        console.warn('Lỗi load bản đồ tĩnh ban đầu:', err);
      }
    };
    initMaps();
  }, []);

  // Dong bo trang thai tu quet tu backend ROS 2 (frontier_explorer chay -> mode EXPLORING).
  // Sau khi bam bat dau, stack can ~20-30 s (kiem tra cam bien + Nav2 + dem nguoc 10 s)
  // moi co explorer: giu isExploring=true trong luc cho de nut khong nhay ve "Quet".
  useEffect(() => {
    let isMounted = true;
    const pollExploreStatus = async () => {
      try {
        const data = await fetchRos2RuntimeStatus();
        if (!isMounted) return;
        const startedAt = exploreStartedAtRef.current;
        const waitingForExplorer = startedAt > 0 && Date.now() - startedAt < EXPLORE_START_GRACE_MS;
        if (data?.mode === 'EXPLORING') {
          exploreSeenRef.current = true;
          setIsExploring(true);
        } else if (!waitingForExplorer) {
          if (exploreSeenRef.current && data?.mode === 'MAPPING') {
            // Explorer da bao ket qua va tu thoat; SLAM van giu map => hoi ten de luu ngay.
            setMapMode('MAPPING');
            setIsMapLocked(false);
            setSaveMapName(defaultMapName());
            setSaveFromExplore(true);
            setIsSaveMapModalOpen(true);
          }
          exploreSeenRef.current = false;
          exploreStartedAtRef.current = 0;
          setIsExploring(false);
        }
      } catch {
        // Backend/WSL dang ban: giu nguyen trang thai
      }
    };

    const timer = setInterval(pollExploreStatus, 3000);
    pollExploreStatus();
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Nguồn Pi 5 đọc thẳng từ Pi (port 8000), không phụ thuộc ROS 2 có chạy hay không.
  useEffect(() => {
    let isMounted = true;
    const pollPiPower = async () => {
      try {
        const res = await fetch(`${PI5_API}/system/power`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) {
          setPiPower(data.power || null);
          setPiBattery(data.battery || null);
        }
      } catch {
        if (isMounted) {
          setPiPower(null);
          setPiBattery(null);
        }
      }
    };

    const timer = setInterval(pollPiPower, 2000);
    pollPiPower();
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  // Ô để trống thì không gửi: chỉ nhập % thì Pi tự học tốc độ tụt giữa các lần nhập.
  const handleSyncBattery = async () => {
    const body = {};
    if (batteryInputPercent !== '') body.percent = Number(batteryInputPercent);
    if (batteryInputRate !== '') body.minutes_per_percent = Number(batteryInputRate);
    if (Object.keys(body).length === 0) {
      setIsBatteryEditOpen(false);
      return;
    }

    setIsSyncingBattery(true);
    try {
      const res = await fetch(`${PI5_API}/system/battery/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'SUCCESS') throw new Error(data.message || `HTTP ${res.status}`);
      setPiBattery(data.battery);
      setBatteryInputPercent('');
      setBatteryInputRate('');
      setIsBatteryEditOpen(false);
      setNavNotification(
        rc('Pi 5 battery updated: {0}%', [Math.round(data.battery.percent)])
        + (data.battery.calibrated ? rc(' · auto-calibrated to {0} min/1%', [data.battery.minutes_per_percent]) : '')
      );
    } catch (err) {
      setNavNotification(rc('Could not update Pi 5 battery: {0}', [err.message]));
    } finally {
      setIsSyncingBattery(false);
    }
  };

  const handleSelectMap = async (mapId) => {
    try {
      setSelectedMapId(mapId);
      setNavNotification(rc('Loading map: {0}...', [mapId]));
      await loadSavedLidarMap(mapId);
      const curr = await fetchCurrentMap();
      if (curr?.grid_data) {
        setGridData(curr.grid_data);
        if (curr.metadata) setGridMetadata(curr.metadata);
        setNavNotification(rc('Map loaded: {0}', [mapId]));
      }
    } catch (err) {
      setNavNotification(rc('Could not load map: {0}', [err.message]));
    }
  };

  const [slamSpeed, setSlamSpeed] = useState(DEFAULT_SLAM_SPEED);
  const [slamSpeedDraft, setSlamSpeedDraft] = useState(null);
  const [slamActiveMotion, setSlamActiveMotion] = useState('stop');
  const slamSpeedRef = useRef(DEFAULT_SLAM_SPEED);
  const handleSlamSpeedChange = (value) => {
    const speed = clampTeleopSpeed(value);
    slamSpeedRef.current = speed;
    setSlamSpeed(speed);
  };

  const teleopIntervalRef = useRef(null);
  const activeTeleopCmdRef = useRef(null);

  const sendMotion = (command) => {
    const motion = getSlamTeleopMotion(command, slamSpeedRef.current);

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishCmdVel(motion.linear, motion.angular);
    } else {
      fetch(`${PI5_API}/map/teleop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          speed: motion.speed,
        }),
      }).catch(() => {});
    }
  };

  const startTeleop = (command) => {
    if (activeTeleopCmdRef.current === command && teleopIntervalRef.current) {
      return;
    }
    if (teleopIntervalRef.current) {
      clearInterval(teleopIntervalRef.current);
    }
    activeTeleopCmdRef.current = command;
    setSlamActiveMotion({ forward: 'w', backward: 's', left: 'a', right: 'd' }[command] || 'stop');
    sendMotion(command);
    teleopIntervalRef.current = setInterval(() => {
      sendMotion(command);
    }, 100);
  };

  const stopTeleop = () => {
    if (teleopIntervalRef.current) {
      clearInterval(teleopIntervalRef.current);
      teleopIntervalRef.current = null;
    }
    activeTeleopCmdRef.current = null;
    setSlamActiveMotion('stop');
    sendMotion('stop');
  };

  const handleTeleop = (command) => {
    if (command === 'stop') {
      stopTeleop();
    } else {
      sendMotion(command);
    }
  };

  // Keyboard Teleop: W-A-S-D hoặc Phím Mũi Tên (giữ phím để xe chạy liên tục)
  useEffect(() => {
    if (activeView !== 'slam') return;
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (['1', '2', '3', '+', '=', '-', '_'].includes(key)) {
        const presets = { 1: 50, 2: 75, 3: 100 };
        handleSlamSpeedChange(presets[key] ?? (slamSpeedRef.current + (key === '-' || key === '_' ? -10 : 10)));
        return;
      }
      let targetCmd = null;
      if (key === 'w' || key === 'arrowup') targetCmd = 'forward';
      else if (key === 's' || key === 'arrowdown') targetCmd = 'backward';
      else if (key === 'a' || key === 'arrowleft') targetCmd = 'left';
      else if (key === 'd' || key === 'arrowright') targetCmd = 'right';
      else if (key === ' ' || key === 'x') {
        stopTeleop();
        return;
      }

      if (targetCmd && activeTeleopCmdRef.current !== targetCmd) {
        startTeleop(targetCmd);
      }
    };

    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        stopTeleop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (teleopIntervalRef.current) clearInterval(teleopIntervalRef.current);
    };
  }, [activeView]);

  const switchView = (view) => {
    if (view === activeView) return;
    if (activeTeleopCmdRef.current) stopTeleop();
    setActiveView(view);
  };

  return {
    handleSyncBattery,
    handleSelectMap,
    slamSpeed,
    slamSpeedDraft,
    setSlamSpeedDraft,
    slamActiveMotion,
    handleSlamSpeedChange,
    teleopIntervalRef,
    activeTeleopCmdRef,
    setSlamActiveMotion,
    startTeleop,
    stopTeleop,
    handleTeleop,
    switchView,
  };
}

import { useState, useEffect, useRef } from 'react';
import {
  RosbridgeClient,
  ROS_TOPICS,
  ROS_MSG_TYPES,
  createZoneSyncMsg,
} from '../../../services/rosbridgeService';
import { PI5_API, PI5_WS } from './unifiedStudioTemplates';

/** Manages ROSBridge zone telemetry, live WebSocket SLAM stream, and WASD teleop controls. */
export const useUnifiedStudioTelemetry = ({
  showNotification,
  setRobotPose,
  setScanPoints,
  setGridMetadata,
  setGridData,
}) => {
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isScanning360, setIsScanning360] = useState(false);
  const [showTeleopPad, setShowTeleopPad] = useState(false);
  const [zoneTelemetry, setZoneTelemetry] = useState(null);
  const rosClientRef = useRef(null);

  const syncZonesToRos = (zonesList) => {
    try {
      if (rosClientRef.current && rosClientRef.current.isConnected) {
        rosClientRef.current.publish(
          ROS_TOPICS.HOTEL_ZONES,
          ROS_MSG_TYPES.STRING,
          createZoneSyncMsg(zonesList)
        );
      }
    } catch {}
  };

  useEffect(() => {
    let client = null;
    let unbindZoneTel = null;
    try {
      const hostname = window.location.hostname || 'localhost';
      const wsUrl = `ws://${hostname}:9090`;
      client = new RosbridgeClient(wsUrl, { autoReconnect: true });
      rosClientRef.current = client;
      client.connect();

      unbindZoneTel = client.subscribe(ROS_TOPICS.ZONE_TELEMETRY, ROS_MSG_TYPES.STRING, (msg) => {
        try {
          const data = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg;
          setZoneTelemetry(data);
        } catch {}
      });
    } catch {}

    return () => {
      if (unbindZoneTel) unbindZoneTel();
      if (client) client.disconnect();
    };
  }, []);

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
          if (data.grid_metadata) setGridMetadata(data.grid_metadata);
          if (data.grid_sparse) {
            const width = data.grid_metadata?.width || 800;
            const height = data.grid_metadata?.height || 800;
            const next = new Array(width * height).fill(-1);
            for (const idx of data.grid_sparse.occ || []) next[idx] = 100;
            for (const idx of data.grid_sparse.free || []) next[idx] = 0;
            setGridData(next);
          } else if (data.grid_data) {
            setGridData(data.grid_data);
          }
        }
      } catch {}
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [setGridData, setGridMetadata, setRobotPose, setScanPoints]);

  const handleResetGridMap = async () => {
    try {
      showNotification('Đang xóa sạch bản đồ SLAM...');
      const res = await fetch(`${PI5_API}/map/reset_map`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        showNotification('Bản đồ đã được xóa sạch. Vị trí robot đã đặt về (0,0).');
        setGridData(new Array(200 * 200).fill(-1));
        setScanPoints([]);
        setRobotPose((prev) => ({ ...prev, x: 0, y: 0, yaw: 0 }));
      }
    } catch (err) {
      showNotification('Lỗi khi xóa bản đồ: ' + err.message);
    }
  };

  const handleScan360 = async () => {
    setIsScanning360(true);
    showNotification('🔄 Bắt đầu xoay 360° quét toàn cảnh phòng...');
    try {
      await fetch(`${PI5_API}/map/scan_360`, { method: 'POST' });
      setTimeout(() => {
        setIsScanning360(false);
        showNotification('✅ Đã hoàn thành quét 360° phòng!');
      }, 9000);
    } catch (err) {
      setIsScanning360(false);
      showNotification('Lỗi khi quét 360: ' + err.message);
    }
  };

  const handleTeleop = async (command) => {
    try {
      await fetch(`${PI5_API}/map/teleop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, speed: 50 }),
      });
    } catch {}
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') handleTeleop('forward');
      else if (key === 's' || key === 'arrowdown') handleTeleop('backward');
      else if (key === 'a' || key === 'arrowleft') handleTeleop('left');
      else if (key === 'd' || key === 'arrowright') handleTeleop('right');
      else if (key === ' ' || key === 'x') handleTeleop('stop');
    };
    const handleKeyUp = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        handleTeleop('stop');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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

  return {
    zoneTelemetry,
    syncZonesToRos,
    isWsConnected,
    isScanning360,
    showTeleopPad,
    setShowTeleopPad,
    handleResetGridMap,
    handleScan360,
    handleTeleop,
    handleCanvasClickGoal,
  };
};

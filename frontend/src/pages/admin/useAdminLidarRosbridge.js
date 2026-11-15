import { useEffect } from 'react';
import {
  RosbridgeClient,
  ROS_TOPICS,
  ROS_MSG_TYPES,
  parseOccupancyGrid,
  parseLaserScan,
  quaternionToYaw,
} from '../../services/rosbridgeService';

/**
 * Manages the ROS 2 Rosbridge WebSocket lifecycle and live topic subscriptions.
 */
export function useAdminLidarRosbridge({
  rc,
  rosbridgeUrl,
  rosClientRef,
  setIsWsConnected,
  setHardwareInfo,
  setTelemetry,
  setNavNotification,
  setHasLiveRosMap,
  setGridData,
  setGridMetadata,
  setScanPoints,
  setEncoders,
  setActiveNavGoal,
  setIsMapLocked,
  setMapMode,
  setSensorHealth,
  setExploreResult,
}) {
  // ROS 2 Rosbridge Connection (port 9090)
  useEffect(() => {
    setIsWsConnected(false);

    const client = new RosbridgeClient(rosbridgeUrl, {
      autoReconnect: true,
      onOpen: () => {
        setIsWsConnected(true);
        setHardwareInfo({
          is_connected: true,
          device_info: {
            model: 'ROS 2 SLAM Toolbox & Nav2',
            port: rosbridgeUrl,
            health: 'Active',
          },
        });
        setTelemetry((prev) => ({
          ...prev,
          status: 'ROS2_CONNECTED',
          source: 'ROS2_SLAM_NAV2',
        }));
        setNavNotification(rc('[ROS 2] Rosbridge connected ({0}); waiting for live LiDAR data...', [rosbridgeUrl]));
      },
      onClose: () => {
        setIsWsConnected(false);
      },
      onError: () => {
        setIsWsConnected(false);
      },
    });

    rosClientRef.current = client;
    client.connect();

    // 1. Subscribe Occupancy Grid Map (/map)
    const unsubMap = client.subscribe(ROS_TOPICS.MAP, ROS_MSG_TYPES.OCCUPANCY_GRID, (msg) => {
      const parsed = parseOccupancyGrid(msg);
      if (parsed) {
        setHasLiveRosMap(true);
        setGridData(parsed.gridData);
        setGridMetadata(parsed.metadata);
      }
    });

    // 2. Subscribe 2D Laser Scan (/scan)
    const unsubScan = client.subscribe(ROS_TOPICS.SCAN, ROS_MSG_TYPES.LASER_SCAN, (msg) => {
      const points = parseLaserScan(msg);
      setScanPoints(points);
    });

    // 3. Subscribe Odometry (/odom)
    const unsubOdom = client.subscribe(ROS_TOPICS.ODOM, ROS_MSG_TYPES.ODOMETRY, (msg) => {
      const pos = msg.pose?.pose?.position;
      const ori = msg.pose?.pose?.orientation;
      if (pos) {
        const yaw = ori ? quaternionToYaw(ori.z, ori.w) : 0;
        setTelemetry((prev) => ({
          ...prev,
          x: Number(pos.x.toFixed(2)),
          y: Number(pos.y.toFixed(2)),
          yaw: Number((yaw * (180 / Math.PI)).toFixed(1)),
          linearVelocity: Number(msg.twist?.twist?.linear?.x?.toFixed(2) || 0),
          angularVelocity: Number(msg.twist?.twist?.angular?.z?.toFixed(2) || 0),
          source: 'ROS2_SLAM_NAV2',
        }));
      }
    });

    // 4. Subscribe AMCL Robot Pose (/amcl_pose)
    const unsubAmcl = client.subscribe(ROS_TOPICS.AMCL_POSE, ROS_MSG_TYPES.POSE_WITH_COVARIANCE, (msg) => {
      const pos = msg.pose?.pose?.position;
      const ori = msg.pose?.pose?.orientation;
      if (pos) {
        const yaw = ori ? quaternionToYaw(ori.z, ori.w) : 0;
        setTelemetry((prev) => ({
          ...prev,
          x: Number(pos.x.toFixed(2)),
          y: Number(pos.y.toFixed(2)),
          yaw: Number((yaw * (180 / Math.PI)).toFixed(1)),
          status: 'AMCL_LOCALIZED',
          source: 'ROS2_SLAM_NAV2',
        }));
      }
    });

    // 5. Subscribe Encoder Telemetry (/robot/encoder_telemetry)
    const unsubTelemetry = client.subscribe('/robot/encoder_telemetry', 'std_msgs/String', (msg) => {
      try {
        const encData = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
        if (encData && encData.m1) {
          setEncoders({
            m1: encData.m1,
            m2: encData.m2,
            m3: encData.m3,
            m4: encData.m4,
          });
        }
      } catch {
        // ignore parsing error
      }
    });

    // 6. Subscribe 2D Goal Pose (/goal_pose) từ Foxglove hoặc Web Admin.
    const unsubGoal = client.subscribe(ROS_TOPICS.GOAL_POSE, ROS_MSG_TYPES.POSE_STAMPED, (msg) => {
      const pos = msg.pose?.position;
      if (pos) {
        const gx = Number(pos.x.toFixed(2));
        const gy = Number(pos.y.toFixed(2));
        setActiveNavGoal({ x: gx, y: gy });
        setNavNotification(rc('[NAV2] Goal received from Foxglove: X={0}m, Y={1}m -> Navigating to destination!', [gx, gy]));
        setTimeout(() => setNavNotification(''), 4500);
      }
    });

    // 7. Subscribe Mapping Status (/robot/mapping_status)
    const unsubStatus = client.subscribe('/robot/mapping_status', 'std_msgs/String', (msg) => {
      if (msg?.data === 'PAUSED') {
        setIsMapLocked(true);
        setMapMode('PAUSED');
      } else if (msg?.data === 'MAPPING') {
        setIsMapLocked(false);
        setMapMode('MAPPING');
      } else if (msg?.data === 'NAVIGATION') {
        setIsMapLocked(true);
        setMapMode('NAVIGATION');
      }
    });

    // 8. Trạng thái dữ liệu thật xuyên suốt Pi -> ROS 2. Một socket mở chưa
    // đồng nghĩa LiDAR/encoder đang phát dữ liệu.
    const unsubSensorHealth = client.subscribe('/robot/sensor_health', 'std_msgs/String', (msg) => {
      try {
        const health = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
        setSensorHealth(health || null);
      } catch {
        setSensorHealth(null);
      }
    });

    // 9. Ket qua tu quet (frontier_explorer phat roi tu thoat): noi dung bang Luu map
    const unsubExplore = client.subscribe('/explore/status', 'std_msgs/String', (msg) => {
      try {
        setExploreResult(typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data);
      } catch {
        // bo qua goi tin hong
      }
    });

    return () => {
      unsubMap();
      unsubScan();
      unsubOdom();
      unsubAmcl();
      unsubTelemetry();
      unsubGoal();
      unsubStatus();
      unsubSensorHealth();
      unsubExplore();
      client.disconnect();
    };
  }, [rosbridgeUrl]);

  // Reconnect logic
  const handleReconnect = () => {
    setNavNotification(rc('Reconnecting to ROS 2 Rosbridge ({0})...', [rosbridgeUrl]));
    if (rosClientRef.current) {
      rosClientRef.current.disconnect();
      rosClientRef.current.autoReconnect = true;
      rosClientRef.current.connect();
    }
    setTimeout(() => setNavNotification(''), 4000);
  };

  return { handleReconnect };
}

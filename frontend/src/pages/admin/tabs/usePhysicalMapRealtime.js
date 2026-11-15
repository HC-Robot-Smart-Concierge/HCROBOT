import { useEffect, useCallback } from 'react';
import {
  ROS_TOPICS,
  ROS_MSG_TYPES,
  RosbridgeClient,
  parseLaserScan,
  quaternionToYaw,
} from '../../../services/rosbridgeService';
import { fetchRos2RuntimeStatus, startRos2Navigation } from '../../../services/workflowApi';
import { buildCostmapImage, pathMsgToPoints } from './physicalMapCostmap';
import { amclPoseIsReliable, composeMapPose, localizationFromManager } from './physicalMapNavigation';
import {
  ROSBRIDGE_DEFAULT_URL,
  transformWorldToCanvas,
  transformCanvasToWorld,
} from './physicalMapConstants';

export function usePhysicalMapRealtime({
  connectionMode, costmapRef, isStartingNav2, lastGoalSentAtRef, locManagerRef, localizationRef, mapConfig, nav2Runtime, navigationRef, pi5Ip, pi5WsRef, rosClientRef, setCostmapVersion, setDriveBlock, setHardwareInfo, setHealthState, setIsNavigating, setIsPiConnected, setIsRosConnected, setIsStartingNav2, setLocManager, setLocalizationReady, setNav2Runtime, setNavPath, setNavStatus, setNavigatingEndpointId, setRobotPose, setScanPoints, setSelectedGoal, setTrail, speedEmaRef, t, viewConfig,
}) {
  // 1. KET NOI XE THAT (Pi 5 WebSocket: ws://100.99.72.51:8000/api/v1/map/ws)
  useEffect(() => {
    if (connectionMode !== 'pi5') return;

    let ws = null;
    let isMounted = true;
    let reconnectTimeout = null;

    const connectPi5Ws = () => {
      try {
        const url = `ws://${pi5Ip}:8000/api/v1/map/ws`;
        ws = new WebSocket(url);
        pi5WsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsPiConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            // Pi robot_pose and scan_points use the Pi's independent odom frame.
            // Only ROS map-frame poses/scans may drive the map overlay.

            if (typeof data.battery === 'number') {
              setHardwareInfo((prev) => ({ ...prev, battery: data.battery }));
            }


            if (data.hardware_info) {
              setHardwareInfo((prev) => ({
                ...prev,
                battery: data.hardware_info.battery ?? prev.battery,
                port: data.hardware_info.port ?? prev.port,
              }));
            }

          } catch (err) {
            console.warn('[AdminPhysicalMapTab] Pi5 WS parse error:', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsPiConnected(false);
          reconnectTimeout = setTimeout(connectPi5Ws, 2500);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setIsPiConnected(false);
        };
      } catch (err) {
        if (!isMounted) return;
        setIsPiConnected(false);
        reconnectTimeout = setTimeout(connectPi5Ws, 3000);
      }
    };

    connectPi5Ws();

    return () => {
      isMounted = false;
      setIsPiConnected(false);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
        pi5WsRef.current = null;
      }
    };
  }, [connectionMode, pi5Ip]);

  // Localization, planning and obstacle avoidance use ROS in both hardware views.
  useEffect(() => {
    let active = true;
    const client = new RosbridgeClient(ROSBRIDGE_DEFAULT_URL, {
      onOpen: () => {
        if (!active) return;
        setIsRosConnected(true);
        setNavStatus('Đã kết nối Nav2. Bật Navigation với map đã chọn và đặt vị trí ban đầu.');
      },
      onClose: () => {
        if (!active) return;
        setIsRosConnected(false);
        localizationRef.current.confirmed = false;
        setLocalizationReady(false);
        navigationRef.current.poseAt = 0;
        navigationRef.current.costmapAt = 0;
      },
      onError: () => {
        if (!active) return;
        setIsRosConnected(false);
      },
    });

    rosClientRef.current = client;
    client.connect();

    // Vi tri xe tren map = (map -> odom tu /tf) ∘ (odom -> base_link tu /odom).
    // map -> odom do SLAM Toolbox (che do quet map) hoac AMCL (Navigation) phat,
    // nen cach nay chay ca khi quet map, luc chua co /amcl_pose.
    let mapToOdom = null;
    let odom = null;
    navigationRef.current = { poseAt: 0, costmapAt: 0, costmap: null, healthAt: 0, health: null };
    localizationRef.current = { mapId: null, requestedAt: 0, confirmed: false };
    setLocalizationReady(false);
    const stripSlash = (frame) => String(frame || '').replace(/^\//, '');
    const updateMapPose = () => {
      if (!mapToOdom || !odom || Date.now() - mapToOdom.receivedAt > 2000 || Date.now() - odom.receivedAt > 1000) return;
      const pose = composeMapPose(mapToOdom, odom);
      if (!pose) return;
      navigationRef.current.poseAt = Date.now();
      setRobotPose(pose);
      setTrail((prev) => [...prev.slice(-150), { x: pose.x, y: pose.y }]);
    };

    client.subscribe(
      '/tf',
      'tf2_msgs/TFMessage',
      (msg) => {
        for (const t of msg?.transforms || []) {
          if (stripSlash(t?.header?.frame_id) !== 'map' || stripSlash(t?.child_frame_id) !== 'odom') continue;
          const tr = t.transform?.translation;
          const rot = t.transform?.rotation;
          mapToOdom = { x: tr?.x ?? 0, y: tr?.y ?? 0,
            yaw: quaternionToYaw(rot?.z ?? 0, rot?.w ?? 1), receivedAt: Date.now() };
          updateMapPose();
        }
      }
      // Khong throttle /tf: map->odom xen giua cac TF khac, throttle co the lam roi mat no.
    );

    client.subscribe(
      ROS_TOPICS.ODOM,
      ROS_MSG_TYPES.ODOMETRY,
      (msg) => {
        const pos = msg?.pose?.pose?.position;
        const ori = msg?.pose?.pose?.orientation;
        if (!pos || stripSlash(msg?.header?.frame_id) !== 'odom') return;
        // Toc do do bang encoder, lam muot (EMA) cho dong ho toc do khoi nhay so
        const rawSpeed = msg?.twist?.twist?.linear?.x || 0;
        speedEmaRef.current = 0.7 * speedEmaRef.current + 0.3 * rawSpeed;
        odom = { x: pos.x, y: pos.y, yaw: quaternionToYaw(ori?.z ?? 0, ori?.w ?? 1),
          receivedAt: Date.now(),
          linearVelocity: speedEmaRef.current, angularVelocity: msg?.twist?.twist?.angular?.z || 0 };
        updateMapPose();
      },
      { throttleRate: 50 }
    );

    client.subscribe(
      ROS_TOPICS.AMCL_POSE,
      ROS_MSG_TYPES.POSE_WITH_COVARIANCE,
      (msg) => {
        if (stripSlash(msg?.header?.frame_id) !== 'map') return;
        const pos = msg?.pose?.pose?.position;
        if (pos) {
          const request = localizationRef.current;
          const stamp = Number(msg?.header?.stamp?.sec || 0) * 1000 + Number(msg?.header?.stamp?.nanosec || 0) / 1e6;
          // Robot co localization_manager => no quyet dinh (so ca LiDAR voi map), Web khong tu danh gia.
          const managerActive = localizationFromManager(locManagerRef.current.msg, locManagerRef.current.at).fresh;
          if (!managerActive && request.mapId === mapConfig.mapId && request.requestedAt && stamp >= request.requestedAt - 50) {
            const reliable = amclPoseIsReliable(msg);
            if (reliable !== request.confirmed) {
              request.confirmed = reliable;
              setLocalizationReady(reliable);
              setNavStatus(reliable
                ? 'AMCL có độ bất định thấp. Kiểm tra laser khớp tường trước khi chọn endpoint.'
                : 'AMCL chưa ổn định. Kiểm tra vị trí/hướng ban đầu và LiDAR khớp tường trước khi đi.');
            }
          }
          // AMCL reports the pose at a scan's timestamp. Do not alternate it with
          // the current TF + odometry pose: delayed scans make the marker jump
          // backwards. Only updateMapPose owns the displayed pose and freshness.
        }
      },
      { throttleRate: 50 }
    );

    client.subscribe('/robot/sensor_health', ROS_MSG_TYPES.STRING, (msg) => {
      try {
        navigationRef.current.health = JSON.parse(msg.data);
        navigationRef.current.healthAt = Date.now();
        setHealthState(navigationRef.current.health);
        // Xe ket (bridge: dung yen >= 2 s du co lenh chay) -> khung do + ly do. Giu them 15 s sau
        // khi het ket (luc Nav2 dang Wait/lui khong ra lenh) de nguoi dung kip doc.
        const block = navigationRef.current.health.drive_block;
        const now = Date.now();
        setDriveBlock((prev) => {
          if (block) {
            if (!prev || prev.code !== block.code || prev.message !== block.message) {
              setNavStatus(`⛔ Xe kẹt: ${block.message} ${block.hint}`);
            }
            return { ...block, at: now };
          }
          return prev && now - prev.at > 15000 ? null : prev;
        });
        if (!navigationRef.current.health.pi_ws_connected || !navigationRef.current.health.lidar_live) {
          localizationRef.current.confirmed = false;
          setLocalizationReady(false);
        }
      } catch { /* Wait for a valid health sample. */ }
    });

    // Gac cong dinh vi tren robot: UNLOCALIZED / LOCALIZING / LOCALIZED / LOCALIZATION_LOST + ly do.
    client.subscribe('/localization/state', ROS_MSG_TYPES.STRING, (msg) => {
      try {
        const data = JSON.parse(msg.data);
        const previous = locManagerRef.current.msg?.state;
        locManagerRef.current = { msg: data, at: Date.now() };
        setLocManager(locManagerRef.current);
        if (previous && previous !== data.state && data.reason) setNavStatus(data.reason);
      } catch { /* bo qua goi tin hong */ }
    });

    client.subscribe(
      ROS_TOPICS.SCAN,
      ROS_MSG_TYPES.LASER_SCAN,
      (msg) => {
        const pts = parseLaserScan(msg);
        setScanPoints(pts);
      },
      { throttleRate: 80 }
    );

    client.subscribe(
      ROS_TOPICS.GOAL_REACHED,
      ROS_MSG_TYPES.STRING,
      (msg) => {
        if (msg?.data) {
          setNavStatus(`Đã tới đích: ${msg.data}`);
          setIsNavigating(false);
          setSelectedGoal(null);
          setNavigatingEndpointId(null);
        }
      }
    );

    // Duong Nav2 vua lap (planner, ~1 Hz khi dang chay) => ve len map thay cho duong thang.
    client.subscribe(
      '/plan',
      'nav_msgs/Path',
      (msg) => {
        const pts = pathMsgToPoints(msg);
        if (pts.length > 0) setNavPath(pts);
      },
      { throttleRate: 500 }
    );

    // Ket qua goal Nav2 do bridge doc tu /navigate_to_pose/_action/status.
    client.subscribe('/robot/nav_result', ROS_MSG_TYPES.STRING, (msg) => {
      let result = null;
      try {
        result = JSON.parse(msg?.data || '{}').status || null;
      } catch {
        result = null;
      }
      if (!result) return;
      // Gui goal moi khi dang chay => Nav2 huy goal cu (ABORTED); bo qua de khong xoa goal moi.
      if (result !== 'SUCCEEDED' && Date.now() - lastGoalSentAtRef.current < 1500) return;
      setIsNavigating(false);
      setSelectedGoal(null);
      setNavigatingEndpointId(null);
      setNavPath([]);
      if (result === 'SUCCEEDED') setNavStatus('Nav2: đã tới đích');
      else if (result === 'CANCELED') setNavStatus('Nav2: đã huỷ đường đi');
      else setNavStatus('Nav2: không tới được đích (ABORTED). Kiểm tra vị trí ban đầu, vùng cấm, hoặc log Nav2.');
    });

    // Costmap toan cuc cua Nav2 (tuong + vung noi + vung cam) ve chong len map.
    client.subscribe(
      '/global_costmap/costmap',
      ROS_MSG_TYPES.OCCUPANCY_GRID,
      (msg) => {
        const img = buildCostmapImage(msg);
        if (!img || stripSlash(msg?.header?.frame_id) !== 'map') return;
        navigationRef.current.costmap = msg;
        navigationRef.current.costmapAt = Date.now();
        const off = document.createElement('canvas');
        off.width = img.width;
        off.height = img.height;
        off.getContext('2d').putImageData(new ImageData(img.rgba, img.width, img.height), 0, 0);
        costmapRef.current = {
          canvas: off,
          originX: img.originX,
          originY: img.originY,
          widthM: img.width * img.resolution,
          heightM: img.height * img.resolution,
        };
        setCostmapVersion((v) => v + 1);
      },
      { throttleRate: 2000 }
    );

    return () => {
      active = false;
      client.disconnect();
      setIsRosConnected(false);
      rosClientRef.current = null;
      costmapRef.current = null;
    };
  }, [connectionMode, mapConfig.mapId]);

  // Trang thai stack ROS 2 tren laptop (OFFLINE / MAPPING / EXPLORING / NAVIGATION + map dang nap)
  useEffect(() => {
    let alive = true;
    const poll = () =>
      fetchRos2RuntimeStatus()
        .then((d) => {
          if (alive) setNav2Runtime({ mode: d?.mode || 'OFFLINE', activeMap: d?.active_map || null });
        })
        .catch(() => {
          if (alive) setNav2Runtime({ mode: 'OFFLINE', activeMap: null });
        });
    poll();
    const timer = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Bat map_server + AMCL + Nav2 voi map dang chon (backend sinh lai mask vung cam truoc).
  const handleStartNav2 = async () => {
    if (isStartingNav2) return;
    if (
      ['MAPPING', 'EXPLORING'].includes(nav2Runtime.mode) &&
      !window.confirm('Đang quét map. Bật Navigation sẽ dừng phiên quét (map chưa lưu sẽ mất). Tiếp tục?')
    ) {
      return;
    }
    setIsStartingNav2(true);
    localizationRef.current = { mapId: null, requestedAt: 0, confirmed: false };
    setLocalizationReady(false);
    navigationRef.current.poseAt = 0;
    navigationRef.current.costmapAt = 0;
    setNavStatus(`Đang bật Nav2 với map "${mapConfig.mapId}" (map_server + AMCL + Nav2, ~20-30 giây)...`);
    try {
      await startRos2Navigation(mapConfig.mapId, connectionMode === 'pi5' ? pi5Ip : null);
      setNav2Runtime({ mode: 'STARTING', activeMap: mapConfig.mapId });
      setNavStatus(
        `Đang khởi động Nav2 cho "${mapConfig.mapId}". Khi báo NAVIGATION: đặt vị trí ban đầu (Chọn trên map), kiểm tra chấm LiDAR nằm đè lên tường, rồi bấm Tới.`
      );
    } catch (err) {
      setNavStatus(`Không bật được Nav2: ${err.message}`);
    } finally {
      setIsStartingNav2(false);
    }
  };

  // Chuyen doi Toa do Thuc (Meters) sang Canvas Pixels
  const worldToCanvas = useCallback(
    (worldX, worldY, canvasWidth, canvasHeight) =>
      transformWorldToCanvas(worldX, worldY, canvasWidth, canvasHeight, viewConfig),
    [viewConfig]
  );

  // Chuyen doi Canvas Pixels sang Toa do Thuc (Meters)
  const canvasToWorld = useCallback(
    (canvasX, canvasY, canvasWidth, canvasHeight) =>
      transformCanvasToWorld(canvasX, canvasY, canvasWidth, canvasHeight, viewConfig),
    [viewConfig]
  );


  return { handleStartNav2, worldToCanvas, canvasToWorld };
}

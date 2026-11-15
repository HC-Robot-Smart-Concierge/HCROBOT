import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { Zap, Eye, EyeOff, ShieldCheck, MapPin, Layers, Compass } from 'lucide-react';
import { localizationFromManager } from './physicalMapNavigation';
import { speedZoneStatus } from './physicalMapZones';
import { PANEL_SECTIONS, loadPanelState, nextPanelState } from './physicalMapPanel';
import { DEFAULT_VIEW, zoomViewAt } from './physicalMapView';
import {
  PI5_IP,
  LAYOUT2_CONFIG,
  layoutToMapConfig,
  DEFAULT_SAFE_SPEED_PERCENT,
  DEFAULT_SAFE_LINEAR_SPEED,
  DEFAULT_LAB_WAYPOINTS,
  DEFAULT_LAB_ZONES,
  ZONE_TEMPLATES,
  LAB_GEOMETRIC_OBSTACLES,
  transformWorldToCanvas,
  transformCanvasToWorld,
} from './physicalMapConstants';
import { usePhysicalMapLayoutLoader } from './usePhysicalMapLayoutLoader';
import { usePhysicalMapRealtime } from './usePhysicalMapRealtime';
import { usePhysicalMapEntities } from './usePhysicalMapEntities';
import { usePhysicalMapCanvasRender } from './usePhysicalMapCanvasRender';
import { usePhysicalMapPointerDown } from './usePhysicalMapPointerDown';
import { usePhysicalMapPointerMoveUp } from './usePhysicalMapPointerMoveUp';
import { usePhysicalMapRobotActions } from './usePhysicalMapRobotActions';
import { PhysicalMapCanvasViewport } from './PhysicalMapCanvasViewport';
import { PhysicalMapFloatingBars } from './PhysicalMapFloatingBars';
import { PhysicalMapPopupOverviewSections } from './PhysicalMapPopupOverviewSections';
import { PhysicalMapPopupTabsSections } from './PhysicalMapPopupTabsSections';
import { PhysicalMapPopupAndRail } from './PhysicalMapPopupAndRail';

export {
  LAYOUT2_CONFIG,
  layoutToMapConfig,
  DEFAULT_SAFE_SPEED_PERCENT,
  DEFAULT_SAFE_LINEAR_SPEED,
  DEFAULT_LAB_WAYPOINTS,
  DEFAULT_LAB_ZONES,
  ZONE_TEMPLATES,
  LAB_GEOMETRIC_OBSTACLES,
  transformWorldToCanvas,
  transformCanvasToWorld,
};

export const AdminPhysicalMapTab = ({ currentUser }) => {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const rosClientRef = useRef(null);
  const pi5WsRef = useRef(null);

  // Hardware telemetry is direct from Pi; both views navigate through Nav2.
  const [connectionMode, setConnectionMode] = useState('pi5');
  const [pi5Ip, setPi5Ip] = useState(PI5_IP);

  // Trang thai ket noi
  const [isPiConnected, setIsPiConnected] = useState(false);
  const [isRosConnected, setIsRosConnected] = useState(false);
  const isWsConnected = connectionMode === 'pi5' ? isPiConnected : isRosConnected;
  const [localizationReady, setLocalizationReady] = useState(false);
  const localizationRef = useRef({ mapId: null, requestedAt: 0, confirmed: false });
  // /localization/state tu localization_manager.py tren robot (co thi uu tien hon kiem tra AMCL o Web)
  const [locManager, setLocManager] = useState({ msg: null, at: 0 });
  const locManagerRef = useRef({ msg: null, at: 0 });
  // Ly do xe dang ket (drive_block trong /robot/sensor_health) + luc nhan (ms)
  const [driveBlock, setDriveBlock] = useState(null);
  // Ban sao /robot/sensor_health (1 Hz) de ve lai dong ho toc do + huy hieu vung giam toc
  const [healthState, setHealthState] = useState(null);
  const speedEmaRef = useRef(0);
  const navigationRef = useRef({ poseAt: 0, costmapAt: 0, costmap: null, healthAt: 0, health: null });
  const [hardwareInfo, setHardwareInfo] = useState({
    model: 'RPLiDAR A1M8',
    port: '/dev/ttyUSB1',
    firmware: '1.29',
    health: 'Good',
    battery: 100,
  });

  // Dao huong dau xe 180 do neu dau robot nguoc voi vi tri dock
  const [invertHeading, setInvertHeading] = useState(false);

  // Du lieu Telemetry Robot thoi gian thuc
  const [robotPose, setRobotPose] = useState({
    x: 0.0,
    y: 0.0,
    yaw: 0.0,
    linearVelocity: 0.0,
    angularVelocity: 0.0,
  });

  // Vet di chuyen cua robot
  const [trail, setTrail] = useState([]);

  // Tia quet LiDAR thoi gian thuc
  const [scanPoints, setScanPoints] = useState([]);
  const [showLaserScan, setShowLaserScan] = useState(true);
  const [showLaserRays, setShowLaserRays] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showEndpoints, setShowEndpoints] = useState(true);

  // Diem dich den dang chon (Click-to-Navigate)
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [navStatus, setNavStatus] = useState('Sẵn sàng');
  const [isNavigating, setIsNavigating] = useState(false);
  // Duong di A* Pi dang bam theo (cac chang con lai) va map Pi dang nap
  const [navPath, setNavPath] = useState([]);

  // Che do ROS 2 (Nav2 tren laptop WSL): trang thai stack, lop costmap, thoi diem gui goal
  const [nav2Runtime, setNav2Runtime] = useState({ mode: 'OFFLINE', activeMap: null });
  const [isStartingNav2, setIsStartingNav2] = useState(false);
  const [showCostmap, setShowCostmap] = useState(true);
  const costmapRef = useRef(null); // { canvas, originX, originY, widthM, heightM }
  const [costmapVersion, setCostmapVersion] = useState(0);
  const lastGoalSentAtRef = useRef(0);

  // Toc do dieu khien: Giam ve 25% (0.12 m/s) de RPLiDAR A1M8 quet tron ven 360 do
  const [speedPercent, setSpeedPercent] = useState(DEFAULT_SAFE_SPEED_PERCENT);
  const [maxLinearSpeed, setMaxLinearSpeed] = useState(DEFAULT_SAFE_LINEAR_SPEED);
  // Danh sach Endpoints (Waypoints) va Zones quan ly thoi gian thuc
  const [endpoints, setEndpoints] = useState(DEFAULT_LAB_WAYPOINTS);
  const [zones, setZones] = useState(DEFAULT_LAB_ZONES);

  // Che do Ghim nhieu Endpoint truc tiep tren ban do (Click de them)
  const [isAddEndpointMode, setIsAddEndpointMode] = useState(false);
  const [addEndpointType, setAddEndpointType] = useState('PARK'); // 'CHARGER' | 'PARK'
  const [navigatingEndpointId, setNavigatingEndpointId] = useState(null);
  const [hoveredEndpointId, setHoveredEndpointId] = useState(null);
  const clickStartRef = useRef(null);

  // Che do chon va sua Endpoint / Zone
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedZoneVertex, setSelectedZoneVertex] = useState(null);
  const [zoneEdgeHover, setZoneEdgeHover] = useState(null);
  const deleteZoneVertexRef = useRef(null);
  useEffect(() => { setSelectedZoneVertex(null); setZoneEdgeHover(null); }, [selectedZone?.id]);
  const [hasUnsavedEndpoints, setHasUnsavedEndpoints] = useState(false);
  const [hasUnsavedZones, setHasUnsavedZones] = useState(false);
  const [isSavingEndpoints, setIsSavingEndpoints] = useState(false);
  const [isSavingZones, setIsSavingZones] = useState(false);

  // Thanh icon la noi duy nhat chuyen phan; luu ca phan dang mo khi tai lai.
  const [panel, setPanel] = useState(() => ({ ...loadPanelState(), open: false }));
  const closePopup = useCallback(() => setPanel((current) => ({ ...current, open: false })), []);
  const openPanelSection = (section) => setPanel({ open: true, section });
  const handlePanelRail = (key) => setPanel((current) => nextPanelState(current, key));
  const canvasHostRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 850, height: 560 });

  // Dat vi tri ban dau (2D Pose Estimate): click chon vi tri, keo de chon huong dau xe
  const [isPoseSetMode, setIsPoseSetMode] = useState(false);
  const [poseDraft, setPoseDraft] = useState(null); // { x, y, yaw } toa do the gioi, yaw radian
  const [isSettingPose, setIsSettingPose] = useState(false);

  // Keo tha tren Canvas
  const zoneEditRef = useRef(null);
  const [zoneCursor, setZoneCursor] = useState(null);
  const [dragState, setDragState] = useState(null);
  const isDraggingRef = useRef(false);
  const panLastRef = useRef(null); // vi tri chuot lan truoc khi keo map (px canvas)

  // Ve vung bang chuot: chon loai vung roi keo hinh chu nhat tren map
  const [zoneDrawType, setZoneDrawType] = useState(null); // null | 'KEEP_OUT' | 'SPEED_ZONE' | 'NO_STOP'
  const [zoneDrawShape, setZoneDrawShape] = useState('rectangle');
  const [zoneDraft, setZoneDraft] = useState(null); // { type, a: {x,y}, b: {x,y} } toa do the gioi

  // Ban do dang chon (thong so tu .yaml) va anh map (.pgm giai ma thanh canvas)
  const [mapLayouts, setMapLayouts] = useState([]);
  const [mapConfig, setMapConfig] = useState(LAYOUT2_CONFIG);
  // Zoom/keo map (lan chuot, keo vung trong / chuot phai, nut goc duoi phai). Doi map => ve "vua khung".
  const [mapView, setMapView] = useState(DEFAULT_VIEW);
  const viewConfig = useMemo(() => ({ ...mapConfig, view: mapView }), [mapConfig, mapView]);
  const viewConfigRef = useRef(viewConfig);
  viewConfigRef.current = viewConfig;
  const zoomMapBy = (factor) =>
    setMapView((v) => zoomViewAt(v, factor, canvasSize.width / 2, canvasSize.height / 2, canvasSize.width, canvasSize.height, mapConfig));
  const [mapImage, setMapImage] = useState(null);
  const isLegacyMap = mapConfig.mapId === LAYOUT2_CONFIG.mapId;
  const navigationMapReady = isRosConnected && nav2Runtime.mode === 'NAVIGATION' && nav2Runtime.activeMap === mapConfig.mapId;
  const managerLoc = localizationFromManager(locManager.msg, locManager.at);
  const isLocalized = managerLoc.fresh ? managerLoc.localized : localizationReady;
  const speedStatus = speedZoneStatus(robotPose, zones, healthState);
  const dockEndpoint = endpoints.find((ep) => ep.id === 'dock' || ['CHARGER', 'dock'].includes(ep.type));

  const handleStopRef = useRef(null);
  const handleSendGoalRef = useRef(null);

  const { handleSelectMap } = usePhysicalMapLayoutLoader({ canvasHostRef, canvasSize, clickStartRef, handleStopRef, hasUnsavedEndpoints, hasUnsavedZones, isRosConnected, localizationRef, mapConfig, mapLayouts, panel, rosClientRef, setCanvasSize, setDragState, setEndpoints, setHasUnsavedEndpoints, setHasUnsavedZones, setIsAddEndpointMode, setLocalizationReady, setMapConfig, setMapImage, setMapLayouts, setMapView, setNavPath, setNavStatus, setNavigatingEndpointId, setPoseDraft, setSelectedEndpoint, setSelectedGoal, setSelectedZone, setSelectedZoneVertex, setTrail, setZoneDraft, setZoneDrawType, setZoneEdgeHover, setZones, zoneEditRef, zones });

  const { handleStartNav2, worldToCanvas, canvasToWorld } = usePhysicalMapRealtime({ connectionMode, costmapRef, isStartingNav2, lastGoalSentAtRef, locManagerRef, localizationRef, mapConfig, nav2Runtime, navigationRef, pi5Ip, pi5WsRef, rosClientRef, setCostmapVersion, setDriveBlock, setHardwareInfo, setHealthState, setIsNavigating, setIsPiConnected, setIsRosConnected, setIsStartingNav2, setLocManager, setLocalizationReady, setNav2Runtime, setNavPath, setNavStatus, setNavigatingEndpointId, setRobotPose, setScanPoints, setSelectedGoal, setTrail, speedEmaRef, t, viewConfig });

  const { rejectZoneRule, handleAddEndpoint, handleNavigateToEndpoint, handleUpdateSelectedEndpoint, handleSaveEndpoints, handleDeleteEndpoint, persistZone, handleAddZone, finishPolygon, handleDeleteSelectedVertex, toggleZoneDraw, startPointPlacement, handleUpdateSelectedZone, handleSaveZones, handleDeleteZone } = usePhysicalMapEntities({ closePopup, deleteZoneVertexRef, dragState, endpoints, handleSendGoalRef, isAddEndpointMode, isDraggingRef, isPoseSetMode, mapConfig, navigatingEndpointId, openPanelSection, pi5WsRef, rosClientRef, selectedEndpoint, selectedZone, selectedZoneVertex, setAddEndpointType, setEndpoints, setHasUnsavedEndpoints, setHasUnsavedZones, setIsAddEndpointMode, setIsNavigating, setIsPoseSetMode, setIsSavingEndpoints, setIsSavingZones, setNavStatus, setNavigatingEndpointId, setPoseDraft, setSelectedEndpoint, setSelectedGoal, setSelectedZone, setSelectedZoneVertex, setShowEndpoints, setShowZones, setZoneDraft, setZoneDrawType, setZones, showZones, t, zoneDraft, zoneDrawType, zones });

  usePhysicalMapCanvasRender({ canvasRef, canvasSize, connectionMode, costmapRef, costmapVersion, endpoints, hoveredEndpointId, invertHeading, isNavigating, mapConfig, mapImage, navPath, navigatingEndpointId, navigationRef, poseDraft, robotPose, scanPoints, selectedEndpoint, selectedGoal, selectedZone, selectedZoneVertex, setMapView, showCostmap, showEndpoints, showLaserRays, showLaserScan, showZones, t, trail, viewConfig, viewConfigRef, worldToCanvas, zoneDraft, zoneEdgeHover, zones });

  const { handleCanvasMouseDown } = usePhysicalMapPointerDown({ addEndpointType, canvasRef, canvasToWorld, clickStartRef, endpoints, finishPolygon, handleAddEndpoint, isAddEndpointMode, isDraggingRef, isPoseSetMode, openPanelSection, panLastRef, rejectZoneRule, robotPose, selectedZone, setDragState, setPoseDraft, setSelectedEndpoint, setSelectedZone, setSelectedZoneVertex, setZoneDraft, setZoneEdgeHover, setZones, showEndpoints, showZones, viewConfig, worldToCanvas, zoneDraft, zoneDrawShape, zoneDrawType, zoneEditRef, zones });

  const { handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasPointerCancel } = usePhysicalMapPointerMoveUp({ canvasRef, canvasToWorld, clickStartRef, dragState, endpoints, handleAddZone, handleApplyInitialPose, handleNavigateToEndpoint, isDraggingRef, mapConfig, panLastRef, persistZone, poseDraft, rejectZoneRule, selectedZone, setDragState, setEndpoints, setHasUnsavedEndpoints, setHoveredEndpointId, setMapView, setNavStatus, setPoseDraft, setSelectedEndpoint, setSelectedZone, setSelectedZoneVertex, setZoneCursor, setZoneDraft, setZoneDrawType, setZoneEdgeHover, setZones, showEndpoints, showZones, viewConfig, worldToCanvas, zoneDraft, zoneDrawShape, zoneDrawType, zoneEditRef, zones });

  const { handleApplyInitialPose, handleSetPoseAtDock, handleRelocalize, handleSendGoal, sendTeleopCommand, handleStop } = usePhysicalMapRobotActions({ connectionMode, deleteZoneVertexRef, dockEndpoint, lastGoalSentAtRef, locManagerRef, localizationRef, mapConfig, maxLinearSpeed, nav2Runtime, navigationRef, pi5Ip, robotPose, rosClientRef, setDragState, setInvertHeading, setIsAddEndpointMode, setIsNavigating, setIsPoseSetMode, setIsSettingPose, setLocalizationReady, setNavPath, setNavStatus, setNavigatingEndpointId, setPoseDraft, setSelectedGoal, setSelectedZoneVertex, setTrail, setZoneDraft, setZoneDrawType, speedPercent, zones });
  handleStopRef.current = handleStop;
  handleSendGoalRef.current = handleSendGoal;

  const mapActions = [
    { key: 'laser', Icon: Zap, title: 'Laser LiDAR', label: `Laser: ${showLaserScan ? 'BẬT' : 'TẮT'} (${scanPoints.length} điểm)`, description: `${scanPoints.length} điểm quét đang được nhận. Bật để hiển thị các điểm LiDAR trên bản đồ.`, active: showLaserScan, onClick: () => setShowLaserScan((value) => !value) },
    { key: 'rays', Icon: showLaserRays ? Eye : EyeOff, title: 'Tia quét LiDAR', label: `Tia quét: ${showLaserRays ? 'BẬT' : 'TẮT'}`, description: 'Hiển thị đường tia từ robot đến các điểm quét LiDAR.', active: showLaserRays, onClick: () => setShowLaserRays((value) => !value) },
    { key: 'zones', Icon: ShieldCheck, title: 'Hiển thị vùng', label: `Hiển thị vùng (${zones.length})`, description: `${zones.length} vùng trên bản đồ. Thay đổi hiển thị không tắt các quy tắc của vùng.`, active: showZones, onClick: () => setShowZones((value) => !value) },
    { key: 'endpoints', Icon: MapPin, title: 'Hiển thị điểm mốc', label: `Hiển thị điểm mốc (${endpoints.length})`, description: `${endpoints.length} điểm mốc, trạm sạc và điểm đỗ trên bản đồ.`, active: showEndpoints, onClick: () => setShowEndpoints((value) => !value) },
    { key: 'costmap', Icon: Layers, title: 'Costmap Nav2', label: `Costmap Nav2${costmapVersion === 0 ? ' (chưa có dữ liệu)' : ''}: ${showCostmap ? 'BẬT' : 'TẮT'}`, description: costmapVersion === 0 ? 'Chưa nhận được costmap từ Nav2. Khi có dữ liệu, đỏ là vật cản hoặc vùng cấm; cam là khoảng nới an toàn.' : 'Đỏ là vật cản hoặc vùng cấm; cam là khoảng nới an toàn quanh vật cản.', active: showCostmap, onClick: () => setShowCostmap((value) => !value) },
    { key: 'heading', Icon: Compass, title: 'Hướng hiển thị robot', label: invertHeading ? 'Đảo đầu: 180°' : 'Đầu chuẩn: 0°', description: 'Đảo hướng hiển thị đầu xe và góc quét LiDAR 180° khi bị ngược với thực tế.', active: invertHeading, onClick: () => setInvertHeading((value) => !value) },
  ];
  const popupAction = mapActions.find((action) => action.key === panel.section);
  const popupTitle = PANEL_SECTIONS.find((section) => section.key === panel.section)?.label
    || popupAction?.title
    || (panel.section === 'ADD' ? 'Thêm vào bản đồ' : 'Vệt di chuyển');

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Main Workspace: Canvas Map Area + Right Control Panel */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        <PhysicalMapCanvasViewport
          addEndpointType={addEndpointType}
          canvasHostRef={canvasHostRef}
          canvasRef={canvasRef}
          canvasSize={canvasSize}
          dragState={dragState}
          driveBlock={driveBlock}
          finishPolygon={finishPolygon}
          handleCanvasMouseDown={handleCanvasMouseDown}
          handleCanvasMouseMove={handleCanvasMouseMove}
          handleCanvasMouseUp={handleCanvasMouseUp}
          handleCanvasPointerCancel={handleCanvasPointerCancel}
          hoveredEndpointId={hoveredEndpointId}
          isAddEndpointMode={isAddEndpointMode}
          isPoseSetMode={isPoseSetMode}
          isRosConnected={isRosConnected}
          mapConfig={mapConfig}
          mapView={mapView}
          panel={panel}
          robotPose={robotPose}
          setDriveBlock={setDriveBlock}
          setHoveredEndpointId={setHoveredEndpointId}
          setIsAddEndpointMode={setIsAddEndpointMode}
          setMapView={setMapView}
          setZoneDraft={setZoneDraft}
          setZoneDrawType={setZoneDrawType}
          setZoneEdgeHover={setZoneEdgeHover}
          speedStatus={speedStatus}
          t={t}
          zoneCursor={zoneCursor}
          zoneDraft={zoneDraft}
          zoneDrawShape={zoneDrawShape}
          zoneDrawType={zoneDrawType}
          zoomMapBy={zoomMapBy}
        >
          <PhysicalMapFloatingBars
          dragState={dragState}
          handleDeleteEndpoint={handleDeleteEndpoint}
          handleDeleteSelectedVertex={handleDeleteSelectedVertex}
          handleDeleteZone={handleDeleteZone}
          handleNavigateToEndpoint={handleNavigateToEndpoint}
          handleSaveEndpoints={handleSaveEndpoints}
          handleSaveZones={handleSaveZones}
          handleStop={handleStop}
          handleUpdateSelectedEndpoint={handleUpdateSelectedEndpoint}
          handleUpdateSelectedZone={handleUpdateSelectedZone}
          hasUnsavedEndpoints={hasUnsavedEndpoints}
          hasUnsavedZones={hasUnsavedZones}
          isNavigating={isNavigating}
          isSavingEndpoints={isSavingEndpoints}
          isSavingZones={isSavingZones}
          navStatus={navStatus}
          navigatingEndpointId={navigatingEndpointId}
          selectedEndpoint={selectedEndpoint}
          selectedZone={selectedZone}
          selectedZoneVertex={selectedZoneVertex}
          setSelectedEndpoint={setSelectedEndpoint}
          setSelectedZone={setSelectedZone}
          />
        </PhysicalMapCanvasViewport>

        <PhysicalMapPopupAndRail
          closePopup={closePopup}
          endpoints={endpoints}
          handlePanelRail={handlePanelRail}
          mapActions={mapActions}
          panel={panel}
          popupTitle={popupTitle}
          trail={trail}
          zones={zones}
          popupContent={
            <>
              <PhysicalMapPopupOverviewSections
          closePopup={closePopup}
          connectionMode={connectionMode}
          dockEndpoint={dockEndpoint}
          handleRelocalize={handleRelocalize}
          handleSelectMap={handleSelectMap}
          handleSetPoseAtDock={handleSetPoseAtDock}
          handleStartNav2={handleStartNav2}
          hardwareInfo={hardwareInfo}
          isLegacyMap={isLegacyMap}
          isLocalized={isLocalized}
          isNavigating={isNavigating}
          isPoseSetMode={isPoseSetMode}
          isSettingPose={isSettingPose}
          isStartingNav2={isStartingNav2}
          isWsConnected={isWsConnected}
          localizationReady={localizationReady}
          managerLoc={managerLoc}
          mapConfig={mapConfig}
          mapLayouts={mapLayouts}
          nav2Runtime={nav2Runtime}
          navStatus={navStatus}
          navigationMapReady={navigationMapReady}
          panel={panel}
          pi5Ip={pi5Ip}
          robotPose={robotPose}
          setConnectionMode={setConnectionMode}
          setIsAddEndpointMode={setIsAddEndpointMode}
          setIsPoseSetMode={setIsPoseSetMode}
          setPoseDraft={setPoseDraft}
          setSelectedEndpoint={setSelectedEndpoint}
          setSelectedZone={setSelectedZone}
          setTrail={setTrail}
          setZoneDraft={setZoneDraft}
          setZoneDrawType={setZoneDrawType}
          startPointPlacement={startPointPlacement}
          t={t}
          toggleZoneDraw={toggleZoneDraw}
          trail={trail}
              />
              <PhysicalMapPopupTabsSections
          addEndpointType={addEndpointType}
          endpoints={endpoints}
          handleAddEndpoint={handleAddEndpoint}
          handleDeleteEndpoint={handleDeleteEndpoint}
          handleDeleteZone={handleDeleteZone}
          handleNavigateToEndpoint={handleNavigateToEndpoint}
          handleSaveEndpoints={handleSaveEndpoints}
          handleSaveZones={handleSaveZones}
          handleStop={handleStop}
          hardwareInfo={hardwareInfo}
          hasUnsavedEndpoints={hasUnsavedEndpoints}
          hasUnsavedZones={hasUnsavedZones}
          isAddEndpointMode={isAddEndpointMode}
          isNavigating={isNavigating}
          isSavingEndpoints={isSavingEndpoints}
          isSavingZones={isSavingZones}
          maxLinearSpeed={maxLinearSpeed}
          navigatingEndpointId={navigatingEndpointId}
          panel={panel}
          pi5Ip={pi5Ip}
          scanPoints={scanPoints}
          selectedEndpoint={selectedEndpoint}
          selectedZone={selectedZone}
          sendTeleopCommand={sendTeleopCommand}
          setAddEndpointType={setAddEndpointType}
          setMaxLinearSpeed={setMaxLinearSpeed}
          setSelectedEndpoint={setSelectedEndpoint}
          setSelectedZone={setSelectedZone}
          setSpeedPercent={setSpeedPercent}
          setZoneDraft={setZoneDraft}
          setZoneDrawShape={setZoneDrawShape}
          setZoneDrawType={setZoneDrawType}
          speedPercent={speedPercent}
          toggleZoneDraw={toggleZoneDraw}
          zoneDrawShape={zoneDrawShape}
          zoneDrawType={zoneDrawType}
          zones={zones}
              />
            </>
          }
        />
      </div>
    </div>
  );
};

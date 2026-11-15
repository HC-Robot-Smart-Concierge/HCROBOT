import React, { useState, useRef, useMemo } from 'react';
import { useRobotControlText } from '../../context/RobotControlLanguage';
import './robot-control.css';
import { PI_POWER_BADGES, ROSBRIDGE_DEFAULT_URL } from './adminLidarUtils';
import { useAdminLidarRosbridge } from './useAdminLidarRosbridge';
import { useAdminLidarPollingAndTeleop } from './useAdminLidarPollingAndTeleop';
import { useAdminLidarMapActions } from './useAdminLidarMapActions';
import { useAdminLidarNavAndWorkflowActions } from './useAdminLidarNavAndWorkflowActions';
import { AdminLidarHeaderAndMenu } from './AdminLidarHeaderAndMenu';
import { AdminLidarWorkspaceView } from './AdminLidarWorkspaceView';
import { AdminLidarSaveAndSavedModals } from './AdminLidarSaveAndSavedModals';
import { AdminLidarWorkflowAndOverlayModals } from './AdminLidarWorkflowAndOverlayModals';

export const AdminLidarPage = ({ currentUser, initialView = 'slam' }) => {
  const rc = useRobotControlText();
  const [activeView, setActiveView] = useState(initialView);
  const [emergencyStopVersion, setEmergencyStopVersion] = useState(0);
  const [, setHardwareInfo] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [rosbridgeUrl] = useState(ROSBRIDGE_DEFAULT_URL);

  // Telemetry & Scan Data
  const [scanPoints, setScanPoints] = useState([]);
  const [gridData, setGridData] = useState([]);
  const [, setGridMetadata] = useState({ width: 200, height: 200, resolution: 0.05, origin_x: -5.0, origin_y: -5.0 });
  const [selectedMapId, setSelectedMapId] = useState('phong_lam_viec');

  const [telemetry, setTelemetry] = useState({
    x: 0.0,
    y: 0.0,
    yaw: 0.0,
    linearVelocity: 0.0,
    angularVelocity: 0.0,
    status: 'WAITING_FOR_ROS2_CONNECTION',
    source: 'ROS2_SLAM_NAV2',
  });

  // Nguồn cấp Pi 5 (PMIC); null khi chưa gọi được Pi.
  const [piPower, setPiPower] = useState(null);
  // % pin dự phòng ước tính theo thời gian cấp nguồn (robot/scripts/pi_battery_estimator.py).
  const [piBattery, setPiBattery] = useState(null);
  const [isBatteryEditOpen, setIsBatteryEditOpen] = useState(false);
  const [batteryInputPercent, setBatteryInputPercent] = useState('');
  const [batteryInputRate, setBatteryInputRate] = useState('');
  const [isSyncingBattery, setIsSyncingBattery] = useState(false);

  const [encoders, setEncoders] = useState({
    m1: { ticks: 0, rpm: 0.0, dir: 0 },
    m2: { ticks: 0, rpm: 0.0, dir: 0 },
    m3: { ticks: 0, rpm: 0.0, dir: 0 },
    m4: { ticks: 0, rpm: 0.0, dir: 0 },
  });

  const [activeNavGoal, setActiveNavGoal] = useState(null);
  const [navNotification, setNavNotification] = useState('');

  // Map saving & loading state
  const [isSaveMapModalOpen, setIsSaveMapModalOpen] = useState(false);
  const [saveMapName, setSaveMapName] = useState('floor1_map');
  const [isSavedMapsModalOpen, setIsSavedMapsModalOpen] = useState(false);
  const [savedMapsList, setSavedMapsList] = useState([]);
  const [isSavingMap, setIsSavingMap] = useState(false);
  const [isMapLocked, setIsMapLocked] = useState(false);
  const [mapMode, setMapMode] = useState('MAPPING');
  const [isRos2RuntimeBusy, setIsRos2RuntimeBusy] = useState(false);
  const [sensorHealth, setSensorHealth] = useState(null);
  const [hasLiveRosMap, setHasLiveRosMap] = useState(false);

  // Frontier Exploration (Quet full phong tu dong bang SLAM)
  const [isExploring, setIsExploring] = useState(false);
  const [exploredCount, setExploredCount] = useState(0);
  const [isExploreModalOpen, setIsExploreModalOpen] = useState(false);
  // Ket qua cuoi cua frontier_explorer (/explore/status) + bang Luu map mo ra vi quet xong
  const [exploreResult, setExploreResult] = useState(null);
  const [saveFromExplore, setSaveFromExplore] = useState(false);
  const [exploreError, setExploreError] = useState('');

  // Workflow Manager
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [workflowList, setWorkflowList] = useState([]);
  const [, setIsWorkflowRunning] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: rc('Floor 1 patrol'),
    description: '',
    steps: [
      { name: rc('Point A'), action: 'navigate', x: 1.0, y: 0.0, timeout: 45 },
      { name: rc('Wait'), action: 'wait', wait_sec: 3 },
      { name: rc('Return home'), action: 'return_home' },
    ],
  });

  // Overlay Map
  const [overlayActive, setOverlayActive] = useState(false);
  const [overlayWaypoints, setOverlayWaypoints] = useState([]);
  const [isOverlayModalOpen, setIsOverlayModalOpen] = useState(false);
  const [overlayMapName, setOverlayMapName] = useState('floor_plan_overlay');

  // Real-time LiDAR Safety & Obstacle Clearances
  const [safetyInfo] = useState({ front_cm: null, rear_cm: null, left_cm: null, right_cm: null, alert: '' });

  const rosClientRef = useRef(null);
  const exploreStartedAtRef = useRef(0); // Date.now() luc bam "Quet Full Phong" (0 = khong cho)
  const exploreSeenRef = useRef(false); // da thay backend bao EXPLORING trong phien nay
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const menuDropdownRef = useRef(null);

  const mapStats = useMemo(() => {
    let occupied = 0;
    let free = 0;
    for (const cell of gridData) {
      if (cell >= 65) occupied += 1;
      else if (cell === 0) free += 1;
    }
    return { occupied, free, known: occupied + free };
  }, [gridData]);

  const lidarLive = Boolean(sensorHealth?.lidar_live && scanPoints.length > 0);
  const odometryMotionSeen = Boolean(sensorHealth?.encoder_motion_detected);

  const piPowerBadge = PI_POWER_BADGES[piPower ? piPower.status : 'OFFLINE'] || PI_POWER_BADGES.UNAVAILABLE;
  const piVoltageLow = piPower?.status === 'UNDERVOLTAGE' || piPower?.status === 'LOW_VOLTAGE';
  const piBatteryPercent = typeof piBattery?.percent === 'number' ? piBattery.percent : null;
  let piBatteryBarColor = 'bg-stone-800';
  if (piBatteryPercent !== null && piBatteryPercent < 20) piBatteryBarColor = 'bg-red-500';
  else if (piBatteryPercent !== null && piBatteryPercent < 50) piBatteryBarColor = 'bg-amber-500';
  const piPowerNotes = [];
  if (!piPower) {
    piPowerNotes.push(rc('Pi 5 is unreachable (port 8000).'));
  } else {
    if (piPower.message) piPowerNotes.push(piPower.message);
    if (typeof piPower.psu_max_current_ma === 'number' && piPower.psu_max_current_ma < 3000) {
      piPowerNotes.push(
        rc('Power supply advertises only {0} A to Pi', [(piPower.psu_max_current_ma / 1000).toFixed(1)])
        + `${piPower.psu_usb_pd === false ? rc(' (no USB-PD)') : ''}.`
      );
    }
  }

  const { handleReconnect } = useAdminLidarRosbridge({
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
  });

  const {
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
    switchView,
  } = useAdminLidarPollingAndTeleop({
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
  });

  const {
    waitForRos2Runtime,
    handleStartMappingFromWeb,
    handleStartNavigationFromWeb,
    handleResetGridMap,
    handleToggleLockMap,
    handleOpenSaveMapModal,
    triggerMapDownload,
    handleSaveMap,
    handleOpenSavedMapsModal,
    handleLoadSavedMap,
    handleDeleteSavedMap,
  } = useAdminLidarMapActions({
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
  });

  const {
    handleEmergencyStop,
    handleStartExplore,
    handleStopExplore,
    loadWorkflows,
    handleSaveWorkflow,
    handleExecuteWorkflow,
    handleDeleteWorkflow,
    handleLoadOverlay,
    handleDisableOverlay,
    handleGenerateOverlayTemplate,
  } = useAdminLidarNavAndWorkflowActions({
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
  });

  return (
    <div className="robot-control-page w-full h-full flex flex-col overflow-hidden font-sans select-none" style={{ background: '#F2EFE9', color: '#262626' }}>
      <AdminLidarHeaderAndMenu
        rc={rc}
        isWsConnected={isWsConnected}
        rosbridgeUrl={rosbridgeUrl}
        lidarLive={lidarLive}
        scanPoints={scanPoints}
        odometryMotionSeen={odometryMotionSeen}
        hasLiveRosMap={hasLiveRosMap}
        mapStats={mapStats}
        menuDropdownRef={menuDropdownRef}
        handleToggleLockMap={handleToggleLockMap}
        mapMode={mapMode}
        isMapLocked={isMapLocked}
        handleEmergencyStop={handleEmergencyStop}
        isExploring={isExploring}
        telemetry={telemetry}
        isMenuDropdownOpen={isMenuDropdownOpen}
        setIsMenuDropdownOpen={setIsMenuDropdownOpen}
        isRos2RuntimeBusy={isRos2RuntimeBusy}
        handleStartMappingFromWeb={handleStartMappingFromWeb}
        handleOpenSaveMapModal={handleOpenSaveMapModal}
        handleStartNavigationFromWeb={handleStartNavigationFromWeb}
        setIsExploreModalOpen={setIsExploreModalOpen}
        handleStopExplore={handleStopExplore}
        handleOpenSavedMapsModal={handleOpenSavedMapsModal}
        savedMapsList={savedMapsList}
        selectedMapId={selectedMapId}
        handleSelectMap={handleSelectMap}
        handleResetGridMap={handleResetGridMap}
        handleReconnect={handleReconnect}
        exploreError={exploreError}
        setExploreError={setExploreError}
        navNotification={navNotification}
        setNavNotification={setNavNotification}
      />

      <AdminLidarWorkspaceView
        rc={rc}
        currentUser={currentUser}
        activeView={activeView}
        switchView={switchView}
        telemetry={telemetry}
        emergencyStopVersion={emergencyStopVersion}
        isRos2RuntimeBusy={isRos2RuntimeBusy}
        handleStartMappingFromWeb={handleStartMappingFromWeb}
        handleOpenSaveMapModal={handleOpenSaveMapModal}
        selectedMapId={selectedMapId}
        setSelectedMapId={setSelectedMapId}
        savedMapsList={savedMapsList}
        handleStartNavigationFromWeb={handleStartNavigationFromWeb}
        mapMode={mapMode}
        lidarLive={lidarLive}
        odometryMotionSeen={odometryMotionSeen}
        isExploring={isExploring}
        exploredCount={exploredCount}
        handleEmergencyStop={handleEmergencyStop}
        safetyInfo={safetyInfo}
        piPowerBadge={piPowerBadge}
        piPower={piPower}
        piBattery={piBattery}
        piBatteryPercent={piBatteryPercent}
        piBatteryBarColor={piBatteryBarColor}
        piVoltageLow={piVoltageLow}
        piPowerNotes={piPowerNotes}
        isBatteryEditOpen={isBatteryEditOpen}
        setIsBatteryEditOpen={setIsBatteryEditOpen}
        batteryInputPercent={batteryInputPercent}
        setBatteryInputPercent={setBatteryInputPercent}
        batteryInputRate={batteryInputRate}
        setBatteryInputRate={setBatteryInputRate}
        handleSyncBattery={handleSyncBattery}
        isSyncingBattery={isSyncingBattery}
        activeNavGoal={activeNavGoal}
        slamSpeed={slamSpeed}
        slamSpeedDraft={slamSpeedDraft}
        setSlamSpeedDraft={setSlamSpeedDraft}
        handleSlamSpeedChange={handleSlamSpeedChange}
        slamActiveMotion={slamActiveMotion}
        startTeleop={startTeleop}
        stopTeleop={stopTeleop}
        encoders={encoders}
      />

      <AdminLidarSaveAndSavedModals
        rc={rc}
        isSaveMapModalOpen={isSaveMapModalOpen}
        setIsSaveMapModalOpen={setIsSaveMapModalOpen}
        saveFromExplore={saveFromExplore}
        setSaveFromExplore={setSaveFromExplore}
        exploreResult={exploreResult}
        handleSaveMap={handleSaveMap}
        saveMapName={saveMapName}
        setSaveMapName={setSaveMapName}
        isSavingMap={isSavingMap}
        isSavedMapsModalOpen={isSavedMapsModalOpen}
        setIsSavedMapsModalOpen={setIsSavedMapsModalOpen}
        savedMapsList={savedMapsList}
        triggerMapDownload={triggerMapDownload}
        handleLoadSavedMap={handleLoadSavedMap}
        handleDeleteSavedMap={handleDeleteSavedMap}
      />

      <AdminLidarWorkflowAndOverlayModals
        rc={rc}
        isExploreModalOpen={isExploreModalOpen}
        setIsExploreModalOpen={setIsExploreModalOpen}
        handleStartExplore={handleStartExplore}
        isWorkflowModalOpen={isWorkflowModalOpen}
        setIsWorkflowModalOpen={setIsWorkflowModalOpen}
        newWorkflow={newWorkflow}
        setNewWorkflow={setNewWorkflow}
        handleSaveWorkflow={handleSaveWorkflow}
        loadWorkflows={loadWorkflows}
        workflowList={workflowList}
        handleExecuteWorkflow={handleExecuteWorkflow}
        handleDeleteWorkflow={handleDeleteWorkflow}
        isOverlayModalOpen={isOverlayModalOpen}
        setIsOverlayModalOpen={setIsOverlayModalOpen}
        overlayActive={overlayActive}
        overlayWaypoints={overlayWaypoints}
        overlayMapName={overlayMapName}
        setOverlayMapName={setOverlayMapName}
        handleGenerateOverlayTemplate={handleGenerateOverlayTemplate}
        handleDisableOverlay={handleDisableOverlay}
        handleLoadOverlay={handleLoadOverlay}
      />
    </div>
  );
};

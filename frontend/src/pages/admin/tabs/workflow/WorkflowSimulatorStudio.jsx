import React, { useState, useEffect, useRef } from 'react';
import { useSpeechSynthesis } from '../../../../hooks/useSpeechSynthesis';
import { useRobotControlText } from '../../../../context/RobotControlLanguage';
import { useLanguage } from '../../../../context/LanguageContext';
import { guestRequestPhase } from '../../../../utils/workflowGuestRequest';
import {
  ROBOT_INITIAL_POSE,
  STANDARD_LOBBY_WAYPOINTS,
  SIMULATOR_HOTEL_ZONES,
  getActiveSimulatorZone,
} from './workflowSimulatorUtils';
import { deriveActiveStepDetail, deriveRobotStatus } from './workflowSimulatorStatus';
import { useWorkflowZoomPan } from './useWorkflowZoomPan';
import { useWorkflowListAndEdits } from './useWorkflowListAndEdits';
import { useWorkflowZoneActions } from './useWorkflowZoneActions';
import { useWorkflowEndpointActions } from './useWorkflowEndpointActions';
import { useWorkflowCanvasPointer } from './useWorkflowCanvasPointer';
import { useWorkflowRosConnection } from './useWorkflowRosConnection';
import { useWorkflowNavigation } from './useWorkflowNavigation';
import { useWorkflowStepExecution } from './useWorkflowStepExecution';
import { useWorkflowPlaybackControls } from './useWorkflowPlaybackControls';
import { WorkflowToolbarScenarioAndMap } from './WorkflowToolbarScenarioAndMap';
import { WorkflowToolbarPlaybackAndSteps } from './WorkflowToolbarPlaybackAndSteps';
import { WorkflowToolbarOptions } from './WorkflowToolbarOptions';
import { WorkflowViewportOverlays } from './WorkflowViewportOverlays';
import { WorkflowFloorPlanSvg } from './WorkflowFloorPlanSvg';
import { WorkflowEditFloatingBars } from './WorkflowEditFloatingBars';

// Kich thuoc ViewBox co so (om sat map 490x315 voi le 3px de anh map to toi da)
const BASE_VB_WIDTH = 496;
const BASE_VB_HEIGHT = 321;

export const WorkflowSimulatorStudio = ({
  workflows = [],
  initialWorkflowId = null,
  onClose = null,
  onNotify = () => {},
  onWorkflowUpdated = null,
}) => {
  const rc = useRobotControlText();
  const { language } = useLanguage();
  const [guestRequest, setGuestRequest] = useState({});

  // Trang thai thuc thi
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoopMode, setIsLoopMode] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);
  const [stepRun, setStepRun] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState(() => new Set());
  const [simBatteryPercent, setSimBatteryPercent] = useState(100);
  const [simGuestPresent, setSimGuestPresent] = useState(false);
  const [currentPath, setCurrentPath] = useState(null);
  const [robotPose, setRobotPose] = useState(ROBOT_INITIAL_POSE);
  const [manualNavLabel, setManualNavLabel] = useState(null);
  const [isRosEnabled, setIsRosEnabled] = useState(true);
  const [isRosConnected, setIsRosConnected] = useState(false);

  // Quan ly 3 Vung Chuc Nang & Endpoints
  const [zones, setZones] = useState(SIMULATOR_HOTEL_ZONES);
  const [showZones, setShowZones] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneAlert, setZoneAlert] = useState(null);
  const [isZoneEditMode, setIsZoneEditMode] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [hasUnsavedZones, setHasUnsavedZones] = useState(false);
  const [isSavingZones, setIsSavingZones] = useState(false);
  const [isZoneMenuOpen, setIsZoneMenuOpen] = useState(false);
  const wasDraggingRef = useRef(false);

  const [endpoints, setEndpoints] = useState(STANDARD_LOBBY_WAYPOINTS);
  const endpointsRef = useRef(endpoints);
  endpointsRef.current = endpoints;
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [hoveredEndpointId, setHoveredEndpointId] = useState(null);
  const [isEndpointEditMode, setIsEndpointEditMode] = useState(false);
  const [dragEndpointState, setDragEndpointState] = useState(null);
  const [isEndpointMenuOpen, setIsEndpointMenuOpen] = useState(false);
  const [hasUnsavedEndpoints, setHasUnsavedEndpoints] = useState(false);
  const [isSavingEndpoints, setIsSavingEndpoints] = useState(false);

  const svgRef = useRef(null);
  const zoomPan = useWorkflowZoomPan({
    baseWidth: BASE_VB_WIDTH,
    baseHeight: BASE_VB_HEIGHT,
    centerX: 280,
    centerY: 192.5,
    svgRef,
  });

  const { speak, cancel: stopSpeaking } = useSpeechSynthesis();

  // Refs de tranh re-render loop va dong bo trang thai thoi gian thuc
  const timerRef = useRef(null);
  const animFrameRef = useRef(null);
  const rosClientRef = useRef(null);
  const speakRef = useRef(speak);
  const stopSpeakingRef = useRef(stopSpeaking);
  const isMutedRef = useRef(isMuted);
  const simSpeedRef = useRef(simSpeed);
  const isPlayingRef = useRef(isPlaying);
  const currentStepIndexRef = useRef(currentStepIndex);
  const robotPoseRef = useRef(robotPose);
  const isRosEnabledRef = useRef(isRosEnabled);
  const isRosConnectedRef = useRef(isRosConnected);
  const currentPathRef = useRef(currentPath);
  const targetTelemetryPoseRef = useRef(null);
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const isLoopModeRef = useRef(isLoopMode);
  const stepsRef = useRef([]);
  const handleStepFinishRef = useRef(null);

  const workflowEdits = useWorkflowListAndEdits({
    workflows,
    initialWorkflowId,
    endpointsRef,
    robotPoseRef,
    setIsLoopMode,
    isLoopModeRef,
    setCurrentPath,
    setManualNavLabel,
    onNotify,
    onWorkflowUpdated,
  });
  const {
    localWorkflows,
    setLocalWorkflows,
    selectedWorkflowId,
    setSelectedWorkflowId,
    activeWorkflow,
    steps,
  } = workflowEdits;
  stepsRef.current = steps;

  useEffect(() => {
    speakRef.current = speak;
    stopSpeakingRef.current = stopSpeaking;
    isMutedRef.current = isMuted;
    simSpeedRef.current = simSpeed;
    stepsRef.current = steps;
    isPlayingRef.current = isPlaying;
    currentStepIndexRef.current = currentStepIndex;
    robotPoseRef.current = robotPose;
    isRosEnabledRef.current = isRosEnabled;
    isRosConnectedRef.current = isRosConnected;
    currentPathRef.current = currentPath;
    zonesRef.current = zones;
    isLoopModeRef.current = isLoopMode;
  });

  const zoneActions = useWorkflowZoneActions({
    zones,
    setZones,
    selectedZone,
    setSelectedZone,
    setShowZones,
    setIsZoneEditMode,
    setHasUnsavedZones,
    setIsSavingZones,
    setIsZoneMenuOpen,
    setIsMapMenuOpen: workflowEdits.setIsMapMenuOpen,
    isRosEnabledRef,
    rosClientRef,
    onNotify,
  });

  const endpointActions = useWorkflowEndpointActions({
    endpoints,
    setEndpoints,
    endpointsRef,
    selectedEndpoint,
    setSelectedEndpoint,
    setSelectedZone,
    setIsEndpointEditMode,
    setIsEndpointMenuOpen,
    setIsMapMenuOpen: workflowEdits.setIsMapMenuOpen,
    setHasUnsavedEndpoints,
    setIsSavingEndpoints,
    robotPose,
    isRosEnabledRef,
    rosClientRef,
    onNotify,
  });

  const pointerHandlers = useWorkflowCanvasPointer({
    baseWidth: BASE_VB_WIDTH,
    baseHeight: BASE_VB_HEIGHT,
    svgRef,
    zoomScale: zoomPan.zoomScale,
    panOffset: zoomPan.panOffset,
    setPanOffset: zoomPan.setPanOffset,
    isPanning: zoomPan.isPanning,
    setIsPanning: zoomPan.setIsPanning,
    panStartRef: zoomPan.panStartRef,
    getSvgPointFromClient: zoomPan.getSvgPointFromClient,
    zones,
    setZones,
    zonesRef,
    selectedZone,
    setSelectedZone,
    isZoneEditMode,
    dragState,
    setDragState,
    setHasUnsavedZones,
    endpointsRef,
    setEndpoints,
    setSelectedEndpoint,
    setIsEndpointEditMode,
    dragEndpointState,
    setDragEndpointState,
    setHasUnsavedEndpoints,
    wasDraggingRef,
    isRosEnabledRef,
    rosClientRef,
  });

  useWorkflowRosConnection({
    isRosEnabled,
    setIsRosConnected,
    rosClientRef,
    targetTelemetryPoseRef,
    robotPoseRef,
    setRobotPose,
    isRosEnabledRef,
    isRosConnectedRef,
    currentPathRef,
    setCurrentPath,
    stepsRef,
    currentStepIndexRef,
    isPlayingRef,
    setStepProgress,
    setManualNavLabel,
    handleStepFinishRef,
  });

  const activeRobotZone = getActiveSimulatorZone(robotPose.x, robotPose.y, zones);
  const activeStep = isPlaying && currentStepIndex < steps.length ? steps[currentStepIndex] : null;
  const showingIdlePromo = activeWorkflow?.id === 'wf-06-idle-promo' && activeStep?.type === 'SHOW';
  const requestPhase = guestRequestPhase(activeWorkflow?.id, activeStep);
  const isMoving = Boolean(currentPath && currentPath.waypoints && currentPath.waypoints.length > 0);
  const robotStatus = deriveRobotStatus({ activeStep, isMoving, manualNavLabel });
  const activeDetail = deriveActiveStepDetail({ activeStep, manualNavLabel });

  const { handleStepFinish, handleNavigateToGoal } = useWorkflowNavigation({
    timerRef,
    animFrameRef,
    stopSpeakingRef,
    rosClientRef,
    isRosEnabledRef,
    robotPoseRef,
    setRobotPose,
    zonesRef,
    stepsRef,
    isLoopModeRef,
    simSpeedRef,
    currentPathRef,
    setCurrentPath,
    setStepProgress,
    setCurrentStepIndex,
    setIsPlaying,
    setIsPaused,
    setStepRun,
    setZoneAlert,
    setManualNavLabel,
    onNotify,
  });
  handleStepFinishRef.current = handleStepFinish;

  useWorkflowStepExecution({
    isPlaying,
    isPaused,
    activeStep,
    showingIdlePromo,
    simGuestPresent,
    currentStepIndex,
    stepRun,
    selectedWorkflowId,
    requestPhase,
    timerRef,
    animFrameRef,
    zonesRef,
    endpointsRef,
    isMutedRef,
    speakRef,
    robotPoseRef,
    simSpeedRef,
    setIsPlaying,
    setIsPaused,
    setZoneAlert,
    setStepProgress,
    setVisitedSteps,
    onNotify,
    handleStepFinish,
    handleNavigateToGoal,
  });

  const playbackControls = useWorkflowPlaybackControls({
    localWorkflows,
    setLocalWorkflows,
    selectedWorkflowId,
    setSelectedWorkflowId,
    activeWorkflow,
    steps,
    isPlaying,
    setIsPlaying,
    isPaused,
    setIsPaused,
    setCurrentStepIndex,
    setVisitedSteps,
    setStepProgress,
    setCurrentPath,
    currentPathRef,
    setManualNavLabel,
    setGuestRequest,
    setSimGuestPresent,
    simBatteryPercent,
    setRobotPose,
    robotPoseRef,
    endpointsRef,
    zonesRef,
    selectedZone,
    setSelectedZone,
    isZoneEditMode,
    setIsZoneEditMode,
    dragState,
    selectedEndpoint,
    setSelectedEndpoint,
    isEndpointEditMode,
    setIsEndpointEditMode,
    dragEndpointState,
    wasDraggingRef,
    timerRef,
    animFrameRef,
    stopSpeakingRef,
    rosClientRef,
    setZoneAlert,
    getSvgPointFromClient: zoomPan.getSvgPointFromClient,
    handleStepFinish,
    handleNavigateToGoal,
    onNotify,
    onClose,
  });

  return (
    <div className="flex flex-col h-full w-full overflow-hidden select-none" style={{ backgroundColor: '#F2EFE9' }}>
      <div
        className="relative z-20 min-h-14 px-3 sm:px-5 py-2 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 select-none"
        style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
      >
        <WorkflowToolbarScenarioAndMap
          rc={rc}
          {...workflowEdits}
          zones={zones}
          showZones={showZones}
          setShowZones={setShowZones}
          selectedZone={selectedZone}
          isZoneEditMode={isZoneEditMode}
          setIsZoneEditMode={setIsZoneEditMode}
          hasUnsavedZones={hasUnsavedZones}
          isSavingZones={isSavingZones}
          {...zoneActions}
          endpoints={endpoints}
          selectedEndpoint={selectedEndpoint}
          hasUnsavedEndpoints={hasUnsavedEndpoints}
          isSavingEndpoints={isSavingEndpoints}
          {...endpointActions}
          handleStopSim={playbackControls.handleStopSim}
        />
        <WorkflowToolbarPlaybackAndSteps
          rc={rc}
          {...workflowEdits}
          currentStepIndex={currentStepIndex}
          isPlaying={isPlaying}
          isPaused={isPaused}
          stepProgress={stepProgress}
          visitedSteps={visitedSteps}
          endpoints={endpoints}
          activeStep={activeStep}
          activeDetail={activeDetail}
          handleStartSim={playbackControls.handleStartSim}
          handlePauseSim={playbackControls.handlePauseSim}
          handleStopSim={playbackControls.handleStopSim}
          handleNextStep={playbackControls.handleNextStep}
          handleReset={playbackControls.handleReset}
        />
        <WorkflowToolbarOptions
          rc={rc}
          simSpeed={simSpeed}
          setSimSpeed={setSimSpeed}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          isLoopMode={isLoopMode}
          setIsLoopMode={setIsLoopMode}
          isLoopModeRef={isLoopModeRef}
          simBatteryPercent={simBatteryPercent}
          setSimBatteryPercent={setSimBatteryPercent}
          isRosEnabled={isRosEnabled}
          setIsRosEnabled={setIsRosEnabled}
          isRosConnected={isRosConnected}
          {...workflowEdits}
          handleDispatchToRobot={playbackControls.handleDispatchToRobot}
          onClose={onClose}
          onNotify={onNotify}
        />
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <main
          className="flex-1 w-full h-full relative p-0 sm:p-1 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: '#F2EFE9' }}
        >
          <WorkflowViewportOverlays
            rc={rc}
            language={language}
            guestRequest={guestRequest}
            setGuestRequest={setGuestRequest}
            activeWorkflow={activeWorkflow}
            isPaused={isPaused}
            simSpeed={simSpeed}
            stepProgress={stepProgress}
            stepRun={stepRun}
            simBatteryPercent={simBatteryPercent}
            simGuestPresent={simGuestPresent}
            setSimGuestPresent={setSimGuestPresent}
            robotPose={robotPose}
            selectedZone={selectedZone}
            zoneAlert={zoneAlert}
            setZoneAlert={setZoneAlert}
            zoomScale={zoomPan.zoomScale}
            handleZoomIn={zoomPan.handleZoomIn}
            handleZoomOut={zoomPan.handleZoomOut}
            handleResetZoom={zoomPan.handleResetZoom}
            isZoneEditMode={isZoneEditMode}
            activeRobotZone={activeRobotZone}
            activeStep={activeStep}
            showingIdlePromo={showingIdlePromo}
            requestPhase={requestPhase}
            handleStepFinish={handleStepFinish}
            batteryStatusText={playbackControls.batteryStatusText}
            handleStopSim={playbackControls.handleStopSim}
          />
          <WorkflowFloorPlanSvg
            svgRef={svgRef}
            dynamicViewBox={zoomPan.viewBoxString}
            handleMapClick={playbackControls.handleMapClick}
            handleWheelZoom={zoomPan.handleWheelZoom}
            {...pointerHandlers}
            isPanning={zoomPan.isPanning}
            dragState={dragState}
            isZoneEditMode={isZoneEditMode}
            setIsZoneEditMode={setIsZoneEditMode}
            selectedZone={selectedZone}
            setSelectedZone={setSelectedZone}
            currentPath={currentPath}
            zones={zones}
            showZones={showZones}
            endpoints={endpoints}
            selectedEndpoint={selectedEndpoint}
            setSelectedEndpoint={setSelectedEndpoint}
            hoveredEndpointId={hoveredEndpointId}
            setHoveredEndpointId={setHoveredEndpointId}
            setIsEndpointEditMode={setIsEndpointEditMode}
            dragEndpointState={dragEndpointState}
            handleNavigateToGoal={handleNavigateToGoal}
            robotPose={robotPose}
            isMoving={isMoving}
            robotStatus={robotStatus}
            onNotify={onNotify}
          />
          <WorkflowEditFloatingBars
            selectedZone={selectedZone}
            setSelectedZone={setSelectedZone}
            setIsZoneEditMode={setIsZoneEditMode}
            hasUnsavedZones={hasUnsavedZones}
            isSavingZones={isSavingZones}
            {...zoneActions}
            selectedEndpoint={selectedEndpoint}
            setSelectedEndpoint={setSelectedEndpoint}
            setIsEndpointEditMode={setIsEndpointEditMode}
            {...endpointActions}
            handleNavigateToGoal={handleNavigateToGoal}
          />
        </main>
      </div>
    </div>
  );
};

export default WorkflowSimulatorStudio;

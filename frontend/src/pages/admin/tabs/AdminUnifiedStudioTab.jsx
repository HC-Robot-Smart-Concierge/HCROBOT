import React, { useState } from 'react';
import { LidarCanvas } from '../../../components/admin/LidarCanvas';
import {
  isPointInZone,
  CONCIERGE_ZONE_TEMPLATES,
  getZoneTemplateInfo,
  CONCIERGE_ENDPOINT_TEMPLATES,
  OTTO_ENDPOINT_TEMPLATES,
  getEndpointTemplateInfo,
  INITIAL_GRID_METADATA,
  INITIAL_ENDPOINT_FORM,
  INITIAL_ZONE_FORM,
} from './unifiedStudioTemplates';
import { runWorkflowMapSimulation } from './unifiedStudioSimulation';
import { useUnifiedStudioTelemetry } from './useUnifiedStudioTelemetry';
import { useUnifiedStudioCrudHandlers } from './useUnifiedStudioCrudHandlers';
import { AdminUnifiedStudioHeader } from './AdminUnifiedStudioHeader';
import { AdminUnifiedStudioMapOverlays } from './AdminUnifiedStudioMapOverlays';
import { AdminUnifiedStudioFloatingPanel } from './AdminUnifiedStudioFloatingPanel';
import { AdminUnifiedStudioEndpointModals } from './AdminUnifiedStudioEndpointModals';
import { AdminUnifiedStudioZoneModal } from './AdminUnifiedStudioZoneModal';

export {
  isPointInZone,
  CONCIERGE_ZONE_TEMPLATES,
  getZoneTemplateInfo,
  CONCIERGE_ENDPOINT_TEMPLATES,
  OTTO_ENDPOINT_TEMPLATES,
  getEndpointTemplateInfo,
};

export const AdminUnifiedStudioTab = ({ onSwitchToCamera }) => {
  const [workflows, setWorkflows] = useState([]);
  const [activeWf, setActiveWf] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [keepOutZones, setKeepOutZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);

  const [scanPoints, setScanPoints] = useState([]);
  const [gridData, setGridData] = useState([]);
  const [gridMetadata, setGridMetadata] = useState(INITIAL_GRID_METADATA);
  const [robotPose, setRobotPose] = useState({ x: 0.0, y: 0.0, yaw: 0.0, battery: 98 });

  const [isPinMode, setIsPinMode] = useState(false);
  const [isEndpointModalOpen, setIsEndpointModalOpen] = useState(false);
  const [endpointModalMode, setEndpointModalMode] = useState('CREATE');
  const [endpointFormData, setEndpointFormData] = useState(INITIAL_ENDPOINT_FORM);

  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [zoneModalMode, setZoneModalMode] = useState('CREATE');
  const [zoneFormData, setZoneFormData] = useState(INITIAL_ZONE_FORM);

  const [templateFilter, setTemplateFilter] = useState('ALL');
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [highlightedWpId, setHighlightedWpId] = useState(null);
  const [sideTab, setSideTab] = useState('workflow');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [isRenameWfModalOpen, setIsRenameWfModalOpen] = useState(false);
  const [newWfName, setNewWfName] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(-1);
  const [simLogs, setSimLogs] = useState([]);
  const [notification, setNotification] = useState('');

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  const {
    syncZonesToRos,
    isWsConnected,
    isScanning360,
    showTeleopPad,
    setShowTeleopPad,
    handleResetGridMap,
    handleScan360,
    handleTeleop,
    handleCanvasClickGoal,
  } = useUnifiedStudioTelemetry({
    showNotification,
    setRobotPose,
    setScanPoints,
    setGridMetadata,
    setGridData,
  });

  const {
    handleOpenAddEndpointModal,
    handleOpenEditEndpointModal,
    handleCanvasClickPin,
    handleSelectWaypointFromMap,
    handleSaveEndpoint,
    handleOpenDeleteConfirm,
    handleConfirmDelete,
    handleOpenAddZoneModal,
    handleOpenEditZoneModal,
    handleSelectZoneFromMap,
    handleSaveZone,
    handleDeleteZone,
    handleCancelDelete,
    handleAddWaypointToWorkflow,
    handleAddStep,
    handleRemoveStep,
    handleMoveStep,
    handleSaveCurrentWorkflow,
    handleOpenRenameModal,
    handleSaveRenameWorkflow,
    handleCreateNewWorkflow,
  } = useUnifiedStudioCrudHandlers({
    workflows,
    setWorkflows,
    activeWf,
    setActiveWf,
    setWaypoints,
    setKeepOutZones,
    selectedZone,
    setSelectedZone,
    selectedWaypoint,
    setSelectedWaypoint,
    highlightedWpId,
    setHighlightedWpId,
    robotPose,
    setIsPinMode,
    isEndpointModalOpen,
    setIsEndpointModalOpen,
    endpointModalMode,
    setEndpointModalMode,
    endpointFormData,
    setEndpointFormData,
    setIsZoneModalOpen,
    zoneModalMode,
    setZoneModalMode,
    zoneFormData,
    setZoneFormData,
    deleteConfirmTarget,
    setDeleteConfirmTarget,
    setIsRenameWfModalOpen,
    newWfName,
    setNewWfName,
    syncZonesToRos,
    showNotification,
  });

  const handleStartSimulation = () => runWorkflowMapSimulation({
    activeWf,
    waypoints,
    robotPose,
    setIsSimulating,
    setSimLogs,
    setSimStepIndex,
    setHighlightedWpId,
    setRobotPose,
    showNotification,
  });

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none" style={{ backgroundColor: '#F2EFE9', color: '#94A3B8' }}>
      <AdminUnifiedStudioHeader
        isWsConnected={isWsConnected}
        activeWf={activeWf}
        notification={notification}
        handleResetGridMap={handleResetGridMap}
        handleScan360={handleScan360}
        isScanning360={isScanning360}
        showTeleopPad={showTeleopPad}
        setShowTeleopPad={setShowTeleopPad}
        isPinMode={isPinMode}
        setIsPinMode={setIsPinMode}
        handleOpenAddZoneModal={handleOpenAddZoneModal}
        handleStartSimulation={handleStartSimulation}
        isSimulating={isSimulating}
        isPanelOpen={isPanelOpen}
        setIsPanelOpen={setIsPanelOpen}
      />

      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        <div className="w-full h-full relative overflow-hidden flex flex-col">
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
              selectedZoneId={selectedZone?.id}
              onCanvasClickGoal={handleCanvasClickGoal}
              onCanvasClickWaypointPin={handleCanvasClickPin}
              onSelectWaypoint={handleSelectWaypointFromMap}
              onSelectZone={handleSelectZoneFromMap}
              onResetMap={handleResetGridMap}
              onScan360={handleScan360}
              isPinMode={isPinMode}
              showGridMap={true}
              showGridLines={true}
              showScanRays={true}
              showWaypoints={true}
            />

            <AdminUnifiedStudioMapOverlays
              showTeleopPad={showTeleopPad}
              setShowTeleopPad={setShowTeleopPad}
              handleTeleop={handleTeleop}
              selectedWaypoint={selectedWaypoint}
              handleCanvasClickGoal={handleCanvasClickGoal}
              handleOpenEditEndpointModal={handleOpenEditEndpointModal}
              handleAddWaypointToWorkflow={handleAddWaypointToWorkflow}
              handleOpenDeleteConfirm={handleOpenDeleteConfirm}
              selectedZone={selectedZone}
              handleOpenEditZoneModal={handleOpenEditZoneModal}
              handleDeleteZone={handleDeleteZone}
            />

            <AdminUnifiedStudioFloatingPanel
              isPanelOpen={isPanelOpen}
              setIsPanelOpen={setIsPanelOpen}
              workflows={workflows}
              activeWf={activeWf}
              setActiveWf={setActiveWf}
              handleCreateNewWorkflow={handleCreateNewWorkflow}
              handleOpenRenameModal={handleOpenRenameModal}
              handleSaveCurrentWorkflow={handleSaveCurrentWorkflow}
              sideTab={sideTab}
              setSideTab={setSideTab}
              waypoints={waypoints}
              keepOutZones={keepOutZones}
              handleAddStep={handleAddStep}
              handleMoveStep={handleMoveStep}
              handleRemoveStep={handleRemoveStep}
              simStepIndex={simStepIndex}
              setHighlightedWpId={setHighlightedWpId}
              simLogs={simLogs}
              templateFilter={templateFilter}
              setTemplateFilter={setTemplateFilter}
              selectedWaypoint={selectedWaypoint}
              highlightedWpId={highlightedWpId}
              selectedZone={selectedZone}
              handleOpenAddEndpointModal={handleOpenAddEndpointModal}
              handleSelectWaypointFromMap={handleSelectWaypointFromMap}
              handleCanvasClickGoal={handleCanvasClickGoal}
              handleAddWaypointToWorkflow={handleAddWaypointToWorkflow}
              handleOpenEditEndpointModal={handleOpenEditEndpointModal}
              handleOpenDeleteConfirm={handleOpenDeleteConfirm}
              handleOpenAddZoneModal={handleOpenAddZoneModal}
              handleSelectZoneFromMap={handleSelectZoneFromMap}
              handleOpenEditZoneModal={handleOpenEditZoneModal}
              handleDeleteZone={handleDeleteZone}
            />
          </div>

          <div
            className="h-8 border-t px-4 shrink-0 flex items-center justify-between text-[11px] font-mono"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#CBD5E1', color: '#8C8C8C' }}
          >
            <div className="flex items-center gap-4">
              <span>X: <strong style={{ color: '#94A3B8' }}>{Number(robotPose.x).toFixed(2)}m</strong></span>
              <span>Y: <strong style={{ color: '#94A3B8' }}>{Number(robotPose.y).toFixed(2)}m</strong></span>
              <span>YAW: <strong style={{ color: '#94A3B8' }}>{Number(robotPose.yaw).toFixed(0)}°</strong></span>
              <span>PIN: <strong style={{ color: '#94A3B8' }}>{robotPose.battery}%</strong></span>
            </div>
            <span>CHẾ ĐỘ TÍCH HỢP BẢN ĐỒ &amp; WORKFLOWS</span>
          </div>
        </div>
      </div>

      <AdminUnifiedStudioEndpointModals
        isEndpointModalOpen={isEndpointModalOpen}
        setIsEndpointModalOpen={setIsEndpointModalOpen}
        endpointModalMode={endpointModalMode}
        endpointFormData={endpointFormData}
        setEndpointFormData={setEndpointFormData}
        robotPose={robotPose}
        handleSaveEndpoint={handleSaveEndpoint}
        handleOpenDeleteConfirm={handleOpenDeleteConfirm}
        deleteConfirmTarget={deleteConfirmTarget}
        handleCancelDelete={handleCancelDelete}
        handleConfirmDelete={handleConfirmDelete}
        isRenameWfModalOpen={isRenameWfModalOpen}
        setIsRenameWfModalOpen={setIsRenameWfModalOpen}
        newWfName={newWfName}
        setNewWfName={setNewWfName}
        handleSaveRenameWorkflow={handleSaveRenameWorkflow}
      />

      <AdminUnifiedStudioZoneModal
        isZoneModalOpen={isZoneModalOpen}
        setIsZoneModalOpen={setIsZoneModalOpen}
        zoneModalMode={zoneModalMode}
        zoneFormData={zoneFormData}
        setZoneFormData={setZoneFormData}
        handleSaveZone={handleSaveZone}
      />
    </div>
  );
};

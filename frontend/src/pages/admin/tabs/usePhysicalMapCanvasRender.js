import { useEffect } from 'react';
import { mapFrame, wheelZoomFactor, zoomViewAt } from './physicalMapView';
import { drawPhysicalMapBaseLayers } from './physicalMapDrawBase';
import { drawPhysicalMapEntities } from './physicalMapDrawEntities';

export function usePhysicalMapCanvasRender({
  canvasRef, canvasSize, connectionMode, costmapRef, costmapVersion, endpoints, hoveredEndpointId, invertHeading, isNavigating, mapConfig, mapImage, navPath, navigatingEndpointId, navigationRef, poseDraft, robotPose, scanPoints, selectedEndpoint, selectedGoal, selectedZone, selectedZoneVertex, setMapView, showCostmap, showEndpoints, showLaserRays, showLaserScan, showZones, t, trail, viewConfig, viewConfigRef, worldToCanvas, zoneDraft, zoneEdgeHover, zones,
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const { scale, offsetX, offsetY, roomW, roomH } = mapFrame(width, height, viewConfig);

    drawPhysicalMapBaseLayers({ costmapRef, ctx, height, mapConfig, mapImage, offsetX, offsetY, robotPose, roomH, roomW, scale, selectedZone, selectedZoneVertex, showCostmap, showZones, t, viewConfig, width, worldToCanvas, zoneDraft, zoneEdgeHover, zones });
    drawPhysicalMapEntities({ ctx, endpoints, height, hoveredEndpointId, invertHeading, isNavigating, navPath, navigatingEndpointId, navigationRef, poseDraft, robotPose, scale, scanPoints, selectedEndpoint, selectedGoal, showEndpoints, showLaserRays, showLaserScan, trail, width, worldToCanvas });
  }, [
    mapImage,
    mapConfig,
    showCostmap,
    costmapVersion,
    connectionMode,
    robotPose,
    scanPoints,
    showLaserScan,
    showLaserRays,
    showZones,
    showEndpoints,
    trail,
    selectedGoal,
    navPath,
    endpoints,
    zones,
    selectedEndpoint,
    selectedZone,
    selectedZoneVertex,
    zoneEdgeHover,
    invertHeading,
    poseDraft,
    worldToCanvas,
    isNavigating,
    navigatingEndpointId,
    hoveredEndpointId,
    zoneDraft,
    canvasSize,
    viewConfig,
  ]);


  // Lan chuot tren map = zoom quanh con tro. Gan listener thuong (passive: false) vi onWheel cua
  // React la passive -> khong chan duoc cuon trang.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const factor = wheelZoomFactor(e.deltaY, e.deltaMode);
      setMapView((v) => zoomViewAt(v, factor, mx, my, canvas.width, canvas.height, viewConfigRef.current));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

}

import { useEffect } from 'react';
import { createZoneSyncMsg } from '../../../services/rosbridgeService';
import { fetchWaypoints, fetchZones, listMapLayouts, fetchMapLayoutImage } from '../../../services/workflowApi';
import { fitCanvasSize, savePanelState } from './physicalMapPanel';
import { DEFAULT_VIEW, clampView } from './physicalMapView';
import {
  LAYOUT2_CONFIG,
  SELECTED_MAP_STORAGE_KEY,
  layoutToMapConfig,
  DEFAULT_LAB_WAYPOINTS,
  DEFAULT_LAB_ZONES,
} from './physicalMapConstants';

export function usePhysicalMapLayoutLoader({
  canvasHostRef, canvasSize, clickStartRef, handleStopRef, hasUnsavedEndpoints, hasUnsavedZones, isRosConnected, localizationRef, mapConfig, mapLayouts, panel, rosClientRef, setCanvasSize, setDragState, setEndpoints, setHasUnsavedEndpoints, setHasUnsavedZones, setIsAddEndpointMode, setLocalizationReady, setMapConfig, setMapImage, setMapLayouts, setMapView, setNavPath, setNavStatus, setNavigatingEndpointId, setPoseDraft, setSelectedEndpoint, setSelectedGoal, setSelectedZone, setSelectedZoneVertex, setTrail, setZoneDraft, setZoneDrawType, setZoneEdgeHover, setZones, zoneEditRef, zones,
}) {
  const handleStop = (...args) => handleStopRef.current?.(...args);

  useEffect(() => {
    savePanelState(panel);
  }, [panel]);

  // Canvas map gian theo khung chua (truoc day co dinh 850 x 560, toi da 960 x 640 px)

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const next = fitCanvasSize(entry.contentRect.width, entry.contentRect.height);
      setCanvasSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMapView(DEFAULT_VIEW);
    setZoneDrawType(null);
    setZoneDraft(null);
    setDragState(null);
    setSelectedZoneVertex(null);
    setZoneEdgeHover(null);
    zoneEditRef.current = null;
    clickStartRef.current = null;
  }, [mapConfig.mapId]);
  useEffect(() => {
    setMapView((v) => clampView(v, canvasSize.width, canvasSize.height, mapConfig));
  }, [canvasSize, mapConfig]);

  // Danh sach map SLAM da luu (robot/maps/*.yaml) cho o chon map
  useEffect(() => {
    let isMounted = true;
    listMapLayouts()
      .then((layouts) => {
        if (!isMounted) return;
        setMapLayouts(layouts);
        const storedId = localStorage.getItem(SELECTED_MAP_STORAGE_KEY);
        const stored = layouts.find((m) => m.map_id === storedId);
        if (stored) setMapConfig(layoutToMapConfig(stored));
      })
      .catch((err) => console.warn('[AdminPhysicalMapTab] Failed to list map layouts:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectMap = (mapId) => {
    if (mapId === mapConfig.mapId) return;
    if (
      (hasUnsavedEndpoints || hasUnsavedZones) &&
      !window.confirm('Điểm mốc / vùng của map hiện tại chưa lưu. Vẫn chuyển map và bỏ thay đổi?')
    ) {
      return;
    }
    const layout = mapLayouts.find((m) => m.map_id === mapId);
    if (!layout) return;
    localStorage.setItem(SELECTED_MAP_STORAGE_KEY, mapId);
    handleStop();
    localizationRef.current = { mapId: null, requestedAt: 0, confirmed: false };
    setLocalizationReady(false);
    setMapConfig(layoutToMapConfig(layout));
    setSelectedEndpoint(null);
    setSelectedZone(null);
    setSelectedGoal(null);
    setNavigatingEndpointId(null);
    setIsAddEndpointMode(false);
    setNavPath([]);
    setPoseDraft(null);
    setTrail([]);
    setHasUnsavedEndpoints(false);
    setHasUnsavedZones(false);
    setNavStatus(`Đã chuyển sang bản đồ "${layout.name}"`);
  };

  // Nap anh map + diem moc / vung cua map dang chon
  useEffect(() => {
    let isMounted = true;
    const mapId = mapConfig.mapId;
    const isLegacy = mapId === LAYOUT2_CONFIG.mapId;
    setMapImage(null);
    setEndpoints(isLegacy ? DEFAULT_LAB_WAYPOINTS : []);
    setZones(isLegacy ? DEFAULT_LAB_ZONES : []);

    fetchMapLayoutImage(mapId)
      .then((img) => {
        if (isMounted) setMapImage(img);
      })
      .catch((err) => {
        console.warn(`[AdminPhysicalMapTab] Failed to load map image "${mapId}":`, err);
        if (!isLegacy) return;
        // Du phong khi backend chua chay: anh tinh layout2.png trong frontend/public
        const img = new Image();
        img.src = '/maps/layout2.png';
        img.onload = () => {
          if (isMounted) setMapImage(img);
        };
      });

    const loadData = async () => {
      if (isLegacy) {
        try {
          // Diem moc mac dinh di kem layout2.json
          const res = await fetch('/maps/layout2.json');
          if (res.ok) {
            const data = await res.json();
            if (isMounted && Array.isArray(data.waypoints) && data.waypoints.length > 0) {
              setEndpoints(data.waypoints);
            }
            if (isMounted && Array.isArray(data.zones) && data.zones.length > 0) {
              setZones(data.zones);
            }
          }
        } catch (err) {
          console.warn('[AdminPhysicalMapTab] Failed to fetch /maps/layout2.json:', err);
        }
      }

      // Dong bo tu CSDL, chi lay diem / vung thuoc map dang chon.
      // layout2 giu mac dinh neu CSDL rong; map moi thi danh sach rong la dung.
      try {
        const dbWps = await fetchWaypoints(mapId);
        if (isMounted && Array.isArray(dbWps) && (dbWps.length > 0 || !isLegacy)) {
          setEndpoints(dbWps);
        }
      } catch (e) {
        // Giu danh sach hien tai neu API loi
      }

      try {
        const dbZones = await fetchZones(mapId);
        if (isMounted && Array.isArray(dbZones) && (dbZones.length > 0 || !isLegacy)) {
          setZones(dbZones);
        }
      } catch (e) {
        // Giu danh sach hien tai neu API loi
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [mapConfig.mapId]);

  // Nav2's map-specific keepout mask is updated when zones are saved below.
  useEffect(() => {
    if (!rosClientRef.current?.isConnected) return undefined;
    const timer = setTimeout(() => {
      rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(zones));
    }, 400);
    return () => clearTimeout(timer);
  }, [zones, isRosConnected]);


  return { handleSelectMap };
}

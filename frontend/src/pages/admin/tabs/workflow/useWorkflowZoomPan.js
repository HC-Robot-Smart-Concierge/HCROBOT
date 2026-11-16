import { useState, useRef, useCallback, useMemo } from 'react';

/**
 * Custom hook quản lý trạng thái Zoom & Pan cho sơ đồ Floor Plan SVG trong Workflow Simulator Studio.
 * Hỗ trợ thu phóng mượt mà, kéo thả lia bản đồ, và chuyển đổi tọa độ chuột Client sang tọa độ SVG ViewBox.
 */
export function useWorkflowZoomPan({
  baseWidth = 496,
  baseHeight = 321,
  centerX = 280,
  centerY = 192.5,
  minZoom = 0.75,
  maxZoom = 2.5,
  svgRef,
} = {}) {
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, initialPan: { x: 0, y: 0 } });

  const handleZoomIn = useCallback(() => {
    setZoomScale((prev) => Math.min(maxZoom, Number((prev + 0.25).toFixed(2))));
  }, [maxZoom]);

  const handleZoomOut = useCallback(() => {
    setZoomScale((prev) => Math.max(minZoom, Number((prev - 0.25).toFixed(2))));
  }, [minZoom]);

  const handleResetZoom = useCallback(() => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleWheelZoom = useCallback(
    (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoomScale((prev) => Math.max(minZoom, Math.min(maxZoom, Number((prev + zoomDelta).toFixed(2)))));
    },
    [minZoom, maxZoom]
  );

  const getSvgPointFromClient = useCallback(
    (clientX, clientY) => {
      const svg = svgRef?.current;
      if (!svg) return { x: centerX, y: centerY };
      if (typeof svg.createSVGPoint === 'function' && svg.getScreenCTM) {
        try {
          const ctm = svg.getScreenCTM();
          if (ctm) {
            const pt = svg.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const p = pt.matrixTransform(ctm.inverse());
            return { x: p.x, y: p.y };
          }
        } catch {
          // Fallback bên dưới
        }
      }
      const rect = svg.getBoundingClientRect();
      const relX = (clientX - rect.left) / (rect.width || 1);
      const relY = (clientY - rect.top) / (rect.height || 1);
      const vbW = baseWidth / zoomScale;
      const vbH = baseHeight / zoomScale;
      const vbX = centerX - vbW / 2 - panOffset.x;
      const vbY = centerY - vbH / 2 - panOffset.y;
      return {
        x: vbX + relX * vbW,
        y: vbY + relY * vbH,
      };
    },
    [baseWidth, baseHeight, centerX, centerY, zoomScale, panOffset, svgRef]
  );

  const currentVbWidth = baseWidth / zoomScale;
  const currentVbHeight = baseHeight / zoomScale;
  const currentVbX = centerX - currentVbWidth / 2 - panOffset.x;
  const currentVbY = centerY - currentVbHeight / 2 - panOffset.y;
  const viewBoxString = useMemo(
    () => `${currentVbX} ${currentVbY} ${currentVbWidth} ${currentVbHeight}`,
    [currentVbX, currentVbY, currentVbWidth, currentVbHeight]
  );

  return {
    zoomScale,
    setZoomScale,
    panOffset,
    setPanOffset,
    isPanning,
    setIsPanning,
    panStartRef,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleWheelZoom,
    getSvgPointFromClient,
    currentVbWidth,
    currentVbHeight,
    currentVbX,
    currentVbY,
    viewBoxString,
  };
}


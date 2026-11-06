import React from 'react';

// Use the same rectangle as meterToSvg so telemetry and waypoints stay aligned.
export function LobbyFloorPlan() {
  return (
    <image href="/maps/3.png" x="35" y="35" width="490" height="315"
      preserveAspectRatio="none" pointerEvents="none" />
  );
}

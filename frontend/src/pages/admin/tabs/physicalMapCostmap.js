// Lop costmap Nav2 (/global_costmap/costmap, nav_msgs/OccupancyGrid) ve chong len Ban Do Vat Ly.
// Gia tri o: 0 = trong, 1..98 = vung noi (inflation, cang gan vat can cang cao),
// 99 = sat vat can (inscribed), 100 = vat can / vung cam (keepout), -1 = chua biet.

// Mau RGBA (0..255) cho mot o costmap; alpha 0 = khong ve.
export const costmapCellColor = (value) => {
  if (value == null || value <= 0) return [0, 0, 0, 0];
  if (value >= 99) return [239, 68, 68, 150]; // do: xe cham vao la va cham
  // cam nhat -> cam dam theo muc chi phi
  const alpha = Math.round(25 + (value / 98) * 110);
  return [249, 115, 22, alpha];
};

// Doi message OccupancyGrid thanh du lieu anh RGBA (hang 0 = DINH anh, nguoc voi grid ROS).
export const buildCostmapImage = (msg) => {
  const info = msg?.info;
  const data = msg?.data;
  if (!info || !data || !info.width || !info.height) return null;
  const { width, height, resolution } = info;
  if (data.length < width * height) return null;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let gy = 0; gy < height; gy++) {
    const dstRow = (height - 1 - gy) * width;
    for (let gx = 0; gx < width; gx++) {
      const [r, g, b, a] = costmapCellColor(data[gy * width + gx]);
      if (a === 0) continue;
      const i = (dstRow + gx) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
  return {
    width,
    height,
    resolution,
    originX: info.origin?.position?.x ?? 0,
    originY: info.origin?.position?.y ?? 0,
    rgba,
  };
};

// nav_msgs/Path -> [[x, y], ...] (bo bot diem de ve nhe).
export const pathMsgToPoints = (msg, step = 3) => {
  const poses = Array.isArray(msg?.poses) ? msg.poses : [];
  const pts = [];
  for (let i = 0; i < poses.length; i += step) {
    const p = poses[i]?.pose?.position;
    if (p) pts.push([p.x, p.y]);
  }
  const last = poses[poses.length - 1]?.pose?.position;
  if (last && (pts.length === 0 || pts[pts.length - 1][0] !== last.x || pts[pts.length - 1][1] !== last.y)) {
    pts.push([last.x, last.y]);
  }
  return pts;
};

// Canvas coordinates only: callers project the absolute map vertices first.
export function drawPolygonZone(ctx, points, { color, label, selected = false, selectedVertex = null, edgeHover = null, active = false, draft = false, hover = null }) {
  if (!points.length) return;
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    if (points.length >= 3) ctx.closePath();
  };
  const left = Math.min(...points.map((p) => p.x)), right = Math.max(...points.map((p) => p.x));
  const top = Math.min(...points.map((p) => p.y)), bottom = Math.max(...points.map((p) => p.y));
  ctx.save();
  outline();
  ctx.fillStyle = `${color}${active ? '6B' : '29'}`;
  ctx.fill();
  if (!draft) {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = `${color}48`;
    ctx.lineWidth = 1.2;
    const h = bottom - top;
    for (let x = left - h; x <= right; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + h, bottom);
      ctx.stroke();
    }
    ctx.restore();
  }
  outline();
  ctx.strokeStyle = selected ? '#FFFFFF' : color;
  ctx.lineWidth = selected || draft ? 2.2 : 1.2;
  ctx.setLineDash([6, 4]);
  if (active) { ctx.shadowColor = color; ctx.shadowBlur = 18; }
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (draft && hover) {
    ctx.beginPath();
    ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(hover.x, hover.y);
    if (points.length > 1) ctx.lineTo(points[0].x, points[0].y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (selected && edgeHover) {
    const a = points[edgeHover.edgeIndex], b = points[(edgeHover.edgeIndex + 1) % points.length];
    if (a && b) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 3;
      ctx.stroke();
      const p = edgeHover.point;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 3, p.y);
      ctx.moveTo(p.x, p.y - 3); ctx.lineTo(p.x, p.y + 3);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }
  if (selected || draft) {
    points.forEach((p, index) => {
      const isSelectedVertex = selected && index === selectedVertex;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isSelectedVertex || (draft && index === 0) ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isSelectedVertex ? '#FBBF24' : draft && index === 0 ? '#22D3EE' : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = isSelectedVertex ? '#FFFFFF' : '#0891B2';
      ctx.stroke();
    });
  }
  if (label) {
    // Anchor the label at a real vertex: the bounding-box centre can be outside a concave zone.
    const anchor = points.reduce((a, p) => p.y < a.y ? p : a);
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(anchor.x + 8, anchor.y + 4, ctx.measureText(label).width + 8, 16);
    ctx.fillStyle = selected ? '#FFFFFF' : color;
    ctx.fillText(label, anchor.x + 12, anchor.y + 15);
  }
  ctx.restore();
}

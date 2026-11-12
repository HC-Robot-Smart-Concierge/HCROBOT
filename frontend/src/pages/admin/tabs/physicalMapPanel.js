// Thanh icon ben phai cua tab Physical Map: bam icon de mo popup tuong ung.
// tab=true: nhom quan ly diem moc, vung va lai tay.

export const PANEL_SECTIONS = [
  { key: 'telemetry', label: 'Trạng thái xe' },
  { key: 'nav2', label: 'Nav2 & bản đồ' },
  { key: 'pose', label: 'Vị trí ban đầu' },
  { key: 'WAYPOINTS', label: 'Điểm mốc', tab: true },
  { key: 'ZONES', label: 'Vùng', tab: true },
  { key: 'TELEOP', label: 'Lái tay', tab: true },
];

export const PANEL_STORAGE_KEY = 'hcrobot.physicalMap.panel';
const DEFAULT_PANEL = { open: true, section: 'telemetry' };
const SECTION_KEYS = new Set(PANEL_SECTIONS.map((s) => s.key));

// clicked = key cua icon; null = nut thu gon/mo rong (giu nguyen phan dang chon).
export function nextPanelState(state, clicked) {
  if (clicked == null) return { open: !state.open, section: state.section };
  if (state.open && state.section === clicked) return { open: false, section: clicked };
  return { open: true, section: clicked };
}

// Kich thuoc canvas = dung khung chua (px nguyen); toi thieu 320 x 240 khi khung chua do duoc.
export function fitCanvasSize(width, height) {
  const w = Number.isFinite(width) ? Math.floor(width) : 0;
  const h = Number.isFinite(height) ? Math.floor(height) : 0;
  return { width: Math.max(320, w), height: Math.max(240, h) };
}

export function loadPanelState() {
  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PANEL };
    const data = JSON.parse(raw);
    return {
      open: typeof data?.open === 'boolean' ? data.open : DEFAULT_PANEL.open,
      section: SECTION_KEYS.has(data?.section) ? data.section : DEFAULT_PANEL.section,
    };
  } catch {
    return { ...DEFAULT_PANEL };
  }
}

export function savePanelState(state) {
  try {
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ open: !!state.open, section: state.section }));
  } catch {
    // trinh duyet chan luu tru: bo qua, chi mat phan ghi nho
  }
}

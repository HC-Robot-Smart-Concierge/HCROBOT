import React from 'react';
import { isPolygonZone } from './physicalMapZones';
import { CONCIERGE_ZONE_TEMPLATES, getZoneTemplateInfo } from './unifiedStudioTemplates';

export const AdminUnifiedStudioZoneModal = ({
  isZoneModalOpen,
  setIsZoneModalOpen,
  zoneModalMode,
  zoneFormData,
  setZoneFormData,
  handleSaveZone,
}) => (
  <>
      {/* MODAL: THÊM HOẶC CHỈNH SỬA VÙNG CHỨC NĂNG */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-2xl animate-fadeIn"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#CBD5E1' }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: '#94A3B8' }}>
                  {zoneModalMode === 'EDIT' ? 'Chỉnh Sửa Vùng Chức Năng' : 'Thêm Mới Vùng Chức Năng (Concierge Zone)'}
                </h3>
                <p className="text-[11px] text-stone-500">
                  Cấu hình loại vùng chức năng, kích thước không gian và quy tắc vận hành cho robot sảnh
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsZoneModalOpen(false)}
                className="text-xs font-bold px-2 py-1 rounded border cursor-pointer hover:bg-stone-100"
                style={{ backgroundColor: '#E9E5DC', borderColor: '#CBD5E1', color: '#94A3B8' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  TÊN VÙNG CHỨC NĂNG *
                </label>
                <input
                  type="text"
                  required
                  value={zoneFormData.name}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, name: e.target.value })}
                  placeholder="VD: Cầu Thang Bộ B, Khu Giảm Tốc Cửa Sảnh, Silent Area VIP..."
                  className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-stone-400"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  LOẠI VÙNG CHỨC NĂNG *
                </label>
                <select
                  value={zoneFormData.type}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs font-bold border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                >
                  {CONCIERGE_ZONE_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.type} value={tmpl.type}>
                      {tmpl.label}
                    </option>
                  ))}
                </select>
                {(() => {
                  const tmpl = getZoneTemplateInfo(zoneFormData.type);
                  return (
                    <p className="text-[10px] text-stone-500 mt-1 italic">
                      {tmpl.description}
                    </p>
                  );
                })()}
              </div>

              {/* Geometry: X, Y, Width, Height */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                    TỌA ĐỘ X TÂM (MÉT)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    disabled={isPolygonZone(zoneFormData)}
                    value={zoneFormData.x}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, x: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none font-mono"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                    TỌA ĐỘ Y TÂM (MÉT)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    disabled={isPolygonZone(zoneFormData)}
                    value={zoneFormData.y}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, y: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none font-mono"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                    CHIỀU RỘNG WIDTH (MÉT)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    required
                    disabled={isPolygonZone(zoneFormData)}
                    value={zoneFormData.width}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, width: parseFloat(e.target.value) || 1.0 })}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none font-mono"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                    CHIỀU CAO HEIGHT (MÉT)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    required
                    disabled={isPolygonZone(zoneFormData)}
                    value={zoneFormData.height}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, height: parseFloat(e.target.value) || 1.0 })}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none font-mono"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                  />
                </div>
              </div>

              {/* Conditional Field: Speed Limit for SLOW_SPEED */}
              {zoneFormData.type === 'SLOW_SPEED' && (
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                    TỐC ĐỘ GIỚI HẠN TOÀN VÙNG (M/S)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.5"
                    value={zoneFormData.speed_limit || 0.3}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, speed_limit: parseFloat(e.target.value) || 0.3 })}
                    className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none font-mono"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  MÔ TẢ CHI TIẾT
                </label>
                <textarea
                  rows={2}
                  value={zoneFormData.description}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, description: e.target.value })}
                  placeholder="Ghi chú thêm về quy tắc hoạt động của vùng..."
                  className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: '#CBD5E1' }}>
                <button
                  type="button"
                  onClick={() => setIsZoneModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-stone-50"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  {zoneModalMode === 'EDIT' ? 'Lưu Cập Nhật' : 'Tạo Vùng Chức Năng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  </>
);

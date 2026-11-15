import React from 'react';
import { Navigation, Check, Save, Trash2 } from 'lucide-react';
import { isPolygonZone } from '../physicalMapZones';
import { OTTO_ENDPOINT_TEMPLATES, getEndpointTemplateInfo } from '../studio/studioConstants';

/**
 * Floating bottom contextual edit toolbars for the selected safety zone or map endpoint.
 */
export const WorkflowEditFloatingBars = ({
  selectedZone,
  setSelectedZone,
  setIsZoneEditMode,
  hasUnsavedZones,
  isSavingZones,
  handleDeleteZone,
  handleUpdateSelectedZone,
  handleSaveZones,
  selectedEndpoint,
  setSelectedEndpoint,
  setIsEndpointEditMode,
  handleUpdateSelectedEndpoint,
  handleSaveEndpointToDb,
  handleDeleteEndpoint,
  handleNavigateToGoal,
}) => {
  return (
    <>
      {selectedZone && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center flex-nowrap whitespace-nowrap gap-2 px-3.5 py-1.5 rounded-xl border shadow-2xl backdrop-blur-md animate-fadeIn text-xs max-w-[95%] overflow-x-auto select-none"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
        >
          {/* 1. Loai Vung Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                backgroundColor:
                  selectedZone.type === 'KEEP_OUT'
                    ? '#DC2626'
                    : selectedZone.type === 'SPEED_ZONE' || selectedZone.type === 'SLOW_SPEED'
                    ? '#D97706'
                    : '#E11D48',
              }}
            />
            <select
              value={
                selectedZone.type === 'SLOW_SPEED' ? 'SPEED_ZONE' : selectedZone.type || 'KEEP_OUT'
              }
              onChange={(e) => handleUpdateSelectedZone('type', e.target.value)}
              className="px-2 py-1 rounded-lg font-bold text-[11px] border focus:outline-none cursor-pointer"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
            >
              <option value="KEEP_OUT">Cấm vào (Keep-Out)</option>
              <option value="SPEED_ZONE">Giới hạn tốc độ (Speed Zone)</option>
              <option value="NO_STOP">Cấm dừng (No-Stop)</option>
            </select>
          </div>

          {/* 2. Sua Ten Vung Inline */}
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="text"
              value={selectedZone.name || ''}
              onChange={(e) => handleUpdateSelectedZone('name', e.target.value)}
              placeholder="Tên vùng..."
              className="w-36 sm:w-44 px-2 py-1 rounded-lg text-xs font-semibold border focus:outline-none"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
            />
          </div>

          {/* 3. Neu la Speed Zone: Cho sua van toc toi da */}
          {(selectedZone.type === 'SPEED_ZONE' || selectedZone.type === 'SLOW_SPEED') && (
            <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
              <span className="text-[#8C8C8C]">Tối đa:</span>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="1.0"
                value={selectedZone.speed_limit || 0.2}
                onChange={(e) => handleUpdateSelectedZone('speed_limit', parseFloat(e.target.value) || 0.2)}
                className="w-14 px-1.5 py-1 rounded-lg text-xs font-bold text-center border focus:outline-none"
                style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#D97706' }}
              />
              <span className="text-[#8C8C8C]">m/s</span>
            </div>
          )}

          {/* 4. Thong so toa do & O nhap kich thuoc truc tiep */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg font-mono text-[10.5px] border shrink-0"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#E9E5DC', color: '#262626' }}
          >
            <span className="text-[#8C8C8C]">Tâm:</span>
            <span className="font-bold">({Number(selectedZone.x).toFixed(1)}m, {Number(selectedZone.y).toFixed(1)}m)</span>
            <span className="text-[#8C8C8C] ml-1">KT:</span>
            <input
              type="number"
              step="0.1"
              min="0.4"
              max="8.0"
              disabled={isPolygonZone(selectedZone)}
              value={selectedZone.width || 2.0}
              onChange={(e) => handleUpdateSelectedZone('width', Math.max(0.3, parseFloat(e.target.value) || 0.4))}
              className="w-12 px-1 py-0.5 rounded text-center font-bold border focus:outline-none"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              title="Chiều rộng vùng (m)"
            />
            <span className="text-[#8C8C8C]">×</span>
            <input
              type="number"
              step="0.1"
              min="0.4"
              max="8.0"
              disabled={isPolygonZone(selectedZone)}
              value={selectedZone.height || 2.0}
              onChange={(e) => handleUpdateSelectedZone('height', Math.max(0.3, parseFloat(e.target.value) || 0.4))}
              className="w-12 px-1 py-0.5 rounded text-center font-bold border focus:outline-none"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              title="Chiều dài vùng (m)"
            />
            <span className="text-[#8C8C8C]">m</span>
          </div>

          {/* 5. Nut Luu Vung nhanh (Pure Icon Button) */}
          <button
            type="button"
            onClick={handleSaveZones}
            disabled={isSavingZones || !hasUnsavedZones}
            className={`p-1.5 rounded-lg border cursor-pointer transition-colors shrink-0 flex items-center justify-center ${
              hasUnsavedZones
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700 animate-pulse'
                : 'bg-[#F2EFE9] text-[#8C8C8C] border-[#BFBFBD] cursor-not-allowed'
            }`}
            title={isSavingZones ? 'Đang lưu cấu hình vùng...' : 'Lưu cấu hình vùng vào CSDL'}
          >
            <Save className={`w-3.5 h-3.5 ${isSavingZones ? 'animate-spin' : ''}`} />
          </button>

          {/* 6. Nut Xoa Vung (Delete Zone) */}
          <button
            type="button"
            onClick={() => handleDeleteZone(selectedZone.id)}
            className="p-1.5 rounded-lg border text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200 cursor-pointer transition-colors shrink-0"
            title="Xóa vùng này khỏi bản đồ"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* 7. Nut Hoan tat / Dong che do sua */}
          <button
            type="button"
            onClick={() => {
              setSelectedZone(null);
              setIsZoneEditMode(false);
            }}
            className="p-1.5 rounded-lg border text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] border-transparent hover:border-[#BFBFBD] cursor-pointer transition-colors shrink-0"
            title="Hoàn tất và đóng thanh chỉnh sửa"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        </div>
      )}

      {/* FLOATING ACTION BAR TINH GON O DUOI DAY SA BAN (EDIT ENDPOINT: DAT TEN, LOAI, TOA DO, DIEN DEN, XOA) */}
      {selectedEndpoint && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center flex-nowrap whitespace-nowrap gap-2 px-3.5 py-1.5 rounded-xl border shadow-2xl backdrop-blur-md animate-fadeIn text-xs max-w-[95%] overflow-x-auto select-none"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
        >
          {/* 1. Loai Endpoint Dropdown (3 Loai Chuan: WAYPOINT, CHARGER, PARK) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: getEndpointTemplateInfo(selectedEndpoint.type).color }}
            />
            <select
              value={selectedEndpoint.type || 'WAYPOINT'}
              onChange={(e) => handleUpdateSelectedEndpoint('type', e.target.value)}
              className="px-2 py-1 rounded-lg font-bold text-[11px] border focus:outline-none cursor-pointer"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
            >
              {OTTO_ENDPOINT_TEMPLATES.map((tmpl) => (
                <option key={tmpl.type} value={tmpl.type}>
                  {tmpl.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Dat ten cho cho do Inline */}
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="text"
              value={selectedEndpoint.name || ''}
              onChange={(e) => handleUpdateSelectedEndpoint('name', e.target.value)}
              onBlur={() => handleSaveEndpointToDb(selectedEndpoint)}
              placeholder="Đặt tên cho chỗ này..."
              className="w-40 sm:w-56 px-2 py-1 rounded-lg text-xs font-semibold border focus:outline-none"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
            />
          </div>

          {/* 3. Thong so toa do realtime */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10.5px] border shrink-0"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#E9E5DC', color: '#262626' }}
          >
            <span className="text-[#8C8C8C]">Tọa độ:</span>
            <span className="font-bold">
              ({Number(selectedEndpoint.x).toFixed(2)}m, {Number(selectedEndpoint.y).toFixed(2)}m)
            </span>
          </div>

          {/* 4. Nut Dieu huong toi day (Pure Icon Button) */}
          <button
            type="button"
            onClick={() => handleNavigateToGoal(selectedEndpoint.x, selectedEndpoint.y, selectedEndpoint.name)}
            className="p-1.5 rounded-lg border text-[#262626] bg-[#F2EFE9] hover:bg-[#FAF8F5] border-[#BFBFBD] cursor-pointer transition-colors shrink-0 flex items-center justify-center"
            title="Điều hướng Robot chạy tới điểm này"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>

          {/* 5. Nut Xoa Endpoint */}
          <button
            type="button"
            onClick={() => handleDeleteEndpoint(selectedEndpoint.id)}
            className="p-1.5 rounded-lg border text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200 cursor-pointer transition-colors shrink-0"
            title="Xóa Endpoint này khỏi bản đồ"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* 6. Nut Hoan tat / Dong che do sua */}
          <button
            type="button"
            onClick={() => {
              handleSaveEndpointToDb(selectedEndpoint);
              setSelectedEndpoint(null);
              setIsEndpointEditMode(false);
            }}
            className="p-1.5 rounded-lg border text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] border-transparent hover:border-[#BFBFBD] cursor-pointer transition-colors shrink-0"
            title="Hoàn tất và đóng thanh chỉnh sửa"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        </div>
      )}
    </>
  );
};

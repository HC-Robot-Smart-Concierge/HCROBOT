import React from 'react';
import { OTTO_ENDPOINT_TEMPLATES, getEndpointTemplateInfo } from './studioConstants';

export const EndpointModal = ({
  isOpen,
  onClose,
  mode,
  formData,
  setFormData,
  onSave,
  robotPose,
  onOpenDeleteConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div
        className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-2xl animate-fadeIn"
        style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
              {mode === 'EDIT' ? 'Chỉnh Sửa Endpoint (Otto Motors)' : 'Thêm Mới Endpoint (Otto Motors)'}
            </h3>
            <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
              Định nghĩa điểm đích chức năng và cấu hình tác vụ thực thi cho Robot
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold px-2 py-1 rounded border cursor-pointer hover:bg-stone-100"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
          >
            Đóng
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-3">
          {/* Tên Endpoint */}
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              TÊN ENDPOINT *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="VD: Quầy Lễ Tân, Trạm Sạc Fast Charger, Bàn VIP 02..."
              className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
            />
          </div>

          {/* Mẫu Endpoint chuẩn Otto */}
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              MẪU ENDPOINT (ENDPOINT TEMPLATE) *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-xs font-bold border focus:outline-none"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
            >
              {OTTO_ENDPOINT_TEMPLATES.map((tmpl) => (
                <option key={tmpl.type} value={tmpl.type}>
                  [{tmpl.badge}] {tmpl.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] mt-1 font-medium text-stone-500">
              {getEndpointTemplateInfo(formData.type).description}
            </p>
          </div>

          {/* Tầng & Tác vụ */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                TẦNG
              </label>
              <select
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                <option value="Tầng 1">Tầng 1</option>
                <option value="Tầng 2">Tầng 2</option>
                <option value="Tầng 3">Tầng 3</option>
                <option value="Tầng 4">Tầng 4</option>
                <option value="Sảnh Chính">Sảnh Chính</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                TÁC VỤ MẶC ĐỊNH (TASKS)
              </label>
              <div
                className="px-2.5 py-2 rounded-lg text-xs font-mono font-bold truncate border"
                style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                title={getEndpointTemplateInfo(formData.type).defaultTasks}
              >
                {getEndpointTemplateInfo(formData.type).defaultTasks}
              </div>
            </div>
          </div>

          {/* Tọa độ Không Gian X, Y, Yaw */}
          <div className="p-3 rounded-lg border space-y-2" style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
                TỌA ĐỘ KHÔNG GIAN THỰC TẾ:
              </span>
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    ...formData,
                    x: Number(robotPose.x.toFixed(2)),
                    y: Number(robotPose.y.toFixed(2)),
                    yaw: Number(robotPose.yaw.toFixed(0)),
                  });
                }}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer hover:bg-stone-200"
                style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
              >
                Lấy vị trí hiện tại Robot
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-stone-500 mb-0.5">X (mét)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.x}
                  onChange={(e) => setFormData({ ...formData, x: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 rounded text-xs font-mono border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-stone-500 mb-0.5">Y (mét)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.y}
                  onChange={(e) => setFormData({ ...formData, y: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 rounded text-xs font-mono border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-stone-500 mb-0.5">Yaw (°)</label>
                <input
                  type="number"
                  step="1"
                  min="-180"
                  max="180"
                  value={formData.yaw}
                  onChange={(e) => setFormData({ ...formData, yaw: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 rounded text-xs font-mono border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                />
              </div>
            </div>
          </div>

          {/* Mô tả / Ghi chú */}
          <div>
            <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
              MÔ TẢ CHI TIẾT
            </label>
            <textarea
              rows="2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ghi chú thêm về quy trình phục vụ hoặc đặc điểm vị trí..."
              className="w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
            />
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#BFBFBD' }}>
            {mode === 'EDIT' ? (
              <button
                type="button"
                onClick={() => {
                  onOpenDeleteConfirm({ id: formData.id, name: formData.name });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-300 text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
              >
                🗑 Xóa Điểm Này
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-stone-100"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
                style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
              >
                {mode === 'EDIT' ? 'Cập Nhật Endpoint' : 'Lưu Endpoint'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

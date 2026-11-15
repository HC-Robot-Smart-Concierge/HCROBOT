import React from 'react';
import { CONCIERGE_ENDPOINT_TEMPLATES, getEndpointTemplateInfo } from './unifiedStudioTemplates';

export const AdminUnifiedStudioEndpointModals = ({
  isEndpointModalOpen,
  setIsEndpointModalOpen,
  endpointModalMode,
  endpointFormData,
  setEndpointFormData,
  robotPose,
  handleSaveEndpoint,
  handleOpenDeleteConfirm,
  deleteConfirmTarget,
  handleCancelDelete,
  handleConfirmDelete,
  isRenameWfModalOpen,
  setIsRenameWfModalOpen,
  newWfName,
  setNewWfName,
  handleSaveRenameWorkflow,
}) => (
  <>
      {/* MODAL: THÊM HOẶC CHỈNH SỬA ENDPOINT THEO CHUẨN OTTO MOTORS */}
      {isEndpointModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-md w-full rounded-2xl border p-6 space-y-4 shadow-2xl animate-fadeIn"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#CBD5E1' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: '#94A3B8' }}>
                  {endpointModalMode === 'EDIT' ? 'Chỉnh Sửa Endpoint (Hotel Concierge)' : 'Thêm Mới Endpoint (Hotel Concierge)'}
                </h3>
                <p className="text-[11px]" style={{ color: '#8C8C8C' }}>
                  Định nghĩa điểm đích chức năng sảnh Tầng 1 và cấu hình tác vụ thực thi cho Robot
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEndpointModalOpen(false)}
                className="text-xs font-bold px-2 py-1 rounded border cursor-pointer hover:bg-stone-100"
                style={{ backgroundColor: '#E9E5DC', borderColor: '#CBD5E1', color: '#94A3B8' }}
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveEndpoint} className="space-y-3">
              {/* Tên Endpoint */}
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  TÊN ENDPOINT *
                </label>
                <input
                  type="text"
                  required
                  value={endpointFormData.name}
                  onChange={(e) => setEndpointFormData({ ...endpointFormData, name: e.target.value })}
                  placeholder="VD: Quầy Lễ Tân, Sảnh Lounge & Coffee, Bàn VIP 01..."
                  className="w-full px-3 py-2 rounded-lg text-xs border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                />
              </div>

              {/* Mẫu Endpoint chuẩn Concierge */}
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  MẪU ENDPOINT (ENDPOINT TEMPLATE) *
                </label>
                <select
                  value={endpointFormData.type}
                  onChange={(e) => setEndpointFormData({ ...endpointFormData, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs font-bold border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                >
                  {CONCIERGE_ENDPOINT_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.type} value={tmpl.type}>
                      {tmpl.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] mt-1 font-medium text-stone-500">
                  {getEndpointTemplateInfo(endpointFormData.type).description}
                </p>
              </div>

              {/* Tác vụ mặc định */}
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  TÁC VỤ MẶC ĐỊNH (TASKS)
                </label>
                <div
                  className="px-3 py-2 rounded-lg text-xs font-mono font-bold truncate border"
                  style={{ backgroundColor: '#F2EFE9', borderColor: '#CBD5E1', color: '#94A3B8' }}
                  title={getEndpointTemplateInfo(endpointFormData.type).defaultTasks}
                >
                  {getEndpointTemplateInfo(endpointFormData.type).defaultTasks}
                </div>
              </div>

              {/* Tọa độ Không Gian X, Y, Yaw */}
              <div className="p-3 rounded-lg border space-y-2" style={{ backgroundColor: '#FAF8F5', borderColor: '#CBD5E1' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
                    TỌA ĐỘ KHÔNG GIAN THỰC TẾ:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEndpointFormData({
                        ...endpointFormData,
                        x: Number(robotPose.x.toFixed(2)),
                        y: Number(robotPose.y.toFixed(2)),
                        yaw: Number(robotPose.yaw.toFixed(0)),
                      });
                    }}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer hover:bg-stone-200"
                    style={{ backgroundColor: '#E9E5DC', borderColor: '#CBD5E1', color: '#94A3B8' }}
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
                      value={endpointFormData.x}
                      onChange={(e) => setEndpointFormData({ ...endpointFormData, x: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded text-xs font-mono border focus:outline-none"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-stone-500 mb-0.5">Y (mét)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={endpointFormData.y}
                      onChange={(e) => setEndpointFormData({ ...endpointFormData, y: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded text-xs font-mono border focus:outline-none"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-stone-500 mb-0.5">Yaw (°)</label>
                    <input
                      type="number"
                      step="1"
                      min="-180"
                      max="180"
                      value={endpointFormData.yaw}
                      onChange={(e) => setEndpointFormData({ ...endpointFormData, yaw: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 rounded text-xs font-mono border focus:outline-none"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
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
                  value={endpointFormData.description}
                  onChange={(e) => setEndpointFormData({ ...endpointFormData, description: e.target.value })}
                  placeholder="Ghi chú thêm về quy trình phục vụ hoặc đặc điểm vị trí..."
                  className="w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#CBD5E1' }}>
                {endpointModalMode === 'EDIT' ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenDeleteConfirm({ id: endpointFormData.id, name: endpointFormData.name });
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
                    onClick={() => setIsEndpointModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-stone-100"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
                    style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                  >
                    {endpointModalMode === 'EDIT' ? 'Cập Nhật Endpoint' : 'Lưu Endpoint'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN XÓA ENDPOINT / WAYPOINT */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className="max-w-sm w-full rounded-2xl border p-5 space-y-4 shadow-2xl animate-fadeIn"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 font-bold text-lg">
                ✕
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: '#94A3B8' }}>
                  Xác Nhận Xóa Điểm Mốc?
                </h4>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  Bạn có chắc chắn muốn xóa vĩnh viễn điểm mốc <strong className="text-stone-900">"{deleteConfirmTarget.name}"</strong>? Điểm này sẽ bị xóa khỏi bản đồ LiDAR và cơ sở dữ liệu.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: '#E9E5DC' }}>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-stone-100"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer transition-colors shadow-sm"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ĐỔI TÊN KỊCH BẢN */}
      {isRenameWfModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-sm w-full rounded-2xl border p-5 space-y-4 shadow-2xl animate-fadeIn"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }}
          >
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: '#CBD5E1' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                Đổi Tên Kịch Bản
              </h3>
              <button
                type="button"
                onClick={() => setIsRenameWfModalOpen(false)}
                className="text-xs font-bold px-2 py-0.5 rounded border cursor-pointer hover:bg-stone-100"
                style={{ backgroundColor: '#E9E5DC', borderColor: '#CBD5E1', color: '#94A3B8' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRenameWorkflow} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                  TÊN KỊCH BẢN MỚI *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newWfName}
                  onChange={(e) => setNewWfName(e.target.value)}
                  placeholder="Nhập tên kịch bản..."
                  className="w-full px-3 py-2 rounded-lg text-xs font-bold border focus:outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: '#CBD5E1' }}>
                <button
                  type="button"
                  onClick={() => setIsRenameWfModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-stone-100"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#8C8C8C' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors"
                  style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#262626' }}
                >
                  Cập Nhật Tên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  </>
);

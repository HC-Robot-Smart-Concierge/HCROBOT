import React, { useState, useEffect } from 'react';
import {
  fetchWorkflows,
  saveWorkflow,
  deleteWorkflow,
  executeWorkflow,
  fetchWaypoints,
} from '../../../services/workflowApi';

// Standard 8 Otto Steps Definition
export const OTTO_STEP_TYPES = [
  {
    type: 'MOVE',
    label: '1. MOVE (Di chuyển vị trí)',
    desc: 'Robot di chuyển tự hành đến điểm mốc Waypoint hoặc tọa độ quy định',
    defaultParams: {
      target_waypoint_id: 'wp-reception',
      waypoint_name: 'Quầy Lễ Tân',
      speed: 0.5,
      timeout_sec: 30,
    },
  },
  {
    type: 'GREET',
    label: '2. GREET (Chào hỏi & Biểu cảm)',
    desc: 'Chủ động chào khách bằng giọng nói, biểu cảm khuôn mặt mỉm cười & đèn LED',
    defaultParams: {
      greeting_text: 'Xin chào quý khách! Welcome to our hotel.',
      face_expression: 'HAPPY_SMILE',
      led_color: 'CYAN',
      enable_language_picker: true,
    },
  },
  {
    type: 'SPEAK',
    label: '3. SPEAK (Phát âm thanh / Đọc thông báo)',
    desc: 'Xuất phản hồi dạng giọng nói TTS qua loa thông báo hoặc hướng dẫn đường đi',
    defaultParams: {
      speech_text: 'Em là Robot Concierge. Em có thể giúp quý khách kiểm tra tiện ích và đặt dịch vụ.',
      voice_speed: 1.0,
      language: 'vi-VN',
    },
  },
  {
    type: 'SHOW',
    label: '4. SHOW (Hiển thị nội dung màn hình)',
    desc: 'Bật thực đơn dịch vụ, poster quảng cáo, hình ảnh nhà hàng, bản đồ tiện ích',
    defaultParams: {
      screen_mode: 'SERVICES_GRID',
      display_banner: 'Dịch vụ nghỉ dưỡng 5 sao & Ẩm thực thượng hạng',
      slide_duration_sec: 10,
    },
  },
  {
    type: 'LISTEN',
    label: '5. LISTEN (Lắng nghe & Ghi nhận)',
    desc: 'Chờ khách nói qua micro hoặc chạm nút chọn trên màn hình cảm ứng',
    defaultParams: {
      input_mode: 'VOICE_AND_TOUCH',
      timeout_sec: 15,
      prompt_hint: 'Quý khách vui lòng chạm màn hình hoặc nói yêu cầu...',
    },
  },
  {
    type: 'RECOMMEND',
    label: '6. RECOMMEND (Gợi ý thông minh)',
    desc: 'Xử lý logic tự động đề xuất món ăn, dịch vụ spa hoặc điểm tham quan',
    defaultParams: {
      recommend_category: 'DINING_AND_SPA',
      ai_suggestion: true,
      highlight_item: 'Set Trà Chiều & Dịch Vụ Spa Tầng 3',
    },
  },
  {
    type: 'CREATE_REQUEST',
    label: '7. CREATE_REQUEST (Khởi tạo yêu cầu dịch vụ)',
    desc: 'Đóng gói phiếu dịch vụ gửi tới bộ phận buồng phòng, gọi taxi, gọi nhân viên',
    defaultParams: {
      target_department: 'Housekeeping',
      ticket_priority: 'Normal',
      fallback_staff: true,
    },
  },
  {
    type: 'FEEDBACK',
    label: '8. FEEDBACK (Thu thập đánh giá)',
    desc: 'Hiện màn hình chấm điểm 1 - 5 sao để đo lường mức độ hài lòng của khách',
    defaultParams: {
      survey_type: '5_STAR_RATING',
      question_text: 'Quý khách có hài lòng với sự phục vụ của Robot không?',
      thank_you_message: 'Cảm ơn quý khách đã đánh giá! Chúc quý khách kỳ nghỉ vui vẻ.',
    },
  },
];

export const AdminWorkflowTab = () => {
  const [workflows, setWorkflows] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Editor State
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Execution / Test Run State
  const [executingWf, setExecutingWf] = useState(null);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [wfList, wpList] = await Promise.all([
        fetchWorkflows(),
        fetchWaypoints(),
      ]);
      setWorkflows(wfList || []);
      setWaypoints(wpList || []);
    } catch {
      showNotification('Lỗi khi tải dữ liệu workflows hoặc waypoints');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingWorkflow({
      id: `wf-${Date.now().toString(36)}`,
      name: 'Kịch bản phục vụ khách mới',
      description: 'Mô tả chu trình hoạt động của robot...',
      trigger_type: 'AUTO_DETECT',
      is_active: true,
      steps: [
        {
          step_id: `step-${Date.now()}-1`,
          type: 'MOVE',
          title: 'Di chuyển lại gần khách tại Sảnh',
          params: { ...OTTO_STEP_TYPES[0].defaultParams },
        },
        {
          step_id: `step-${Date.now()}-2`,
          type: 'GREET',
          title: 'Chào hỏi và biểu cảm',
          params: { ...OTTO_STEP_TYPES[1].defaultParams },
        },
        {
          step_id: `step-${Date.now()}-3`,
          type: 'SPEAK',
          title: 'Phát âm thanh giới thiệu',
          params: { ...OTTO_STEP_TYPES[2].defaultParams },
        },
      ],
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (wf) => {
    setEditingWorkflow(JSON.parse(JSON.stringify(wf)));
    setIsEditorOpen(true);
  };

  const handleSaveWorkflow = async (e) => {
    e.preventDefault();
    if (!editingWorkflow.name.trim()) {
      showNotification('Vui lòng nhập tên kịch bản workflow');
      return;
    }
    try {
      setIsLoading(true);
      await saveWorkflow(editingWorkflow);
      showNotification(`Đã lưu kịch bản "${editingWorkflow.name}" thành công!`);
      setIsEditorOpen(false);
      setEditingWorkflow(null);
      await loadData();
    } catch (err) {
      showNotification('Lỗi khi lưu kịch bản: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkflow = async (id, name) => {
    if (!window.confirm(`Xác nhận xóa kịch bản "${name}"?`)) return;
    try {
      setIsLoading(true);
      await deleteWorkflow(id);
      showNotification(`Đã xóa kịch bản "${name}"`);
      await loadData();
    } catch (err) {
      showNotification('Lỗi khi xóa: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (wf) => {
    try {
      await saveWorkflow({ ...wf, is_active: !wf.is_active });
      await loadData();
    } catch (err) {
      showNotification('Lỗi cập nhật trạng thái: ' + err.message);
    }
  };

  // Step operations
  const handleAddStep = (stepType) => {
    const stepDef = OTTO_STEP_TYPES.find((s) => s.type === stepType);
    if (!stepDef) return;

    const newStep = {
      step_id: `step-${Date.now()}`,
      type: stepDef.type,
      title: stepDef.label,
      params: { ...stepDef.defaultParams },
    };

    setEditingWorkflow({
      ...editingWorkflow,
      steps: [...(editingWorkflow.steps || []), newStep],
    });
  };

  const handleRemoveStep = (index) => {
    const updated = [...editingWorkflow.steps];
    updated.splice(index, 1);
    setEditingWorkflow({ ...editingWorkflow, steps: updated });
  };

  const handleMoveStep = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= editingWorkflow.steps.length) return;
    const updated = [...editingWorkflow.steps];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    setEditingWorkflow({ ...editingWorkflow, steps: updated });
  };

  const handleStepParamChange = (stepIndex, paramKey, val) => {
    const updated = [...editingWorkflow.steps];
    updated[stepIndex] = {
      ...updated[stepIndex],
      params: {
        ...updated[stepIndex].params,
        [paramKey]: val,
      },
    };
    setEditingWorkflow({ ...editingWorkflow, steps: updated });
  };

  // Execute / Test Run Simulator
  const handleTestRun = async (wf) => {
    setExecutingWf(wf);
    setExecutionLogs([]);
    setIsExecuting(true);
    try {
      const res = await executeWorkflow(wf.id, { robot_id: 'RC-001' });
      setExecutionLogs(res.logs || []);
    } catch (err) {
      setExecutionLogs([`[LỖI] Không thể kích hoạt kịch bản: ${err.message}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="w-full flex flex-col p-4 space-y-4 pb-12" style={{ color: '#262626' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          className="fixed top-5 right-5 z-50 px-4 py-2 rounded-lg border text-xs font-semibold shadow-lg"
          style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#BFBFBD' }}
        >
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: '#BFBFBD' }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight" style={{ color: '#262626' }}>
              Quản Lý Chu Trình Nhiệm Vụ Robot (Step Workflows)
            </h2>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold border"
              style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
            >
              HOTEL CONCIERGE CONCEPT
            </span>
          </div>
          <p className="text-[11px] font-normal mt-0.5" style={{ color: '#8C8C8C' }}>
            Thiết lập kịch bản tự động tuần tự 8 bước: Move, Greet, Speak, Show, Listen, Recommend, Create Request, Feedback
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors whitespace-nowrap self-start sm:self-auto hover:opacity-90"
          style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#262626' }}
        >
          + Tạo kịch bản mới
        </button>
      </div>

      {/* Workflow Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {workflows.length === 0 ? (
          <div
            className="col-span-full p-8 text-center rounded-xl border text-xs"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
          >
            Chưa có kịch bản nào. Nhấn "+ Tạo kịch bản mới" để bắt đầu cấu hình.
          </div>
        ) : (
          workflows.map((wf) => (
            <div
              key={wf.id}
              className="p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-shadow hover:shadow-sm"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
                    style={{
                      backgroundColor: wf.is_active ? '#262626' : '#F2EFE9',
                      color: wf.is_active ? '#FFFFFF' : '#8C8C8C',
                      borderColor: wf.is_active ? '#262626' : '#BFBFBD',
                    }}
                  >
                    {wf.is_active ? 'ĐANG KÍCH HOẠT' : 'TẠM TẮT'}
                  </span>
                  <span className="text-[10px] font-mono font-semibold" style={{ color: '#8C8C8C' }}>
                    {wf.trigger_type}
                  </span>
                </div>

                <h3 className="font-bold text-sm leading-snug" style={{ color: '#262626' }}>
                  {wf.name}
                </h3>
                <p className="text-[11px] line-clamp-2 mt-1" style={{ color: '#8C8C8C' }}>
                  {wf.description || 'Không có mô tả chi tiết'}
                </p>

                {/* Steps Preview Badge */}
                <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: '#E9E5DC' }}>
                  <span className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>
                    Tổng số bước: <strong style={{ color: '#262626' }}>{wf.steps?.length || 0} Steps</strong>
                  </span>
                  <div className="flex items-center gap-1">
                    {(wf.steps || []).slice(0, 4).map((s, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold border"
                        style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                      >
                        {s.type}
                      </span>
                    ))}
                    {(wf.steps?.length || 0) > 4 && (
                      <span className="text-[10px] font-bold" style={{ color: '#8C8C8C' }}>
                        +{wf.steps.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 border-t flex items-center justify-between gap-1.5" style={{ borderColor: '#BFBFBD' }}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleTestRun(wf)}
                    className="px-2.5 py-1 rounded text-xs font-bold border cursor-pointer hover:bg-stone-100 transition-colors"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#262626', color: '#262626' }}
                    title="Chạy thử kịch bản trên Robot"
                  >
                    ▶ Chạy thử
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(wf)}
                    className="px-2 py-1 rounded text-[11px] border cursor-pointer"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                    title="Bật/Tắt kích hoạt"
                  >
                    {wf.is_active ? 'Tắt' : 'Bật'}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(wf)}
                    className="px-2.5 py-1 rounded text-xs font-medium border cursor-pointer hover:bg-stone-100"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteWorkflow(wf.id, wf.name)}
                    className="px-2 py-1 rounded text-xs border cursor-pointer hover:text-red-700 hover:border-red-300"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL / DRAWER: WORKFLOW BUILDER (8 Steps) */}
      {isEditorOpen && editingWorkflow && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div
            className="max-w-4xl w-full rounded-2xl border p-5 sm:p-6 space-y-4 shadow-2xl my-auto"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: '#262626' }}>
                  Trình Thiết Kế Kịch Bản Robot (Workflow Builder)
                </h3>
                <span className="text-[11px] font-mono" style={{ color: '#8C8C8C' }}>
                  ID: {editingWorkflow.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-xs font-bold px-2 py-1 rounded border cursor-pointer"
                style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveWorkflow} className="space-y-4">
              {/* General Config */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border" style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD' }}>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                    TÊN KỊCH BẢN *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingWorkflow.name}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                    CƠ CHẾ KÍCH HOẠT
                  </label>
                  <select
                    value={editingWorkflow.trigger_type}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, trigger_type: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  >
                    <option value="AUTO_DETECT">Tự Động Phát Hiện Khách (Sensor)</option>
                    <option value="MANUAL">Thủ Công (Admin / Nhân Sự Kích Hoạt)</option>
                    <option value="GUEST_TAP">Khách Chạm Màn Hình Robot</option>
                    <option value="SCHEDULE">Theo Khung Giờ Định Kỳ</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#8C8C8C' }}>
                    MÔ TẢ CHI TIẾT
                  </label>
                  <input
                    type="text"
                    value={editingWorkflow.description || ''}
                    onChange={(e) => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })}
                    placeholder="Mô tả mục đích và bối cảnh hoạt động của kịch bản này..."
                    className="w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  />
                </div>
              </div>

              {/* Sequential Steps List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#BFBFBD' }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#262626' }}>
                    CHU TRÌNH CÁC BƯỚC THỰC THI ({(editingWorkflow.steps || []).length} STEPS)
                  </span>

                  {/* Add Step Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: '#8C8C8C' }}>Thêm bước:</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddStep(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      className="px-2 py-1 rounded text-xs font-bold border cursor-pointer focus:outline-none"
                      style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#262626' }}
                    >
                      <option value="" disabled>+ Chọn loại Step</option>
                      {OTTO_STEP_TYPES.map((st) => (
                        <option key={st.type} value={st.type}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Steps Cards */}
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {(editingWorkflow.steps || []).map((step, idx) => (
                    <div
                      key={step.step_id || idx}
                      className="p-3 rounded-xl border space-y-2.5 transition-all"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
                    >
                      {/* Step Header */}
                      <div className="flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: '#E9E5DC' }}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ backgroundColor: '#262626', color: '#F2EFE9' }}
                          >
                            {idx + 1}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
                            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                          >
                            {step.type}
                          </span>
                          <input
                            type="text"
                            value={step.title}
                            onChange={(e) => {
                              const updated = [...editingWorkflow.steps];
                              updated[idx].title = e.target.value;
                              setEditingWorkflow({ ...editingWorkflow, steps: updated });
                            }}
                            className="text-xs font-bold border-b border-transparent focus:border-stone-400 focus:outline-none px-1"
                            style={{ color: '#262626' }}
                          />
                        </div>

                        {/* Reorder and Delete */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, -1)}
                            disabled={idx === 0}
                            className="px-1.5 py-0.5 rounded text-[11px] border disabled:opacity-30 cursor-pointer"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                            title="Di chuyển lên"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, 1)}
                            disabled={idx === editingWorkflow.steps.length - 1}
                            className="px-1.5 py-0.5 rounded text-[11px] border disabled:opacity-30 cursor-pointer"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                            title="Di chuyển xuống"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
                            className="px-2 py-0.5 rounded text-[11px] border cursor-pointer hover:text-red-700 hover:border-red-300"
                            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                            title="Xóa bước này"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Step Parameters Custom Inputs */}
                      <div className="text-xs pt-1">
                        {step.type === 'MOVE' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                CHỌN ĐIỂM MỐC LI-DAR (WAYPOINT)
                              </label>
                              <select
                                value={step.params?.target_waypoint_id || ''}
                                onChange={(e) => {
                                  const selectedWp = waypoints.find((w) => w.id === e.target.value);
                                  handleStepParamChange(idx, 'target_waypoint_id', e.target.value);
                                  if (selectedWp) {
                                    handleStepParamChange(idx, 'waypoint_name', selectedWp.name);
                                    handleStepParamChange(idx, 'target_x', selectedWp.x);
                                    handleStepParamChange(idx, 'target_y', selectedWp.y);
                                  }
                                }}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              >
                                {waypoints.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name} (X:{w.x}m, Y:{w.y}m)
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                VẬN TỐC DI CHUYỂN (M/S)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                max="1.5"
                                value={step.params?.speed || 0.5}
                                onChange={(e) => handleStepParamChange(idx, 'speed', parseFloat(e.target.value))}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none font-mono"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              />
                            </div>
                          </div>
                        )}

                        {step.type === 'GREET' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                LỜI CHÀO BAN ĐẦU
                              </label>
                              <input
                                type="text"
                                value={step.params?.greeting_text || ''}
                                onChange={(e) => handleStepParamChange(idx, 'greeting_text', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                BIỂU CẢM KHUÔN MẶT
                              </label>
                              <select
                                value={step.params?.face_expression || 'HAPPY_SMILE'}
                                onChange={(e) => handleStepParamChange(idx, 'face_expression', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              >
                                <option value="HAPPY_SMILE">Mỉm cười thân thiện (Happy Smile)</option>
                                <option value="NEUTRAL">Nghiêm túc lịch sự (Neutral)</option>
                                <option value="TALKING">Đang nói chuyện (Talking)</option>
                                <option value="BLINK">Nháy mắt vui vẻ (Blink)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                MÀU ĐÈN LED CHỈ BÁO
                              </label>
                              <select
                                value={step.params?.led_color || 'CYAN'}
                                onChange={(e) => handleStepParamChange(idx, 'led_color', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              >
                                <option value="CYAN">Xanh ngọc (Cyan)</option>
                                <option value="GREEN">Xanh lá (Green)</option>
                                <option value="BLUE">Xanh dương (Blue)</option>
                                <option value="PURPLE">Tím hoàng gia (Purple)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {step.type === 'SPEAK' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                NỘI DUNG GIỌNG NÓI TTS ĐỌC RA LOA
                              </label>
                              <textarea
                                rows={2}
                                value={step.params?.speech_text || ''}
                                onChange={(e) => handleStepParamChange(idx, 'speech_text', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none resize-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              />
                            </div>
                          </div>
                        )}

                        {step.type === 'SHOW' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                CHẾ ĐỘ MÀN HÌNH
                              </label>
                              <select
                                value={step.params?.screen_mode || 'SERVICES_GRID'}
                                onChange={(e) => handleStepParamChange(idx, 'screen_mode', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              >
                                <option value="SERVICES_GRID">Menu Danh Sách Tiện Ích Khách Sạn</option>
                                <option value="RESTAURANT_MENU">Thực Đơn Nhà Hàng & Ẩm Thực</option>
                                <option value="PROMO_BANNER">Slide Poster Khuyến Mãi / Quảng Cáo</option>
                                <option value="HOTEL_MAP">Sơ Đồ Tầng & Bản Đồ Tiện Ích</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                TIÊU ĐỀ BANNER HIỂN THỊ
                              </label>
                              <input
                                type="text"
                                value={step.params?.display_banner || ''}
                                onChange={(e) => handleStepParamChange(idx, 'display_banner', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              />
                            </div>
                          </div>
                        )}

                        {step.type === 'LISTEN' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                KÊNH THU NHẬP Ý KIẾN
                              </label>
                              <select
                                value={step.params?.input_mode || 'VOICE_AND_TOUCH'}
                                onChange={(e) => handleStepParamChange(idx, 'input_mode', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              >
                                <option value="VOICE_AND_TOUCH">Cả Giọng Nói (Micro) & Chạm Màn Hình</option>
                                <option value="TOUCH_ONLY">Chỉ Chạm Nút Trên Màn Hình Cảm Ứng</option>
                                <option value="VOICE_ONLY">Chỉ Nhận Diện Giọng Nói</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                THỜI GIAN CHỜ TIMEOUT (GIÂY)
                              </label>
                              <input
                                type="number"
                                min="5"
                                max="60"
                                value={step.params?.timeout_sec || 15}
                                onChange={(e) => handleStepParamChange(idx, 'timeout_sec', parseInt(e.target.value, 10))}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none font-mono"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              />
                            </div>
                          </div>
                        )}

                        {step.type === 'RECOMMEND' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                DANH MỤC GỢI Ý
                              </label>
                              <select
                                value={step.params?.recommend_category || 'DINING_AND_SPA'}
                                onChange={(e) => handleStepParamChange(idx, 'recommend_category', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              >
                                <option value="DINING_AND_SPA">Ẩm Thực & Chăm Sóc Sức Khỏe (Spa)</option>
                                <option value="ROOM_AMENITIES">Tiện Nghi Phòng & Nâng Cấp Phòng</option>
                                <option value="CITY_TOUR">Điểm Tham Quan & Tour Du Lịch Quanh Khách Sạn</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                NỘI DUNG ĐỀ XUẤT NỔI BẬT
                              </label>
                              <input
                                type="text"
                                value={step.params?.highlight_item || ''}
                                onChange={(e) => handleStepParamChange(idx, 'highlight_item', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              />
                            </div>
                          </div>
                        )}

                        {step.type === 'CREATE_REQUEST' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                BỘ PHẬN TIẾP NHẬN PHIẾU
                              </label>
                              <select
                                value={step.params?.target_department || 'Housekeeping'}
                                onChange={(e) => handleStepParamChange(idx, 'target_department', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              >
                                <option value="Housekeeping">Buồng phòng (Housekeeping)</option>
                                <option value="Reception">Lễ tân (Front Desk / Reception)</option>
                                <option value="F&B">Ẩm thực & Nhà hàng (F&B / Room Service)</option>
                                <option value="Bell Services">Hành lý & Đón tiễn (Bell Services)</option>
                                <option value="Maintenance">Kỹ thuật & Bảo trì (Maintenance)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                ĐỘ ƯU TIÊN
                              </label>
                              <select
                                value={step.params?.ticket_priority || 'Normal'}
                                onChange={(e) => handleStepParamChange(idx, 'ticket_priority', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              >
                                <option value="Low">Thấp (Low)</option>
                                <option value="Normal">Bình thường (Normal)</option>
                                <option value="High">Cao (High)</option>
                                <option value="Urgent">Khẩn cấp (Urgent)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {step.type === 'FEEDBACK' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[10px] font-semibold mb-0.5" style={{ color: '#8C8C8C' }}>
                                CÂU HỎI KHẢO SÁT HÀI LÒNG
                              </label>
                              <input
                                type="text"
                                value={step.params?.question_text || ''}
                                onChange={(e) => handleStepParamChange(idx, 'question_text', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs border focus:outline-none"
                                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit / Save Bar */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: '#BFBFBD' }}>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-lg text-xs font-bold cursor-pointer"
                  style={{ backgroundColor: '#262626', color: '#F2EFE9' }}
                >
                  {isLoading ? 'Đang lưu...' : 'Lưu Kịch Bản Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TEST RUN EXECUTION SIMULATOR */}
      {executingWf && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            className="max-w-xl w-full rounded-2xl border p-5 space-y-3 shadow-2xl"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: '#BFBFBD' }}>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#262626' }}>
                  Giả Lập Thực Thi: {executingWf.name}
                </h3>
                <span className="text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                  UNIT RC-001 • {executingWf.steps?.length || 0} Steps
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExecutingWf(null)}
                className="text-xs font-bold px-2 py-0.5 rounded border cursor-pointer"
                style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
              >
                Đóng
              </button>
            </div>

            {/* Execution Logs Terminal */}
            <div
              className="p-3 rounded-xl border font-mono text-[11px] space-y-1.5 max-h-72 overflow-y-auto"
              style={{ backgroundColor: '#1A1917', borderColor: '#262626', color: '#E9E5DC' }}
            >
              {isExecuting && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="animate-spin">●</span>
                  <span>Đang gửi lệnh và đồng bộ các bước hành động tới Robot...</span>
                </div>
              )}
              {executionLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  {log.startsWith('[LỖI]') ? (
                    <span className="text-red-400">{log}</span>
                  ) : log.includes('Hoàn thành') ? (
                    <span className="text-emerald-400 font-bold">{log}</span>
                  ) : (
                    <span>{log}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setExecutingWf(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                style={{ backgroundColor: '#262626', color: '#F2EFE9' }}
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

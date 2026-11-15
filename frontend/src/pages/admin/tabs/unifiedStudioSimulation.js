/** Live step-by-step simulation runner on the Unified Studio SLAM canvas. */
export const runWorkflowMapSimulation = async ({
  activeWf,
  waypoints,
  robotPose,
  setIsSimulating,
  setSimLogs,
  setSimStepIndex,
  setHighlightedWpId,
  setRobotPose,
  showNotification,
}) => {
  if (!activeWf || !activeWf.steps || activeWf.steps.length === 0) {
    showNotification('Kịch bản chưa có bước hành động nào để chạy');
    return;
  }

  setIsSimulating(true);
  setSimLogs([`[00:00] Bắt đầu mô phỏng chu trình "${activeWf.name}" trên bản đồ SLAM...`]);

  let currentX = robotPose.x;
  let currentY = robotPose.y;

  for (let i = 0; i < activeWf.steps.length; i++) {
    const step = activeWf.steps[i];
    setSimStepIndex(i);

    if (step.type === 'MOVE') {
      const wp = waypoints.find((w) => w.id === step.params?.target_waypoint_id);
      const targetX = wp ? wp.x : (parseFloat(step.params?.target_x) || currentX);
      const targetY = wp ? wp.y : (parseFloat(step.params?.target_y) || currentY);
      const targetYaw = wp?.yaw ?? (parseFloat(step.params?.target_yaw) || 0);

      if (wp) setHighlightedWpId(wp.id);

      const dist = Math.hypot(targetX - currentX, targetY - currentY);
      const speed = Math.max(0.1, parseFloat(step.params?.speed) || 0.4);
      const timeout = parseInt(step.params?.timeout_sec || step.params?.timeout) || 30;
      const travelSec = Math.min(timeout, Math.max(1.8, dist > 0.05 ? dist / speed : 2.0));

      setSimLogs((prev) => [
        ...prev,
        `[BƯỚC ${i + 1}: MOVE] Robot di chuyển đến "${wp?.name || step.params?.waypoint_name || 'Điểm mốc'}" (Cự ly: ${dist.toFixed(1)}m, Tốc độ: ${speed}m/s, Thời gian: ${travelSec.toFixed(1)}s)`,
      ]);

      // Nội suy chuyển động mượt mà của Robot trên bản đồ 2D
      const frames = 12;
      const frameInterval = (travelSec * 1000) / frames;
      const startX = currentX;
      const startY = currentY;

      for (let f = 1; f <= frames; f++) {
        const ratio = f / frames;
        const interpX = startX + (targetX - startX) * ratio;
        const interpY = startY + (targetY - startY) * ratio;
        setRobotPose((prev) => ({
          ...prev,
          x: Number(interpX.toFixed(3)),
          y: Number(interpY.toFixed(3)),
          yaw: targetYaw,
        }));
        await new Promise((resolve) => setTimeout(resolve, frameInterval));
      }

      currentX = targetX;
      currentY = targetY;
    } else if (step.type === 'GREET') {
      setSimLogs((prev) => [
        ...prev,
        `[BƯỚC ${i + 1}: GREET] Lời chào: "${step.params?.greeting_text || 'Xin chào'}" (Biểu cảm: ${step.params?.face_expression || 'SMILE'}, LED: ${step.params?.led_color || 'CYAN'})`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, 2200));
    } else if (step.type === 'SPEAK') {
      setSimLogs((prev) => [
        ...prev,
        `[BƯỚC ${i + 1}: SPEAK] Phát loa: "${step.params?.speech_text || '...'}" (Tốc độ đọc: ${step.params?.voice_speed || 1.0}x)`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, 2200));
    } else if (step.type === 'SHOW') {
      const showDuration = Math.min(5000, Math.max(1500, (parseInt(step.params?.slide_duration_sec || step.params?.timeout) || 4) * 1000));
      setSimLogs((prev) => [
        ...prev,
        `[BƯỚC ${i + 1}: SHOW] Màn hình Kiosk: "${step.params?.screen_mode || step.params?.content_id || 'TIỆN ÍCH'}" - Banner: "${step.params?.display_banner || 'Tiêu chuẩn'}" (${(showDuration / 1000).toFixed(0)}s)`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, showDuration));
    } else if (step.type === 'COMMUNICATE') {
      const commDuration = Math.min(5000, Math.max(1500, (parseInt(step.params?.silence_timeout_sec || step.params?.timeout) || 4) * 1000));
      const prompt = step.params?.initial_prompt || step.params?.speech_text || step.params?.text || 'Đối thoại hai chiều với khách';
      setSimLogs((prev) => [
        ...prev,
        `[BƯỚC ${i + 1}: COMMUNICATE] Đối thoại AI 2 chiều: "${prompt.slice(0, 45)}..." (Silence Timeout: ${step.params?.silence_timeout_sec || 30}s)`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, commDuration));
    } else if (step.type === 'LISTEN') {
      const listenDuration = Math.min(5000, Math.max(1500, (parseInt(step.params?.timeout_sec || step.params?.timeout) || 4) * 1000));
      setSimLogs((prev) => [
        ...prev,
        `[BƯỚC ${i + 1}: LISTEN] Mở Mic lắng nghe (Gợi ý: "${step.params?.prompt_hint || 'Nói yêu cầu...'}", Chờ: ${(listenDuration / 1000).toFixed(0)}s)`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, listenDuration));
    } else if (step.type === 'RECOMMEND') {
      setSimLogs((prev) => [
        ...prev,
        `[BƯỚC ${i + 1}: RECOMMEND] AI gợi ý: "${step.params?.highlight_item || 'Ẩm thực 5 sao'}"`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, 2400));
    } else if (step.type === 'CREATE_REQUEST') {
      setSimLogs((prev) => [
        ...prev,
        `[BƯỚC ${i + 1}: CREATE_REQUEST] Tạo phiếu [${step.params?.urgency || 'NORMAL'}] gửi ${step.params?.target_department || 'Housekeeping'} (Phòng ${step.params?.room_number || '402'})`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } else if (step.type === 'FEEDBACK') {
      setSimLogs((prev) => [
        ...prev,
        `[BƯỚC ${i + 1}: FEEDBACK] Mở khảo sát 5 sao: "${step.params?.question_text || 'Đánh giá dịch vụ'}"`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, 2500));
    } else {
      setSimLogs((prev) => [
        ...prev,
        `[BƯỚC ${i + 1}: ${step.type}] Thực thi hành động: ${step.title}`,
      ]);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  setSimLogs((prev) => [...prev, '✅ Hoàn thành toàn bộ kịch bản! Robot sẵn sàng cho chu trình mới.']);
  setIsSimulating(false);
  setSimStepIndex(-1);
  setHighlightedWpId(null);
  showNotification('Đã hoàn tất mô phỏng chu trình trên bản đồ!');
};

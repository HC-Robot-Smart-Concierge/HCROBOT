    // Kiểm tra hết hạn vé
    function checkExpiry() {
      const now = Date.now();
      const timeLeft = expiresAt - now;

      if (ticketId && localStorage.getItem('aurora_finished_ticket_' + ticketId)) {
        showExpired(timeLeft > 0);
        return;
      }

      if (timeLeft <= 0) {
        showExpired(false);
        return;
      }

      const m = Math.floor(timeLeft / 60000);
      const s = Math.floor((timeLeft % 60000) / 1000);
      document.getElementById('expiryTimer').innerText = `${dest.time || '2 Phút'} · Còn ${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function showExpired(canReopen) {
      document.getElementById('expiredScreen').style.display = 'flex';
      document.getElementById('mainContent').style.display = 'none';
      const titleEl = document.getElementById('expiredTitle');
      const descEl = document.getElementById('expiredDesc');
      const reopenBtn = document.getElementById('reopenBtn');
      if (canReopen) {
        if (titleEl) titleEl.innerText = 'Đã Đóng Chỉ Dẫn Đường Đi';
        if (descEl) descEl.innerHTML = 'Bạn đã xác nhận nhớ lộ trình tới <strong>' + dest.name + '</strong>. Nếu lỡ tay bấm đóng, bạn có thể mở lại ngay bên dưới.';
        if (reopenBtn) reopenBtn.style.display = 'block';
      } else {
        if (titleEl) titleEl.innerText = 'Chỉ Dẫn Đã Hết Hạn';
        if (descEl) descEl.innerHTML = 'Vé chỉ đường này có hiệu lực 15 phút để đảm bảo an ninh và riêng tư. Quý khách vui lòng hỏi lại <strong>Robot Concierge Rora</strong> tại sảnh khách sạn nhé ạ!';
        if (reopenBtn) reopenBtn.style.display = 'none';
      }
    }

    function finishTicket() {
      if (ticketId) {
        localStorage.setItem('aurora_finished_ticket_' + ticketId, '1');
      }
      showExpired(expiresAt > Date.now());
    }

    function reopenTicket() {
      if (ticketId) {
        localStorage.removeItem('aurora_finished_ticket_' + ticketId);
      }
      document.getElementById('expiredScreen').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
      checkExpiry();
    }

    function render() {
      document.getElementById('destNameHeader').innerText = dest.name;
      document.getElementById('destFloorBadge').innerText = dest.floorLevel;

      if (!dest.isDiff) {
        document.getElementById('stepSwitcher').style.display = 'none';
        document.getElementById('nextLegQuickBtn').style.display = 'none';
        activeStep = 2;
      }

      updateStepView();
    }

    function getActiveLegPoints() {
      if (activeStep === 1) {
        return {
          path: ROUTE_GROUND_TO_ELEVATOR,
          start: { x: 350, y: 580 },
          end: { x: 1715, y: 560 },
          startLabel: 'BẠN Ở ĐÂY',
          endLabel: 'THANG MÁY A'
        };
      }
      const startPt = dest.isDiff ? { x: 1715, y: 560 } : { x: 350, y: 580 };
      return {
        path: dest.route,
        start: startPt,
        end: dest.coords,
        startLabel: dest.isDiff ? 'RA THANG MÁY' : 'BẠN Ở ĐÂY',
        endLabel: dest.shortLabel || dest.name.toUpperCase().slice(0, 16)
      };
    }

    function updateStepView() {
      const btn1 = document.getElementById('btnStep1');
      const btn2 = document.getElementById('btnStep2');
      const floorImg = document.getElementById('floorImage');
      const floorBadge = document.getElementById('floorBadge');
      const halo = document.getElementById('svgHalo');
      const track = document.getElementById('svgTrack');
      const route = document.getElementById('svgRoute');
      const startPinGroup = document.getElementById('startPinGroup');
      const destPinGroup = document.getElementById('destPinGroup');
      const startLabelText = document.getElementById('startLabelText');
      const destLabelText = document.getElementById('destLabelText');
      const instNum = document.getElementById('currentStepIcon');
      const instText = document.getElementById('stepInstructionText');
      const nextLegBtnText = document.getElementById('nextLegBtnText');

      const leg = getActiveLegPoints();

      if (activeStep === 1) {
        btn1.classList.add('active');
        btn2.classList.remove('active');
        floorImg.setAttribute('href', FLOOR_IMAGES['3']);
        floorBadge.innerText = 'SẢNH TRỆT';
        instNum.innerText = '1';
        instText.innerText = dest.step1 || 'Đi từ sảnh Lobby đến Thang máy A và bấm lên tầng mục tiêu.';
        if (nextLegBtnText) nextLegBtnText.innerText = 'Chặng 2 →';
      } else {
        btn2.classList.add('active');
        btn1.classList.remove('active');
        floorImg.setAttribute('href', FLOOR_IMAGES[dest.floorId] || `/maps/floor_${dest.floorId}.png`);
        floorBadge.innerText = dest.floorLevel;
        instNum.innerText = dest.isDiff ? '2' : '1';
        instText.innerText = (dest.isDiff ? dest.step2 : dest.step1) || `Ra khỏi thang máy, đi theo chỉ dẫn tới ${dest.name}.`;
        if (nextLegBtnText) nextLegBtnText.innerText = '← Chặng 1';
      }

      halo.setAttribute('d', leg.path);
      track.setAttribute('d', leg.path);
      route.setAttribute('d', leg.path);

      startPinGroup.setAttribute('transform', `translate(${leg.start.x}, ${leg.start.y})`);
      destPinGroup.setAttribute('transform', `translate(${leg.end.x}, ${leg.end.y})`);
      startLabelText.textContent = leg.startLabel;
      destLabelText.textContent = leg.endLabel;

      recenterRoute();
    }

    function updateControlButtonsUI() {
      const btnHeading = document.getElementById('btnToggleHeading');
      const btn3D = document.getElementById('btnToggle3D');
      const label3D = document.getElementById('label3DMode');
      const stage3D = document.getElementById('map3dStage');

      if (btnHeading) btnHeading.classList.toggle('active', isHeadingUp);
      if (btn3D) btn3D.classList.toggle('active', is3D);
      if (label3D) label3D.innerText = is3D ? '3D' : '2D';
      if (stage3D) stage3D.classList.toggle('tilt-3d', is3D);
    }

    function toggleHeadingMode() {
      isHeadingUp = !isHeadingUp;
      updateControlButtonsUI();
      recenterRoute();
    }

    function toggle3DMode() {
      is3D = !is3D;
      updateControlButtonsUI();
    }

    function syncSvgOrientation(rotZ) {
      const svgEl = document.getElementById('mainMapSvg');
      const worldGroup = document.getElementById('svgWorldGroup');
      const startInner = document.getElementById('startLabelInner');
      const destInner = document.getElementById('destLabelInner');

      if (rotZ === -90) {
        svgEl.setAttribute('viewBox', '0 0 1174 1840');
        worldGroup.setAttribute('transform', 'translate(0, 1840) rotate(-90)');
      } else if (rotZ === 90) {
        svgEl.setAttribute('viewBox', '0 0 1174 1840');
        worldGroup.setAttribute('transform', 'translate(1174, 0) rotate(90)');
      } else {
        svgEl.setAttribute('viewBox', '0 0 1840 1174');
        worldGroup.setAttribute('transform', 'translate(0, 0) rotate(0)');
      }

      if (startInner) startInner.setAttribute('transform', `rotate(${-rotZ})`);
      if (destInner) destInner.setAttribute('transform', `rotate(${-rotZ})`);
    }

    function applyGpuTransform(smooth) {
      const gpuLayer = document.getElementById('gpuCameraLayer');
      if (!gpuLayer) return;
      gpuLayer.classList.toggle('smooth-cam', Boolean(smooth));
      gpuLayer.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${currentZoom})`;
    }

    function recenterRoute() {
      const leg = getActiveLegPoints();
      const frame = computeSmartRouteFrame(leg.path, leg.start, leg.end, isHeadingUp);
      if (currentRotZ !== frame.rotZ) {
        currentRotZ = frame.rotZ;
        syncSvgOrientation(currentRotZ);
      } else {
        syncSvgOrientation(currentRotZ);
      }
      currentZoom = frame.zoom;
      panX = frame.panX;
      panY = frame.panY;
      applyGpuTransform(true);
    }

    function switchStep(step) {
      activeStep = step;
      updateStepView();
    }

    function clampZoom(z) {
      return Math.min(3.2, Math.max(0.65, Number(z.toFixed(3))));
    }

    function clampPanX(x, z = currentZoom) {
      const limit = Math.round(540 * Math.max(1, z * 0.85));
      return Math.max(-limit, Math.min(limit, Number(x.toFixed(2))));
    }

    function clampPanY(y, z = currentZoom) {
      const limit = Math.round(660 * Math.max(1, z * 0.85));
      return Math.max(-limit, Math.min(limit, Number(y.toFixed(2))));
    }

    function zoom(delta) {
      const nextZoom = clampZoom(currentZoom + delta);
      const ratio = nextZoom / currentZoom;
      currentZoom = nextZoom;
      panX = clampPanX(panX * ratio, nextZoom);
      panY = clampPanY(panY * ratio, nextZoom);
      applyGpuTransform(true);
    }

    // Engine Cảm ứng Đa điểm (1 ngón kéo + 2 ngón Pinch-to-Zoom bám đúng tâm 2 ngón tay chuẩn Google Maps)
    const mapContainer = document.getElementById('mapContainer');
    let isPinching = false;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchStartPanX = 0;
    let pinchStartPanY = 0;
    let pinchStartMidX = 0;
    let pinchStartMidY = 0;

    function scheduleFrameUpdate() {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const gpuLayer = document.getElementById('gpuCameraLayer');
          if (gpuLayer) {
            gpuLayer.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${currentZoom})`;
          }
        });
      }
    }

    function disableSmoothTransition() {
      const gpuLayer = document.getElementById('gpuCameraLayer');
      if (gpuLayer) gpuLayer.classList.remove('smooth-cam');
    }

    function getTouchMetrics(t1, t2) {
      const rect = mapContainer.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      return {
        dist: Math.max(12, Math.hypot(dx, dy)),
        midX: (t1.clientX + t2.clientX) / 2 - centerX,
        midY: (t1.clientY + t2.clientY) / 2 - centerY
      };
    }

    // 1. Touch Events chuyên biệt cho điện thoại (1 ngón pan + 2 ngón pinch-zoom mượt theo tay)
    mapContainer.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      disableSmoothTransition();

      if (e.touches.length === 1) {
        isDragging = true;
        isPinching = false;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        startPanX = panX;
        startPanY = panY;
      } else if (e.touches.length >= 2) {
        e.preventDefault();
        isDragging = false;
        isPinching = true;
        const m = getTouchMetrics(e.touches[0], e.touches[1]);
        pinchStartDist = m.dist;
        pinchStartZoom = currentZoom;
        pinchStartPanX = panX;
        pinchStartPanY = panY;
        pinchStartMidX = m.midX;
        pinchStartMidY = m.midY;
      }
    }, { passive: false });

    mapContainer.addEventListener('touchmove', (e) => {
      if (e.touches.length >= 2 && isPinching) {
        e.preventDefault();
        const m = getTouchMetrics(e.touches[0], e.touches[1]);
        const nextZoom = clampZoom(pinchStartZoom * (m.dist / pinchStartDist));
        const zoomRatio = nextZoom / pinchStartZoom;

        // Giữ nguyên điểm bản đồ nằm ngay dưới tâm 2 ngón tay vừa zoom vừa di chuyển theo 2 ngón
        const nextPanX = m.midX - (pinchStartMidX - pinchStartPanX) * zoomRatio;
        const nextPanY = m.midY - (pinchStartMidY - pinchStartPanY) * zoomRatio;

        currentZoom = nextZoom;
        panX = clampPanX(nextPanX, nextZoom);
        panY = clampPanY(nextPanY, nextZoom);
        scheduleFrameUpdate();
      } else if (e.touches.length === 1 && isDragging && !isPinching) {
        e.preventDefault();
        const nextX = startPanX + (e.touches[0].clientX - dragStartX);
        const nextY = startPanY + (e.touches[0].clientY - dragStartY);
        panX = clampPanX(nextX, currentZoom);
        panY = clampPanY(nextY, currentZoom);
        scheduleFrameUpdate();
      }
    }, { passive: false });

    const handleTouchEnd = (e) => {
      if (e.touches.length === 1) {
        // Khi nhấc 1 ngón tay ra sau khi pinch, neo lại tọa độ ngón còn lại để không bị giật nhảy
        isPinching = false;
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        startPanX = panX;
        startPanY = panY;
      } else if (e.touches.length === 0) {
        isPinching = false;
        isDragging = false;
      }
    };
    mapContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
    mapContainer.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // 2. Hỗ trợ chuột & con lăn trên máy tính (chỉ kích hoạt với chuột để không xung đột cảm ứng)
    mapContainer.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.target.closest('button')) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startPanX = panX;
      startPanY = panY;
      disableSmoothTransition();
      try { mapContainer.setPointerCapture(e.pointerId); } catch (_) {}
    });

    mapContainer.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !isDragging) return;
      const nextX = startPanX + (e.clientX - dragStartX);
      const nextY = startPanY + (e.clientY - dragStartY);
      panX = clampPanX(nextX, currentZoom);
      panY = clampPanY(nextY, currentZoom);
      scheduleFrameUpdate();
    });

    const stopMouseDrag = (e) => {
      if (e.pointerType === 'touch') return;
      if (isDragging) {
        isDragging = false;
        try { mapContainer.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };
    mapContainer.addEventListener('pointerup', stopMouseDrag);
    mapContainer.addEventListener('pointercancel', stopMouseDrag);

    mapContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      disableSmoothTransition();
      const rect = mapContainer.getBoundingClientRect();
      const cursorX = e.clientX - (rect.left + rect.width / 2);
      const cursorY = e.clientY - (rect.top + rect.height / 2);
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const nextZoom = clampZoom(currentZoom * factor);
      const zoomRatio = nextZoom / currentZoom;

      panX = clampPanX(cursorX - (cursorX - panX) * zoomRatio, nextZoom);
      panY = clampPanY(cursorY - (cursorY - panY) * zoomRatio, nextZoom);
      currentZoom = nextZoom;
      scheduleFrameUpdate();
    }, { passive: false });

    // Khởi tạo
    updateControlButtonsUI();
    render();
    checkExpiry();
    setInterval(checkExpiry, 1000);

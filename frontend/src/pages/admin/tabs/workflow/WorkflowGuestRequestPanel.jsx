import React, { useEffect, useRef, useState } from 'react';
import { RoomPinModal } from '../../../../components/robot/RoomPinModal';
import { fetchReceptionRequestById } from '../../../../services/operationsApi';
import { isValidHotelRoom } from '../../../../utils/roomHelper';
import {
  guestRequestRequiresRoom,
  resolveCreateRequestConfig,
  submitGuestRequest,
} from '../../../../utils/workflowGuestRequest';

export function WorkflowGuestRequestPanel({
  workflowId, step, followUpConfirmation = false, phase, session, setSession, onNext, onCancel, english,
  preview = false, verifiedRoom = '', sessionId, onRoomVerified,
}) {
  const label = (en, vi) => english ? en : vi;
  const config = resolveCreateRequestConfig(workflowId, step);
  const currentStepId = step?.step_id || null;

  // Clear stale ticket/draft from an earlier independent CREATE_REQUEST branch in the same workflow.
  const isStaleFromOtherBranch =
    phase === 'confirm' &&
    Boolean(session?.ticket?.stepId) &&
    Boolean(currentStepId) &&
    session.ticket.stepId !== currentStepId;
  const activeSession = isStaleFromOtherBranch ? {} : (session || {});

  const initialKind = activeSession.draft?.kind || config.kind;
  const [kind, setKind] = useState(initialKind);
  const [room, setRoom] = useState(String(verifiedRoom || activeSession.draft?.room || (preview ? config.defaultRoom : '') || ''));
  const [detail, setDetail] = useState(activeSession.draft?.detail ?? config.defaultDetail ?? '');
  const [time, setTime] = useState(activeSession.draft?.time || '');
  const [pinOpen, setPinOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [staffStatus, setStaffStatus] = useState('pending');
  const mounted = useRef(false);
  const sending = useRef(false);
  const { draft, ticket } = activeSession;

  const labels = {
    cleaning: label('Room cleaning (Room Service)', 'Dọn phòng (Phục vụ phòng)'),
    amenities: label('Extra room amenities', 'Xin thêm đồ dùng phòng'),
    food: label('Food & Beverage (Kitchen)', 'Đặt món ăn / Đồ uống (Bếp)'),
    taxi: label('Taxi from the lobby', 'Đặt taxi đón tại sảnh'),
    wakeup: label('Wake-up call (Reception)', 'Gọi báo thức (Lễ tân)'),
    staff: label('Meet reception', 'Gặp nhân viên lễ tân'),
    reception: label('Front desk assistance', 'Hỗ trợ tại quầy Lễ tân'),
    bell: label('Bell Services & Luggage', 'Hành lý / Đồ thất lạc (Bellman)'),
    maintenance: label('Facility maintenance', 'Kỹ thuật & Bảo trì'),
    concierge: label('Concierge support', 'Trợ lý Concierge'),
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (isStaleFromOtherBranch) {
      setSession({});
    }
  }, [isStaleFromOtherBranch, setSession]);

  useEffect(() => {
    if (phase !== 'wait' || !ticket || preview) return;
    let active = true;
    let timer;
    async function refresh() {
      const req = await fetchReceptionRequestById(ticket.id);
      if (!active) return;
      const status = String(req?.status || '').toLowerCase();
      if (['in progress', 'in_progress', 'completed', 'accepted', 'assigned'].includes(status)) {
        setStaffStatus('accepted');
      } else if (['cancelled', 'canceled', 'declined', 'rejected'].includes(status)) {
        setStaffStatus('closed');
      } else {
        setStaffStatus(req ? 'pending' : 'reconnecting');
        timer = setTimeout(refresh, 3000);
      }
    }
    refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [phase, ticket, preview]);

  const button = 'rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer';
  const field = 'mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm';
  const cancel = <button type="button" disabled={busy} onClick={onCancel} className="px-2 py-2 text-sm cursor-pointer">{label('Close', 'Đóng')}</button>;
  const needsRoom = guestRequestRequiresRoom(kind);
  const lobbyFallbackRoom = config.defaultLocation || (kind === 'concierge' ? 'Main Lobby Kiosk' : 'Lobby Desk');
  const effectiveRoom = needsRoom
    ? String((preview ? room : verifiedRoom) || '').trim()
    : String((preview ? (room || lobbyFallbackRoom) : (verifiedRoom || lobbyFallbackRoom)) || '').trim();
  const detailRequired = !['cleaning', 'wakeup'].includes(kind);
  const needsDetails =
    !ticket &&
    (phase === 'details' ||
      editing ||
      !draft ||
      (phase === 'confirm' && !preview && needsRoom && draft.room !== effectiveRoom));

  async function confirm() {
    if (!draft || sending.current || ticket) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const receipt = preview
        ? { id: 'preview', code: label('Preview', 'Mô phỏng'), department: labels[draft.kind] || '' }
        : await submitGuestRequest(draft);
      if (mounted.current) {
        setSession({ draft, ticket: { ...receipt, stepId: currentStepId } });
        if (followUpConfirmation) {
          onNext();
        }
      }
    } catch (err) {
      if (mounted.current) {
        setError(err?.message || label('The server did not confirm the request.', 'Máy chủ chưa xác nhận đã nhận phiếu.'));
      }
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (phase === 'receipt' || phase === 'wait' || (phase === 'confirm' && ticket)) {
    return (
      <section className="space-y-3">
        <h2 className="font-bold">
          {ticket ? (labels[draft?.kind || kind] || label('Request sent', 'Đã gửi yêu cầu')) : label('No confirmed request', 'Chưa gửi yêu cầu')}
        </h2>
        {ticket && (
          <p className="text-sm text-stone-700">
            {label('Request', 'Phiếu')}{' '}
            <strong className="font-mono text-stone-900">{ticket.code}</strong>
            {draft?.room ? ' · ' + (isValidHotelRoom(draft.room) ? label('Room ', 'Phòng ') + draft.room : draft.room) : ''}
          </p>
        )}
        {ticket && ticket.department && (
          <p className="text-xs text-emerald-700 font-semibold">
            {preview
              ? label('Preview only — no database record was created.', 'Chế độ mô phỏng — chưa tạo phiếu trong CSDL.')
              : label(`Sent to ${ticket.department}`, `Đã chuyển thật đến bộ phận: ${ticket.department}`)}
          </p>
        )}
        {draft?.detail && <p className="text-xs text-stone-600">{draft.detail}</p>}
        {phase === 'wait' && ticket && (
          <p role="status">
            {({
              accepted: label('Staff has accepted your request.', 'Nhân viên đã tiếp nhận yêu cầu của quý khách.'),
              pending: label('Waiting for staff to accept…', 'Đang chờ nhân viên tiếp nhận…'),
              reconnecting: label('Reconnecting to server…', 'Đang kết nối lại với máy chủ…'),
              closed: label('Staff closed the request.', 'Nhân viên đã đóng yêu cầu.'),
            })[staffStatus]}
          </p>
        )}
        {preview && phase === 'wait' && ticket && staffStatus === 'pending' && (
          <button type="button" className={button} onClick={() => setStaffStatus('accepted')}>
            {label('Simulate staff accepting', 'Mô phỏng nhân viên tiếp nhận')}
          </button>
        )}
        {((phase !== 'wait' || ['accepted', 'closed'].includes(staffStatus)) && ticket) ? (
          <button
            type="button"
            className={button}
            onClick={() => {
              setSession({});
              onNext();
            }}
          >
            {label('Done', 'Hoàn tất')}
          </button>
        ) : cancel}
      </section>
    );
  }

  if (needsDetails) {
    const detailLabel = kind === 'taxi'
      ? label('Destination', 'Điểm đến')
      : kind === 'food'
        ? label('Food & drinks', 'Món ăn / đồ uống')
        : kind === 'maintenance'
          ? label('Issue to repair', 'Sự cố cần sửa chữa')
          : kind === 'bell'
            ? label('Luggage / lost item details', 'Chi tiết hành lý / đồ thất lạc')
            : kind === 'staff' || kind === 'reception'
              ? label('How can reception help?', 'Quý khách cần lễ tân hỗ trợ việc gì?')
              : kind === 'concierge'
                ? label('How can concierge help?', 'Quý khách cần Concierge hỗ trợ gì?')
                : label('Request details', 'Nội dung yêu cầu');

    const submitDisabled =
      (needsRoom && !isValidHotelRoom(effectiveRoom)) ||
      (detailRequired && !detail.trim()) ||
      (kind === 'wakeup' && !time);

    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (submitDisabled) return;
          setError('');
          setSession({
            draft: {
              kind,
              room: effectiveRoom,
              detail: detail.trim() || (kind === 'cleaning' ? 'Dọn phòng' : ''),
              time,
            },
            ticket: null,
          });
          setEditing(false);
          if (phase === 'details') onNext();
        }}
      >
        <h2 className="font-bold">{label('Guest request', 'Yêu cầu của khách')}</h2>
        {Array.isArray(config.selectableKinds) ? (
          <label className="block">
            {label('Service', 'Dịch vụ')}
            <select
              className={field}
              value={config.selectableKinds.includes(kind) ? kind : config.selectableKinds[0]}
              onChange={(e) => {
                setKind(e.target.value);
                if (!config.defaultDetail) setDetail('');
              }}
            >
              {config.selectableKinds.map((k) => (
                <option key={k} value={k}>{labels[k]}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm font-medium text-stone-700">{labels[kind]}</p>
        )}
        {needsRoom && (preview
          ? (
            <label className="block">
              {label('Room number', 'Số phòng')}
              <input className={field} value={room} inputMode="numeric" required onChange={(e) => setRoom(e.target.value)} />
            </label>
          ) : (
            <div>
              {verifiedRoom ? (
                <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {label('Verified room ', 'Phòng đã xác thực ') + verifiedRoom}
                </span>
              ) : (
                <button type="button" className={button} onClick={() => setPinOpen(true)}>
                  {label('Verify your room', 'Xác thực phòng')}
                </button>
              )}
            </div>
          )
        )}
        {kind === 'wakeup' ? (
          <label className="block">
            {label('Wake-up time', 'Giờ báo thức')}
            <input className={field} type="time" value={time} required onChange={(e) => setTime(e.target.value)} />
          </label>
        ) : (
          <label className="block">
            {detailLabel}
            <input
              className={field}
              value={detail}
              maxLength={500}
              required={detailRequired}
              placeholder={kind === 'cleaning' ? label('Optional note (e.g. extra towels)', 'Ghi chú thêm (VD: thêm khăn tắm)') : ''}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
        )}
        <div className="flex gap-2">
          <button className={button} disabled={submitDisabled}>
            {label('Review request', 'Xem lại yêu cầu')}
          </button>
          {cancel}
        </div>
        {pinOpen && (
          <RoomPinModal
            isOpen
            roomNumber={config.defaultRoom}
            sessionId={sessionId}
            skipTicketCreation
            onRoomSelect={setRoom}
            onClose={() => setPinOpen(false)}
            onVerifiedSuccess={(result, selected) => {
              onRoomVerified(result?.room_number || selected);
              setPinOpen(false);
            }}
          />
        )}
      </form>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-bold">{labels[draft.kind] || label('Confirm request', 'Xác nhận yêu cầu')}</h2>
      {draft.room && (
        <p className="text-sm text-stone-700">
          {isValidHotelRoom(draft.room) ? label('Room ', 'Phòng ') + draft.room : draft.room}
        </p>
      )}
      <p className="text-sm text-stone-800">{draft.kind === 'wakeup' ? draft.time : draft.detail}</p>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={confirm}>
          {busy ? '…' : label('Confirm and send', 'Xác nhận gửi')}
        </button>
        <button type="button" disabled={busy} onClick={() => setEditing(true)} className="px-3 py-2 text-sm cursor-pointer">
          {label('Edit', 'Sửa')}
        </button>
        {cancel}
      </div>
    </section>
  );
}

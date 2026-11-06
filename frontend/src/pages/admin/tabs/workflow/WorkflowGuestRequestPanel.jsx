import React, { useEffect, useRef, useState } from 'react';
import { RoomPinModal } from '../../../../components/robot/RoomPinModal';
import { fetchReceptionRequestById } from '../../../../services/operationsApi';
import { isValidHotelRoom } from '../../../../utils/roomHelper';
import { submitGuestRequest } from '../../../../utils/workflowGuestRequest';

export function WorkflowGuestRequestPanel({
  workflowId, phase, session, setSession, onNext, onCancel, english,
  preview = false, verifiedRoom = '', sessionId, onRoomVerified,
}) {
  const label = (en, vi) => english ? en : vi;
  const initialKind = workflowId === 'wf-04-call-staff' ? 'staff' : workflowId === 'wf-08-wakeup' ? 'wakeup' : 'cleaning';
  const [kind, setKind] = useState(session.draft?.kind || initialKind);
  const [room, setRoom] = useState(String(verifiedRoom || session.draft?.room || ''));
  const [detail, setDetail] = useState(session.draft?.detail || '');
  const [time, setTime] = useState(session.draft?.time || '');
  const [pinOpen, setPinOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [staffStatus, setStaffStatus] = useState('pending');
  const mounted = useRef(false);
  const sending = useRef(false);
  const { draft, ticket } = session;
  const labels = {
    cleaning: label('Room cleaning', 'Dọn phòng'), amenities: label('Extra amenities', 'Xin thêm đồ dùng'),
    taxi: label('Taxi from the lobby', 'Đặt taxi đón tại sảnh'), wakeup: label('Wake-up call', 'Gọi báo thức'),
    staff: label('Meet reception', 'Gặp nhân viên lễ tân'),
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (phase !== 'wait' || !ticket || preview) return;
    let active = true, timer;
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

  const button = 'rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
  const field = 'mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm';
  const cancel = <button type="button" disabled={busy} onClick={onCancel} className="px-2 py-2 text-sm">{label('Close', 'Đóng')}</button>;
  const needsRoom = kind !== 'staff';
  const effectiveRoom = String((preview ? room : verifiedRoom) || '').trim();
  const needsDetails = phase === 'details' || editing || !draft ||
    (phase === 'confirm' && !preview && needsRoom && draft.room !== effectiveRoom);

  async function confirm() {
    if (!draft || sending.current || ticket) return;
    sending.current = true;
    setBusy(true);
    setError(false);
    try {
      const receipt = preview ? { id: 'preview', code: label('Preview', 'Mô phỏng') } : await submitGuestRequest(draft);
      if (mounted.current) {
        setSession({ draft, ticket: receipt });
        onNext();
      }
    } catch {
      if (mounted.current) setError(true);
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (phase === 'receipt' || phase === 'wait') {
    return <section className="space-y-3">
      <h2 className="font-bold">{ticket ? labels[draft.kind] : label('No confirmed request', 'Chưa gửi yêu cầu')}</h2>
      {ticket && <p>{label('Request', 'Phiếu')} {ticket.code}{draft.room && ' · ' + label('Room ', 'Phòng ') + draft.room}</p>}
      {phase === 'wait' && ticket && <p role="status">{({
        accepted: label('Reception has accepted your request.', 'Lễ tân đã tiếp nhận yêu cầu của quý khách.'),
        pending: label('Waiting for reception to accept…', 'Đang chờ lễ tân tiếp nhận…'),
        reconnecting: label('Reconnecting to reception…', 'Đang kết nối lại với lễ tân…'),
        closed: label('Reception closed the request.', 'Lễ tân đã đóng yêu cầu.'),
      })[staffStatus]}</p>}
      {preview && phase === 'wait' && ticket && staffStatus === 'pending' &&
        <button type="button" className={button} onClick={() => setStaffStatus('accepted')}>{label('Simulate staff accepting', 'Mô phỏng nhân viên tiếp nhận')}</button>}
      {(phase === 'receipt' || ['accepted', 'closed'].includes(staffStatus)) && ticket
        ? <button type="button" className={button} onClick={onNext}>{label('Done', 'Hoàn tất')}</button> : cancel}
    </section>;
  }

  if (needsDetails) return <form className="space-y-3" onSubmit={e => {
    e.preventDefault();
    if ((needsRoom && !isValidHotelRoom(effectiveRoom)) || (['staff','taxi','amenities'].includes(kind) && !detail.trim())) return;
    setSession({ draft: { kind, room: effectiveRoom, detail: detail.trim(), time }, ticket: null });
    setEditing(false);
    if (phase === 'details') onNext();
  }}>
    <h2 className="font-bold">{label('Guest request', 'Yêu cầu của khách')}</h2>
    {workflowId === 'wf-03-room-service' ?
      <label className="block">{label('Service', 'Dịch vụ')}<select className={field} value={kind} onChange={e => { setKind(e.target.value); setDetail(''); }}>
        {['cleaning','amenities','taxi'].map(k => <option key={k} value={k}>{labels[k]}</option>)}
      </select></label> : <p>{labels[kind]}</p>}
    {needsRoom && (preview
      ? <label className="block">{label('Room number', 'Số phòng')}<input className={field} value={room} inputMode="numeric" required onChange={e => setRoom(e.target.value)} /></label>
      : <div>{verifiedRoom ? label('Verified room ', 'Phòng đã xác thực ') + verifiedRoom : <button type="button" className={button} onClick={() => setPinOpen(true)}>{label('Verify your room', 'Xác thực phòng')}</button>}</div>)}
    {kind === 'wakeup' ? <label className="block">{label('Wake-up time', 'Giờ báo thức')}<input className={field} type="time" value={time} required onChange={e => setTime(e.target.value)} /></label>
      : <label className="block">{kind === 'taxi' ? label('Destination', 'Điểm đến') : kind === 'staff' ? label('How can reception help?', 'Quý khách cần lễ tân hỗ trợ việc gì?') : label('Request details', 'Nội dung yêu cầu')}
        <input className={field} value={detail} maxLength={500} required={kind !== 'cleaning'} onChange={e => setDetail(e.target.value)} /></label>}
    <div className="flex gap-2"><button className={button} disabled={needsRoom && !isValidHotelRoom(effectiveRoom)}>{label('Review request', 'Xem lại yêu cầu')}</button>{cancel}</div>
    {pinOpen && <RoomPinModal isOpen roomNumber="" sessionId={sessionId} skipTicketCreation
      onRoomSelect={setRoom} onClose={() => setPinOpen(false)}
      onVerifiedSuccess={(result, selected) => { onRoomVerified(result?.room_number || selected); setPinOpen(false); }} />}
  </form>;

  return <section className="space-y-3">
    <h2 className="font-bold">{labels[draft.kind]}</h2>
    {draft.room && <p>{label('Room ', 'Phòng ')}{draft.room}</p>}
    <p>{draft.kind === 'wakeup' ? draft.time : draft.detail}</p>
    {error && <p role="alert">{label('The server did not confirm the request.', 'Máy chủ chưa xác nhận đã nhận phiếu.')}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={busy} onClick={confirm}>{busy ? '…' : label('Confirm and send', 'Xác nhận gửi')}</button>
      <button type="button" disabled={busy} onClick={() => setEditing(true)}>{label('Edit', 'Sửa')}</button>{cancel}
    </div>
  </section>;
}

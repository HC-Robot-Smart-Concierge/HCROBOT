// Only the stock guest-service steps need a room, a guest decision or a staff reply.
export function guestRequestPhase(workflowId, step) {
  const content = step?.params?.content_id;
  if (workflowId === 'wf-04-call-staff') {
    if (step?.step_id === 'wf4-step-1' && step.type === 'COMMUNICATE') return 'details';
    if (step?.type === 'CREATE_REQUEST' && step.params?.service_type === 'CALL_STAFF') return 'confirm';
    if (step?.type === 'SHOW' && content === 'UI_WAITING_STAFF') return 'wait';
  }
  if (!['wf-03-room-service', 'wf-08-wakeup'].includes(workflowId)) return null;
  if (step?.type === 'SHOW' && ['UI_SERVICE_FORM', 'UI_WAKEUP_FORM'].includes(content)) return 'details';
  if (step?.type === 'CREATE_REQUEST') return 'confirm';
  if (step?.type === 'SHOW' && content === 'UI_CONFIRMATION') return 'receipt';
  return null;
}

// Workflow confirmation must use an actual server response, including on retry.
export async function submitGuestRequest({ kind, room, detail, time }) {
  let path, payload;
  switch (kind) {
    case 'taxi':
      path = 'taxi/requests';
      payload = { room_number: room, destination: detail, pickup_location: 'Main Lobby', pickup_time: 'Immediate' };
      break;
    case 'cleaning':
    case 'amenities': {
      const name = kind === 'cleaning' ? 'Dọn phòng' : detail;
      path = 'room-service/orders';
      payload = { room_number: room, is_service_request: true, items: [{ name, qty: 1 }], note: detail || name };
      break;
    }
    case 'wakeup':
    case 'staff':
      path = 'reception/requests';
      payload = {
        room_number: room || 'Lobby Desk', source: 'Robot Kiosk',
        title: kind === 'staff' ? 'Khách cần gặp nhân viên lễ tân' : 'Yêu cầu gọi báo thức lúc ' + time,
        description: kind === 'staff' ? detail : 'Phòng ' + room + ' yêu cầu gọi báo thức lúc ' + time,
      };
      break;
    default:
      throw new Error('Unknown service');
  }
  const token = localStorage.getItem('aurora_jwt_token');
  const response = await fetch('/api/v1/operations/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Request failed: ' + response.status);
  const result = await response.json();
  if (!result.id) throw new Error('Missing request ID');
  return { id: result.id, code: result.ticket_code || result.order_number || result.id };
}

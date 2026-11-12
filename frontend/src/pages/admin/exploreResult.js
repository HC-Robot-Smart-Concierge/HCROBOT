// Ket qua phien tu quet map (frontier_explorer phat /explore/status JSON roi tu thoat)
// => noi dung bang "Luu map" hien ra khi robot quet xong.

export function describeExploreResult(result) {
  const detail = result?.message || '';
  switch (result?.state) {
    case 'DONE':
      return { tone: 'success', title: 'Robot đã quét xong bản đồ', detail };
    case 'FAILED':
      return { tone: 'warning', title: 'Robot dừng tự quét nhưng chưa đi được', detail };
    case 'STOPPED':
      return { tone: 'neutral', title: 'Đã dừng tự quét', detail };
    default:
      // Web khong nhan duoc ket qua (rosbridge mat ket noi...): van cho luu map hien tai.
      return {
        tone: 'neutral',
        title: 'Robot đã dừng tự quét',
        detail: 'Kiểm tra bản đồ trên màn hình rồi đặt tên để lưu.',
      };
  }
}

// fetch toi Pi that bai o tang mang (TypeError "Failed to fetch") hoac het gio => thuong la
// main.py tren Pi chua chay (Pi vua khoi dong lai) - noi ro cach bat thay vi "Failed to fetch".
export function piRequestErrorMessage(err, piIp) {
  if (err instanceof TypeError || err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return `Không kết nối được Pi (${piIp}:8000): main.py trên Pi chưa chạy hoặc Pi mất mạng. `
      + 'SSH vào Pi rồi chạy: cd ~/HCROBOT/robot && sudo python3 main.py';
  }
  return err?.message || String(err);
}

export function defaultMapName(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `map_${now.getFullYear()}_${p(now.getMonth() + 1)}_${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}`;
}

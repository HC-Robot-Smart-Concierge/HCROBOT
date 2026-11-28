const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatDateTimeCell = (isoValue) => {
  if (!isoValue) return '';
  const raw = String(isoValue).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw) ? `${raw}Z` : raw;
  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return String(isoValue);
  return dt.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Exports completed food & room service bills to an Excel-compatible .xls file with UTF-8 BOM.
 */
export function exportServiceBillsToExcel(bills = [], filename = 'hoa-don-dich-vu-le-tan.xls') {
  const totalRevenue = bills.reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);

  const rowsHtml = bills
    .map((bill, idx) => {
      const itemsText = Array.isArray(bill.items) && bill.items.length > 0
        ? bill.items
            .map((it) => `${it.qty}x ${it.name} (${Number(it.subtotal || 0).toLocaleString('vi-VN')} đ)`)
            .join('; ')
        : bill.items_summary || '';

      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${escapeHtml(bill.order_number)}</td>
          <td>${escapeHtml(formatDateTimeCell(bill.created_at))}</td>
          <td>${escapeHtml(formatDateTimeCell(bill.completed_at))}</td>
          <td style="text-align:center;">${escapeHtml(bill.room_number)}</td>
          <td>${escapeHtml(bill.guest_name)}</td>
          <td style="mso-number-format:'\\@';">${escapeHtml(bill.guest_phone || '')}</td>
          <td>${escapeHtml(bill.service_category)}</td>
          <td>${escapeHtml(itemsText)}</td>
          <td style="text-align:right;font-weight:bold;">${Number(bill.total_amount || 0)}</td>
          <td style="text-align:center;">${bill.is_settled ? 'Đã check-out' : 'Đang ở'}</td>
          <td>${escapeHtml(bill.assigned_staff_name || '')}</td>
          <td>${escapeHtml(bill.note || '')}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
          th { background-color: #1c1917; color: #ffffff; font-weight: bold; text-align: left; }
          .summary-row td { background-color: #fef3c7; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã Bill</th>
              <th>Giờ đặt</th>
              <th>Giờ hoàn thành</th>
              <th>Phòng</th>
              <th>Tên khách</th>
              <th>Số điện thoại</th>
              <th>Loại dịch vụ</th>
              <th>Món / Dịch vụ đặt</th>
              <th>Tổng tiền (VNĐ)</th>
              <th>Trạng thái lưu trú</th>
              <th>Nhân viên giao</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="summary-row">
              <td colspan="9" style="text-align:right;">TỔNG CỘNG (${bills.length} hóa đơn)</td>
              <td style="text-align:right;">${totalRevenue}</td>
              <td colspan="3"></td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.xls') ? filename : `${filename}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

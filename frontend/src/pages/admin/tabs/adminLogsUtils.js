export const formatLogMessageText = (msg, language) => {
  if (!msg || typeof msg !== 'string') return '';
  const isEN = language === 'EN';

  // Helper: translate department or role strings
  const translateDeptOrRole = (info) => {
    if (!info) return '';
    const map = {
      'Bộ phận Quản trị': 'Operations Admin',
      'Bộ Phận Quản Trị': 'Operations Admin',
      'Bộ phận Bếp': 'Kitchen Dept',
      'Bộ phận Hành lý': 'Bellman Dept',
      'Bộ phận Nhà hàng': 'Restaurant Dept',
      'Bộ phận Trợ lý Concierge & Đặt xe': 'Concierge & Taxi Booking',
      'Bộ phận Buồng phòng': 'Housekeeping Dept',
      'Bộ phận Lễ tân': 'Reception Dept',
      'Bộ phận Phục vụ phòng': 'Room Service Dept',
      'Bộ phận Kỹ thuật': 'Maintenance Dept',
      'Bộ phận Y tế': 'Medical Dept',
      'Bộ phận Hậu cần': 'Logistics Dept',
      'Bộ phận An ninh': 'Security Dept',
      'Bộ phận Dịch vụ khách hàng': 'Customer Service Dept',
    };
    return map[info.trim()] || info;
  };

  // 1. Raw pattern: [STAFF] admin performed LOGIN on SESSION:...
  const staffMatch = msg.match(/^\[([A-Z_]+)\]\s+([\w\d_-]+)\s+performed\s+([A-Z_]+)(?:\s+on\s+([A-Z_]+):?([^\s]*))?/i);
  if (staffMatch) {
    const [, , actor, action, resource] = staffMatch;
    const act = action.toUpperCase();
    const isRobot = actor.toLowerCase().startsWith('robot');

    if (isEN) {
      const prefix = isRobot ? 'Robot' : 'Staff';
      const resStr = resource ? ` (${resource})` : '';
      if (act === 'LOGIN') return `${prefix} '${actor}' successfully logged into the system.`;
      if (act === 'LOGOUT') return `${prefix} '${actor}' successfully logged out of the system.`;
      if (act === 'CREATE') return `${prefix} '${actor}' created new data${resStr}.`;
      if (act === 'UPDATE') return `${prefix} '${actor}' updated data${resStr}.`;
      if (act === 'DELETE') return `${prefix} '${actor}' deleted data from the system${resStr}.`;
      return `${prefix} '${actor}' performed ${action.toLowerCase()} action.`;
    } else {
      const prefix = isRobot ? 'Robot' : 'Nhân viên';
      const resStr = resource ? ` (${resource})` : '';
      if (act === 'LOGIN') return `${prefix} '${actor}' đã đăng nhập thành công vào hệ thống.`;
      if (act === 'LOGOUT') return `${prefix} '${actor}' đã đăng xuất thành công khỏi hệ thống.`;
      if (act === 'CREATE') return `${prefix} '${actor}' đã tạo mới dữ liệu${resStr}.`;
      if (act === 'UPDATE') return `${prefix} '${actor}' đã cập nhật thông tin dữ liệu${resStr}.`;
      if (act === 'DELETE') return `${prefix} '${actor}' đã xóa dữ liệu khỏi hệ thống${resStr}.`;
      return `${prefix} '${actor}' đã thực hiện thao tác ${action.toLowerCase()}.`;
    }
  }

  // 2. Stored Vietnamese patterns:
  // e.g. "Nhân viên 'admin' (Bộ phận Quản trị) đã đăng nhập thành công vào hệ thống."
  //      "Nhân viên 'robot_01' (Robot Kiosk Unit 01) đã đăng nhập thành công vào hệ thống."
  //      "Nhân viên 'bellman' (Bộ phận Hành lý) đã đăng xuất thành công khỏi hệ thống."
  //      "Nhân viên 'admin' đã đăng nhập thành công vào hệ thống."
  const vnStaffRegex = /^(?:Nhân viên|Robot)\s+'([^']+)'(?:\s+\(([^)]+)\))?\s+(.+)$/i;
  const vnMatch = msg.match(vnStaffRegex);
  if (vnMatch) {
    const [, actor, info, actionText] = vnMatch;
    const isRobot = actor.toLowerCase().startsWith('robot') || (info && info.toLowerCase().includes('robot'));

    if (isEN) {
      const prefix = isRobot ? 'Robot' : 'Staff';
      const infoStr = info ? ` (${translateDeptOrRole(info)})` : '';

      if (/đã đăng nhập thành công/i.test(actionText)) {
        return `${prefix} '${actor}'${infoStr} successfully logged into the system.`;
      }
      if (/đã đăng xuất thành công/i.test(actionText)) {
        return `${prefix} '${actor}'${infoStr} successfully logged out of the system.`;
      }
      if (/đã tạo mới dữ liệu/i.test(actionText)) {
        const res = actionText.match(/\(([^)]+)\)/);
        return `${prefix} '${actor}'${infoStr} created new data${res ? ` (${res[1]})` : ''}.`;
      }
      if (/đã cập nhật/i.test(actionText)) {
        const res = actionText.match(/\(([^)]+)\)/);
        return `${prefix} '${actor}'${infoStr} updated data${res ? ` (${res[1]})` : ''}.`;
      }
      if (/đã xóa dữ liệu/i.test(actionText)) {
        const res = actionText.match(/\(([^)]+)\)/);
        return `${prefix} '${actor}'${infoStr} deleted data from the system${res ? ` (${res[1]})` : ''}.`;
      }
      if (/đã thực hiện thao tác/i.test(actionText)) {
        const actMatch = actionText.match(/đã thực hiện thao tác\s+([^\s.]+)/i);
        return `${prefix} '${actor}'${infoStr} performed ${actMatch ? actMatch[1] : 'an'} action on the system.`;
      }
      return `${prefix} '${actor}'${infoStr} ${actionText}`;
    } else {
      if (isRobot && msg.startsWith('Nhân viên')) {
        return msg.replace(/^Nhân viên/, 'Robot');
      }
      return msg;
    }
  }

  // 3. Failed login attempt pattern
  if (!isEN) {
    const failedMatch = msg.match(/^Failed login attempt for username '([^']+)'/i);
    if (failedMatch) {
      return `Đăng nhập thất bại cho tài khoản '${failedMatch[1]}'`;
    }
  }

  // 4. Session & token cleanup
  const sessionText = isEN ? 'Session' : 'Phiên làm việc';
  return msg.replace(/SESSION:[a-zA-Z0-9_\-]+/gi, sessionText)
            .replace(/token:[a-zA-Z0-9_\-\.]+/gi, '***');
};

export const formatTimestampText = (ts, language) => {
  if (!ts) return '--:--:--';
  try {
    const d = new Date(ts);
    const locale = language === 'EN' ? 'en-US' : 'vi-VN';
    return d.toLocaleTimeString(locale, { hour12: false }) + ' ' + d.toLocaleDateString(locale);
  } catch {
    return ts;
  }
};

export const getLevelBadgeStyle = (level = '') => {
  const l = level.toUpperCase();
  if (l === 'CRITICAL' || l === 'ERROR') {
    return {
      backgroundColor: '#262626',
      color: '#F2EFE9',
      borderColor: '#262626',
    };
  }
  if (l === 'WARNING') {
    return {
      backgroundColor: '#E9E5DC',
      color: '#262626',
      borderColor: '#BFBFBD',
    };
  }
  return {
    backgroundColor: '#FFFFFF',
    color: '#8C8C8C',
    borderColor: '#BFBFBD',
  };
};

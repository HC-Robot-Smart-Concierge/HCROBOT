// Danh sach toa do cac diem moc Sanh Tang Tret (Ground Floor - Lobby Arena)
// Khong co tram sac robot, robot mac dinh o vi tri truc Goc Tren Ben Phai cua Lobby (x: 3.7, y: 5.0)
export const ROBOT_INITIAL_POSE = { x: 3.7, y: 5.0, yaw: -Math.PI / 2 };

export const GAZEBO_LOBBY_WAYPOINTS = {
  ROBOT_STANDBY: {
    x: 3.7,
    y: 5.0,
    name: 'Vị Trí Chờ Robot (Góc Trên Bên Phải Lobby)',
    badge: 'Robot Sảnh',
    label: 'Vị Trí Robot Sảnh',
    role: 'standby',
    offset: 'bottom',
  },
  LOBBY_LOUNGE: {
    x: 2.0,
    y: 2.8,
    name: 'Khu Sofa Sảnh (Lobby Lounge)',
    badge: 'Khu Sofa Sảnh',
    label: 'Khu Sofa Sảnh',
    role: 'lounge',
    offset: 'top',
  },
  MAIN_ENTRANCE: {
    x: 5.2,
    y: 1.0,
    name: 'Cửa Chính Ra Vào Sảnh',
    badge: 'Cửa Chính Sảnh',
    label: 'Cửa Chính Ra Vào Sảnh',
    role: 'entrance',
    offset: 'top',
  },
  FRONT_DESK: {
    x: 6.4,
    y: 2.0,
    name: 'Quầy Lễ Tân (Front Desk)',
    badge: 'Quầy Lễ Tân',
    label: 'Quầy Lễ Tân (Front Desk)',
    role: 'facility',
    offset: 'top',
  },
  ELEVATOR: {
    x: 7.8,
    y: 4.5,
    name: 'Cụm Thang Máy Tầng 1',
    badge: 'Thang Máy',
    label: 'Cụm Thang Máy',
    role: 'facility',
    offset: 'bottom',
  },
  RESTROOMS: {
    x: 6.6,
    y: 4.5,
    name: 'Nhà Vệ Sinh Sảnh (Restrooms)',
    badge: 'Nhà Vệ Sinh (WC)',
    label: 'Nhà Vệ Sinh (WC)',
    role: 'facility',
    offset: 'bottom',
  },
  STAIRS: {
    x: 8.8,
    y: 4.5,
    name: 'Cầu Thang Bộ Thoát Hiểm',
    badge: 'Cầu Thang Bộ',
    label: 'Cầu Thang Bộ',
    role: 'facility',
    offset: 'bottom',
  },
  STAFF_ONLY: {
    x: 8.5,
    y: 2.0,
    name: 'Phòng Nhân Viên (Staff Only)',
    badge: 'Phòng Nội Bộ',
    label: 'Phòng Nhân Viên (Staff Only)',
    role: 'staff',
    offset: 'bottom',
  },
  CENTRAL_LOBBY: {
    x: 5.2,
    y: 2.8,
    name: 'Khu Vực Trung Tâm Sảnh',
    badge: 'Trung Tâm Sảnh',
    label: 'Khu Vực Trung Tâm Sảnh',
    role: 'area',
    offset: 'top',
  },
  // Backward compatibility aliases
  ZONE_LOBBY: { x: 5.2, y: 1.0, badge: 'Cửa Chính Sảnh', label: 'Cửa Chính Sảnh' },
  DOCK_LOBBY: { x: 3.7, y: 5.0, badge: 'Robot Sảnh', label: 'Vị Trí Robot Sảnh' },
  DOCK_01: { x: 3.7, y: 5.0, badge: 'Robot Sảnh', label: 'Vị Trí Robot Sảnh' },
  HOTSPOT_LOBBY: { x: 5.2, y: 2.8, badge: 'Trung Tâm Sảnh', label: 'Khu Vực Trung Tâm Sảnh' },
  RESTAURANT_GATE: { x: 6.4, y: 2.0, badge: 'Quầy Lễ Tân', label: 'Quầy Lễ Tân (Front Desk)' },
  CORRIDOR_NORTH: { x: 6.6, y: 4.5, badge: 'Nhà Vệ Sinh (WC)', label: 'Nhà Vệ Sinh (WC)' },
  LOBBY_NORTHEAST: { x: 7.8, y: 4.5, badge: 'Thang Máy', label: 'Cụm Thang Máy' },
  ELEVATOR_CLUSTER: { x: 7.8, y: 4.5, badge: 'Thang Máy', label: 'Cụm Thang Máy' },
};

// Chuyen toa do Met (ROS: X 0..10m, Y 0..6m) sang Toa do SVG Canvas (1000 x 600)
export const meterToSvg = (mx, my) => {
  const safeX = typeof mx === 'number' && !isNaN(mx) ? mx : 3.7;
  const safeY = typeof my === 'number' && !isNaN(my) ? my : 5.0;
  const clampedX = Math.max(0, Math.min(10.0, safeX));
  const clampedY = Math.max(0, Math.min(6.0, safeY));
  const svgX = 50 + (clampedX / 10.0) * 900;
  const svgY = 550 - (clampedY / 6.0) * 500;
  return { x: svgX, y: svgY };
};

// Chuyen nguoc tu Toa do SVG Canvas sang Toa do Met (ROS: X 0..10m, Y 0..6m)
export const svgToMeter = (svgX, svgY) => {
  const clampedSvgX = Math.max(50, Math.min(950, svgX));
  const clampedSvgY = Math.max(50, Math.min(550, svgY));
  const mx = ((clampedSvgX - 50) / 900) * 10.0;
  const my = ((550 - clampedSvgY) / 500) * 6.0;
  return {
    x: Number(mx.toFixed(2)),
    y: Number(my.toFixed(2)),
  };
};

// THUAT TOAN DINH TUYEN NE TUONG VA VAT CAN TRONG SANH (Ground Floor Lobby)
// Tranh vach ngan x=4.4m bang cach di qua cua thong sanh (4.4, 2.85) va tranh quay tiep tan
export const calculateSafeWaypoints = (from, to) => {
  const points = [{ x: Number(from.x.toFixed(2)), y: Number(from.y.toFixed(2)) }];

  const fromIsLeft = from.x < 4.4;
  const toIsLeft = to.x < 4.4;

  if (fromIsLeft && !toIsLeft) {
    // Di tu Gian Trai sang Gian Phai -> BAT BUOC phai qua Cua Thong Sanh o giua vach ngan
    if (Math.abs(from.y - 2.85) > 0.3 || from.x < 3.6) {
      points.push({ x: 3.8, y: 2.85 });
    }
    // Di xuyen qua tam Cua Thong Sanh
    points.push({ x: 4.4, y: 2.85 });
    // Thoat sang hanh lang Gian Phai
    points.push({ x: 5.1, y: 2.85 });

    // Tu Gian Phai re huong tiep can dich den an toan
    if (to.y < 2.0) {
      // Huong xuong phia Nam (Cua Chinh hoac Quay Tiep Tan)
      points.push({ x: 5.2, y: 1.8 });
    } else if (to.y > 3.6) {
      // Huong len phia Bac (Thang May, Restrooms, Stairs)
      points.push({ x: 5.2, y: 4.0 });
    }
  } else if (!fromIsLeft && toIsLeft) {
    // Di tu Gian Phai ve Gian Trai -> BAT BUOC phai tap ket ve Cua Thong Sanh
    if (from.y < 2.0) {
      points.push({ x: 5.2, y: 1.8 });
    } else if (from.y > 3.6) {
      points.push({ x: 5.2, y: 4.0 });
    }
    points.push({ x: 5.1, y: 2.85 });
    // Di xuyen qua tam Cua Thong Sanh
    points.push({ x: 4.4, y: 2.85 });
    // Thoat sang hanh lang Gian Trai
    points.push({ x: 3.8, y: 2.85 });
  } else if (!fromIsLeft && !toIsLeft) {
    // Cung o Gian Phai: Kiem tra vuong Quay Front Desk (x: 5.8-6.8, y: 0.8-2.6)
    const crossesDesk = (from.y < 2.3 && to.y > 3.5) || (from.y > 3.5 && to.y < 2.3);
    if (crossesDesk) {
      points.push({ x: 5.2, y: from.y < 2.3 ? 2.5 : 3.5 });
      points.push({ x: 5.2, y: from.y < 2.3 ? 3.5 : 2.5 });
    }
  } else {
    // Cung o Gian Trai: Tranh sofa sat tuong tay (x <= 1.5)
    if (from.x < 1.8 || to.x < 1.8) {
      points.push({ x: 2.6, y: Number(((from.y + to.y) / 2).toFixed(2)) });
    }
  }

  // Them diem dich cuoi cung
  points.push({ x: Number(to.x.toFixed(2)), y: Number(to.y.toFixed(2)) });

  // Loc bo cac diem trung nhau hoac qua gan (< 0.15m)
  const filtered = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1];
    const cur = points[i];
    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > 0.15) {
      filtered.push(cur);
    }
  }

  return filtered;
};

// GIAI MA VA HIEN THI CHI TIET CHO TUNG ENUM BUOC (SHOW, SPEAK, GREET, LISTEN, v.v.)
export const getStepActionDetail = (step) => {
  if (!step) {
    return {
      label: 'READY',
      shortChip: 'San sang',
      detailText: 'Robot o trang thai cho lenh',
      bubbleTitle: 'TRANG THAI',
      bubbleBody: 'San sang phuc vu tai Sanh',
    };
  }

  const type = step.type || 'UNKNOWN';
  const params = step.params || {};
  const rawTitle = (step.title || '').replace(/^\d+\.\s*/, '');

  switch (type) {
    case 'SHOW': {
      const screenType = params.screen_type || 'MENU';
      const contentId = params.content_id || '';
      let displayContent = '';
      let shortName = 'Man hinh';

      if (screenType === 'LANGUAGE_SELECT' || contentId === 'UI_LANG') {
        displayContent = 'Man hinh Chon ngon ngu (Tieng Viet / English / 中文)';
        shortName = 'Chon ngon ngu';
      } else if (contentId === 'UI_MAIN_MENU' || screenType === 'MENU') {
        displayContent = 'Thuc don Tien ich Sanh & Dich vu Khach san';
        shortName = 'Thuc don dich vu';
      } else if (contentId === 'UI_RECOMMEND_LIST') {
        displayContent = 'Danh muc Goi y Am thuc & Set Tra chieu sảnh';
        shortName = 'Goi y am thuc';
      } else if (contentId === 'UI_SERVICE_FORM') {
        displayContent = 'Bieu mau Tiep nhan Yeu cau Buong phong & Taxi';
        shortName = 'Bieu mau dich vu';
      } else if (contentId === 'UI_CONFIRMATION') {
        displayContent = 'Man hinh Thong bao Xac nhan Yeu cau Thanh cong';
        shortName = 'Xac nhan yeu cau';
      } else if (screenType === 'MAP' || contentId === 'MAP_LOBBY') {
        displayContent = 'So do Huong dan Duong di Sanh Tang tret';
        shortName = 'So do sanh';
      } else if (screenType === 'QR_CODE') {
        displayContent = 'Ma QR Quet Check-in & Thanh toan';
        shortName = 'Ma QR Check-in';
      } else {
        displayContent = rawTitle || screenType;
        shortName = rawTitle.slice(0, 16) || screenType;
      }

      return {
        label: 'SHOW',
        shortChip: `SHOW: ${shortName}`,
        detailText: `Hien thi man hinh Kiosk: ${displayContent}`,
        bubbleTitle: 'MAN HINH KIOSK (SHOW)',
        bubbleBody: displayContent,
      };
    }

    case 'SPEAK': {
      const speech = params.text || params.speech_text || rawTitle || 'Thong bao toi quy khach';
      return {
        label: 'SPEAK',
        shortChip: `SPEAK: Thong bao`,
        detailText: `Phat giong noi: "${speech}"`,
        bubbleTitle: 'PHAT GIONG NOI (SPEAK)',
        bubbleBody: `"${speech}"`,
      };
    }

    case 'GREET': {
      const greet = params.greeting_text || params.text || 'Dạ em chào quý khách!';
      return {
        label: 'GREET',
        shortChip: `GREET: Chao khach`,
        detailText: `Loi chao don: "${greet}"`,
        bubbleTitle: 'CHAO DON KHACH (GREET)',
        bubbleBody: `"${greet}"`,
      };
    }

    case 'LISTEN': {
      const src =
        params.input_source === 'VOICE'
          ? 'Giong noi'
          : params.input_source === 'TOUCH'
          ? 'Cham cam ung'
          : 'Giong noi / Cham cam ung';
      const prompt = rawTitle || 'Cho khach tuong tac';
      return {
        label: 'LISTEN',
        shortChip: `LISTEN: ${params.input_source === 'TOUCH' ? 'Cham Kiosk' : 'Giong noi'}`,
        detailText: `Tiep nhan tu khach: ${prompt} (Kenh: ${src})`,
        bubbleTitle: 'DANG LANG NGHE (LISTEN)',
        bubbleBody: `${prompt} (${src})`,
      };
    }

    case 'RECOMMEND': {
      const item =
        params.highlight_item || params.item_name || params.category || 'Mon an & Tien ich sanh';
      return {
        label: 'RECOMMEND',
        shortChip: `RECOMMEND: Goi y`,
        detailText: `Goi y thong minh: ${item}`,
        bubbleTitle: 'GOI Y THONG MINH (RECOMMEND)',
        bubbleBody: item,
      };
    }

    case 'CREATE_REQUEST': {
      const req =
        params.note ||
        `${params.service_type || 'Dich vu buong phong'} (Phong ${params.room_number || 'Sanh'})`;
      return {
        label: 'CREATE_REQUEST',
        shortChip: `REQUEST: Gui yeu cau`,
        detailText: `Tao phieu yeu cau he thong: ${req}`,
        bubbleTitle: 'TAO PHIEU YEU CAU (REQUEST)',
        bubbleBody: req,
      };
    }

    case 'FEEDBACK': {
      const q = params.question || 'Khao sat danh gia chat luong phuc vu tai sanh';
      return {
        label: 'FEEDBACK',
        shortChip: `FEEDBACK: Khao sat`,
        detailText: `Thu thap danh gia: ${q}`,
        bubbleTitle: 'KHAO SAT Y KIEN (FEEDBACK)',
        bubbleBody: q,
      };
    }

    case 'MOVE': {
      const wp = params.waypoint_name || params.target_value || 'Diem den';
      return {
        label: 'MOVE',
        shortChip: `MOVE: ${wp.split('(')[0].trim()}`,
        detailText: `Dieu huong ne tuong & vat can den: ${wp}`,
        bubbleTitle: 'DI CHUYEN NE VAT CAN (MOVE)',
        bubbleBody: `Den: ${wp}`,
      };
    }

    default:
      return {
        label: type,
        shortChip: type,
        detailText: rawTitle || type,
        bubbleTitle: type,
        bubbleBody: rawTitle || type,
      };
  }
};

// DANH SACH KICH BAN MO PHONG DU PHONG (BUILT-IN FALLBACK WORKFLOWS)
// Dam bao simulator luon luon hoat dong ngay ca khi API backend chua tai xong
export const BUILTIN_SIMULATOR_WORKFLOWS = [
  {
    id: 'wf-01-welcome',
    name: 'Workflow 1: Don tiep & Chao mung khach tai Cua Sanh',
    description: 'Robot tu tram cho di chuyen ra Cua chinh don khach moi vao sanh, chao hoi va mo menu.',
    steps: [
      {
        step_id: 'wf1-step-1',
        type: 'MOVE',
        title: '1. Di chuyen ra Cua chinh don khach',
        params: {
          target_type: 'LOCATION',
          target_value: 'MAIN_ENTRANCE',
          waypoint_name: 'Cua Chinh Ra Vao Sanh (Main Entrance)',
          target_x: 5.2,
          target_y: 1.0,
          speed: 0.35,
        },
      },
      {
        step_id: 'wf1-step-2',
        type: 'GREET',
        title: '2. Chao don khach niem no',
        params: {
          template_id: 'TPL_WELCOME',
          language: 'vi',
          expression: 'SMILE',
          greeting_text: 'Da em chao quy khach! Chao mung quy khach den voi khach san.',
        },
      },
      {
        step_id: 'wf1-step-3',
        type: 'SHOW',
        title: '3. Mo man hinh chon ngon ngu',
        params: {
          screen_type: 'LANGUAGE_SELECT',
          content_id: 'UI_LANG',
          timeout: 4,
        },
      },
      {
        step_id: 'wf1-step-4',
        type: 'LISTEN',
        title: '4. Cho khach cham chon ngon ngu',
        params: {
          input_source: 'TOUCH',
          timeout: 3,
        },
      },
      {
        step_id: 'wf1-step-5',
        type: 'SHOW',
        title: '5. Bat thuc don tien ich sanh & dich vu',
        params: {
          screen_type: 'MENU',
          content_id: 'UI_MAIN_MENU',
          timeout: 4,
        },
      },
    ],
  },
  {
    id: 'wf-04-call-staff',
    name: 'Workflow 4: Huong dan & Dan khach toi Quay Le Tan (Front Desk)',
    description: 'Dan khach tu khu sofa qua Quay Le Tan khi khach can gap nhan vien truc tiep.',
    steps: [
      {
        step_id: 'wf4-step-1',
        type: 'SPEAK',
        title: '1. Thong bao huong dan toi quay le tan',
        params: {
          text: 'Xin moi quy khach di theo em toi quay tiep tan a.',
        },
      },
      {
        step_id: 'wf4-step-2',
        type: 'MOVE',
        title: '2. Dan khach toi Quay Le Tan (Front Desk)',
        params: {
          target_type: 'LOCATION',
          target_value: 'FRONT_DESK',
          waypoint_name: 'Quay Le Tan (Front Desk)',
          target_x: 6.4,
          target_y: 2.0,
          speed: 0.35,
        },
      },
      {
        step_id: 'wf4-step-3',
        type: 'SHOW',
        title: '3. Man hinh ket noi nhan vien truc quay',
        params: {
          screen_type: 'QR_CODE',
          content_id: 'UI_CONFIRMATION',
          timeout: 4,
        },
      },
    ],
  },
  {
    id: 'wf-07-guide-tour',
    name: 'Workflow 7: Chi duong & Dan khach toi Cum Thang May (Elevator)',
    description: 'Dan khach tu Tram Cho sang Cum Thang May, tu dong ne vach ngan 4.4m va di qua cua thong.',
    steps: [
      {
        step_id: 'wf7-step-1',
        type: 'SHOW',
        title: '1. Bat so do ban do sanh Tang Tret',
        params: {
          screen_type: 'MAP',
          content_id: 'MAP_LOBBY',
          timeout: 3,
        },
      },
      {
        step_id: 'wf7-step-2',
        type: 'SPEAK',
        title: '2. Huong dan khach di theo robot toi thang may',
        params: {
          text: 'Da, em xin phep dan quy khach toi cum thang may de len phong a.',
        },
      },
      {
        step_id: 'wf7-step-3',
        type: 'MOVE',
        title: '3. Dan duong toi Cum Thang May',
        params: {
          target_type: 'LOCATION',
          target_value: 'ELEVATOR',
          waypoint_name: 'Cum Thang May (Elevator)',
          target_x: 7.8,
          target_y: 4.5,
          speed: 0.35,
        },
      },
      {
        step_id: 'wf7-step-4',
        type: 'SPEAK',
        title: '4. Thong bao da den khu vuc thang may',
        params: {
          text: 'Chung ta da den khu vuc thang may. Chuc quy khach mot ngay tot lanh!',
        },
      },
    ],
  },
  {
    id: 'wf-05-feedback',
    name: 'Workflow 5: Danh gia dich vu & Robot ve Tram Sac Sanh',
    description: 'Thu thap danh gia hai long va dua robot quay ve tram sac Robot Sanh.',
    steps: [
      {
        step_id: 'wf5-step-1',
        type: 'SHOW',
        title: '1. Hien giao dien cham diem 5 sao',
        params: {
          screen_type: 'FEEDBACK',
          timeout: 3,
        },
      },
      {
        step_id: 'wf5-step-2',
        type: 'FEEDBACK',
        title: '2. Thu thap diem hai long tu khach',
        params: {
          question: 'Quy khach co hai long voi su phuc vu cua robot khong a?',
        },
      },
      {
        step_id: 'wf5-step-3',
        type: 'MOVE',
        title: '3. Robot tro ve Tram Sac Robot Sanh',
        params: {
          target_type: 'LOCATION',
          target_value: 'DOCK_LOBBY',
          waypoint_name: 'Trạm Sạc Robot Sảnh',
          target_x: 3.2,
          target_y: 2.8,
          speed: 0.35,
        },
      },
    ],
  },
];

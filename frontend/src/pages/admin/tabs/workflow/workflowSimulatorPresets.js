import { FRONT_DOOR_APPROACH, GAZEBO_LOBBY_WAYPOINTS } from './workflowSimulatorZones';

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
        detailText: `Hien thi man hinh Robot: ${displayContent}`,
        bubbleTitle: 'MAN HINH ROBOT (SHOW)',
        bubbleBody: displayContent,
      };
    }

    case 'COMMUNICATE': {
      const prompt = params.initial_prompt || params.speech_text || params.text || rawTitle || 'Đối thoại hai chiều với khách';
      const timeout = params.silence_timeout_sec || params.timeout || 30;
      const src = params.input_source === 'VOICE' ? 'Giọng nói' : params.input_source === 'TOUCH' ? 'Chạm cảm ứng' : 'Giọng nói & Chạm';
      return {
        label: 'COMMUNICATE',
        shortChip: `COMMUNICATE: Đối thoại AI (30s)`,
        detailText: `Đối thoại AI 2 chiều (${src}): "${prompt}" (Tự ngắt sau ${timeout}s im lặng)`,
        bubbleTitle: 'ĐỐI THOẠI AI 2 CHIỀU (COMMUNICATE)',
        bubbleBody: `"${prompt}"`,
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
        shortChip: `LISTEN: ${params.input_source === 'TOUCH' ? 'Cham Robot' : 'Giong noi'}`,
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

    case 'CHOICE': {
      const options = Array.isArray(params.options) ? params.options : [];
      const prompt = params.prompt || rawTitle || 'Chờ khách lựa chọn';
      const labels = options.map((o) => o?.label || o?.id).filter(Boolean).join(' / ');
      return {
        label: 'CHOICE',
        shortChip: `CHOICE: ${options.length} lựa chọn`,
        detailText: `Chờ khách chọn: ${labels || prompt}`,
        bubbleTitle: 'CHỜ KHÁCH LỰA CHỌN (CHOICE)',
        bubbleBody: prompt,
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
      const fromWpKey = params.from_waypoint;
      const toWpKey = params.target_value || params.target_waypoint_id;
      const fromWpName =
        params.from_waypoint_name ||
        (fromWpKey && GAZEBO_LOBBY_WAYPOINTS[fromWpKey]?.name) ||
        'Vị trí hiện tại';
      const toWpName =
        params.waypoint_name ||
        (toWpKey && GAZEBO_LOBBY_WAYPOINTS[toWpKey]?.name) ||
        params.target_value ||
        'Điểm đến';

      const isCurrentStart = !fromWpKey || fromWpKey === 'CURRENT';
      const toShort = toWpName.split('(')[0].trim();
      const fromShort = fromWpName.split('(')[0].trim();

      return {
        label: 'MOVE',
        shortChip: isCurrentStart ? `MOVE: ${toShort}` : `MOVE: ${fromShort} ➔ ${toShort}`,
        detailText: isCurrentStart
          ? `Điều hướng né vật cản đến: ${toWpName}`
          : `Lộ trình: ${fromWpName} ➔ ${toWpName}`,
        bubbleTitle: isCurrentStart ? 'DI CHUYỂN NÉ VẬT CẢN (MOVE)' : 'LỘ TRÌNH ĐIỂM MỐC (MOVE)',
        bubbleBody: isCurrentStart ? `Đến: ${toWpName}` : `Từ: ${fromWpName}\nĐến: ${toWpName}`,
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
          from_waypoint: 'ROBOT_STANDBY',
          from_waypoint_name: 'Vị Trí Chờ Robot Sảnh',
          target_type: 'LOCATION',
          target_value: 'MAIN_ENTRANCE',
          waypoint_name: 'Cửa Chính Ra Vào Sảnh (Main Entrance)',
          target_x: FRONT_DOOR_APPROACH.x,
          target_y: FRONT_DOOR_APPROACH.y,
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
        type: 'COMMUNICATE',
        title: '4. Giao tiếp & xác nhận yêu cầu của khách',
        params: {
          initial_prompt: 'Dạ em chào quý khách, em có thể hỗ trợ quý khách thông tin gì ạ?',
          silence_timeout_sec: 30,
          input_source: 'BOTH',
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
        type: 'COMMUNICATE',
        title: '1. Thong bao huong dan & doi thoai voi khach',
        params: {
          initial_prompt: 'Xin moi quy khach di theo em toi quay tiep tan a.',
          silence_timeout_sec: 30,
        },
      },
      {
        step_id: 'wf4-step-2',
        type: 'MOVE',
        title: '2. Dan khach toi Quay Le Tan (Front Desk)',
        params: {
          from_waypoint: 'LOBBY_LOUNGE',
          from_waypoint_name: 'Khu Sofa Khách Chờ Sảnh',
          target_type: 'LOCATION',
          target_value: 'FRONT_DESK',
          waypoint_name: 'Trước Quầy Lễ Tân (Front Desk)',
          target_x: GAZEBO_LOBBY_WAYPOINTS.FRONT_DESK.x,
          target_y: GAZEBO_LOBBY_WAYPOINTS.FRONT_DESK.y,
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
        type: 'COMMUNICATE',
        title: '2. Huong dan khach di theo robot toi thang may',
        params: {
          initial_prompt: 'Da, em xin phep dan quy khach toi cum thang may de len phong a.',
          silence_timeout_sec: 30,
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
          target_x: GAZEBO_LOBBY_WAYPOINTS.ELEVATOR.x,
          target_y: GAZEBO_LOBBY_WAYPOINTS.ELEVATOR.y,
          speed: 0.35,
        },
      },
      {
        step_id: 'wf7-step-4',
        type: 'COMMUNICATE',
        title: '4. Thong bao da den khu vuc thang may & giai dap them',
        params: {
          initial_prompt: 'Chung ta da den khu vuc thang may. Chuc quy khach mot ngay tot lanh! Quy khach can em giup gi them khong a?',
          silence_timeout_sec: 30,
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
        title: '3. Robot tro ve Vi Tri Cho Sanh',
        params: {
          target_type: 'STANDBY',
          target_value: 'ROBOT_STANDBY',
          waypoint_name: 'Vị Trí Chờ Robot Sảnh',
          target_x: GAZEBO_LOBBY_WAYPOINTS.ROBOT_STANDBY.x,
          target_y: GAZEBO_LOBBY_WAYPOINTS.ROBOT_STANDBY.y,
          speed: 0.35,
        },
      },
    ],
  },
];

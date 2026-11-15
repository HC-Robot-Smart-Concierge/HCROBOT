import { getStepActionDetail } from './workflowSimulatorUtils';

/**
 * Derive compact robot status badge metadata from active workflow step, path, and manual nav state.
 */
export function deriveRobotStatus({ activeStep, isMoving, manualNavLabel }) {
  const hasMediaMove =
    activeStep?.type === 'MOVE' &&
    (Boolean(activeStep.params?.show_media_on_move) ||
      Boolean(activeStep.params?.media_url) ||
      activeStep.params?.screen_mode === 'PROMO_VIDEO' ||
      activeStep.params?.screen_mode === 'PROMO_IMAGE');
  const hasBroadcast = activeStep?.type === 'MOVE' && Boolean(activeStep.params?.broadcast_speech);

  if (isMoving || (manualNavLabel && manualNavLabel.startsWith('Toi:'))) {
    if (hasMediaMove) {
      return {
        code: 'PATROL_MEDIA',
        label: 'TUẦN TRA • CHIẾU QC',
        dotColor: '#E11D48',
        isMoving: true,
      };
    }
    if (hasBroadcast) {
      return {
        code: 'PATROL',
        label: 'TUẦN TRA & PHÁT LOA',
        dotColor: '#6366F1',
        isMoving: true,
      };
    }
    return {
      code: 'NAV',
      label: 'ĐIỀU HƯỚNG',
      dotColor: '#262626',
      isMoving: true,
    };
  }

  if (activeStep) {
    switch (activeStep.type) {
      case 'MOVE':
        if (hasMediaMove) {
          return { code: 'PATROL_MEDIA', label: 'TUẦN TRA • CHIẾU QC', dotColor: '#E11D48', isMoving: true };
        }
        return hasBroadcast
          ? { code: 'PATROL', label: 'TUẦN TRA & PHÁT LOA', dotColor: '#6366F1', isMoving: true }
          : { code: 'NAV', label: 'ĐIỀU HƯỚNG', dotColor: '#262626', isMoving: true };
      case 'SHOW': {
        const isVid =
          activeStep.params?.media_type === 'VIDEO' ||
          activeStep.params?.screen_mode === 'PROMO_VIDEO' ||
          (activeStep.params?.media_url && /\.(mp4|webm)$/i.test(activeStep.params.media_url));
        const isImg =
          activeStep.params?.media_type === 'IMAGE' ||
          activeStep.params?.screen_mode === 'PROMO_IMAGE' ||
          activeStep.params?.screen_mode === 'PROMO_SUMMER';
        if (isVid) {
          return { code: 'SHOW_VIDEO', label: 'CHIẾU VIDEO QUẢNG CÁO', dotColor: '#E11D48', isMoving: false };
        }
        if (isImg) {
          return { code: 'SHOW_IMAGE', label: 'CHIẾU POSTER QUẢNG CÁO', dotColor: '#E11D48', isMoving: false };
        }
        return { code: 'SHOW', label: 'MÀN HÌNH QUẢNG CÁO', dotColor: '#E11D48', isMoving: false };
      }
      case 'GREET':
        return { code: 'GREET', label: 'CHÀO KHÁCH', dotColor: '#059669', isMoving: false };
      case 'SPEAK':
        return { code: 'SPEAK', label: 'PHÁT GIỌNG NÓI', dotColor: '#059669', isMoving: false };
      case 'LISTEN':
        return { code: 'LISTEN', label: 'LẮNG NGHE', dotColor: '#D97706', isMoving: false };
      case 'RECOMMEND':
        return { code: 'REC', label: 'GỢI Ý', dotColor: '#D97706', isMoving: false };
      case 'FEEDBACK':
        return { code: 'RATE', label: 'ĐÁNH GIÁ', dotColor: '#059669', isMoving: false };
      default:
        return { code: activeStep.type, label: activeStep.type, dotColor: '#262626', isMoving: false };
    }
  }

  if (manualNavLabel && manualNavLabel.startsWith('Da den')) {
    return {
      code: 'ARRIVED',
      label: 'ĐÃ ĐẾN NƠI',
      dotColor: '#059669',
      isMoving: false,
    };
  }

  return {
    code: 'READY',
    label: 'SẴN SÀNG',
    dotColor: '#059669',
    isMoving: false,
  };
}

/**
 * Derive rich step bubble details for HUD/toolbar chip and above-robot speech bubble.
 */
export function deriveActiveStepDetail({ activeStep, manualNavLabel }) {
  if (activeStep) {
    if (activeStep.type === 'SHOW') {
      return {
        label: 'SHOW',
        bubbleTitle: 'CHIẾU QUẢNG CÁO MÀN HÌNH',
        bubbleBody: activeStep.params?.display_banner || activeStep.title || 'Quảng cáo Video / Poster',
        shortChip: activeStep.title || 'Chiếu quảng cáo',
        badgeColor: '#E11D48',
      };
    }
    if (
      activeStep.type === 'MOVE' &&
      (activeStep.params?.broadcast_speech || activeStep.params?.show_media_on_move || activeStep.params?.media_url)
    ) {
      return {
        label: 'PATROL',
        bubbleTitle:
          activeStep.params?.show_media_on_move || activeStep.params?.media_url
            ? 'TUẦN TRA • CHIẾU QC MÀN HÌNH'
            : 'TUẦN TRA & PHÁT LOA',
        bubbleBody:
          activeStep.params?.broadcast_speech ||
          activeStep.params?.display_banner ||
          activeStep.title ||
          'Tuần tra phát quảng cáo',
        shortChip: activeStep.title || 'Tuần tra phát quảng cáo',
        badgeColor: '#4F46E5',
      };
    }
    return getStepActionDetail(activeStep);
  }

  if (manualNavLabel) {
    return {
      label: 'NAV',
      bubbleTitle: 'DIEU HUONG',
      bubbleBody: manualNavLabel,
    };
  }

  return getStepActionDetail(null);
}

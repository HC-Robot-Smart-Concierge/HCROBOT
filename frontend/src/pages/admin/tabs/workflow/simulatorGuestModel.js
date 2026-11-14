import {
  calculateSafeWaypoints,
  GAZEBO_LOBBY_WAYPOINTS,
  isLobbyWalkablePoint,
  resolveMoveTarget,
} from './workflowSimulatorUtils';
import { simulatorScreenKind } from './workflowSimulatorPresentation';

const ENTRANCE = { x: 0.55, y: 6.25 };
const FOLLOW_DISTANCE = 1.15;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const point = (p) => ({ x: p.x, y: p.y });
const INTERACTION_TYPES = new Set(['GREET', 'COMMUNICATE', 'LISTEN', 'RECOMMEND', 'CHOICE', 'CREATE_REQUEST', 'FEEDBACK']);

export function hasSimulatedGuest(workflow, chargeRoutineId) {
  return workflow?.id !== chargeRoutineId && workflow?.id !== 'wf-06-idle-promo' &&
    (workflow?.steps || []).some((step) => INTERACTION_TYPES.has(step.type));
}

export function guestActivity(workflow, step, endpoints = []) {
  if (!step) return 'waiting';
  if (step.type === 'SHOW') return ({
    LANGUAGE: 'selectingLanguage', MAP: 'readingMap', FEEDBACK: 'rating',
    REQUEST: 'requesting', WAKEUP: 'requesting', MENU: 'choosing',
    DINING: 'choosing', RECOMMENDATIONS: 'choosing', STAFF: 'waiting',
  })[simulatorScreenKind(step.params)] || 'viewing';
  if (step.type !== 'MOVE') return ({
    GREET: 'listening', SPEAK: 'listening', COMMUNICATE: 'talking', LISTEN: 'talking',
    RECOMMEND: 'choosing', SHOW: 'viewing', CHOICE: 'choosing',
    CREATE_REQUEST: 'requesting', FEEDBACK: 'rating',
  })[step.type] || 'waiting';

  const params = step.params || {};
  const key = params.target_waypoint_id || params.target_value || '';
  const target = endpoints.find((ep) => ep.id === key || ep.key === key);
  if (['STANDBY', 'CHARGER', 'PARK'].includes(params.target_type) ||
      ['PARK', 'CHARGER'].includes(target?.type) ||
      /^(ROBOT_STANDBY|CHARGER_STATION|DOCK_.*)$/.test(key)) return 'leaving';
  if (workflow?.id === 'wf-01-welcome' || ['MAIN_ENTRANCE', 'ZONE_LOBBY'].includes(key)) return 'waiting';
  if (workflow?.id === 'wf-06-idle-promo') return 'waiting';
  return 'following';
}

export function guestMeetingPoint(robot) {
  const yaw = Number.isFinite(robot.yaw) ? robot.yaw : 0;
  for (const radius of [1.2, 0.9, 1.5]) {
    for (const offset of [Math.PI / 2, -Math.PI / 2, 0, Math.PI, Math.PI / 4, -Math.PI / 4]) {
      const candidate = { x: robot.x + radius * Math.cos(yaw + offset), y: robot.y + radius * Math.sin(yaw + offset) };
      if (isLobbyWalkablePoint(candidate)) return candidate;
    }
  }
  return point(GAZEBO_LOBBY_WAYPOINTS.CENTRAL_LOBBY);
}

function routeTo(guest, target) {
  guest.route = calculateSafeWaypoints(guest.pose, target).slice(1).map(point);
}

export function createSimulatedGuest({ workflow, step, robot, endpoints }) {
  const activity = guestActivity(workflow, step, endpoints);
  const guest = {
    pose: { ...ENTRANCE }, route: [], mode: 'approaching', activity,
    lastRobot: point(robot), followed: false, reply: null, replySeconds: 0,
  };
  updateGuestActivity(guest, { workflow, step, robot, endpoints });
  return guest;
}

export function departSimulatedGuest(guest, robot, workflowId) {
  if (!guest || guest.mode === 'leaving') return;
  guest.mode = 'leaving';
  guest.activity = 'leaving';
  guest.reply = null;
  // After an escort, the guest stays at the destination rather than following the robot home.
  const exit = guest.followed || workflowId === 'wf-07-guide-tour'
    ? guestMeetingPoint({ ...robot, yaw: 0 })
    : ENTRANCE;
  routeTo(guest, exit);
}

export function updateGuestActivity(guest, { workflow, step, robot, endpoints }) {
  if (!guest || guest.mode === 'leaving') return;
  const activity = guestActivity(workflow, step, endpoints);
  guest.activity = activity;
  if (activity === 'leaving') {
    departSimulatedGuest(guest, robot, workflow?.id);
    return;
  }
  if (activity === 'following') {
    guest.followed = true;
    guest.mode = 'following';
    routeTo(guest, robot);
    guest.lastRobot = point(robot);
    return;
  }
  if (guest.mode === 'following') {
    // Keep the remaining breadcrumb route; do not cut across a corner at the end of MOVE.
    guest.mode = 'catching-up';
    return;
  }
  if (distance(guest.pose, robot) < 2.0 && activity !== 'waiting') {
    guest.mode = 'interacting';
    guest.route = [];
    return;
  }
  const anchor = activity === 'waiting' && step?.type === 'MOVE' && workflow?.id === 'wf-01-welcome'
    ? { ...resolveMoveTarget(step, endpoints), yaw: 0 }
    : robot;
  routeTo(guest, guestMeetingPoint(anchor));
  guest.mode = 'approaching';
}

export function remainingGuestRoute(guest) {
  let previous = guest.pose;
  return guest.route.reduce((total, next) => {
    const segment = distance(previous, next);
    previous = next;
    return total + segment;
  }, 0);
}

// Mutates only the local visual actor. No ROS publication or service request is made here.
export function advanceSimulatedGuest(guest, robot, seconds) {
  if (guest.mode === 'following') {
    const moved = distance(guest.lastRobot, robot);
    if (moved > 2.5) routeTo(guest, robot); // A simulator reset/pose override, not a walked segment.
    else if (moved >= 0.08) guest.route.push(point(robot));
    if (moved >= 0.08) guest.lastRobot = point(robot);
  }
  guest.replySeconds = Math.max(0, guest.replySeconds - seconds);
  if (guest.replySeconds === 0) guest.reply = null;
  const following = ['following', 'catching-up'].includes(guest.mode);
  const remaining = remainingGuestRoute(guest);
  let budget = Math.min(1.4 * seconds, Math.max(0, remaining - (following ? FOLLOW_DISTANCE : 0)));
  while (budget > 0.00001 && guest.route.length) {
    const next = guest.route[0];
    const length = distance(guest.pose, next);
    if (length <= budget) {
      guest.pose = point(next);
      guest.route.shift();
      budget -= length;
    } else {
      guest.pose = {
        x: guest.pose.x + (next.x - guest.pose.x) * budget / length,
        y: guest.pose.y + (next.y - guest.pose.y) * budget / length,
      };
      budget = 0;
    }
  }
  if (guest.mode === 'catching-up' && remainingGuestRoute(guest) <= FOLLOW_DISTANCE + 0.01) {
    guest.mode = 'interacting';
    guest.route = [];
  }
  if (!guest.route.length) {
    if (guest.mode === 'leaving') return false;
    if (guest.mode === 'approaching') guest.mode = guest.activity === 'waiting' ? 'waiting' : 'interacting';
  }
  return true;
}

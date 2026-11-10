/**
 * floorGeometry.js
 * Architectural geometry, obstacle bounds, wall segments, doorways, and walkable networks
 * for all floors in Aurora Grand Hotel (HC-Robot).
 * Unified Coordinate System: 1840 x 1174 px.
 */

export const UNIFIED_MAP_DIMENSIONS = {
  width: 1840,
  height: 1174,
};

export const DEFAULT_NAVIGATION_CLEARANCE = 24; // px (approx 30cm in floor plan scale)

// Tuyến đường chuẩn chặng 1: Từ Lobby (Ground) -> Thang máy A (đi vòng tránh bồn cây và quầy lễ tân)
export const ROUTE_GROUND_TO_ELEVATOR = 'M 350 580 L 350 860 Q 350 880, 370 880 L 1330 880 Q 1350 880, 1362 864 L 1568 576 Q 1580 560, 1600 560 L 1715 560';

/**
 * Helper to define box obstacle
 */
const box = (id, minX, maxX, minY, maxY) => ({ id, minX, maxX, minY, maxY });

/**
 * Helper to define wall line segment
 */
const wall = (id, x1, y1, x2, y2) => ({
  id,
  p1: { x: x1, y: y1 },
  p2: { x: x2, y: y2 },
});

// ========================================================
// FLOOR 1: GROUND FLOOR / LOBBY (Sảnh Trệt)
// ========================================================
export const FLOOR_1_GEOMETRY = {
  floorId: '3',
  level: 'Ground',
  name: 'Tầng Trệt · Sảnh & Tiếp Tân',
  dimensions: UNIFIED_MAP_DIMENSIONS,
  elevator: {
    id: 'elevator_1',
    x: 1715,
    y: 560,
    approach: { x: 1580, y: 560 },
  },
  defaultStart: { x: 350, y: 580 }, // Robot Standby position in Lobby
  mainEntrance: { x: 60, y: 580 },
  obstacles: [
    box('SOFA_TOP_LEFT', 0, 240, 0, 360),
    box('SOFA_BOTTOM_LEFT', 0, 380, 980, 1174),
    box('SOFA_TOP_RIGHT', 1420, 1840, 200, 360),
    box('RECEPTION_DESK', 920, 1220, 370, 770),
    box('CENTER_PLANT', 520, 700, 490, 670),
    box('EMERGENCY_EXIT_STAIRS', 1680, 1840, 620, 880),
  ],
  walls: [
    // Outer boundaries (leaving entrance at left, elevator at right)
    wall('OUTER_NORTH', 0, 10, 1840, 10),
    wall('OUTER_SOUTH', 0, 1164, 1840, 1164),
    wall('OUTER_WEST_N', 10, 10, 10, 520),
    wall('OUTER_WEST_S', 10, 640, 10, 1164),
    wall('OUTER_EAST_N', 1830, 10, 1830, 480),
    wall('OUTER_EAST_S', 1830, 680, 1830, 1164),
    // Partition walls near front desk
    wall('RECEPTION_PART_TOP', 1200, 10, 1200, 120),
    wall('RECEPTION_PART_BOT', 1200, 1040, 1200, 1164),
  ],
  doorways: [
    { id: 'door_lobby_entrance', position: { x: 60, y: 580 }, width: 120 },
    { id: 'door_lobby_elevator', position: { x: 1715, y: 560 }, width: 100 },
    { id: 'door_lobby_wc', position: { x: 1450, y: 940 }, width: 90 },
  ],
  // Walkable roadmap nodes (cleared of all obstacles with clearance)
  walkableNodes: {
    ENTRANCE: { x: 100, y: 580 },
    STANDBY: { x: 350, y: 580 },
    NORTH_HALL_W: { x: 350, y: 260 },
    NORTH_HALL_M: { x: 800, y: 260 },
    NORTH_HALL_E: { x: 1350, y: 260 },
    SOUTH_HALL_W: { x: 350, y: 880 },
    SOUTH_HALL_M: { x: 800, y: 880 },
    SOUTH_HALL_E: { x: 1350, y: 880 },
    FRONT_DESK_APPROACH: { x: 1070, y: 880 },
    FRONT_DESK_SERVICE: { x: 1070, y: 800 },
    RESTROOM_APPROACH: { x: 1380, y: 920 },
    RESTROOM_INSIDE: { x: 1520, y: 980 },
    ELEVATOR_APPROACH: { x: 1580, y: 560 },
    ELEVATOR_A: { x: 1715, y: 560 },
  },
  walkableEdges: [
    ['ENTRANCE', 'STANDBY'],
    ['STANDBY', 'NORTH_HALL_W'],
    ['STANDBY', 'SOUTH_HALL_W'],
    ['NORTH_HALL_W', 'NORTH_HALL_M'],
    ['NORTH_HALL_M', 'NORTH_HALL_E'],
    ['NORTH_HALL_E', 'ELEVATOR_APPROACH'],
    ['SOUTH_HALL_W', 'SOUTH_HALL_M'],
    ['SOUTH_HALL_M', 'SOUTH_HALL_E'],
    ['SOUTH_HALL_E', 'FRONT_DESK_APPROACH'],
    ['FRONT_DESK_APPROACH', 'FRONT_DESK_SERVICE'],
    ['SOUTH_HALL_E', 'RESTROOM_APPROACH'],
    ['RESTROOM_APPROACH', 'RESTROOM_INSIDE'],
    ['SOUTH_HALL_E', 'ELEVATOR_APPROACH'],
    ['ELEVATOR_APPROACH', 'ELEVATOR_A'],
  ],
};

// ========================================================
// FLOOR 2: KITCHEN, RESTAURANT & PICKUP AREA (Tầng 2)
// ========================================================
export const FLOOR_2_GEOMETRY = {
  floorId: '4',
  level: 'TẦNG 2',
  name: 'Tầng 2 · Bếp & Nhà Hàng (Kitchen & Pickup)',
  dimensions: UNIFIED_MAP_DIMENSIONS,
  elevator: {
    id: 'elevator_2',
    x: 1715,
    y: 560,
    approach: { x: 1550, y: 560 },
  },
  obstacles: [
    // Pickup / Dining tables in public dining area
    box('TABLE_TOP_L', 410, 840, 30, 95),
    box('TABLE_TOP_R', 900, 1330, 30, 95),
    box('TABLE_BOT_L', 410, 840, 400, 465),
    box('TABLE_BOT_R', 900, 1330, 400, 465),
    box('STAIRWELL_FAR_EAST_F2', 1720, 1840, 715, 1174),
  ],
  walls: [
    wall('HORIZ_DIVIDER_MID', 0, 560, 1375, 560),
    wall('VERT_EAST_HALL', 1375, 0, 1375, 1174),
    wall('WAREHOUSE_BOTTOM', 1375, 290, 1840, 290),
    wall('RESTROOM_TOP', 1520, 870, 1840, 870),
    wall('PREP_EAST_WALL', 355, 0, 355, 560),
  ],
  doorways: [
    { id: 'door_pickup_east', position: { x: 1375, y: 310 }, width: 110 },
    { id: 'door_warehouse', position: { x: 1550, y: 290 }, width: 90 },
    { id: 'door_restroom_f2', position: { x: 1650, y: 870 }, width: 90 },
    { id: 'door_kitchen_east', position: { x: 1375, y: 720 }, width: 100 },
    { id: 'door_prep_east', position: { x: 355, y: 260 }, width: 100 },
    { id: 'door_prep_into_kitchen', position: { x: 200, y: 560 }, width: 100 },
  ],
  walkableNodes: {
    ELEVATOR_2: { x: 1715, y: 560 },
    EAST_CORRIDOR_MID: { x: 1550, y: 560 },
    EAST_CORRIDOR_NORTH: { x: 1550, y: 310 },
    EAST_CORRIDOR_SOUTH: { x: 1550, y: 800 },
    RESTROOM_DOOR_F2: { x: 1650, y: 870 },
    RESTROOM_F2_INSIDE: { x: 1650, y: 960 },
    WAREHOUSE_INSIDE: { x: 1600, y: 160 },
    PICKUP_DOORWAY: { x: 1375, y: 310 },
    PICKUP_HALL_ENTRY: { x: 1220, y: 260 },
    RESTAURANT_TABLE: { x: 800, y: 260 },
    PREPARATION_DOORWAY: { x: 355, y: 260 },
    PREPARATION_AREA: { x: 180, y: 260 },
    KITCHEN_DOORWAY: { x: 1375, y: 720 },
    KITCHEN_ENTRY: { x: 1100, y: 750 },
    KITCHEN_CENTER: { x: 680, y: 850 },
  },
  walkableEdges: [
    ['ELEVATOR_2', 'EAST_CORRIDOR_MID'],
    ['EAST_CORRIDOR_MID', 'EAST_CORRIDOR_NORTH'],
    ['EAST_CORRIDOR_MID', 'EAST_CORRIDOR_SOUTH'],
    ['EAST_CORRIDOR_NORTH', 'WAREHOUSE_INSIDE'],
    ['EAST_CORRIDOR_SOUTH', 'RESTROOM_DOOR_F2'],
    ['RESTROOM_DOOR_F2', 'RESTROOM_F2_INSIDE'],
    ['EAST_CORRIDOR_NORTH', 'PICKUP_DOORWAY'],
    ['PICKUP_DOORWAY', 'PICKUP_HALL_ENTRY'],
    ['PICKUP_HALL_ENTRY', 'RESTAURANT_TABLE'],
    ['RESTAURANT_TABLE', 'PREPARATION_DOORWAY'],
    ['PREPARATION_DOORWAY', 'PREPARATION_AREA'],
    ['EAST_CORRIDOR_MID', 'KITCHEN_DOORWAY'],
    ['KITCHEN_DOORWAY', 'KITCHEN_ENTRY'],
    ['KITCHEN_ENTRY', 'KITCHEN_CENTER'],
  ],
};

// ========================================================
// FLOOR 3 & FLOOR 4: GUEST ROOMS (301-310 & 401-410)
// ========================================================
const createGuestRoomsFloor = (floorId, floorLevel, prefix) => ({
  floorId,
  level: floorLevel,
  name: `${floorLevel} · Phòng Nghỉ (${prefix}01-${prefix}10)`,
  dimensions: UNIFIED_MAP_DIMENSIONS,
  elevator: {
    id: `elevator_${floorId}`,
    x: 1715,
    y: 560,
    approach: { x: 1600, y: 560 },
  },
  obstacles: [
    // Physical columns or utility shafts if any, keeping corridor clear
    box('STAIRWELL_EAST', 1710, 1840, 765, 1174),
  ],
  walls: [
    wall('CORRIDOR_WALL_NORTH', 0, 385, 1710, 385),
    wall('CORRIDOR_WALL_SOUTH', 0, 765, 1710, 765),
    wall('ELEVATOR_WEST_WALL_T', 1710, 385, 1710, 500),
    wall('ELEVATOR_WEST_WALL_B', 1710, 620, 1710, 765),
  ],
  doorways: [
    { id: 'door_elevator', position: { x: 1710, y: 560 }, width: 120 },
    { id: `door_${prefix}01`, position: { x: 1656, y: 385 }, width: 80 },
    { id: `door_${prefix}02`, position: { x: 1288, y: 385 }, width: 80 },
    { id: `door_${prefix}03`, position: { x: 920, y: 385 }, width: 80 },
    { id: `door_${prefix}04`, position: { x: 552, y: 385 }, width: 80 },
    { id: `door_${prefix}05`, position: { x: 184, y: 385 }, width: 80 },
    { id: `door_${prefix}06`, position: { x: 184, y: 765 }, width: 80 },
    { id: `door_${prefix}07`, position: { x: 552, y: 765 }, width: 80 },
    { id: `door_${prefix}08`, position: { x: 920, y: 765 }, width: 80 },
    { id: `door_${prefix}09`, position: { x: 1288, y: 765 }, width: 80 },
    { id: `door_${prefix}10`, position: { x: 1656, y: 765 }, width: 80 },
  ],
  walkableNodes: {
    ELEVATOR: { x: 1715, y: 560 },
    HALL_ELEV: { x: 1600, y: 560 },
    HALL_10: { x: 1656, y: 560 },
    HALL_09: { x: 1288, y: 560 },
    HALL_08: { x: 920, y: 560 },
    HALL_07: { x: 552, y: 560 },
    HALL_06: { x: 184, y: 560 },
    [`room_${prefix}01`]: { x: 1656, y: 220 },
    [`room_${prefix}02`]: { x: 1288, y: 220 },
    [`room_${prefix}03`]: { x: 920, y: 220 },
    [`room_${prefix}04`]: { x: 552, y: 220 },
    [`room_${prefix}05`]: { x: 184, y: 220 },
    [`room_${prefix}06`]: { x: 184, y: 920 },
    [`room_${prefix}07`]: { x: 552, y: 920 },
    [`room_${prefix}08`]: { x: 920, y: 920 },
    [`room_${prefix}09`]: { x: 1288, y: 920 },
    [`room_${prefix}10`]: { x: 1656, y: 920 },
  },
  walkableEdges: [
    ['ELEVATOR', 'HALL_ELEV'],
    ['HALL_ELEV', 'HALL_10'],
    ['HALL_10', 'HALL_09'],
    ['HALL_09', 'HALL_08'],
    ['HALL_08', 'HALL_07'],
    ['HALL_07', 'HALL_06'],
    ['HALL_10', `room_${prefix}01`],
    ['HALL_09', `room_${prefix}02`],
    ['HALL_08', `room_${prefix}03`],
    ['HALL_07', `room_${prefix}04`],
    ['HALL_06', `room_${prefix}05`],
    ['HALL_06', `room_${prefix}06`],
    ['HALL_07', `room_${prefix}07`],
    ['HALL_08', `room_${prefix}08`],
    ['HALL_09', `room_${prefix}09`],
    ['HALL_10', `room_${prefix}10`],
  ],
});

export const FLOOR_3_GEOMETRY = createGuestRoomsFloor('5', 'TẦNG 3', '3');
export const FLOOR_4_GEOMETRY = createGuestRoomsFloor('6', 'TẦNG 4', '4');

// ========================================================
// FLOOR 5 & 6: POOL, SPA, GYM / COFFEE, BAR, KARAOKE
// ========================================================
const createAmenitiesFloor = (floorId, floorLevel, names) => ({
  floorId,
  level: floorLevel,
  name: `${floorLevel} · ${names.pool}, ${names.spa} & ${names.gym}`,
  dimensions: UNIFIED_MAP_DIMENSIONS,
  elevator: {
    id: `elevator_${floorId}`,
    x: 1715,
    y: 560,
    approach: { x: 1560, y: 560 },
  },
  obstacles: [
    // Solid architectural structures / columns outside walkable pathways
    box('STAIRWELL_FAR_EAST', 1720, 1840, 715, 1174),
  ],
  walls: [
    // Central dividing vertical wall: x = 758 with double doors at y = 665..825 (door center y = 745)
    wall('DIVIDING_WALL_TOP', 758, 0, 758, 665),
    wall('DIVIDING_WALL_BOT', 758, 825, 758, 1174),
    // Spa East boundary wall (x = 1400)
    wall('SPA_EAST_WALL', 1400, 0, 1400, 458),
    // Top-room bottom walls (y = 458)
    wall('POOL_BOT_WALL_L', 0, 458, 525, 458),
    wall('POOL_BOT_WALL_R', 640, 458, 758, 458), // door at x=525..640
    wall('POOL_DOOR_LEAF', 525, 340, 525, 458), // door leaf swung open inside pool
    wall('SPA_BOT_WALL_L', 758, 458, 1030, 458),
    wall('SPA_BOT_WALL_R', 1130, 458, 1400, 458), // door at x=1030..1130
    wall('SPA_DOOR_LEAF', 1130, 350, 1130, 458), // door leaf inside spa
    // Locker East wall (x = 375)
    wall('LOCKER_EAST_WALL_T', 375, 458, 375, 640),
    wall('LOCKER_EAST_WALL_B', 375, 715, 375, 1174), // door at y=640..715
    // Gym top wall (y = 715)
    wall('GYM_TOP_WALL_L', 1080, 715, 1380, 715),
    wall('GYM_TOP_WALL_R', 1500, 715, 1840, 715), // door at x=1380..1500
    wall('GYM_WEST_WALL', 1080, 715, 1080, 1174),
  ],
  doorways: [
    // Central double doors: opening y = 665..825, center y = 745
    { id: 'door_central_double', position: { x: 758, y: 745 }, width: 160 },
    // Gym door on top wall
    { id: 'door_gym', position: { x: 1450, y: 715 }, width: 120 },
    // Spa door on bottom wall
    { id: 'door_spa', position: { x: 1080, y: 458 }, width: 100 },
    // Pool door on bottom wall
    { id: 'door_pool', position: { x: 600, y: 458 }, width: 115 },
    // Locker door on east wall
    { id: 'door_locker', position: { x: 375, y: 670 }, width: 75 },
  ],
  walkableNodes: {
    ELEVATOR: { x: 1715, y: 560 },
    EAST_HALL_ENTRY: { x: 1560, y: 560 },
    EAST_HALL_GYM_APPROACH: { x: 1450, y: 560 },
    GYM_DOOR: { x: 1450, y: 715 },
    GYM_INSIDE: { x: 1450, y: 880 },
    EAST_HALL_SPA_APPROACH: { x: 1080, y: 560 },
    SPA_DOOR: { x: 1080, y: 458 },
    SPA_INSIDE: { x: 1080, y: 230 },
    DOUBLE_DOOR_APPROACH: { x: 880, y: 650 },
    DOUBLE_DOOR_EAST: { x: 840, y: 745 },
    DOUBLE_DOOR_CENTER: { x: 758, y: 745 },
    DOUBLE_DOOR_WEST: { x: 670, y: 745 },
    WEST_HALL_SOUTH: { x: 600, y: 745 },
    WEST_HALL_MID: { x: 600, y: 560 },
    POOL_DOOR: { x: 600, y: 458 },
    POOL_ENTRY_CLEAR: { x: 600, y: 360 },
    POOL_INSIDE: { x: 380, y: 230 },
    LOCKER_DOOR: { x: 375, y: 670 },
    LOCKER_INSIDE: { x: 200, y: 750 },
  },
  walkableEdges: [
    ['ELEVATOR', 'EAST_HALL_ENTRY'],
    ['EAST_HALL_ENTRY', 'EAST_HALL_GYM_APPROACH'],
    ['EAST_HALL_GYM_APPROACH', 'GYM_DOOR'],
    ['GYM_DOOR', 'GYM_INSIDE'],
    ['EAST_HALL_GYM_APPROACH', 'EAST_HALL_SPA_APPROACH'],
    ['EAST_HALL_SPA_APPROACH', 'SPA_DOOR'],
    ['SPA_DOOR', 'SPA_INSIDE'],
    ['EAST_HALL_SPA_APPROACH', 'DOUBLE_DOOR_APPROACH'],
    ['DOUBLE_DOOR_APPROACH', 'DOUBLE_DOOR_EAST'],
    ['DOUBLE_DOOR_EAST', 'DOUBLE_DOOR_CENTER'],
    ['DOUBLE_DOOR_CENTER', 'DOUBLE_DOOR_WEST'],
    ['DOUBLE_DOOR_WEST', 'WEST_HALL_SOUTH'],
    ['WEST_HALL_SOUTH', 'LOCKER_DOOR'],
    ['LOCKER_DOOR', 'LOCKER_INSIDE'],
    ['WEST_HALL_SOUTH', 'WEST_HALL_MID'],
    ['WEST_HALL_MID', 'POOL_DOOR'],
    ['POOL_DOOR', 'POOL_ENTRY_CLEAR'],
    ['POOL_ENTRY_CLEAR', 'POOL_INSIDE'],
  ],
});

export const FLOOR_5_GEOMETRY = createAmenitiesFloor('7', 'TẦNG 5', {
  pool: 'Hồ Bơi Vô Cực',
  spa: 'Thảo Mộc Spa',
  gym: 'Fitness & Gym',
});

export const FLOOR_6_GEOMETRY = createAmenitiesFloor('8', 'TẦNG 6', {
  pool: 'Rooftop Coffee',
  spa: 'Sky Bar',
  gym: 'Karaoke',
});

// ========================================================
// FLOOR B1 & B2: PARKING (Hầm B1 & B2)
// ========================================================
const createParkingFloor = (floorId, floorLevel, name) => ({
  floorId,
  level: floorLevel,
  name,
  dimensions: UNIFIED_MAP_DIMENSIONS,
  elevator: {
    id: `elevator_${floorId}`,
    x: 1715,
    y: 560,
    approach: { x: 1560, y: 560 },
  },
  obstacles: [
    box('RAMP_CURVE_CORNER', 0, 390, 0, 1174),
  ],
  walls: [
    wall('RAMP_INNER_WALL_T', 390, 0, 390, 350),
    wall('RAMP_INNER_WALL_B', 390, 750, 390, 1174),
  ],
  doorways: [
    { id: 'door_parking_elevator', position: { x: 1715, y: 560 }, width: 100 },
  ],
  walkableNodes: {
    ELEVATOR: { x: 1715, y: 560 },
    HALL_APPROACH: { x: 1560, y: 560 },
    MAIN_LANE_EAST: { x: 1250, y: 560 },
    MAIN_LANE_CENTER: { x: 920, y: 560 },
    MAIN_LANE_WEST: { x: 550, y: 560 },
    RAMP_LANE_MID: { x: 250, y: 560 },
    RAMP_LANE_NORTH: { x: 250, y: 200 },
    RAMP_LANE_SOUTH: { x: 250, y: 920 },
    PARKING_BAY_CENTER: { x: 880, y: 850 },
    PARKING_BIKE_BAY: { x: 920, y: 500 },
  },
  walkableEdges: [
    ['ELEVATOR', 'HALL_APPROACH'],
    ['HALL_APPROACH', 'MAIN_LANE_EAST'],
    ['MAIN_LANE_EAST', 'MAIN_LANE_CENTER'],
    ['MAIN_LANE_CENTER', 'MAIN_LANE_WEST'],
    ['MAIN_LANE_WEST', 'RAMP_LANE_MID'],
    ['RAMP_LANE_MID', 'RAMP_LANE_NORTH'],
    ['RAMP_LANE_MID', 'RAMP_LANE_SOUTH'],
    ['MAIN_LANE_CENTER', 'PARKING_BAY_CENTER'],
    ['MAIN_LANE_CENTER', 'PARKING_BIKE_BAY'],
  ],
});

export const FLOOR_B1_GEOMETRY = createParkingFloor('2', 'HẦM B1', 'Hầm B1 · Bãi Xe Máy');
export const FLOOR_B2_GEOMETRY = createParkingFloor('1', 'HẦM B2', 'Hầm B2 · Bãi Đỗ Xe Ô Tô');

export const ALL_FLOOR_GEOMETRIES = {
  '1': FLOOR_B2_GEOMETRY,
  '2': FLOOR_B1_GEOMETRY,
  '3': FLOOR_1_GEOMETRY,
  '4': FLOOR_2_GEOMETRY,
  '5': FLOOR_3_GEOMETRY,
  '6': FLOOR_4_GEOMETRY,
  '7': FLOOR_5_GEOMETRY,
  '8': FLOOR_6_GEOMETRY,
};

export const getFloorGeometry = (floorId) => {
  return ALL_FLOOR_GEOMETRIES[String(floorId)] || FLOOR_1_GEOMETRY;
};

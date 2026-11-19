import { describe, expect, it } from 'vitest';
import { findWayfindingPlace, getFloorLabelLayout, getFloorLabelMinimum, getWayfindingLeg, resizeWayfindingFloor, shouldRotateWayfindingFloor } from './wayfindingGeometry';
import { computeSmartRouteFrame, parseGuestMapParams } from '../pages/guest/GuestMapPage';

const lobby = { id: 'lobby', level: 'Sảnh', entry: { x: 30, y: 40 } };
const upper = { id: 'upper', level: 'Tầng 9', entry: { x: 100, y: 200 } };
const place = { id: 'place_7ab', floorId: upper.id, coords: { x: 150, y: 220 }, points: [], enabled: true };
const snapshot = {
  floors: [lobby, upper], lobbyFloorId: lobby.id, lobbyStart: { x: 10, y: 20 },
  lobbyRoute: [{ x: 20, y: 25 }], destinations: [place],
};

describe('published guest wayfinding', () => {
  it('uses the configured lobby and each floor’s own elevator position', () => {
    expect(getWayfindingLeg(snapshot, place, 1)).toEqual({
      floor: lobby, start: snapshot.lobbyStart, end: lobby.entry, path: 'M 10 20 L 20 25 L 30 40',
    });
    expect(getWayfindingLeg(snapshot, place, 2)).toEqual({
      floor: upper, start: upper.entry, end: place.coords, path: 'M 100 200 L 150 220',
    });
    expect(getWayfindingLeg(snapshot, { ...place, floorId: lobby.id }, 2).start).toEqual(snapshot.lobbyStart);
  });

  it('keeps the disabled place on its floor while withholding both route legs', () => {
    const disabled = { ...place, enabled: false };
    expect(findWayfindingPlace({ ...snapshot, destinations: [disabled] }, place.id)).toMatchObject({
      enabled: false, floorLevel: 'Tầng 9', isDifferentFloor: false,
    });
    expect(getWayfindingLeg(snapshot, disabled, 1)).toMatchObject({ floor: upper, path: '' });
    expect(getWayfindingLeg(snapshot, disabled, 2)).toMatchObject({ floor: upper, path: '' });
  });

  it('keeps the destination ID in a QR ticket for a newly added place', () => {
    const ticket = { d: place.id, e: 2_000_000_000_000, n: 'test-ticket' };
    const token = Buffer.from(JSON.stringify(ticket)).toString('base64url');
    expect(parseGuestMapParams(`?t=${token}`)).toEqual({ destKey: place.id, expiresAt: ticket.e, ticketId: ticket.n });
  });

  it('resizes a floor and its layout, pins, and route while leaving the other floors in place', () => {
    const room = { id: 'room_a', kind: 'room', x: 10, y: 50, width: 300, height: 100, color: '#F4F6FA' };
    const floors = [{ ...lobby, width: 1000, height: 800, elements: [room] }, { ...upper, width: 900, height: 1200, elements: [] }];
    const localPlace = { ...place, id: 'front_desk', floorId: lobby.id, points: [{ x: 80, y: 100 }] };
    const resized = resizeWayfindingFloor({ ...snapshot, floors, destinations: [place, localPlace] }, lobby.id, 2000, 400);
    expect(resized.floors[0]).toMatchObject({ width: 2000, height: 400, entry: { x: 60, y: 20 }, elements: [
      { ...room, x: 20, y: 25, width: 600, height: 50 },
    ] });
    expect(resized.lobbyStart).toEqual({ x: 20, y: 10 });
    expect(getWayfindingLeg(resized, resized.destinations[1], 2).path).toBe('M 20 10 L 160 50 L 300 110');
    expect(resized.floors[1]).toBe(floors[1]);
    expect(resized.destinations[0]).toBe(place);
    expect(computeSmartRouteFrame('', { x: 1200, y: 100 }, { x: 900, y: 250 }, 'heading', resized.floors[0]))
      .toMatchObject({ rotZ: 90, baseW: 400, baseH: 2000 });
  });

  it('reflows a room name for quarter turns and keeps free-standing labels horizontal', () => {
    const room = { kind: 'room', text: 'Phòng hội nghị Bình Minh', width: 470, height: 100 };
    const flat = getFloorLabelLayout(room, 0, 9);
    const rotated = getFloorLabelLayout(room, -90, 9);
    expect(rotated.lines.join(' ')).toBe(room.text);
    expect(rotated.lines).toHaveLength(2);
    expect(rotated.fontSize).toBeLessThan(flat.fontSize);
    expect(getFloorLabelLayout({ ...room, kind: 'label' }, 90, 9)).toEqual(flat);
    expect(getFloorLabelLayout(room, -90, 48)).toBeNull();
  });

  it('chooses the angle that fits each device and hides labels below its readable size', () => {
    const floor = { width: 1840, height: 1174 };
    const portrait = { width: 390, height: 780 };
    const landscape = { width: 780, height: 390 };
    expect(shouldRotateWayfindingFloor(portrait, floor)).toBe(true);
    expect(shouldRotateWayfindingFloor(landscape, floor)).toBe(false);
    expect(shouldRotateWayfindingFloor(landscape, { width: 1174, height: 1840 })).toBe(true);
    expect(getFloorLabelMinimum(portrait, floor.height, floor.width, 1.5)).toBeLessThan(
      getFloorLabelMinimum(portrait, floor.height, floor.width, 1)
    );
  });
});

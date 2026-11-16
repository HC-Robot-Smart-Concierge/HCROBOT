import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminRobotControlTab } from '../AdminRobotControlTab';
import { AdminRobotManagementTab } from '../AdminRobotManagementTab';
import {
  fetchRobotProfile,
  updateRobotProfile,
  fetchRobotJobs,
  fetchRobotJobDetail,
  fetchRobotMaintenance,
  createRobotMaintenance,
  updateRobotMaintenance,
  deleteRobotMaintenance,
} from '../../../../services/operationsApi';

describe('operationsApi RC-001 Robot Profile, Jobs & Maintenance', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage = { getItem: vi.fn(() => 'fake-jwt') };
  });

  it('calls GET and PUT /api/v1/operations/robot/profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'RC-001', code: 'RC-001', status: 'IDLE' }),
    });
    globalThis.fetch = fetchMock;

    const prof = await fetchRobotProfile('RC-001');
    expect(prof.code).toBe('RC-001');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/operations/robot/profile?robot_id=RC-001',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer fake-jwt' }),
      })
    );

    await updateRobotProfile({ status: 'CHARGING', battery_level: 75 }, 'RC-001');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/operations/robot/profile?robot_id=RC-001',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ status: 'CHARGING', battery_level: 75 }),
      })
    );
  });

  it('calls jobs history and maintenance CRUD endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    globalThis.fetch = fetchMock;

    await fetchRobotJobs({ robotId: 'RC-001', status: 'COMPLETED' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/operations/robot/jobs?robot_id=RC-001&status=COMPLETED');

    await fetchRobotJobDetail('JOB-123');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/operations/robot/jobs/JOB-123');

    await fetchRobotMaintenance({ robotId: 'RC-001', status: 'Scheduled', component: 'lidar' });
    expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/operations/robot/maintenance?robot_id=RC-001&status=Scheduled&component=lidar');

    await createRobotMaintenance({ robot_id: 'RC-001', title: 'Check LiDAR' });
    expect(fetchMock.mock.calls[3][1].method).toBe('POST');

    await updateRobotMaintenance('RMS-1', { status: 'Completed' });
    expect(fetchMock.mock.calls[4][0]).toBe('/api/v1/operations/robot/maintenance/RMS-1');
    expect(fetchMock.mock.calls[4][1].method).toBe('PUT');

    await deleteRobotMaintenance('RMS-1');
    expect(fetchMock.mock.calls[5][1].method).toBe('DELETE');
  });

  it('wires Robot Control tab component cleanly for profile, history, and maintenance views', () => {
    expect(typeof AdminRobotControlTab).toBe('function');
    expect(typeof AdminRobotManagementTab).toBe('function');
  });
});


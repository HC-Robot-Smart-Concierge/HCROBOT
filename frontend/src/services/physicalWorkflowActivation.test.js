import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { activatePhysicalWorkflow } from './workflowApi';

afterEach(() => vi.unstubAllGlobals());

describe('Activate a workflow configured on Physical Map', () => {
  it('uses the registered backend update method without overwriting workflow steps or starting the vehicle', async () => {
    const saved = { id: 'wf-1', is_active: true };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => saved });
    vi.stubGlobal('fetch', fetchMock);
    const config = { execution_mode: 'ROBOT', repeat_count: 3, schedules: [] };
    expect(await activatePhysicalWorkflow({ id: 'wf-1', execution_config: config, steps: [{ type: 'WAIT' }] })).toEqual(saved);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/workflows/wf-1');
    const backend = readFileSync(new URL('../../../backend/app/api/v1/endpoints/workflows.py', import.meta.url), 'utf8');
    const updateRoute = backend.match(/@router\.(\w+)\("\/\{workflow_id\}",[^\n]*summary="Cập nhật Workflow"/);
    expect(updateRoute).not.toBeNull();
    expect(options.method).toBe(updateRoute[1].toUpperCase());
    expect(JSON.parse(options.body)).toEqual({ is_active: true, execution_config: config });
  });
  it('shows the backend validation failure without executing anything', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'Workflow còn bước chưa có tuyến' }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(activatePhysicalWorkflow({ id: 'wf-1', execution_config: {} })).rejects.toThrow('còn bước chưa có tuyến');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

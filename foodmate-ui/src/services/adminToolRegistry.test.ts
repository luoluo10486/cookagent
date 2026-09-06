import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAdminToolRegistry } from './adminService';

describe('admin tool registry API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AGENT_MODE', 'real');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('maps the dedicated registry contract without dashboard fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            tools: [
              {
                tool_id: 720005,
                name: 'food_log_writer',
                display_name: 'Food log writer',
                description: 'Write food logs.',
                category: 'write',
                risk_level: 'high',
                availability_scope: 'user',
                status: 'active',
                current_version: 'v1',
                version: 'v1',
                input_schema: { type: 'object' },
                output_schema: { type: 'object' },
                permissions: { approval: 'required' },
                timeout_ms: 10000,
                retryable: false,
                idempotent: true,
                published_at: '2026-01-01T00:00:00Z',
                revision: 7,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadAdminToolRegistry()).resolves.toMatchObject([
      {
        name: 'food_log_writer',
        status: 'active',
        revision: 7,
        timeoutMs: '10000',
        retryPolicy: '不可重试',
        idempotent: true,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/tools/registry', expect.objectContaining({ method: 'GET' }));
  });
});

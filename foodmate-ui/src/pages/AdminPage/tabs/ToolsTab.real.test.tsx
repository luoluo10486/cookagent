import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let ToolsSection: typeof import('./ToolsTab').ToolsSection;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('管理端真实工具数据', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_AGENT_MODE', 'real');
    ({ ToolsSection } = await import('./ToolsTab'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('注册表接口失败时展示错误并支持重试', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: { code: 'ADMIN_UNAVAILABLE', message: '管理查询暂不可用' } }, 503),
      )
      .mockResolvedValueOnce(
        jsonResponse({
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
                published_at: null,
                revision: 7,
              },
            ],
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/tools?tab=registry']}>
        <ToolsSection onAction={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('管理查询暂不可用');
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect((await screen.findAllByText('food_log_writer')).length).toBeGreaterThanOrEqual(1);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('工具调用页读取真实查询结果并展示详情', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          items: [
            {
              tool_call_id: 8921,
              agent_run_id: 1024,
              tool_name: 'food_log_writer',
              status: 'success',
              latency_ms: 320,
              trace_id: 'trace_plan_1024',
            },
          ],
          total: 1,
          page: 1,
          size: 8,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/admin/tools']}>
        <ToolsSection onAction={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('工具调用记录')).toBeInTheDocument();
    expect((await screen.findAllByText('food_log_writer')).length).toBeGreaterThanOrEqual(1);
    const table = screen.getByRole('table');
    expect(within(table).getByText('8921')).toBeInTheDocument();
    expect(within(table).getByText('1024')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '工具调用详情' })).toHaveTextContent('trace_plan_1024');
    expect(fetchMock.mock.calls[0][0]).toContain('/api/admin/queries/tool-calls');
  });
});

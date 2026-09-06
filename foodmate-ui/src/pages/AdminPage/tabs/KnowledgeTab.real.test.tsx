import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeSection } from './KnowledgeTab';

class TestEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

const dashboard = {
  overview_metrics: [],
  runs: [],
  tool_calls: [],
  sql_audits: [],
  traces: [],
  tools: [],
  usage: [],
  knowledge: [
    {
      document_id: 42,
      title: '服务端公共饮食指南.pdf',
      status: 'indexed',
      visibility: 'draft',
      chunks: 4,
      owner: '管理员',
      source: 'nutrition-guides',
      index_progress: '100%',
      updated_at: '2026-08-22T12:00:00Z',
    },
  ],
  deleted: [],
  operation_audits: [],
};

describe('KnowledgeSection real mode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AGENT_MODE', 'real');
    localStorage.setItem(
      'foodmate_auth_user',
      JSON.stringify({ id: '7', username: 'admin', displayName: 'Admin', role: 'admin', status: 'active' }),
    );
    vi.stubGlobal('EventSource', TestEventSource);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('uploads a batch and refreshes a failed item after manual retry', async () => {
    const user = userEvent.setup();
    let itemStatus = 'index_failed';
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (path === '/api/admin/queries/knowledge?page=1&size=100') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: { resource: 'knowledge', items: dashboard.knowledge, total: 1, page: 1, size: 100 },
            }),
            { status: 200 },
          ),
        );
      }
      if (path === '/api/admin/knowledge-documents/upload-batches') {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: { batch_id: '9001' } }), { status: 200 }),
        );
      }
      if (path === '/api/admin/knowledge-upload-batches/9001' && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                batch: {
                  job: {
                    job_id: '9001',
                    status: itemStatus === 'pending' ? 'indexing' : 'partial_failed',
                    total_items: 1,
                    indexed_items: 0,
                    failed_items: itemStatus === 'pending' ? 0 : 1,
                  },
                  items: [
                    {
                      item_id: 'item-1',
                      document_id: '42',
                      filename: 'guide.pdf',
                      upload_status: 'uploaded',
                      index_status: itemStatus,
                      attempts: itemStatus === 'pending' ? 4 : 3,
                      error_code: itemStatus === 'pending' ? undefined : 'RAG_INDEX_FAILED',
                    },
                  ],
                },
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (path === '/api/admin/knowledge-upload-batches/9001/documents/42/retry' && method === 'POST') {
        itemStatus = 'pending';
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, data: { status: 'pending' } }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<KnowledgeSection onAction={vi.fn()} />);
    expect(await screen.findByText('服务端公共饮食指南.pdf')).toBeInTheDocument();

    const file = new File(['guide'], 'guide.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('选择知识库文件'), file);
    await user.click(screen.getByRole('button', { name: '提交上传' }));

    expect(await screen.findByText('批次 9001')).toBeInTheDocument();
    expect(await screen.findByText(/guide\.pdf: index_failed/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(screen.getByText(/guide\.pdf: pending/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/knowledge-upload-batches/9001/documents/42/retry',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

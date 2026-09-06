import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPage } from './ChatPage';

const { loadSessionMessages, openAgentRunStream } = vi.hoisted(() => ({
  loadSessionMessages: vi.fn(),
  openAgentRunStream: vi.fn(),
}));

vi.mock('../../services/sessionService', async () => {
  const actual = await vi.importActual<typeof import('../../services/sessionService')>('../../services/sessionService');
  return { ...actual, loadSessionMessages };
});

vi.mock('../../services/agentRunService', async () => {
  const actual = await vi.importActual<typeof import('../../services/agentRunService')>(
    '../../services/agentRunService',
  );
  return { ...actual, openAgentRunStream };
});

vi.mock('../../services/authService', async () => {
  const actual = await vi.importActual<typeof import('../../services/authService')>('../../services/authService');
  return {
    ...actual,
    getAuthStatus: () => 'authenticated',
    getAuthUser: () => ({
      id: '7',
      username: 'admin@foodmate.local',
      displayName: '管理员',
      email: 'admin@foodmate.local',
      role: 'admin',
      status: 'active',
    }),
    loadCurrentUser: async () => ({
      id: '7',
      username: 'admin@foodmate.local',
      displayName: '管理员',
      email: 'admin@foodmate.local',
      role: 'admin',
      status: 'active',
    }),
  };
});

describe('ChatPage 真实历史会话回放', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AGENT_MODE', 'real');
    loadSessionMessages.mockReset();
    openAgentRunStream.mockReset();
    openAgentRunStream.mockImplementation((_runId: string, onEvent: (type: string, payload: unknown) => void) => {
      onEvent('run.completed', {
        event_type: 'run.completed',
        answer: '基于已发布公共知识库完成回答。',
        citations: [
          {
            citation_id: 'citation-1',
            document_id: 'document-1',
            title: '公共营养指南',
            version: 'v1',
            section_path: '健康饮食',
            snippet: '优先选择多样化且少加工的食物。',
          },
        ],
      });
      return { close: vi.fn(), getConnection: () => ({ state: 'closed', attempt: 1, maxAttempts: 5 }) };
    });
  });

  it('从历史消息恢复最近 Run 并回放安全引用', async () => {
    loadSessionMessages.mockResolvedValue([
      {
        message_id: 'message-1',
        session_id: 'session-1',
        role: 'user',
        content: '请解释公共营养指南。',
        sequence_no: 1,
        created_at: '2026-09-06T10:00:00Z',
      },
      {
        message_id: 'message-2',
        session_id: 'session-1',
        agent_run_id: 'run-1',
        role: 'assistant',
        content: '基于已发布公共知识库完成回答。',
        sequence_no: 2,
        created_at: '2026-09-06T10:00:01Z',
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:session_id" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(openAgentRunStream).toHaveBeenCalledWith('run-1', expect.any(Function), expect.anything()),
    );
    expect(await screen.findByText('公共营养指南')).toBeInTheDocument();
    expect(screen.getAllByText('基于已发布公共知识库完成回答。')).toHaveLength(1);
    expect(screen.getByText('优先选择多样化且少加工的食物。')).not.toBeVisible();
  });

  it('卸载真实会话页面时关闭当前 SSE 订阅', async () => {
    const close = vi.fn();
    openAgentRunStream.mockImplementation((_runId: string, onEvent: (type: string, payload: unknown) => void) => {
      onEvent('run.answer_stream', { event_type: 'run.answer_stream', text: '已接收部分回答' });
      return { close, getConnection: () => ({ state: 'connected', attempt: 1, maxAttempts: 5 }) };
    });
    loadSessionMessages.mockResolvedValue([
      {
        message_id: 'message-1',
        session_id: 'session-1',
        role: 'user',
        content: '请继续分析。',
        sequence_no: 1,
        created_at: '2026-09-06T10:00:00Z',
      },
      {
        message_id: 'message-2',
        session_id: 'session-1',
        agent_run_id: 'run-1',
        role: 'assistant',
        content: '已接收部分回答',
        sequence_no: 2,
        created_at: '2026-09-06T10:00:01Z',
      },
    ]);

    const view = render(
      <MemoryRouter initialEntries={['/chat/session-1']}>
        <Routes>
          <Route path="/chat/:session_id" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(openAgentRunStream).toHaveBeenCalledWith('run-1', expect.any(Function), expect.anything()),
    );
    view.unmount();

    expect(close).toHaveBeenCalledTimes(1);
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { confirmMemory, loadMemories } from '../../services/memoryService';

vi.mock('../../services/memoryService', () => ({
  confirmMemory: vi.fn(),
  deleteMemory: vi.fn(),
  loadMemories: vi.fn(),
  updateMemory: vi.fn(),
}));

vi.mock('../../services/authService', async () => {
  const actual = await vi.importActual<typeof import('../../services/authService')>('../../services/authService');
  return {
    ...actual,
    getAuthStatus: () => 'authenticated',
    getAuthUser: () => ({
      id: '7',
      username: 'tester',
      displayName: 'Tester',
      email: 'tester@example.com',
      role: 'user',
      status: 'active',
    }),
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile/memories']}>
      <Routes>
        <Route path="/profile/memories" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfilePage real memory status', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AGENT_MODE', 'real');
    vi.mocked(loadMemories).mockResolvedValue([
      {
        memory_id: 11,
        memory_type: 'preference',
        memory_value: JSON.stringify('偏好燕麦'),
        confirmation_status: 'confirmed',
        updated_at: '2026-09-06T08:00:00Z',
      },
      {
        memory_id: 12,
        memory_type: 'constraint',
        memory_value: JSON.stringify('避免花生'),
        confirmation_status: 'conflict',
        updated_at: '2026-09-06T08:01:00Z',
      },
    ]);
    vi.mocked(confirmMemory).mockResolvedValue({
      memory_id: 12,
      memory_type: 'constraint',
      memory_value: JSON.stringify('避免花生'),
      confirmation_status: 'confirmed',
      updated_at: '2026-09-06T08:02:00Z',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('distinguishes conflict memories and confirms them as replacements', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('存在冲突')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认并替换' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '待处理 (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '已确认 (1)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '确认并替换' }));

    await waitFor(() => expect(confirmMemory).toHaveBeenCalledWith(12));
    expect(loadMemories).toHaveBeenCalledTimes(2);
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe('HomePage session cards', () => {
  it('renders active sessions through shadcn buttons and keeps navigation intact', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/chat/:sessionId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const sessionCard = screen.getByRole('button', { name: /每周宏量调整/ });
    expect(sessionCard).toHaveClass('inline-flex');

    await user.click(sessionCard);
    expect(screen.getByTestId('location')).toHaveTextContent('/chat/week-plan');
  });

  it('renders the Figma workspace shell with its Chat session list', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/?state=figma-v2']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Anddy')).toBeInTheDocument();
    expect(screen.getByText('每周饮食微调')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索会话...')).toBeInTheDocument();
    expect(screen.getByLabelText('会话分页')).toBeInTheDocument();
    expect(container.querySelector('[data-name="window-controls"]')).toBeInTheDocument();
    expect(container.querySelector('aside .avatar img')).toHaveAttribute('src', '/assets/avatars/default-male.svg');
    expect(container.querySelector('main header .topAvatar img')).toHaveAttribute(
      'src',
      '/assets/avatars/default-male.svg',
    );
    const quickAction = screen.getByRole('button', { name: '记录饮食' });
    expect(within(quickAction).getByText('🍽')).toBeInTheDocument();
    expect(quickAction.querySelector('svg')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: '主导航' })).queryByRole('link', { name: '知识库' }),
    ).toBeNull();
  });

  it('keeps the Figma pending queue as a compact panel instead of stretching to the activity panel height', () => {
    render(
      <MemoryRouter initialEntries={['/?state=figma-v2']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '待确认队列' }).closest('article')).toHaveClass('pendingPanel');
  });

  it('renders the Figma workspace task status panel', () => {
    render(
      <MemoryRouter initialEntries={['/?state=figma-v2']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '任务入口与状态' })).toBeInTheDocument();
  });
});

describe('HomePage Figma 状态', () => {
  it.each([
    ['loading', '工作台正在加载'],
    ['empty', '还没有任何数据'],
    ['error', '数据加载失败'],
  ] as const)('renders the %s state with the shared Figma shell', (state, heading) => {
    render(
      <MemoryRouter initialEntries={[`/?state=${state}`]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByText('共 15 条会话')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        state === 'loading' ? '正在准备工作台数据，稍后可创建新任务...' : '分析早餐照片，计算热量摄入并记录营养指标...',
      ),
    ).toBeInTheDocument();
  });

  it('renders the three input states as separate controls', () => {
    render(
      <MemoryRouter initialEntries={['/?state=input-states']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '输入器状态' })).toBeInTheDocument();
    expect(screen.getByText('空输入 · 发送禁用')).toBeInTheDocument();
    expect(screen.getByText('模板已带入 · 可发送')).toBeInTheDocument();
    expect(screen.getByText('运行中 · 可停止')).toBeInTheDocument();
    const sendButtons = screen.getAllByRole('button', { name: '发送' });
    expect(sendButtons[0]).toBeDisabled();
    expect(sendButtons[1]).toBeEnabled();
    expect(screen.getByRole('button', { name: '停止' })).toBeEnabled();
  });
});

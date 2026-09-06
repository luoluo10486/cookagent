import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AdminPage } from '../AdminPage';

function renderUsers() {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route path="/admin/*" element={<AdminPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Admin user details', () => {
  it('renders the user list and all five detail tabs', async () => {
    renderUsers();

    expect(await screen.findByRole('heading', { name: '用户管理', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /usr_098a1/ })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: '资料' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('KetoMealFormer_v4')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '用户详情 Tab' })).toBeInTheDocument();
    expect(screen.getByText(/禁用 \/ 锁定前显示影响：撤销会话/)).toBeInTheDocument();
  });

  it('switches between dietary, business session and operation history tabs', async () => {
    const user = userEvent.setup();
    renderUsers();

    await screen.findByRole('row', { name: /usr_098a1/ });
    await user.click(screen.getByRole('tab', { name: '饮食' }));
    expect(screen.getByText('蛋白质目标')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: '业务会话' }));
    expect(screen.getByText('session_keto_418')).toBeVisible();
    expect(screen.getByText('Keto meal planning')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: '历史' }));
    const historyPanel = screen.getByRole('tabpanel');
    expect(within(historyPanel).getByText('LOGIN')).toBeInTheDocument();
    expect(within(historyPanel).getByText('req_login_098a1')).toBeInTheDocument();
  });

  it('keeps status actions on the shared operation state machine', async () => {
    const user = userEvent.setup();
    renderUsers();

    await screen.findByRole('row', { name: /usr_112b9/ });
    const userRow = screen.getByRole('row', { name: /usr_112b9/ });
    await user.click(within(userRow).getByRole('button', { name: 'usr_112b9 操作' }));
    await user.click(screen.getByRole('menuitem', { name: '锁定用户' }));
    expect(screen.getByRole('dialog', { name: '确认锁定用户' })).toBeInTheDocument();
  });

  it('uses shadcn filter controls and restores the complete list on reset', async () => {
    const user = userEvent.setup();
    renderUsers();

    const search = await screen.findByRole('textbox', { name: '搜索用户名、ID或邮箱' });
    expect(screen.getByRole('combobox', { name: '角色筛选' })).toHaveTextContent('角色：全部');
    expect(screen.getByRole('combobox', { name: '状态筛选' })).toHaveTextContent('状态：活跃');
    expect(screen.getByRole('button', { name: '注册时间筛选' })).toHaveTextContent('Registered: Last 30 Days');

    await user.type(search, 'sarah');
    expect(screen.getByRole('row', { name: /usr_112b9/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /usr_098a1/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: '角色筛选' }));
    await user.click(screen.getByRole('option', { name: '角色：操作员' }));
    expect(screen.getByRole('row', { name: /usr_112b9/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重置筛选' }));
    expect(search).toHaveValue('');
    expect(screen.getByRole('row', { name: /usr_889d4/ })).toBeInTheDocument();
  });
});

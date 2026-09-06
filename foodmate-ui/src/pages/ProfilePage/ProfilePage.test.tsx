import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProfilePage } from './ProfilePage';
import styles from './ProfilePage.module.css';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/memories" element={<ProfilePage />} />
        <Route path="/profile/security" element={<ProfilePage />} />
        <Route path="/profile/data" element={<ProfilePage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfilePage', () => {
  it.each([
    ['basic', '饮食与身体目标'],
    ['memories', '记忆系统'],
    ['security', '修改账号密码'],
    ['privacy', '导出个人工作区数据'],
  ])('maps the Figma %s fixture to its page', (state, heading) => {
    renderPage(`/profile?state=${state}`);

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('keeps the Figma fixture navigation semantics aligned with the rendered profile tab', () => {
    renderPage('/profile?state=security');

    expect(screen.getByRole('link', { name: '安全与设备' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '基本资料' })).not.toHaveAttribute('aria-current');
  });

  it('uses the Figma unsaved-leave modal contract', () => {
    renderPage('/profile?state=basic-unsaved-leave-confirmation');

    const modal = screen.getByRole('heading', { name: '放弃未保存的修改？' }).closest('section');

    expect(modal).toHaveClass(styles.fixtureModalUnsaved);
    expect(modal).toHaveAttribute('data-figma-modal', 'profile-basic-unsaved-leave-confirmation');
    expect(screen.getByRole('button', { name: '继续编辑' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '放弃并离开' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
  });

  it('uses the Figma profile fixture for the default mock entry', () => {
    const { container } = renderPage('/profile');

    expect(screen.getByText('Anddy')).toBeInTheDocument();
    expect(screen.getByText('anddy_operator_9')).toBeInTheDocument();
    expect(screen.getByDisplayValue('150')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '花生' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '乳糖' })).toBeInTheDocument();
    expect(screen.getByText('早餐奶昔配方')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument();
    expect(screen.getByText('饮食与身体目标')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '个人头像' })).toHaveAttribute(
      'src',
      '/assets/figma/profile/main-avatar.png',
    );
    expect(screen.getByRole('button', { name: 'Anddy' }).querySelector('img')).toHaveAttribute(
      'src',
      '/assets/figma/profile/topbar-avatar.png',
    );
    expect(container.querySelector('.profile img')).toHaveAttribute('src', '/assets/figma/profile/sidebar-avatar.png');
    expect(container.querySelector('img[src="/assets/figma/workspace/profile/home.svg"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/assets/figma/workspace/profile/topbar-search.svg"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/assets/figma/workspace/profile/notification.svg"]')).toBeInTheDocument();
    expect(screen.getByText('首席运营')).toBeInTheDocument();
    expect(document.querySelector('[data-name="window-controls"]')).toBeInTheDocument();
  });

  it('renders the complete basic Figma fixture field set', () => {
    renderPage('/profile?state=basic');

    expect(screen.getByRole('textbox', { name: '展示名称' })).toHaveValue('Anddy 的工作区');
    expect(screen.getByRole('combobox', { name: '性别（可选）' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '身高 (cm)' })).toHaveValue('180');
    expect(screen.getByRole('textbox', { name: '体重 (kg)' })).toHaveValue('78');
    expect(screen.getByRole('combobox', { name: '活动水平' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '饮食目标' })).toHaveValue('精益增肌');
    expect(screen.getByRole('textbox', { name: '每日热量目标 (千卡)' })).toHaveValue('2500');
    expect(screen.getByRole('textbox', { name: '每日蛋白质目标 (g)' })).toHaveValue('150');
    expect(screen.getByRole('heading', { name: '饮食与身体目标' }).closest('div')).toHaveClass(styles.figmaGoalsCard);
    expect(screen.getByText('偏好速览')).toBeInTheDocument();
    expect(screen.getByText('头像与账号概览')).toBeInTheDocument();
    expect(screen.getByText('账号状态')).toBeInTheDocument();
    expect(screen.getByText('头像与账号概览').closest('div')).toHaveClass(styles.figmaProfileCard);
  });

  it('marks the memories page with its Figma-only geometry contract', () => {
    renderPage('/profile?state=memories');

    const memoryPage = screen.getByRole('heading', { name: '记忆系统' }).closest('[data-figma-layout]');

    expect(memoryPage).toHaveAttribute('data-figma-layout', 'profile-memories');
    expect(memoryPage?.querySelector('img[src="/assets/figma/workspace/profile/memory-eye.svg"]')).toBeInTheDocument();
    expect(memoryPage?.querySelector('img[src="/assets/figma/workspace/profile/memory-edit.svg"]')).toBeInTheDocument();
    expect(
      memoryPage?.querySelector('img[src="/assets/figma/workspace/profile/memory-trash.svg"]'),
    ).toBeInTheDocument();
  });

  it('limits the security Figma fixture to the two reference cards', () => {
    renderPage('/profile?state=security');

    const securityPage = screen.getByRole('heading', { name: '修改账号密码' }).closest('[data-figma-layout]');

    expect(securityPage).toHaveAttribute('data-figma-layout', 'profile-security');
    expect(securityPage).toHaveClass(styles.figmaSecurityPage);
    expect(screen.queryByRole('heading', { name: '最近安全活动' })).not.toBeInTheDocument();
    expect(screen.queryByText('SECURE')).not.toBeInTheDocument();
    expect(screen.queryByText('2 ACTIVE DEVICES')).not.toBeInTheDocument();
    expect(screen.queryByText('设备状态在每次登录后更新')).not.toBeInTheDocument();
    expect(securityPage?.querySelector(`.${styles.securityAccent}`)).not.toBeInTheDocument();
    expect(securityPage?.querySelector(`.${styles.sessionAccent}`)).not.toBeInTheDocument();
  });

  it('renders the Figma logout confirmation fixture with the target devices', async () => {
    const user = userEvent.setup();
    renderPage('/profile?state=security-logout-confirm');

    expect(screen.getByRole('heading', { name: '退出其他设备？' })).toBeInTheDocument();
    expect(
      screen.getByText(
        '这将退出除当前设备以外的 2 个活跃会话。当前设备会保留登录状态，最近的运行和审计记录不会被删除。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('将退出：iPhone 15 Pro · iOS App；Google Chrome · Windows 11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认退出' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认继续' })).not.toBeInTheDocument();
    expect(screen.getByText('Anddy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '安全与设备' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: '确认退出' }));

    expect(screen.queryByRole('heading', { name: '退出其他设备？' })).not.toBeInTheDocument();
  });

  it('renders the Figma account deletion confirmation fixture', async () => {
    const user = userEvent.setup();
    renderPage('/profile?state=privacy-delete-confirm');

    expect(screen.getByText('DANGER ZONE · CONFIRM')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '确认注销 FoodMate 账号' })).toBeInTheDocument();
    expect(
      screen.getByText(
        '确认后账号会立即禁用，全部登录会话将被撤销，并开始后台清理个人资料、饮食记录、记忆和知识库数据。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('请先导出需要保留的数据；取消或失败不会改变现有数据。')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '输入 DELETE 继续' })).toHaveValue('DELETE');
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认注销' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认继续' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByRole('heading', { name: '确认注销 FoodMate 账号' })).not.toBeInTheDocument();
  });

  it('dismisses the account deletion fixture from the confirm action', async () => {
    const user = userEvent.setup();
    renderPage('/profile?state=privacy-delete-confirm');

    await user.click(screen.getByRole('button', { name: '确认注销' }));

    expect(screen.queryByRole('heading', { name: '确认注销 FoodMate 账号' })).not.toBeInTheDocument();
  });

  it('renders and dismisses the Figma export queued fixture', async () => {
    const user = userEvent.setup();
    renderPage('/profile?state=privacy-export-queued');

    expect(screen.getByRole('heading', { name: '数据导出已排队' })).toBeInTheDocument();
    expect(screen.getByText('任务已创建，后台整理完成后提供一次性下载。')).toBeInTheDocument();
    expect(screen.getByText('状态: queued · 预计等待 1-2 分钟 · export_id: exp_20260731_01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.queryByText('状态：queued')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '关闭' }));

    expect(screen.queryByRole('heading', { name: '数据导出已排队' })).not.toBeInTheDocument();
  });

  it('renders and dismisses the Figma export running fixture', async () => {
    const user = userEvent.setup();
    renderPage('/profile?state=privacy-export-running');

    expect(screen.getByRole('heading', { name: '正在生成数据导出' })).toBeInTheDocument();
    expect(screen.getByText('正在脱敏并打包数据，完成后会显示一次性下载入口。')).toBeInTheDocument();
    expect(screen.getByText('状态: running · 已处理 68% · export_id: exp_20260731_01')).toBeInTheDocument();
    expect(screen.getByLabelText('数据导出进度 68%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.queryByText('状态：running')).not.toBeInTheDocument();

    const status = screen.getByText('状态: running · 已处理 68% · export_id: exp_20260731_01');
    const progress = screen.getByLabelText('数据导出进度 68%');
    expect(status).not.toHaveStyle({ marginTop: '24px' });
    expect(progress).toHaveAttribute('aria-label', '数据导出进度 68%');

    await user.click(screen.getByRole('button', { name: '关闭' }));

    expect(screen.queryByRole('heading', { name: '正在生成数据导出' })).not.toBeInTheDocument();
  });

  it('renders and dismisses the Figma export expired fixture', async () => {
    const user = userEvent.setup();
    renderPage('/profile?state=privacy-export-expired');

    expect(screen.getByRole('heading', { name: '导出文件已过期' })).toBeInTheDocument();
    expect(screen.getByText('下载链接已过期，请重新创建导出任务。')).toBeInTheDocument();
    expect(screen.getByText('状态: expired · export_id: exp_20260729_18')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新创建导出' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.queryByText('状态：expired')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重新创建导出' }));

    expect(screen.queryByRole('heading', { name: '导出文件已过期' })).not.toBeInTheDocument();
  });

  it('renders and dismisses the Figma deletion submitting fixture', async () => {
    const user = userEvent.setup();
    renderPage('/profile?state=privacy-deletion-submitting');

    expect(screen.getByRole('heading', { name: '正在注销账号' })).toBeInTheDocument();
    expect(screen.getByText('正在禁用账号并撤销会话，后台清理已排队。')).toBeInTheDocument();
    expect(screen.getByText('提交中 · request_id: req_delete_91ba')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '关闭' }));

    expect(screen.queryByRole('heading', { name: '正在注销账号' })).not.toBeInTheDocument();
  });

  it('renders and dismisses the Figma deletion success fixture', async () => {
    const user = userEvent.setup();
    renderPage('/profile?state=privacy-deletion-success');

    expect(screen.getByRole('heading', { name: '账号已注销' })).toBeInTheDocument();
    expect(screen.getByText('账号已禁用，全部会话已撤销，后台清理任务已创建。')).toBeInTheDocument();
    expect(screen.getByText('完成 · request_id: req_delete_91ba')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.queryByText('完成 · request_id: req_delete_91ba。')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '关闭' }));

    expect(screen.queryByRole('heading', { name: '账号已注销' })).not.toBeInTheDocument();
  });

  it('renders and dismisses the Figma deletion failure fixture', async () => {
    const user = userEvent.setup();
    renderPage('/profile?state=privacy-deletion-failed');

    expect(screen.getByRole('heading', { name: '账号注销失败' })).toBeInTheDocument();
    expect(screen.getByText('清理任务失败，账号状态保持不变，请重新创建。')).toBeInTheDocument();
    expect(screen.getByText('错误码: ACCOUNT_DELETION_FAILED · request_id: req_delete_b721')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新创建注销请求' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重新创建注销请求' }));

    expect(screen.queryByRole('heading', { name: '账号注销失败' })).not.toBeInTheDocument();
  });

  it('edits profile fields and manages allergens before saving', async () => {
    const user = userEvent.setup();
    renderPage('/profile');

    const proteinTarget = screen.getByRole('textbox', { name: '每日蛋白质目标 (g)' });
    await user.clear(proteinTarget);
    await user.type(proteinTarget, '160');

    const allergenInput = screen.getByRole('textbox', { name: '添加过敏原' });
    await user.type(allergenInput, '花生');
    await user.click(screen.getByRole('button', { name: '添加过敏原' }));

    expect(screen.getByRole('button', { name: '花生' })).toHaveClass('inline-flex');
    expect(screen.getByRole('button', { name: '放弃更改' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '保存资料' }));

    expect(screen.getByRole('button', { name: '放弃更改' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '花生' }));
    expect(screen.queryByRole('button', { name: '花生' })).not.toBeInTheDocument();
  });

  it('filters memories and routes the empty state back to chat', async () => {
    const user = userEvent.setup();
    renderPage('/profile/memories');

    await user.click(screen.getByRole('tab', { name: '待确认 (3)' }));
    expect(screen.getByRole('tab', { name: '待确认 (3)' })).toHaveClass('inline-flex');
    expect(screen.getByText(/Attempts to avoid soy protein isolates/)).toBeInTheDocument();
    expect(screen.queryByText(/Prefers wild caught salmon/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: '记忆分类' }));
    await user.click(screen.getByRole('option', { name: '目标' }));
    expect(screen.getByRole('heading', { name: '暂无长期记忆' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '去会话确认' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/chat');
  });

  it('shows password validation failure without submitting an invalid password', async () => {
    const user = userEvent.setup();
    renderPage('/profile/security');

    await user.type(screen.getByLabelText('当前密码'), 'current-password');
    await user.type(screen.getByLabelText('新密码'), 'short');
    await user.type(screen.getByLabelText('确认密码'), 'short');
    await user.click(screen.getByRole('button', { name: '更新密码' }));

    expect(screen.getByText('密码更新失败，请重新填写')).toBeInTheDocument();
  });

  it('confirms logging out other devices and preserves the current session', async () => {
    const user = userEvent.setup();
    renderPage('/profile/security');

    expect(screen.getByRole('button', { name: /查看登录历史/ })).toHaveClass('inline-flex');
    await user.click(screen.getByRole('button', { name: '退出其他设备' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '退出其他设备？' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '确认退出' }));

    expect(screen.queryByText('iPhone 15 Pro · iOS App')).not.toBeInTheDocument();
    expect(screen.queryByText('Google Chrome · Windows 11')).not.toBeInTheDocument();
    expect(screen.getByText('0 ACTIVE DEVICES')).toBeInTheDocument();
  });

  it('queues an export and requires the deletion confirmation phrase', async () => {
    const user = userEvent.setup();
    renderPage('/profile/data');

    await user.click(screen.getByRole('button', { name: '创建数据导出' }));
    expect(screen.getByText('今天')).toBeInTheDocument();
    expect(screen.getAllByText('排队中').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '创建数据导出' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /下载归档/ })).toHaveClass('inline-flex');

    await user.click(screen.getByRole('button', { name: '申请注销账号' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.type(screen.getByLabelText('当前密码'), 'current-password');
    await user.type(screen.getByPlaceholderText('DELETE_MY_ACCOUNT'), 'DELETE_MY_ACCOUNT');
    await user.click(screen.getByRole('button', { name: '确认注销' }));

    expect(screen.getByText(/账号已注销 · request_id:/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

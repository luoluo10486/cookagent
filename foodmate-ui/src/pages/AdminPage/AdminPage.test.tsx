import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AdminPage } from './AdminPage';

function renderAdmin(initialEntry = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/*" element={<AdminPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminPage overview', () => {
  it('matches the Figma overview structure and keeps admin navigation visible', () => {
    renderAdmin();

    expect(screen.getByText('管理概览')).toBeInTheDocument();
    expect(screen.getByText('生产环境')).toBeInTheDocument();
    expect(screen.getByText('AgentRun 总量')).toBeInTheDocument();
    expect(screen.getByText('12,480')).toBeInTheDocument();
    expect(screen.getByText('成功率')).toBeInTheDocument();
    expect(screen.getByText('91.4%')).toBeInTheDocument();
    expect(screen.getByText('$128.45')).toBeInTheDocument();
    expect(screen.getByText('显示第 1 到 6 条，共 12,480 条结果')).toBeInTheDocument();
    expect(screen.getAllByText('查看详情')).toHaveLength(6);
    expect(screen.getByRole('button', { name: '复制 run_889a4' })).toBeInTheDocument();

    for (const label of [
      '概览',
      '用户管理',
      'Agent 运行',
      '工具调用',
      'SQL 审计',
      'Trace',
      '模型用量',
      '知识库管理',
      '工具注册表',
      '删除资源',
      '操作审计',
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: '模型治理' })).not.toBeInTheDocument();
  });

  it('does not render the Figma-only macOS window control dots', () => {
    renderAdmin();

    expect(document.querySelector('[data-name="window-controls"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-name="traffic-light"]')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/#ff3b30|#ffcc00|#34c759/i);
  });

  it('uses the registered Figma SVG asset for every admin navigation item', () => {
    renderAdmin();

    const icons = Array.from(document.querySelectorAll<HTMLElement>('[data-figma-icon]'));
    expect(icons).toHaveLength(11);
    expect(icons.map((icon) => icon.dataset.figmaIcon)).toEqual([
      'overview',
      'users',
      'runs',
      'tools',
      'sql',
      'trace',
      'usage',
      'knowledge',
      'registry',
      'deleted',
      'audit',
    ]);
    expect(
      icons.every((icon) =>
        icon.style.getPropertyValue('--admin-nav-icon').includes('/assets/figma/admin/navigation/'),
      ),
    ).toBe(true);
  });

  it('uses Figma fixture avatars and the registered overview copy asset', () => {
    renderAdmin('/admin?state=overview');

    expect(document.querySelector('.userAvatar img')).toHaveAttribute(
      'src',
      '/assets/figma/admin/admin-sidebar-avatar.png',
    );
    expect(document.querySelectorAll('[data-figma-asset="admin-overview-copy"]')).toHaveLength(6);
  });

  it('uses the registered Figma filter icons while preserving shadcn Select behavior', () => {
    renderAdmin();

    expect(document.querySelectorAll('[data-figma-asset="admin-overview-dropdown-arrow"]')).toHaveLength(3);
    expect(document.querySelector('[data-figma-asset="admin-overview-search"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-label="时间范围"] [data-radix-select-icon] svg')).toHaveLength(0);
  });

  it('keeps the overview analytics cards at their Figma desktop widths', () => {
    renderAdmin();

    const cards = Array.from(document.querySelectorAll('[data-figma-role="admin-overview-analytics-card"]'));
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.getAttribute('data-figma-node'))).toEqual(['1005:3', '1005:7', '1005:11']);
    expect(cards.map((card) => card.getAttribute('data-figma-width'))).toEqual(['344', '344', '344']);
    expect(document.querySelector('[data-figma-role="admin-overview-analytics"]')).toHaveAttribute(
      'data-figma-border',
      'inset',
    );
    expect(cards.every((card) => card.getAttribute('data-figma-border') === 'inset')).toBe(true);
  });

  it('filters the overview table by result and search query', async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(screen.getByRole('combobox', { name: '结果筛选' }));
    await user.click(screen.getByRole('option', { name: 'completed' }));
    expect(screen.queryByText('run_889a4')).not.toBeInTheDocument();
    expect(screen.queryByText('run_133c9')).not.toBeInTheDocument();
    expect(screen.queryByText('run_98218a')).not.toBeInTheDocument();
    expect(screen.getByText('run_774x2')).toBeInTheDocument();

    const search = screen.getByRole('textbox', { name: '搜索运行或用户' });
    await user.clear(search);
    await user.type(search, 'sarah_chen');
    expect(screen.getByText('run_774x2')).toBeInTheDocument();
    expect(screen.queryByText('run_552b1')).not.toBeInTheDocument();
  });

  it('highlights only the exact query route in the admin navigation', () => {
    const { unmount } = renderAdmin();

    expect(screen.getByRole('link', { name: '概览' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '操作审计' })).not.toHaveAttribute('aria-current');

    unmount();
    renderAdmin('/admin?view=audit');

    expect(screen.getByRole('link', { name: '概览' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '操作审计' })).toHaveAttribute('aria-current', 'page');
  });

  it('maps admin visual fixture query states to their real sections', () => {
    let view = renderAdmin('/admin?state=tool-registry');
    expect(screen.getByText('已注册工具')).toBeInTheDocument();
    expect(document.querySelector('nav a[aria-current="page"]')).toHaveAttribute('href', '/admin/tools?tab=registry');

    view.unmount();
    view = renderAdmin('/admin?state=deleted-resources');
    expect(screen.getByText('存档数据保护规范与合规通告')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '删除资源' })).toHaveAttribute('aria-current', 'page');

    view.unmount();
    view = renderAdmin('/admin?state=user-detail');
    expect(screen.getByText('用户详情')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '用户管理' })).toHaveAttribute('aria-current', 'page');

    view.unmount();
    view = renderAdmin('/admin?state=op-confirm');
    expect(screen.getByText('已注册工具')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '确认停用工具' })).toBeInTheDocument();
    expect(document.querySelector('nav a[aria-current="page"]')).toHaveAttribute('href', '/admin/tools?tab=registry');
    view.unmount();
  });

  it('uses the Figma user-detail close affordance and registered fixture avatar', () => {
    renderAdmin('/admin?state=user-detail');

    const closeButton = screen.getByRole('button', { name: '关闭用户详情' });
    expect(closeButton).toHaveAttribute('data-figma-asset', 'admin-user-detail-close');
    expect(closeButton.querySelector('svg circle')).toBeInTheDocument();
    expect(document.querySelector('.userDetailAvatar img')).toHaveAttribute(
      'src',
      '/assets/figma/admin/user-detail-avatar.png',
    );
  });

  it('limits operation-state fixtures to the four Figma registry rows', () => {
    renderAdmin('/admin?state=op-confirm');

    expect(screen.getAllByText('nutrition_lookup')).toHaveLength(2);
    expect(screen.getAllByText('food_image_analyze')).toHaveLength(1);
    expect(screen.getAllByText('meal_plan_generate')).toHaveLength(1);
    expect(screen.getAllByText('knowledge_search')).toHaveLength(1);
    expect(screen.queryByText('sql_query')).not.toBeInTheDocument();
    expect(screen.queryByText('user_memory_write')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '权限范围筛选' })).not.toBeInTheDocument();
    expect(screen.getByText('显示第 1 到 4 条，共 24 条结果')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '3' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '4' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '停用工具', hidden: true })).toHaveLength(4);
  });

  it('renders the Figma run detail fixture with a table and execution steps', () => {
    renderAdmin('/admin?state=run-detail');

    expect(screen.getByText('Agent 运行控制台')).toBeInTheDocument();
    expect(screen.getAllByText('run_98218a')).toHaveLength(2);
    expect(screen.getByRole('region', { name: '执行事件追踪' })).toBeInTheDocument();
    expect(screen.getByText('1. 分发')).toBeInTheDocument();
    expect(screen.getByText('4. 失败')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Run 详情字段' })).toBeInTheDocument();
    expect(screen.getByText(/父 Run：run_9812a0/)).toBeInTheDocument();
    expect(screen.getByText(/request_id req_7c2e/)).toBeInTheDocument();
    expect(screen.queryByText(/caller_context_mask/)).not.toBeInTheDocument();
  });

  it('renders the Figma tool call fixture with filters and masked payload details', async () => {
    const user = userEvent.setup();
    renderAdmin('/admin?state=tool-calls');

    expect(screen.getByText('工具调用与 SQL 审计')).toBeInTheDocument();
    expect(document.querySelector('nav[aria-label="治理详情视图"] a')).toHaveAttribute(
      'href',
      '/admin?state=tool-calls',
    );
    expect(screen.getByText('Arguments & System Schema (call_829c)')).toBeInTheDocument();
    expect(screen.getByText('策略：通过')).toBeInTheDocument();
    expect(document.body.textContent).toContain('SENSITIVE_USER_CREDENTIALS_MASKED');
    expect(screen.getByRole('complementary', { name: 'Tool Calls 筛选与详情' })).toHaveAttribute(
      'data-figma-role',
      'admin-tool-calls-detail-fields',
    );

    const search = screen.getByRole('textbox', { name: '搜索运行 ID' });
    await user.type(search, 'does-not-exist');
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('没有匹配的工具调用');
  });

  it('renders the Figma SQL audit fixture with redaction guidance', async () => {
    const user = userEvent.setup();
    renderAdmin('/admin?state=sql-audit');

    expect(screen.getByText('工具调用与 SQL 审计')).toBeInTheDocument();
    expect(screen.getByText('SQL Audit · 筛选与详情')).toBeInTheDocument();
    expect(screen.getByText(/数据库凭据、令牌和敏感参数统一脱敏/)).toBeInTheDocument();
    expect(
      document.querySelector('nav[aria-label="治理详情视图"] a[href="/admin?state=sql-audit"]'),
    ).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: '搜索 SQL 运行 ID' }), 'not-found');
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('没有匹配的 SQL 审计记录');
  });

  it('renders the Figma trace fixture with timeline and trace aggregation guidance', () => {
    renderAdmin('/admin?state=trace');

    expect(screen.getByText('Agent 运行控制台')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '执行事件追踪' })).toBeInTheDocument();
    expect(screen.getByText('Trace 聚合与筛选')).toBeInTheDocument();
    expect(screen.getByText(/request_id req_7c2e/)).toBeInTheDocument();
    expect(screen.getByText('3. 降级')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载完整日志' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Run 详情字段' })).not.toBeInTheDocument();
    expect(document.querySelector('.fixtureSurfaceCard')).toBeNull();
  });
});

describe('AdminPage knowledge upload fixtures', () => {
  it('renders the uploading state with the submitted batch and 64% progress', () => {
    renderAdmin('/admin?state=knowledge-uploading');

    expect(screen.getByRole('dialog', { name: '批量任务已提交' })).toBeInTheDocument();
    expect(screen.getByText('3 个文件 · nutrient_reference.xlsx 等')).toBeInTheDocument();
    expect(screen.getByText('上传中 · 64% · 可离开页面，完成后自动开始索引')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '64');
    expect(screen.getByRole('link', { name: '查看任务进度' })).toBeInTheDocument();
  });

  it('renders the indexing state with the batch detail and 72% progress', () => {
    renderAdmin('/admin?state=knowledge-indexing');

    expect(screen.getByRole('dialog', { name: '后台正在建立索引' })).toBeInTheDocument();
    expect(screen.getByText('3 个文件 · 批次 KB-20260731-0042')).toBeInTheDocument();
    expect(screen.getByText('索引中 · 72% · 可离开页面，完成后收到通知')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '72');
    expect(screen.getByText('任务详情 · 已完成 1 / 3 个文件')).toBeInTheDocument();
  });

  it('renders the batch failure state with a retry action', () => {
    renderAdmin('/admin?state=knowledge-upload-failed');

    expect(screen.getByRole('dialog', { name: '批次上传有失败项' })).toBeInTheDocument();
    expect(screen.getByText('1 个文件失败 · nutrient_reference.xlsx')).toBeInTheDocument();
    expect(screen.getByText('其余 2 个文件已接收并继续后台索引，可单独重试失败文件。')).toBeInTheDocument();
    expect(screen.getByText('错误码：KB_UPLOAD_FORMAT_INVALID · request_id: req_kb_20260731_0042')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试此文件' })).toBeInTheDocument();
  });

  it('renders the format validation error with the remove-and-retry action', () => {
    renderAdmin('/admin?state=knowledge-format-error');

    expect(screen.getByRole('dialog', { name: '文件格式校验失败' })).toBeInTheDocument();
    expect(screen.getByText('2 个文件不支持 · meal_photo.webp')).toBeInTheDocument();
    expect(screen.getByText('仅支持 PDF / CSV / XLSX / TXT；其他文件未提交。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移除并重试' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });

  it('renders the size limit error with the file selection action', () => {
    renderAdmin('/admin?state=knowledge-size-error');

    expect(screen.getByRole('dialog', { name: '文件大小超过限制' })).toBeInTheDocument();
    expect(screen.getByText('1 个文件超出 50MB · nutrition_archive.pdf')).toBeInTheDocument();
    expect(screen.getByText('文件未提交；其他文件继续后台索引。')).toBeInTheDocument();
    expect(screen.getByText('错误码：KB_UPLOAD_SIZE_LIMIT · request_id: req_kb_20260731_0048')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新选择文件' })).toBeInTheDocument();
  });

  it('returns to the normal knowledge page after upload success', () => {
    renderAdmin('/admin?state=knowledge-upload-success');

    expect(screen.getByRole('link', { name: '知识库管理' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('USDA_Keto_Ingredient_Guidelines.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Admin model usage Figma fixture', () => {
  it('renders the model usage board with filters, six usage rows, pagination, and analytics', () => {
    renderAdmin('/admin/usage');

    expect(screen.getByRole('heading', { name: '模型用量', level: 1 })).toBeInTheDocument();
    const environmentBadge = document.querySelector('.topbar .envBadge');
    expect(environmentBadge).toBeInTheDocument();
    expect(environmentBadge).toHaveTextContent('生产环境');
    expect(screen.getByText('数据刷新：刚刚')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出 CSV' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '模型用量筛选' })).toBeInTheDocument();
    expect(screen.getAllByText('结果:')).toHaveLength(1);
    expect(screen.getAllByText('供应商:')).toHaveLength(1);
    expect(screen.getAllByText('模型:')).toHaveLength(1);
    expect(screen.getByPlaceholderText('时间 / 场景 / 模型 / Run ID...')).toBeInTheDocument();

    expect(screen.getByText('输入 Token')).toBeInTheDocument();
    expect(screen.getByText('12.4M')).toBeInTheDocument();
    expect(screen.getByText('输出 Token')).toBeInTheDocument();
    expect(screen.getByText('3.7M')).toBeInTheDocument();
    expect(screen.getByText('总成本')).toBeInTheDocument();
    expect(screen.getByText('$128.45')).toBeInTheDocument();

    const table = screen.getByRole('region', { name: '模型用量明细' });
    expect(table).toBeInTheDocument();
    expect(screen.getByText('调用时间')).toBeInTheDocument();
    expect(screen.getByText('run_98218a')).toBeInTheDocument();
    expect(screen.getByText('run_774x2')).toBeInTheDocument();
    expect(screen.getByText('run_889a4')).toBeInTheDocument();
    expect(screen.getByText('run_552b1')).toBeInTheDocument();
    expect(screen.getByText('run_133c9')).toBeInTheDocument();
    expect(screen.getByText('run_908d1')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '查看 Run' })).toHaveLength(6);
    expect(screen.getByText('显示第 1 到 6 条，共 12,480 条结果')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '模型用量分页' })).toBeInTheDocument();

    expect(screen.getByText('成本 / Token 趋势')).toBeInTheDocument();
    expect(screen.getByText('供应商占比')).toBeInTheDocument();
    expect(screen.getByText('场景排行')).toBeInTheDocument();
    expect(document.querySelector('[data-name="window-controls"]')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/traffic-light|#ff3b30|#ffcc00|#34c759/i);
  });

  it('filters usage rows and copies a run id from the Figma table', async () => {
    const user = userEvent.setup();
    renderAdmin('/admin/usage');

    const search = screen.getByPlaceholderText('时间 / 场景 / 模型 / Run ID...');
    await user.type(search, 'run_774x2');

    expect(screen.getByText('run_774x2')).toBeInTheDocument();
    expect(screen.queryByText('run_98218a')).not.toBeInTheDocument();
    expect(screen.getByText('显示第 1 到 1 条，共 12,480 条结果')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '复制 run_774x2' }));
    expect(screen.getByRole('status')).toHaveTextContent('已复制 run_774x2');
  });

  it('filters usage rows by result and changes page without losing the Figma table contract', async () => {
    const user = userEvent.setup();
    renderAdmin('/admin/usage');

    await user.click(screen.getByRole('combobox', { name: '结果筛选' }));
    await user.click(screen.getByRole('option', { name: '失败' }));

    expect(screen.getByText('run_133c9')).toBeInTheDocument();
    expect(screen.queryByText('run_98218a')).not.toBeInTheDocument();
    expect(screen.getByText('显示第 1 到 1 条，共 12,480 条结果')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: '结果筛选' }));
    await user.click(screen.getByRole('option', { name: '全部' }));
    await user.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('显示第 7 到 12 条，共 12,480 条结果')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PlanningPage } from './PlanningPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderPage(initialEntry = '/planning') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PlanningPage', () => {
  it('supports the weekly schedule and shopping checklist interactions', async () => {
    const user = userEvent.setup();
    renderPage();

    const Wednesday = screen.getByRole('tab', { name: '周三 15' });
    expect(Wednesday).toHaveClass('inline-flex');
    await user.click(Wednesday);
    expect(Wednesday).toHaveAttribute('aria-selected', 'true');

    const emptyMeal = screen.getAllByRole('button', { name: '+ 计划' })[0];
    expect(emptyMeal).toHaveClass('inline-flex');
    await user.click(emptyMeal);
    expect(screen.getByRole('status')).toHaveTextContent('已打开早餐的计划入口');

    const salmon = screen.getByRole('checkbox', { name: '野生三文鱼 (450g)' });
    await user.click(salmon);
    expect(salmon).toBeChecked();

    await user.click(screen.getByRole('button', { name: '保存计划' }));
    expect(screen.getByRole('status')).toHaveTextContent('计划已保存');
  });

  it('renders the Figma shell with session history', () => {
    renderPage('/planning?state=v2');

    expect(screen.getByPlaceholderText('搜索会话...')).toBeInTheDocument();
    expect(screen.getByText('每周饮食微调')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument();
    expect(document.querySelector('img[src="/assets/figma/workspace/home-sidebar-avatar.png"]')).toBeInTheDocument();
    expect(document.querySelector('img[src="/assets/figma/workspace/home-topbar-avatar.png"]')).toBeInTheDocument();
    expect(document.querySelector('img[src="/assets/figma/workspace/planning/meal-planning.svg"]')).toBeInTheDocument();
    expect(screen.getByLabelText('餐食规划')).toHaveAttribute('data-figma-node-id', '640:974');
  });

  it('keeps the account dock in the Figma planning fixture', () => {
    renderPage('/planning?state=v2');

    expect(screen.getByRole('button', { name: '收起导航' })).toBeInTheDocument();
    expect(screen.getByText('就绪 (Fustat-v2)')).toBeInTheDocument();
    expect(screen.getByText('Anddy 的工作区')).toBeInTheDocument();
  });

  it('renders all four planning constraint statuses', () => {
    renderPage('/planning?state=v2');

    expect(screen.getAllByText('Pass ✓')).toHaveLength(3);
    expect(screen.getByText('Review ✗')).toBeInTheDocument();
  });

  it('renders loading, empty, and error states with their recovery paths', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage('/planning?state=loading');
    expect(screen.getByLabelText('餐食规划加载中')).toHaveAttribute('aria-busy', 'true');
    unmount();

    renderPage('/planning?state=empty');
    await user.click(screen.getByRole('button', { name: '创建首个规划方案' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/chat?prompt=请为我创建本周餐食规划');
    unmount();

    renderPage('/planning?state=error');
    await user.click(screen.getByRole('button', { name: '重新加载' }));
    expect(screen.getByRole('heading', { name: '增肌计划 v3' })).toBeInTheDocument();
  });

  it('keeps the error fixture shell free of session history', () => {
    renderPage('/planning?state=error');

    expect(screen.getByText('Agent 对话')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('搜索会话...')).not.toBeInTheDocument();
    expect(document.querySelector('.sidebar-session-list')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toHaveClass('inline-flex');
  });

  it('keeps plan list filters and the wizard progression aligned', async () => {
    const user = userEvent.setup();
    renderPage('/planning?state=list');

    expect(screen.getByText('夏日减脂轻食计划')).toBeInTheDocument();
    expect(screen.getByText('高蛋白增肌能量餐')).toBeInTheDocument();
    expect(screen.getByText('抗炎生酮低碳饮食')).toBeInTheDocument();
    const draftTab = screen.getByRole('tab', { name: '草稿箱' });
    expect(draftTab).toHaveClass('inline-flex');
    await user.click(draftTab);
    expect(screen.getByText('高蛋白增肌能量餐')).toBeInTheDocument();
    expect(screen.queryByText('夏日减脂轻食计划')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '进行中' }));
    await user.click(screen.getAllByRole('button', { name: '进入计划' })[0]);
    expect(screen.getByRole('heading', { name: '增肌计划 v3' })).toBeInTheDocument();
  });

  it('keeps the list tab controls at the Figma fixture height', () => {
    const { container } = renderPage('/planning?state=list');
    expect(container.querySelector('[data-figma-role="planning-list-tabs"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-figma-role="planning-list-tab"]')).toHaveLength(3);
  });

  it('scopes the planning list notification treatment to the list fixture', () => {
    const listRender = renderPage('/planning?state=list');
    const listTopbar = listRender.container.querySelector('main header');
    expect(listTopbar).toHaveAttribute('data-topbar-variant', 'planning-list');
    listRender.unmount();

    const emptyRender = renderPage('/planning?state=empty');
    expect(emptyRender.container.querySelector('main header')).not.toHaveAttribute(
      'data-topbar-variant',
      'planning-list',
    );
  });

  it('moves through the wizard and supports cancelling generation', async () => {
    const user = userEvent.setup();
    renderPage('/planning?state=wizard-step1');

    expect(screen.getByRole('button', { name: /设置目标/ })).toHaveClass('inline-flex');
    await user.click(screen.getByRole('button', { name: '下一步: 膳食约束' }));
    expect(screen.getByRole('heading', { name: '步骤 2: 设置膳食约束 & 偏好' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '下一步: 确认并生成' }));
    expect(screen.getByRole('heading', { name: '步骤 3: 确认规则并运行规划' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始生成智能计划' }));
    expect(screen.getByRole('heading', { name: '正在生成您的智能餐食计划' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '取消生成' }));
    expect(screen.getByRole('heading', { name: '步骤 3: 确认规则并运行规划' })).toBeInTheDocument();
  });

  it('uses shadcn actions for allergy chips and plan card menus', async () => {
    const user = userEvent.setup();
    renderPage('/planning?state=wizard-step2');

    const peanut = screen.getByRole('button', { name: /花生/ });
    expect(peanut).toHaveClass('inline-flex');
    await user.click(peanut);
    expect(screen.queryByRole('button', { name: /花生/ })).not.toBeInTheDocument();

    const addAllergy = screen.getByRole('button', { name: '+ 添加过敏源' });
    expect(addAllergy).toHaveClass('inline-flex');
    await user.click(addAllergy);
    expect(screen.getByRole('button', { name: /坚果/ })).toBeInTheDocument();

    renderPage('/planning?state=list');
    const planMenu = screen.getByRole('button', { name: '夏日减脂轻食计划更多操作' });
    expect(planMenu).toHaveClass('inline-flex');
  });

  it('uses the shadcn select for cuisine preferences', async () => {
    const user = userEvent.setup();
    renderPage('/planning?state=wizard-step2');

    const cuisine = screen.getByRole('combobox', { name: '首选菜系口味' });
    expect(cuisine).toHaveTextContent('中式、日式轻食');
    await user.click(cuisine);
    await user.click(screen.getByRole('option', { name: '地中海轻食' }));
    expect(cuisine).toHaveTextContent('地中海轻食');
  });

  it('applies a selected conflict resolution and updates the shopping progress count', async () => {
    const user = userEvent.setup();
    renderPage('/planning?state=conflict');

    await user.click(screen.getByRole('radio', { name: '替换菜品（智能推荐低蛋白早餐）' }));
    expect(screen.getByRole('radio', { name: '替换菜品（智能推荐低蛋白早餐）' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: '应用修改并重新计划' }));
    expect(screen.getByRole('heading', { name: '增肌计划 v3' })).toBeInTheDocument();

    renderPage('/planning?state=shopping-list');
    expect(screen.getByText('已买 3 / 8 项')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '导出清单文件' }));
    expect(screen.getByRole('status')).toHaveTextContent('清单导出已准备');
  });
});

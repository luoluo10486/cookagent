import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { KnowledgePage } from './KnowledgePage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderPage(initialEntry = '/knowledge') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('KnowledgePage', () => {
  it('supports search, topic filters, and citation selection', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: '知识库' })).toBeInTheDocument();
    expect(screen.getByText('显示 24 条结果')).toBeInTheDocument();

    const nutritionFilter = screen.getByRole('button', { name: '营养素' });
    await user.click(nutritionFilter);
    expect(nutritionFilter).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getAllByRole('button', { name: '查看引用' })[1]);
    expect(screen.getByLabelText('当前引用详情：藜麦与酸面包淀粉的血糖指数动态')).toBeInTheDocument();
    expect(screen.getByText('USDA FoodData Central')).toBeInTheDocument();

    const search = screen.getByRole('textbox', { name: '搜索食物知识、食材、烹饪技巧' });
    await user.type(search, '牛油果');
    await user.keyboard('{Enter}');
    expect(screen.getByText('烹饪温度对牛油果健康脂肪的影响')).toBeInTheDocument();
    expect(screen.queryByText('运动后最佳蛋白质吸收窗口期')).not.toBeInTheDocument();
  });

  it('uses the Figma shell fixture for the default page', () => {
    const { container } = renderPage('/knowledge?state=default');

    expect(screen.getByRole('button', { name: 'Anddy' })).toBeInTheDocument();
    expect(screen.getByText('Anddy 的工作区')).toBeInTheDocument();
    expect(container.querySelector('img[src="/assets/figma/knowledge/sidebar-avatar.png"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/assets/figma/knowledge/topbar-avatar.png"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/assets/figma/workspace/knowledge/knowledge.svg"]')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索会话...')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /每周饮食微调/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument();
    expect(container.querySelector('[data-name="window-controls"]')).toBeInTheDocument();
    expect(screen.queryByText('梁同学')).not.toBeInTheDocument();
  });

  it('recovers from an empty result state by clearing the search', async () => {
    const user = userEvent.setup();
    renderPage();

    const search = screen.getByRole('textbox', { name: '搜索食物知识、食材、烹饪技巧' });
    await user.type(search, '不存在的营养内容');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('没有找到相关内容');
    await user.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('显示 24 条结果')).toBeInTheDocument();
  });

  it('uses the Figma shell fixture for knowledge states', () => {
    const { container } = renderPage('/knowledge?state=empty');

    expect(screen.getByText('Anddy')).toBeInTheDocument();
    expect(screen.getByText('早餐奶昔配方')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索会话...')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /每周饮食微调/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('没有找到相关内容');
    expect(container.querySelector('[data-name="window-controls"]')).toBeInTheDocument();
  });

  it('recovers from search and source availability errors', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage('/knowledge?state=search-failed');

    expect(screen.getByRole('alert')).toHaveTextContent('检索失败');
    await user.click(screen.getByRole('button', { name: '重新检索' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    unmount();
    renderPage('/knowledge');
    await user.click(screen.getByRole('button', { name: '打开原始来源' }));
    expect(screen.getByRole('alert')).toHaveTextContent('PARTIAL ACCESS');
    expect(screen.getByRole('alert')).toHaveTextContent('来源暂时不可访问');
    await user.click(screen.getByRole('button', { name: '稍后重试' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('routes the selected result into an attributed knowledge conversation', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getAllByRole('button', { name: '就此提问' })[0]);
    expect(screen.getByTestId('location')).toHaveTextContent('/chat/knowledge?prompt=');
    expect(screen.getByTestId('location')).toHaveTextContent(encodeURIComponent('烹饪温度对牛油果健康脂肪的影响'));
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DietRecordsPage } from './DietRecordsPage';

function renderPage(entry = '/analysis?view=records') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <DietRecordsPage />
    </MemoryRouter>,
  );
}

describe('DietRecordsPage', () => {
  it('switches between day and week views', async () => {
    const user = userEvent.setup();
    renderPage();

    const weekTab = screen.getByRole('tab', { name: '周视图' });
    expect(weekTab).toHaveClass('inline-flex');
    await user.click(weekTab);

    expect(weekTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: '本周，3月11日 - 3月17日' })).toBeInTheDocument();
  });

  it('adds a pending food item through the dialog', async () => {
    const user = userEvent.setup();
    renderPage();

    const addFoodButton = screen.getAllByRole('button', { name: '+ 添加食物' })[0];
    expect(addFoodButton).toHaveClass('inline-flex');
    await user.click(addFoodButton);
    const input = screen.getByPlaceholderText('例如：煮鸡蛋 2 个');
    await user.type(input, '香蕉');
    await user.click(screen.getByRole('button', { name: /^添加$/ }));

    expect(screen.getByText('香蕉')).toBeInTheDocument();
    expect(screen.getByText(/等待营养估算。/)).toBeInTheDocument();
  });

  it('removes a food item through the shared icon button', async () => {
    const user = userEvent.setup();
    renderPage();

    const removeButton = screen.getByRole('button', { name: '删除蓝莓燕麦粥' });
    expect(removeButton).toHaveClass('inline-flex');
    await user.click(removeButton);

    expect(screen.queryByText('蓝莓燕麦粥')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('蓝莓燕麦粥 已从当前记录移除。');
  });

  it('keeps record detail actions as shared buttons', async () => {
    const user = userEvent.setup();
    renderPage();

    const copyButton = screen.getByRole('button', { name: '复制到明天' });
    expect(copyButton).toHaveClass('inline-flex');
    await user.click(copyButton);

    expect(screen.getByRole('status')).toHaveTextContent('已复制到明天的记录草稿。');
  });

  it('renders the Figma session history and record detail without the extra action bar', async () => {
    const user = userEvent.setup();
    renderPage('/analysis?view=records&state=v2');

    expect(screen.getByPlaceholderText('搜索会话...')).toBeInTheDocument();
    expect(screen.getByText('每周饮食微调')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '记录详情 · 待确认记录可在这里补充后保存' })).toBeInTheDocument();
    expect(document.querySelectorAll('img[src="/assets/avatars/default-male.svg"]')).toHaveLength(2);
    expect(document.querySelector('img[src="/assets/figma/diet-records/metric-ring-energy.svg"]')).toBeInTheDocument();
    expect(
      document.querySelector('img[src="/assets/figma/workspace/diet-records/intake-analysis.svg"]'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('饮食记录')).toHaveAttribute('data-figma-node-id', '640:660');
    expect(screen.queryByRole('button', { name: '记录一餐' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '分析这一天' })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: '+ 添加食物' })[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('添加到 Breakfast，营养值将在确认后估算。')).toBeInTheDocument();
  });

  it.each([
    ['loading', '饮食记录加载中'],
    ['empty', '今天还没有饮食记录'],
    ['error', '饮食记录加载失败'],
  ])('renders the Figma %s state', (state, label) => {
    renderPage(`/analysis?view=records&state=${state}`);

    expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('搜索会话...')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '下一页' })).not.toBeInTheDocument();
    expect(screen.getByText('共 15 条会话')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '饮食工具' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-name="window-controls"]')).not.toBeInTheDocument();
  });

  it('opens the first-meal dialog from the empty state', async () => {
    const user = userEvent.setup();
    renderPage('/analysis?view=records&state=empty');

    await user.click(screen.getByRole('button', { name: '记录一餐' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('添加到 Breakfast，营养值将在确认后估算。')).toBeInTheDocument();
  });

  it('returns to the default view from the error state', async () => {
    const user = userEvent.setup();
    renderPage('/analysis?view=records&state=error');

    await user.click(screen.getByRole('button', { name: '重新加载' }));

    expect(screen.getByRole('heading', { name: '记录详情 · 待确认记录可在这里补充后保存' })).toBeInTheDocument();
  });
});

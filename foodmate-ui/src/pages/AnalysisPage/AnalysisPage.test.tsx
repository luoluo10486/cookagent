import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AnalysisPage } from './AnalysisPage';
import styles from './AnalysisPage.module.css';

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location" role="presentation">
      {location.pathname + location.search}
    </output>
  );
}

function renderPage(initialEntry = '/analysis') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/analysis" element={<AnalysisPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('AnalysisPage', () => {
  it('updates summary metrics when the range changes', async () => {
    const user = userEvent.setup();
    renderPage();

    const rangeTab = screen.getByRole('tab', { name: '30 天' });
    expect(rangeTab).toHaveClass('inline-flex');
    await user.click(rangeTab);

    expect(screen.getByRole('tab', { name: '30 天' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('1,896 kcal')).toBeInTheDocument();
    expect(screen.getByText('26 / 30 Days')).toBeInTheDocument();
  });

  it('reports export state without changing the visible analysis', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '导出 CSV' }));

    expect(screen.getByText('分析报告已排队，完成后可下载 CSV。')).toBeInTheDocument();
    expect(screen.getByText('能量摄入与目标对比')).toBeInTheDocument();
  });

  it('renders the Figma filter controls with session history', async () => {
    const user = userEvent.setup();
    renderPage('/analysis?state=v2');

    expect(screen.getByLabelText('摄入分析')).toHaveClass(styles.figmaDefault);
    expect(screen.getByRole('tablist')).toHaveClass(styles.filters);
    expect(screen.getByRole('button', { name: '自定义范围' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部餐次' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索会话...')).toBeInTheDocument();
    expect(screen.getByText('每周饮食微调')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument();
    expect(document.querySelectorAll('img[src="/assets/avatars/default-male.svg"]')).toHaveLength(2);
    expect(
      document.querySelector('img[src="/assets/figma/workspace/analysis/intake-analysis.svg"]'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('摄入分析')).toHaveAttribute('data-figma-node-id', '640:974');

    await user.click(screen.getByRole('button', { name: '全部餐次' }));
    expect(screen.getByText('当前分析覆盖全部餐次。')).toBeInTheDocument();
  });

  it('keeps Figma-only card treatment scoped to the fixture shell', () => {
    const fixtureRender = renderPage('/analysis?state=v2');
    const fixtureShell = screen.getByLabelText('摄入分析');
    const fixtureChart = screen.getByText('能量摄入与目标对比').closest('section');
    const fixtureInsight = screen.getByText('营养洞察（由 Agent 生成）').closest('section');

    expect(fixtureShell).toHaveClass(styles.figmaAnalysis);
    expect(fixtureChart).toHaveClass(styles.chartCard);
    expect(fixtureInsight).toHaveClass(styles.insightCard);
    expect(screen.getByRole('button', { name: '让 Agent 解读' })).toHaveClass(styles.figmaInsightActionPrimary);
    expect(screen.getByRole('button', { name: '基于分析制定计划' })).toHaveClass(styles.figmaInsightActionSecondary);

    fixtureRender.unmount();
    renderPage('/analysis');
    expect(screen.getByLabelText('摄入分析')).not.toHaveClass(styles.figmaAnalysis);
  });

  it('renders loading, empty, and error analysis states with recovery paths', async () => {
    const user = userEvent.setup();
    const loadingRender = renderPage('/analysis?state=loading');
    expect(screen.getByLabelText('分析摘要加载中')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('分析摘要加载中')).toHaveClass(styles.loadingMetrics);
    expect(screen.getByLabelText('能量摄入分析加载中')).toBeInTheDocument();
    expect(screen.queryByText('1,940 kcal')).not.toBeInTheDocument();
    loadingRender.unmount();

    const emptyRender = renderPage('/analysis?state=empty');
    expect(screen.getByText('数据不足，无法生成分析')).toBeInTheDocument();
    expect(screen.getByText('0 / 7 Days')).toBeInTheDocument();
    expect(screen.getByTestId('empty-analysis-icon')).toHaveAttribute(
      'src',
      '/assets/figma/analysis/intake-analysis-empty-chart-column.svg',
    );
    await user.click(screen.getByRole('button', { name: '去记录饮食' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/analysis?view=records');
    emptyRender.unmount();

    renderPage('/analysis?state=error');
    expect(screen.getByRole('alert', { name: '分析数据加载失败' })).toBeInTheDocument();
    expect(screen.getByTestId('analysis-error-icon')).toHaveAttribute(
      'src',
      '/assets/figma/analysis/intake-analysis-error-alert-triangle.svg',
    );
    expect(screen.getByText('获取营养趋势数据时出错，请稍后重试')).toHaveClass(styles.errorDescription);
    expect(screen.getByRole('button', { name: '重新加载' })).toHaveClass(styles.reloadButton);
    expect(screen.queryByRole('button', { name: '自定义范围' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '全部餐次' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重新加载' }));
    expect(screen.getAllByText('1,940 kcal')).not.toHaveLength(0);
  });
});

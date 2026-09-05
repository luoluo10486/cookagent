import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FIGMA_WORKSPACE_AVATARS } from '../../lib/avatar';
import { WorkspaceLayout } from '../../layouts/WorkspaceLayout/WorkspaceLayout';
import { loadNutritionAnalysis, type NutritionAnalysis } from '../../services/analysisService';
import type { SessionSummary } from '../../types/session';
import styles from './AnalysisPage.module.css';

type RangeKey = '7d' | '30d' | '90d';
type AnalysisState = 'default' | 'loading' | 'empty' | 'error';

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: '7d', label: '7 天' },
  { key: '30d', label: '30 天' },
  { key: '90d', label: '90 天' },
];

const figmaSidebarSessions: SessionSummary[] = [
  { id: 'weekly-adjustment', title: '每周饮食微调', subtitle: '12:45', active: true },
  { id: 'pre-workout-snack', title: '运动前零食建议', subtitle: '12:45', active: false },
  { id: 'allergen-rules', title: '过敏原排除规则', subtitle: '12:45', active: false },
  { id: 'protein-supplement', title: '蛋白质补充方案', subtitle: '12:45', active: false },
  { id: 'bedtime-snack', title: '睡前加餐建议', subtitle: '12:45', active: false },
  { id: 'breakfast-carbs', title: '早餐碳水搭配', subtitle: '12:45', active: false },
  { id: 'dinner-protein', title: '晚餐蛋白质补充', subtitle: '12:45', active: false },
  { id: 'low-carb-diet', title: '低碳水饮食建议', subtitle: '12:45', active: false },
  { id: 'breakfast-smoothie', title: '早餐奶昔配方', subtitle: '12:45', active: false },
];

const rangeData: Record<
  RangeKey,
  { calories: string; protein: string; activeDays: string; bars: number[]; miniBars: number[] }
> = {
  '7d': {
    calories: '1,940 kcal',
    protein: '114 g',
    activeDays: '6 / 7 Days',
    bars: [52, 78, 64, 96, 88, 112, 74],
    miniBars: [12, 18, 8, 22],
  },
  '30d': {
    calories: '1,896 kcal',
    protein: '109 g',
    activeDays: '26 / 30 Days',
    bars: [72, 86, 64, 104, 92, 118, 82],
    miniBars: [10, 16, 12, 22],
  },
  '90d': {
    calories: '1,872 kcal',
    protein: '106 g',
    activeDays: '79 / 90 Days',
    bars: [62, 94, 76, 110, 86, 116, 98],
    miniBars: [14, 20, 10, 22],
  },
};

function MiniBars({ bars }: { bars: number[] }) {
  return (
    <div className={styles.miniBars} aria-hidden="true">
      {bars.map((height, index) => (
        <span key={`${height}-${index}`} style={{ height: `${height}px` }} />
      ))}
    </div>
  );
}

function getAnalysisState(value: string | null): AnalysisState {
  return value === 'loading' || value === 'empty' || value === 'error' ? value : 'default';
}

function LoadingMetrics() {
  const skeletons = [
    { label: '日均能量', value: 'metricSkeletonWide', detail: 'metricDetailWide' },
    { label: '日均蛋白质', value: 'metricSkeletonMedium', detail: 'metricDetailMedium' },
    { label: '活跃记录天数', value: 'metricSkeletonNarrow', detail: 'metricDetailNarrow' },
  ] as const;

  return (
    <section className={`${styles.metrics} ${styles.loadingMetrics}`} aria-label="分析摘要加载中" aria-busy="true">
      {skeletons.map((item) => (
        <article className={styles.metricCard} key={item.label}>
          <span>{item.label}</span>
          <Skeleton className={`${styles.metricSkeleton} ${styles[item.value]}`} />
          <Skeleton className={`${styles.metricDetailSkeleton} ${styles[item.detail]}`} />
        </article>
      ))}
    </section>
  );
}

function LoadingAnalysis() {
  return (
    <>
      <LoadingMetrics />
      <section
        className={`${styles.chartCard} ${styles.loadingChartCard}`}
        aria-label="能量摄入分析加载中"
        aria-busy="true"
      >
        <h2>能量摄入与目标对比</h2>
        <div className={styles.loadingChartArea}>
          <Skeleton className={styles.loadingChartSkeleton} />
        </div>
      </section>
      <section
        className={`${styles.insightCard} ${styles.loadingInsightCard}`}
        aria-label="营养洞察加载中"
        aria-busy="true"
      >
        <h2>营养洞察（由 Agent 生成）</h2>
        <div className={styles.loadingInsightList}>
          {Array.from({ length: 3 }, (_, index) => (
            <div className={styles.loadingInsightRow} key={index}>
              <span className={styles.loadingInsightDot} />
              <Skeleton className={styles.loadingInsightSkeleton} />
            </div>
          ))}
        </div>
        <div className={styles.loadingInsightActions}>
          <Skeleton className={styles.loadingActionPrimary} />
          <Skeleton className={styles.loadingActionSecondary} />
        </div>
      </section>
    </>
  );
}

function EmptyAnalysis({
  onRecord,
  realMode = false,
  range = '7d',
}: {
  onRecord: () => void;
  realMode?: boolean;
  range?: '7d' | '30d';
}) {
  const days = range === '30d' ? 30 : 7;
  return (
    <>
      <section className={styles.metrics} aria-label="分析摘要">
        <article className={styles.metricCard}>
          <span>日均能量</span>
          <strong>-</strong>
        </article>
        <article className={styles.metricCard}>
          <span>日均蛋白质</span>
          <strong>-</strong>
        </article>
        <article className={styles.metricCard}>
          <span>活跃记录天数</span>
          <strong>0 / {days} Days</strong>
        </article>
      </section>
      <section className={styles.emptyChartCard} aria-labelledby="empty-analysis-title">
        <h2 id="empty-analysis-title">能量摄入与目标对比</h2>
        <div className={styles.emptyChartArea}>
          <div className={styles.emptyStateIcon}>
            <img
              src="/assets/figma/analysis/intake-analysis-empty-chart-column.svg"
              alt=""
              data-testid="empty-analysis-icon"
            />
          </div>
          <div className={styles.stateCopy}>
            <h3>数据不足，无法生成分析</h3>
            <p>{realMode ? '当前范围暂无饮食记录' : '至少需要 3 天的饮食记录才能生成趋势分析'}</p>
          </div>
          <Button className={styles.recordButton} onClick={onRecord}>
            去记录饮食
          </Button>
        </div>
      </section>
    </>
  );
}

function ErrorAnalysis({ onReload, detail }: { onReload: () => void; detail?: string }) {
  return (
    <section className={styles.errorCard} role="alert" aria-label="分析数据加载失败">
      <div className={styles.errorStateIcon}>
        <img
          src="/assets/figma/analysis/intake-analysis-error-alert-triangle.svg"
          alt=""
          aria-hidden="true"
          data-testid="analysis-error-icon"
        />
      </div>
      <div className={styles.stateCopy}>
        <h3>分析数据加载失败</h3>
        <p className={styles.errorDescription}>获取营养趋势数据时出错，请稍后重试</p>
        {detail ? <p>{detail}</p> : null}
      </div>
      <Button className={styles.reloadButton} variant="outline" onClick={onReload}>
        重新加载
      </Button>
    </section>
  );
}

export function AnalysisPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const analysisState = getAnalysisState(searchParams.get('state'));
  const isRealMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const isFigmaFixture = !isRealMode && (searchParams.get('state') === 'v2' || analysisState !== 'default');
  const [range, setRange] = useState<RangeKey>('7d');
  const [notice, setNotice] = useState('');
  const [realData, setRealData] = useState<NutritionAnalysis>();
  const [realLoading, setRealLoading] = useState(isRealMode);
  const [realError, setRealError] = useState<string>();
  const [realReloadNonce, setRealReloadNonce] = useState(0);
  const data = rangeData[range];
  const realRange = range === '90d' ? '30d' : range;

  useEffect(() => {
    if (!isRealMode) return;
    let active = true;
    // The effect owns the request lifecycle, so loading state starts with each external data request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRealLoading(true);
    setRealError(undefined);
    loadNutritionAnalysis(realRange)
      .then((value) => {
        if (active) setRealData(value);
      })
      .catch((cause) => {
        if (active) {
          setRealData(undefined);
          setRealError(cause instanceof Error ? cause.message : '营养分析加载失败');
        }
      })
      .finally(() => {
        if (active) setRealLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isRealMode, realRange, realReloadNonce]);

  const realDays = realRange === '7d' ? 7 : 30;
  const realCalories = Number(realData?.calories_kcal ?? 0);
  const realProtein = Number(realData?.protein_g ?? 0);
  const realCoverage = Number(realData?.coverage ?? 0);
  const realTargetCalories = (realData?.calorie_target ?? 0) * realDays;
  const realBarHeight = useMemo(() => {
    if (realTargetCalories <= 0) return 8;
    return Math.max(8, Math.min(170, Math.round((realCalories / realTargetCalories) * 170)));
  }, [realCalories, realTargetCalories]);
  const realHasNoData = Boolean(realData && realData.total_items === 0);
  const realState = realLoading ? 'loading' : realError ? 'error' : realHasNoData ? 'empty' : 'default';
  const visibleState = isRealMode ? realState : analysisState;
  const showAdvancedFilters = visibleState === 'default';

  const exportCsv = () => {
    setNotice('分析报告已排队，完成后可下载 CSV。');
  };

  const reloadAnalysis = () => {
    if (isRealMode) {
      setRealReloadNonce((current) => current + 1);
      return;
    }
    setSearchParams({});
    setNotice('正在重新加载摄入分析。');
  };

  return (
    <WorkspaceLayout
      activeModule="analysis"
      fixtureVariant={isFigmaFixture ? 'analysis' : undefined}
      displayNameOverride={isFigmaFixture ? 'Anddy' : undefined}
      profileIdOverride={isFigmaFixture ? '1234567' : undefined}
      sidebarAvatarSrc={isFigmaFixture ? FIGMA_WORKSPACE_AVATARS.sidebar : undefined}
      topAvatarSrc={isFigmaFixture ? FIGMA_WORKSPACE_AVATARS.topbar : undefined}
      showKnowledgeTopNav={!isFigmaFixture}
      sidebarFixture={isFigmaFixture ? { sessions: figmaSidebarSessions } : undefined}
    >
      <div className={styles.page}>
        <section
          className={`${styles.analysisBody} ${isFigmaFixture ? styles.figmaAnalysis : ''} ${isFigmaFixture && visibleState === 'default' ? styles.figmaDefault : ''}`}
          aria-label="摄入分析"
          data-figma-node-id="640:974"
        >
          <header
            className={`${styles.filterRow} ${isFigmaFixture ? styles.figmaFilterRow : ''} ${visibleState === 'loading' ? styles.stateFilterRow : ''}`}
          >
            <div className={styles.filters} role="tablist" aria-label="分析范围">
              {(isRealMode ? ranges.filter((item) => item.key !== '90d') : ranges).map((item) => (
                <Button
                  className={range === item.key ? styles.rangeActive : ''}
                  variant="ghost"
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={range === item.key}
                  onClick={() => setRange(item.key)}
                  disabled={visibleState === 'loading' || visibleState === 'error'}
                >
                  {item.label}
                </Button>
              ))}
              {showAdvancedFilters ? (
                <>
                  <Button
                    className={styles.filterPill}
                    variant="ghost"
                    type="button"
                    onClick={() => setNotice('自定义范围将在真实记录接入后启用。')}
                    disabled={isRealMode}
                  >
                    自定义范围
                  </Button>
                  <Button
                    className={styles.filterPill}
                    variant="ghost"
                    type="button"
                    onClick={() => setNotice('当前分析覆盖全部餐次。')}
                    disabled={isRealMode}
                  >
                    全部餐次
                  </Button>
                </>
              ) : null}
            </div>
            <Button
              className={styles.exportButton}
              variant="ghost"
              onClick={exportCsv}
              disabled={isRealMode || visibleState !== 'default'}
            >
              导出 CSV
            </Button>
          </header>

          {visibleState === 'loading' ? <LoadingAnalysis /> : null}
          {visibleState === 'empty' ? (
            <EmptyAnalysis
              onRecord={() => navigate('/analysis?view=records')}
              range={realRange}
              realMode={isRealMode}
            />
          ) : null}
          {visibleState === 'error' ? (
            <ErrorAnalysis detail={isRealMode ? realError : undefined} onReload={reloadAnalysis} />
          ) : null}
          {visibleState === 'default' && isRealMode && realData ? (
            <section className={styles.metrics} aria-label="分析摘要" data-figma-node-id="640:674">
              <article className={styles.metricCard}>
                <span>区间总能量</span>
                <strong>{realCalories.toLocaleString('zh-CN')} kcal</strong>
              </article>
              <article className={styles.metricCard}>
                <span>区间总蛋白质</span>
                <strong>{realProtein.toLocaleString('zh-CN')} g</strong>
              </article>
              <article className={styles.metricCard}>
                <span>记录匹配率</span>
                <strong>{Math.round(realCoverage * 100)}%</strong>
              </article>
            </section>
          ) : null}
          {visibleState === 'default' && !isRealMode ? (
            <section className={styles.metrics} aria-label="分析摘要" data-figma-node-id="640:674">
              <article className={styles.metricCard}>
                <span>日均能量</span>
                <div className={styles.metricValueRow}>
                  <strong>{data.calories}</strong>
                  <MiniBars bars={data.miniBars} />
                </div>
              </article>
              <article className={styles.metricCard}>
                <span>日均蛋白质</span>
                <strong>{data.protein}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>活跃记录天数</span>
                <strong>{data.activeDays}</strong>
              </article>
            </section>
          ) : null}

          {visibleState === 'default' && isRealMode && realData ? (
            <section className={styles.chartCard} aria-labelledby="calorie-chart-title" data-figma-node-id="640:711">
              <h2 id="calorie-chart-title">区间能量摄入与目标对比</h2>
              <div className={styles.chartArea}>
                <div className={styles.legend} aria-label="图例">
                  <span>
                    <i className={styles.actualDot} />
                    实际总摄入
                  </span>
                  {realTargetCalories > 0 ? (
                    <span>
                      <i className={styles.targetDot} />
                      目标总量
                    </span>
                  ) : null}
                </div>
                <div className={styles.barChart} role="img" aria-label="区间能量摄入柱状图">
                  <span className={styles.bar} style={{ height: realBarHeight }} />
                </div>
                <p className={styles.chartSummary}>
                  {realTargetCalories > 0
                    ? `${realCalories.toLocaleString('zh-CN')} / ${realTargetCalories.toLocaleString('zh-CN')} kcal`
                    : `${realCalories.toLocaleString('zh-CN')} kcal · 未配置能量目标`}
                </p>
              </div>
            </section>
          ) : null}
          {visibleState === 'default' && !isRealMode ? (
            <section className={styles.chartCard} aria-labelledby="calorie-chart-title" data-figma-node-id="640:711">
              <h2 id="calorie-chart-title">能量摄入与目标对比</h2>
              <div className={styles.chartArea}>
                <div className={styles.legend} aria-label="图例">
                  <span>
                    <i className={styles.actualDot} />
                    实际摄入
                  </span>
                  <span>
                    <i className={styles.targetDot} />
                    目标对比
                  </span>
                </div>
                <div
                  className={styles.barChart}
                  role="img"
                  aria-label={`${ranges.find((item) => item.key === range)?.label}能量摄入柱状图`}
                >
                  {data.bars.map((height, index) => (
                    <span className={styles.bar} key={`${height}-${index}`} style={{ height }} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {visibleState === 'default' && isRealMode && realData ? (
            <section className={styles.insightCard} aria-labelledby="insight-title" data-figma-node-id="640:712">
              <h2 id="insight-title">营养洞察（基于已匹配记录）</h2>
              <div className={styles.insights}>
                <p>
                  <i className={styles.insightPurple} />
                  已匹配 {realData.matched_items} / {realData.total_items} 条饮食记录，覆盖率为{' '}
                  {Math.round(realCoverage * 100)}%。
                </p>
                <p>
                  <i className={styles.insightBlue} />
                  {realData.protein_target == null
                    ? '当前未配置蛋白质目标，暂不进行目标达成判断。'
                    : `区间蛋白质 ${realProtein.toLocaleString('zh-CN')} g，目标为 ${realData.protein_target * realDays} g。`}
                </p>
                <p>
                  <i className={styles.insightOrange} />
                  {realData.incomplete
                    ? `有 ${realData.unmatched_names.length} 项记录未匹配营养目录。`
                    : '所有记录均已匹配营养目录。'}
                </p>
              </div>
            </section>
          ) : null}
          {visibleState === 'default' && !isRealMode ? (
            <section className={styles.insightCard} aria-labelledby="insight-title" data-figma-node-id="640:712">
              <h2 id="insight-title">营养洞察（由 Agent 生成）</h2>
              <div className={styles.insights}>
                <p>
                  <i className={styles.insightPurple} />
                  Protein distribution is heavily skewed toward dinner. Consider adding 15g to breakfast.
                </p>
                <p>
                  <i className={styles.insightBlue} />
                  Energy intake is consistently in your targeted deficit zone of 1,800 - 2,000 kcal.
                </p>
                <p>
                  <i className={styles.insightOrange} />
                  Sodium logging was omitted for 2 days. The Agent assumed average database values.
                </p>
              </div>
              <div className={styles.insightActions}>
                <Button
                  className={`${styles.interpretButton} ${styles.figmaInsightActionPrimary}`}
                  onClick={() => navigate('/chat/protein-review?prompt=请解读这份摄入分析')}
                >
                  让 Agent 解读
                </Button>
                <Button
                  className={styles.figmaInsightActionSecondary}
                  variant="outline"
                  onClick={() => navigate('/planning')}
                >
                  基于分析制定计划
                </Button>
              </div>
            </section>
          ) : null}
        </section>

        {visibleState === 'default' && isRealMode && realData ? (
          <section className={styles.qualityPanel} aria-label="分析维度与数据质量" data-figma-node-id="975:3">
            <h2>分析维度与数据质量</h2>
            <p>
              统计范围：{realData.range === '7d' ? '最近 7 天' : '最近 30 天'} · 已匹配 {realData.matched_items} /{' '}
              {realData.total_items} 条记录
            </p>
            <p>
              营养合计：蛋白质 {realProtein.toLocaleString('zh-CN')} g · 脂肪{' '}
              {Number(realData.fat_g).toLocaleString('zh-CN')} g · 碳水{' '}
              {Number(realData.carbs_g).toLocaleString('zh-CN')} g
            </p>
            <p className={styles.qualityNote}>{realData.disclaimer}</p>
            {realData.unmatched_names.length ? (
              <p className={styles.qualityNote}>未匹配项：{realData.unmatched_names.join('、')}</p>
            ) : null}
          </section>
        ) : null}
        {visibleState === 'default' && !isRealMode ? (
          <section className={styles.qualityPanel} aria-label="分析维度与数据质量">
            <h2>分析维度与数据质量</h2>
            <p>趋势指标：能量 · 蛋白质 · 碳水 · 脂肪 · 对比：上一周期 / 不对比 · 餐次：全部餐次 / 指定餐次</p>
            <p>统计口径：7 天内有效记录 6 天 · 缺失 1 天 · 估算记录 2 / 7（28%） · 目标区间 1,800–2,000 kcal</p>
            <p className={styles.qualityNote}>
              异常点可打开当天饮食记录；洞察按事实 / 风险 / 建议分层展示，缺失数据不会伪造图表值。
            </p>
            <p className={styles.exportStatus}>
              导出报告：已排队 queued · 生成中 running · 可下载 completed · 失败可重新创建 failed
            </p>
            {notice ? (
              <p className={styles.notice} role="status">
                {notice}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </WorkspaceLayout>
  );
}

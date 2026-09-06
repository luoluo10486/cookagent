import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input as ShadcnInput } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ROUTES } from '../../../constants/routes';
import { loadAdminDashboard, loadAdminQuery, type AdminQueryRun } from '../../../services/adminService';
import { adminOverviewMetrics, adminOverviewRows } from './AdminShared';
import styles from '../AdminPage.module.css';

type OverviewMetric = {
  label: string;
  value: string;
  hint?: string;
};

type OverviewRow = {
  key: string;
  runId: string;
  user: string;
  status: string;
  stage: string;
  duration: string;
  cost: string;
  toolCount: string;
  result: string;
  errorCode: string;
};

const overviewMetrics: OverviewMetric[] = adminOverviewMetrics;
const overviewRows: OverviewRow[] = adminOverviewRows;
// Figma 概览页展示的是系统总量，mock 行只负责还原首屏可见记录。
const overviewFixtureTotal = 12480;

function queryRowsToOverviewRows(rows: AdminQueryRun[]): OverviewRow[] {
  return rows.map((row, index) => ({
    key: `run-${row.agent_run_id ?? index}`,
    runId: row.agent_run_id == null ? '-' : `run_${row.agent_run_id}`,
    user: row.actor_ref || '-',
    status: row.status || '-',
    stage: row.intent || '-',
    duration: row.duration_ms == null ? '-' : `${(Number(row.duration_ms) / 1000).toFixed(1)}s`,
    cost: '-',
    toolCount: '-',
    result: row.status || '-',
    errorCode: '-',
  }));
}

function OverviewPill({ value, tone }: { value: string; tone: 'green' | 'coral' | 'amber' | 'neutral' | 'teal' }) {
  return (
    <span className={`${styles.overviewPill} ${styles[`overviewPill${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
      {value}
    </span>
  );
}

function statusTone(value: string): 'green' | 'neutral' {
  return value === 'completed' ? 'green' : 'neutral';
}

function stageTone(value: string): 'coral' | 'amber' | 'teal' {
  if (value === 'COMPOSE') return 'coral';
  if (value === 'PLAN') return 'amber';
  return 'teal';
}

function OverviewFilterSelect({
  label,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={styles.overviewFilter} aria-label={ariaLabel}>
        <span className={styles.overviewFilterLabel}>{label}:</span>
        <SelectValue />
        <span
          aria-hidden="true"
          className={styles.overviewFilterArrow}
          data-figma-asset="admin-overview-dropdown-arrow"
        />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function copyRunId(runId: string) {
  if (navigator.clipboard) void navigator.clipboard.writeText(runId);
}

function formatResultCount(value: number) {
  return value.toLocaleString('en-US');
}

export function OverviewSection({ refreshNonce = 0 }: { onAction?: unknown; refreshNonce?: number }) {
  const isRealMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const [metrics, setMetrics] = useState<OverviewMetric[]>(isRealMode ? [] : overviewMetrics);
  const [rows, setRows] = useState<OverviewRow[]>(isRealMode ? [] : overviewRows);
  const [resultFilter, setResultFilter] = useState('all');
  const [degradedFilter, setDegradedFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(isRealMode ? 0 : overviewFixtureTotal);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isRealMode) return;
    let active = true;
    // The effect owns the request lifecycle, so clearing the previous error starts a new subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadError('');
    Promise.all([
      loadAdminDashboard(),
      loadAdminQuery<AdminQueryRun>('runs', {
        page,
        size: 6,
        query: query.trim() || undefined,
        status: resultFilter === 'all' ? undefined : resultFilter,
      }),
    ])
      .then(([dashboard, runPage]) => {
        if (!active) return;
        setMetrics(dashboard.overview_metrics.slice(0, 3));
        setRows(queryRowsToOverviewRows(runPage.items));
        setTotal(runPage.total);
      })
      .catch((error) => {
        if (!active) return;
        setMetrics([]);
        setRows([]);
        setTotal(0);
        setLoadError(error instanceof Error ? error.message : '管理概览数据加载失败');
      });
    return () => {
      active = false;
    };
  }, [isRealMode, page, query, refreshNonce, resultFilter]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesResult = resultFilter === 'all' || row.result === resultFilter;
      const matchesDegraded =
        degradedFilter === 'all' || (degradedFilter === 'yes' ? row.errorCode !== '-' : row.errorCode === '-');
      const matchesQuery = !normalizedQuery || `${row.runId} ${row.user}`.toLowerCase().includes(normalizedQuery);
      return matchesResult && matchesDegraded && matchesQuery;
    });
  }, [degradedFilter, query, resultFilter, rows]);

  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <section className={styles.overviewFilters} aria-label="管理概览筛选">
        <div className={styles.overviewFilterGroup}>
          <OverviewFilterSelect
            label="时间"
            value="all"
            options={[
              { value: 'all', label: '全部' },
              { value: '24h', label: '近 24h' },
              { value: '7d', label: '近 7 天' },
              { value: '30d', label: '近 30 天' },
            ]}
            onChange={() => undefined}
            ariaLabel="时间范围"
          />
          <OverviewFilterSelect
            label="结果"
            value={resultFilter}
            options={[
              { value: 'all', label: '全部' },
              { value: 'completed', label: 'completed' },
              { value: 'running', label: 'running' },
              { value: 'failed', label: 'failed' },
            ]}
            onChange={(value) => {
              setResultFilter(value);
              setPage(1);
            }}
            ariaLabel="结果筛选"
          />
          <OverviewFilterSelect
            label="是否降级"
            value={degradedFilter}
            options={[
              { value: 'all', label: '全部' },
              { value: 'yes', label: '是' },
              { value: 'no', label: '否' },
            ]}
            onChange={(value) => {
              setDegradedFilter(value);
              setPage(1);
            }}
            ariaLabel="降级筛选"
          />
        </div>
        <label className={styles.overviewSearch}>
          <span aria-hidden="true" className={styles.overviewSearchIcon} data-figma-asset="admin-overview-search" />
          <ShadcnInput
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="搜索运行 / 用户..."
            aria-label="搜索运行或用户"
          />
        </label>
      </section>

      <section className={styles.overviewStats} aria-label="管理概览指标">
        {metrics.slice(0, 3).map((metric, index) => (
          <Card className={`${styles.overviewStatCard} ${styles[`overviewStat${index}`]}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </Card>
        ))}
      </section>

      <Card className={styles.overviewTableCard}>
        <div className={styles.overviewTableScroll}>
          <Table className={styles.overviewTable}>
            <TableHeader>
              <TableRow>
                {['运行 ID', '用户', '状态', '阶段', '耗时', '成本', '工具数', '结果', '错误码', '操作'].map(
                  (title) => (
                    <TableHead key={title}>{title}</TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <span className={styles.overviewRunIdCell}>
                      <strong>{row.runId}</strong>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={styles.copyButton}
                        type="button"
                        aria-label={`复制 ${row.runId}`}
                        onClick={() => copyRunId(row.runId)}
                        title={`复制 ${row.runId}`}
                      >
                        <img
                          alt=""
                          className={styles.copyIcon}
                          data-figma-asset="admin-overview-copy"
                          src="/assets/figma/admin/overview/copy.svg"
                        />
                      </Button>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={styles.overviewMonoMuted}>{row.user}</span>
                  </TableCell>
                  <TableCell>
                    <OverviewPill value={row.status} tone={statusTone(row.status)} />
                  </TableCell>
                  <TableCell>
                    <OverviewPill value={row.stage} tone={stageTone(row.stage)} />
                  </TableCell>
                  <TableCell>
                    <span className={styles.overviewMono}>{row.duration}</span>
                  </TableCell>
                  <TableCell>
                    <span className={styles.overviewCellMuted}>{row.cost}</span>
                  </TableCell>
                  <TableCell>
                    <span className={styles.overviewMono}>{row.toolCount}</span>
                  </TableCell>
                  <TableCell>
                    <span className={styles.overviewCellMuted}>{row.result}</span>
                  </TableCell>
                  <TableCell>
                    <span className={styles.overviewErrorCode}>{row.errorCode}</span>
                  </TableCell>
                  <TableCell>
                    <Link
                      className={styles.overviewActionButton}
                      to={`${ROUTES.ADMIN}/runs?run=${encodeURIComponent(row.runId)}`}
                    >
                      查看详情
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!filteredRows.length ? (
          <div className={styles.runEmptyState} role="status">
            <strong>{loadError ? '真实接口加载失败' : '暂无概览记录'}</strong>
            <span>{loadError || '当前筛选条件没有可展示的运行记录。'}</span>
          </div>
        ) : null}
      </Card>

      <section className={styles.overviewPagination} aria-label="运行结果分页">
        <span>
          {total
            ? `显示第 ${(page - 1) * pageSize + 1} 到 ${Math.min(page * pageSize, total)} 条，共 ${formatResultCount(total)} 条结果`
            : '暂无结果'}
        </span>
        <div className={styles.overviewPageButtons}>
          <Button
            className={styles.overviewPageButton}
            disabled={page === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            上一页
          </Button>
          {(isRealMode ? [page] : [1, 2, 3, 4]).map((value) => (
            <Button
              className={`${styles.overviewPageButton} ${page === value ? styles.overviewPageActive : ''}`}
              key={value}
              disabled={isRealMode}
              onClick={() => setPage(value)}
            >
              {value}
            </Button>
          ))}
          <Button
            className={styles.overviewPageButton}
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            下一页
          </Button>
        </div>
      </section>

      {isRealMode ? (
        <Card className={styles.overviewAnalytics}>
          <div className={styles.runEmptyState} role="status">
            <strong>趋势与健康指标暂无真实数据</strong>
            <span>当前后端仅提供运行分页与基础概览指标，未返回分位延迟、失败分布或健康聚合。</span>
          </div>
        </Card>
      ) : (
        <Card className={styles.overviewAnalytics} data-figma-border="inset" data-figma-role="admin-overview-analytics">
          <article
            data-figma-border="inset"
            data-figma-node="1005:3"
            data-figma-role="admin-overview-analytics-card"
            data-figma-width="344"
          >
            <h2>运行趋势</h2>
            <p>近 24h 1,284 次 · 成功率 91.4%</p>
            <p>P50 4.2s · P95 18.6s · P99 42.1s</p>
            <p>模型 Token 16.1M · 平均耗时 8.4s</p>
          </article>
          <article
            data-figma-border="inset"
            data-figma-node="1005:7"
            data-figma-role="admin-overview-analytics-card"
            data-figma-width="344"
          >
            <h2>失败原因分布</h2>
            <p>模型限制 42% · 工具超时 31%</p>
            <p>策略拒绝 18% · 其他 9%</p>
          </article>
          <article
            data-figma-border="inset"
            data-figma-node="1005:11"
            data-figma-role="admin-overview-analytics-card"
            data-figma-width="344"
          >
            <h2>健康与审计</h2>
            <p>工具 24 个 · 3 个高风险 · 知识库索引 92%</p>
            <p>最近管理操作 4 条待复核 · 取消率 2.1%</p>
          </article>
        </Card>
      )}
    </>
  );
}

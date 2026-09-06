import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Lock, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type TableColumnProps } from '@/components/ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input as ShadcnInput } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import styles from '../AdminPage.module.css';
import { AdminFilters, OperationAuditCard } from './AdminComponents';
import {
  type ToolRegistryRow,
  type ToolRow,
  adminToolRegistryRows,
  adminToolRows,
  canManage,
  riskTag,
  statusTag,
} from './AdminShared';
import type { AdminActionPayload, AdminOperationState } from './types';
import {
  loadAdminDashboard,
  loadAdminQuery,
  loadAdminToolRegistry,
  type AdminQueryToolCall,
  type AdminToolCallRow,
  updateAdminToolStatus,
} from '../../../services/adminService';

const registryMetrics = [
  { label: '已注册工具', value: '24 个', tone: 'neutral' },
  { label: '高风险运行限制', value: '3 个', tone: 'coral' },
  { label: '今日API总调用', value: '1,420,951 次', tone: 'green' },
] as const;

const registryStatusLabels: Record<string, string> = { active: '已启用', disabled: '已停用' };
const registryRiskLabels: Record<string, string> = { low: '低风险', medium: '中风险', high: '高风险' };

function RegistryPill({ value, tone }: { value: string; tone: 'green' | 'coral' | 'amber' | 'teal' | 'neutral' }) {
  return (
    <span className={`${styles.registryPill} ${styles[`registryPill${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
      {value}
    </span>
  );
}

function registryStatusPill(value: string) {
  return <RegistryPill value={registryStatusLabels[value] ?? value} tone={value === 'active' ? 'green' : 'neutral'} />;
}

function registryRiskPill(value: string) {
  const tone = value === 'high' ? 'coral' : value === 'medium' ? 'amber' : 'teal';
  return <RegistryPill value={registryRiskLabels[value] ?? value} tone={tone} />;
}

function copyToolName(name: string) {
  if (navigator.clipboard) void navigator.clipboard.writeText(name);
}

function RegistryFilterSelect({
  label,
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
  className: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`${styles.registryFilter} ${className}`} aria-label={ariaLabel}>
        <span className={styles.registryFilterLabel}>{label}:</span>
        <SelectValue />
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

function ToolRegistrySection({
  onAction,
  operationStatus = 'idle',
  refreshNonce = 0,
  operationFixture = false,
}: {
  onAction: (payload: AdminActionPayload) => void;
  operationStatus?: AdminOperationState;
  refreshNonce?: number;
  operationFixture?: boolean;
}) {
  const isRealMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const isFigmaOperationFixture = operationFixture && !isRealMode;
  const [tools, setTools] = useState<ToolRegistryRow[]>(
    isRealMode
      ? []
      : isFigmaOperationFixture
        ? adminToolRegistryRows
            .slice(0, 4)
            .map((tool, index) =>
              operationStatus === 'success' && index === 0 ? { ...tool, status: 'disabled' } : tool,
            )
        : adminToolRegistryRows,
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTool, setSelectedTool] = useState<ToolRegistryRow>();
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(isRealMode);
  const [retryNonce, setRetryNonce] = useState(0);
  const showOperationActions = operationStatus !== 'idle';
  const operationActionDisabled = operationStatus === 'submitting' || operationStatus === 'no-permission';

  const createToolAction = (record: ToolRegistryRow): AdminActionPayload => {
    const nextStatus = record.status === 'active' ? 'disabled' : 'active';
    let nextRevision = record.revision ?? 1;
    return {
      action: nextStatus === 'disabled' ? '停用工具' : '启用工具',
      targetLabel: record.name,
      targetType: 'tool',
      targetId: record.name,
      execute: async () => {
        const result = await updateAdminToolStatus(record.name, nextStatus, record.revision ?? 1);
        nextRevision = result.revision;
      },
      onApply: () => {
        setTools((current) =>
          current.map((tool) =>
            tool.key === record.key ? { ...tool, status: nextStatus, revision: nextRevision } : tool,
          ),
        );
      },
    };
  };

  useEffect(() => {
    if (!isRealMode) return;
    let active = true;
    // 每次刷新都重新建立请求生命周期，避免旧请求覆盖当前页面状态。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadError('');
    loadAdminToolRegistry()
      .then((items) => {
        if (active) setTools(items);
      })
      .catch((error) => {
        if (!active) return;
        setTools([]);
        setSelectedTool(undefined);
        setLoadError(error instanceof Error ? error.message : '工具注册表加载失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isRealMode, refreshNonce, retryNonce]);

  const filteredTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesStatus = statusFilter === 'all' || tool.status === statusFilter;
      const matchesRisk = riskFilter === 'all' || tool.risk === riskFilter;
      const matchesScope = scopeFilter === 'all' || tool.scope === scopeFilter;
      const matchesQuery =
        !normalizedQuery ||
        `${tool.name} ${tool.version} ${tool.scope} ${tool.retryPolicy}`.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesRisk && matchesScope && matchesQuery;
    });
  }, [query, riskFilter, scopeFilter, statusFilter, tools]);

  const registryColumns: TableColumnProps<ToolRegistryRow>[] = [
    {
      title: '工具名称',
      dataIndex: 'name',
      render: (value) => {
        const name = String(value);
        return (
          <span className={styles.registryNameCell}>
            <strong>{name}</strong>
            <Button
              variant="ghost"
              size="icon"
              className={styles.registryCopyButton}
              type="button"
              aria-label={`复制 ${name}`}
              onClick={() => copyToolName(name)}
              title={`复制 ${name}`}
            >
              <Copy aria-hidden="true" />
            </Button>
          </span>
        );
      },
    },
    {
      title: '版本',
      dataIndex: 'version',
      render: (value) => <span className={styles.registryMonoMuted}>{String(value)}</span>,
    },
    { title: '状态', dataIndex: 'status', render: (value) => registryStatusPill(String(value)) },
    { title: '风险等级', dataIndex: 'risk', render: (value) => registryRiskPill(String(value)) },
    {
      title: '超时(ms)',
      dataIndex: 'timeoutMs',
      render: (value) => <span className={styles.registryMono}>{String(value)}</span>,
    },
    {
      title: '重试策略',
      dataIndex: 'retryPolicy',
      render: (value) => <span className={styles.registryCellMuted}>{String(value)}</span>,
    },
    {
      title: '权限范围',
      dataIndex: 'scope',
      render: (value) => <span className={styles.registryCellMuted}>{String(value)}</span>,
    },
    {
      title: '最近调用',
      dataIndex: 'lastCalledAt',
      render: (value) => <span className={styles.registryCellMuted}>{String(value)}</span>,
    },
    {
      title: '失败率',
      dataIndex: 'failedRate',
      render: (value, record) => (
        <span className={`${styles.registryMono} ${record.risk === 'high' ? styles.registryFailure : ''}`}>
          {String(value)}
        </span>
      ),
    },
    {
      title: '操作',
      render: (_, record) => (
        <>
          {showOperationActions ? (
            <Button
              variant="outline"
              className={`${styles.registryActionButton} ${
                isFigmaOperationFixture && operationStatus !== 'no-permission' && record.status === 'active'
                  ? styles.registryActionAttention
                  : ''
              } ${operationActionDisabled ? styles.registryActionDisabled : ''}`}
              size="sm"
              aria-label={record.status === 'active' ? '停用工具' : '启用工具'}
              disabled={operationActionDisabled}
              onClick={() => onAction(createToolAction(record))}
            >
              {operationStatus === 'no-permission' ? <Lock aria-hidden="true" /> : null}
              {operationStatus === 'no-permission' ? null : record.status === 'active' ? '停用工具' : '启用工具'}
            </Button>
          ) : (
            <Button
              variant="outline"
              className={styles.registryActionButton}
              size="sm"
              onClick={() => setSelectedTool(record)}
            >
              配置详情
            </Button>
          )}
        </>
      ),
    },
  ];

  const hasFilter = Boolean(query.trim()) || statusFilter !== 'all' || riskFilter !== 'all' || scopeFilter !== 'all';
  const totalResults = isRealMode || hasFilter ? filteredTools.length : 24;
  const pageSize = isFigmaOperationFixture ? 4 : 6;
  const pageCount = isFigmaOperationFixture ? 2 : Math.max(1, Math.ceil(totalResults / pageSize));
  const visibleResults = filteredTools.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <section className={styles.registryFilters} aria-label="工具注册表筛选">
        <div className={styles.registryFilterGroup}>
          <RegistryFilterSelect
            label="状态"
            value={statusFilter}
            options={[
              { value: 'all', label: '全部' },
              { value: 'active', label: '已启用' },
              { value: 'disabled', label: '已停用' },
            ]}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            ariaLabel="工具状态筛选"
            className={styles.registryFilterStatus}
          />
          <RegistryFilterSelect
            label="风险等级"
            value={riskFilter}
            options={[
              { value: 'all', label: '全部' },
              { value: 'low', label: '低风险' },
              { value: 'medium', label: '中风险' },
              { value: 'high', label: '高风险' },
            ]}
            onChange={(value) => {
              setRiskFilter(value);
              setPage(1);
            }}
            ariaLabel="风险等级筛选"
            className={styles.registryFilterRisk}
          />
          {!isFigmaOperationFixture ? (
            <RegistryFilterSelect
              label="权限范围"
              value={scopeFilter}
              options={[
                { value: 'all', label: '全部' },
                { value: 'read-only', label: 'read-only' },
                { value: 'read-write', label: 'read-write' },
                { value: 'write-only', label: 'write-only' },
                { value: 'admin', label: 'admin' },
              ]}
              onChange={(value) => {
                setScopeFilter(value);
                setPage(1);
              }}
              ariaLabel="权限范围筛选"
              className={styles.registryFilterScope}
            />
          ) : null}
        </div>
        <label className={styles.registrySearch}>
          <Search aria-hidden="true" />
          <ShadcnInput
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="搜索工具、指令或版本..."
            aria-label="搜索工具、指令或版本"
          />
        </label>
      </section>

      {loadError ? (
        <div className={styles.auditError} role="alert">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => setRetryNonce((value) => value + 1)}>
            <RefreshCw aria-hidden="true" />
            重试
          </Button>
        </div>
      ) : null}

      <section
        className={`${styles.registryStats} ${isFigmaOperationFixture ? styles.registryOperationStats : ''}`}
        aria-label="工具注册表指标"
      >
        {(isRealMode
          ? [
              { label: '已注册工具', value: `${tools.length} 个` },
              { label: '高风险运行限制', value: `${tools.filter((tool) => tool.risk === 'high').length} 个` },
              { label: '今日 API 调用', value: '服务端未提供' },
            ]
          : registryMetrics
        ).map((metric, index) => (
          <Card
            className={`${styles.registryStatCard} ${styles[`registryStat${index}`]} ${isFigmaOperationFixture ? styles.registryOperationStatCard : ''}`}
            key={metric.label}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </Card>
        ))}
      </section>

      <Card
        className={`${styles.registryTableCard} ${isFigmaOperationFixture ? styles.registryOperationTableCard : ''}`}
        data-figma-node={isFigmaOperationFixture ? '692:4539' : undefined}
        data-figma-role={isFigmaOperationFixture ? 'admin-operation-state-registry-table' : undefined}
      >
        <DataTable
          className={styles.registryTableScroll}
          tableClassName={`${styles.registryTable} ${isFigmaOperationFixture ? styles.registryOperationTable : ''}`}
          columns={registryColumns}
          data={visibleResults}
          emptyLabel={loading ? '正在加载工具注册表...' : loadError ? '工具注册表暂不可用' : '暂无匹配的工具'}
        />
      </Card>

      <section
        className={`${styles.registryPagination} ${isFigmaOperationFixture ? styles.registryOperationPagination : ''}`}
        aria-label="工具注册表分页"
      >
        <span>
          显示第 {totalResults === 0 ? 0 : 1} 到 {Math.min(pageSize, totalResults)} 条，共 {totalResults} 条结果
        </span>
        <div className={styles.registryPageButtons}>
          <Button
            variant="outline"
            className={styles.registryPageButton}
            disabled={page === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            上一页
          </Button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((value) => (
            <Button
              variant="outline"
              className={`${styles.registryPageButton} ${page === value ? styles.registryPageActive : ''}`}
              key={value}
              onClick={() => setPage(value)}
            >
              {value}
            </Button>
          ))}
          <Button
            variant="outline"
            className={styles.registryPageButton}
            disabled={page === pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            下一页
          </Button>
        </div>
      </section>

      <Dialog open={Boolean(selectedTool)} onOpenChange={(open) => !open && setSelectedTool(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTool?.name} 配置详情</DialogTitle>
            <DialogDescription>注册表展示工具契约；启停操作需要管理员确认并写入操作审计。</DialogDescription>
          </DialogHeader>
          {selectedTool ? (
            <div className={styles.registryDetailGrid}>
              <span>显示名称</span>
              <strong>{selectedTool.displayName ?? selectedTool.name}</strong>
              <span>描述</span>
              <strong>{selectedTool.description ?? '-'}</strong>
              <span>版本</span>
              <strong>{selectedTool.version}</strong>
              <span>状态</span>
              <strong>{registryStatusLabels[selectedTool.status] ?? selectedTool.status}</strong>
              <span>风险等级</span>
              <strong>{registryRiskLabels[selectedTool.risk] ?? selectedTool.risk}</strong>
              <span>权限范围</span>
              <strong>{selectedTool.scope}</strong>
              <span>超时</span>
              <strong>{selectedTool.timeoutMs}</strong>
              <span>重试策略</span>
              <strong>{selectedTool.retryPolicy}</strong>
              <span>幂等</span>
              <strong>{selectedTool.idempotent == null ? '-' : selectedTool.idempotent ? '是' : '否'}</strong>
              <span>入参 schema</span>
              <strong>{selectedTool.schema}</strong>
            </div>
          ) : null}
          <DialogFooter>
            {selectedTool ? (
              <Button
                variant="outline"
                className={styles.registryActionButton}
                disabled={operationStatus === 'submitting'}
                onClick={() => {
                  const target = selectedTool;
                  setSelectedTool(undefined);
                  onAction(createToolAction(target));
                }}
              >
                {selectedTool.status === 'active' ? '停用工具' : '启用工具'}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setSelectedTool(undefined)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ToolsSection({
  onAction,
  operationStatus = 'idle',
  refreshNonce = 0,
}: {
  onAction: (payload: AdminActionPayload) => void;
  operationStatus?: AdminOperationState;
  refreshNonce?: number;
}) {
  const [searchParams] = useSearchParams();
  const fixtureState = searchParams.get('state');
  const operationFixture = fixtureState?.startsWith('op-') ?? false;
  return searchParams.get('tab') === 'registry' || fixtureState === 'tool-registry' || operationFixture ? (
    <ToolRegistrySection
      onAction={onAction}
      operationFixture={operationFixture}
      operationStatus={operationStatus}
      refreshNonce={refreshNonce}
    />
  ) : import.meta.env.VITE_AGENT_MODE === 'real' ? (
    <RealToolCallsSection refreshNonce={refreshNonce} />
  ) : (
    <ToolCallsSection onAction={onAction} refreshNonce={refreshNonce} />
  );
}

function mapRealToolCall(row: AdminQueryToolCall, index: number): AdminToolCallRow {
  return {
    key: `tool-call-${row.tool_call_id ?? index}`,
    callId: row.tool_call_id == null ? '-' : String(row.tool_call_id),
    runId: row.agent_run_id == null ? '-' : String(row.agent_run_id),
    toolName: row.tool_name || '-',
    status: row.status || '-',
    latencyMs: row.latency_ms ?? 0,
    traceId: row.trace_id || '-',
    requestId: '-',
    inputSummary: '-',
    outputSummary: '-',
    errorCode: '-',
  };
}

function RealToolCallsSection({ refreshNonce = 0 }: { refreshNonce?: number }) {
  const [rows, setRows] = useState<AdminToolCallRow[]>([]);
  const [selectedTool, setSelectedTool] = useState<AdminToolCallRow>();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);
  const pageSize = 8;

  useEffect(() => {
    let active = true;
    // 查询条件、刷新或重试变化时，只有当前请求可以更新页面。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadError('');
    loadAdminQuery<AdminQueryToolCall>('tool-calls', {
      page,
      size: pageSize,
      query: query.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })
      .then((result) => {
        if (!active) return;
        const items = result.items.map(mapRealToolCall);
        setRows(items);
        setSelectedTool(items[0]);
        setTotal(result.total);
      })
      .catch((error) => {
        if (!active) return;
        setRows([]);
        setSelectedTool(undefined);
        setTotal(0);
        setLoadError(error instanceof Error ? error.message : '工具调用加载失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, query, refreshNonce, retryNonce, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const columns: TableColumnProps<AdminToolCallRow>[] = [
    { title: '工具调用 ID', dataIndex: 'callId' },
    { title: 'Run ID', dataIndex: 'runId' },
    { title: '工具名', dataIndex: 'toolName' },
    { title: '状态', dataIndex: 'status', render: (_, row) => statusTag(row.status) },
    { title: '耗时', render: (_, row) => `${row.latencyMs} ms` },
    { title: 'Trace ID', dataIndex: 'traceId' },
    {
      title: '操作',
      render: (_, row) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedTool(row)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <section className={styles.filters} aria-label="工具调用筛选">
        <strong>筛选</strong>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className={styles.filterControl} aria-label="工具调用状态筛选">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="success">success</SelectItem>
            <SelectItem value="failed">failed</SelectItem>
            <SelectItem value="running">running</SelectItem>
          </SelectContent>
        </Select>
        <ShadcnInput
          className={styles.filterInput}
          value={searchInput}
          placeholder="工具名 / Run ID / Trace ID"
          aria-label="搜索工具调用"
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            setQuery(searchInput);
            setPage(1);
          }}
        >
          <Search aria-hidden="true" />
          查询
        </Button>
      </section>

      {loadError ? (
        <div className={styles.auditError} role="alert">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => setRetryNonce((value) => value + 1)}>
            <RefreshCw aria-hidden="true" />
            重试
          </Button>
        </div>
      ) : null}

      <section className={styles.sectionLayout}>
        <Card className={styles.wideCard}>
          <div className={styles.cardHead}>
            <strong>工具调用记录</strong>
            <Badge variant="outline">真实接口只读数据</Badge>
          </div>
          <DataTable
            columns={columns}
            data={rows}
            emptyLabel={loading ? '正在加载工具调用...' : loadError ? '工具调用暂不可用' : '暂无工具调用记录'}
          />
        </Card>
        <aside className={styles.side} aria-label="工具调用详情">
          {selectedTool ? (
            <Card className={styles.card}>
              <div className={styles.cardHead}>
                <strong>工具调用详情</strong>
                {statusTag(selectedTool.status)}
              </div>
              <div className={styles.detailGrid}>
                <span>调用 ID</span>
                <strong>{selectedTool.callId}</strong>
                <span>Run ID</span>
                <strong>{selectedTool.runId}</strong>
                <span>工具名</span>
                <strong>{selectedTool.toolName}</strong>
                <span>耗时</span>
                <strong>{selectedTool.latencyMs} ms</strong>
                <span>Trace ID</span>
                <strong>{selectedTool.traceId}</strong>
                <span>错误码</span>
                <strong>{selectedTool.errorCode || '-'}</strong>
              </div>
            </Card>
          ) : (
            <Card className={styles.card}>
              <div className={styles.runEmptyState} role="status">
                <strong>{loadError ? '工具调用详情暂不可用' : '暂无工具调用详情'}</strong>
                <span>{loadError || '当前接口没有返回可查看的工具调用。'}</span>
              </div>
            </Card>
          )}
        </aside>
      </section>

      <section className={styles.overviewPagination} aria-label="工具调用分页">
        <span>
          显示第 {rangeStart} 到 {rangeEnd} 条，共 {total} 条结果
        </span>
        <div className={styles.overviewPageButtons}>
          <Button disabled={page === 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            上一页
          </Button>
          <span aria-label={`第 ${page} 页，共 ${pageCount} 页`}>
            {page} / {pageCount}
          </span>
          <Button
            disabled={page >= pageCount || loading}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            下一页
          </Button>
        </div>
      </section>
    </>
  );
}

function ToolCallsSection({
  onAction,
  refreshNonce = 0,
}: {
  onAction: (payload: AdminActionPayload) => void;
  refreshNonce?: number;
}) {
  const [tools, setTools] = useState<ToolRow[]>(import.meta.env.VITE_AGENT_MODE === 'real' ? [] : adminToolRows);
  const [selectedTool, setSelectedTool] = useState<ToolRow | undefined>(tools[0]);
  useEffect(() => {
    if (import.meta.env.VITE_AGENT_MODE === 'real')
      loadAdminDashboard()
        .then((d) => {
          const rows = d.tools as ToolRow[];
          setTools(rows);
          setSelectedTool(rows[0]);
        })
        .catch(() => setTools([]));
  }, [refreshNonce]);

  const toolColumns: TableColumnProps<ToolRow>[] = [
    { title: '工具名', dataIndex: 'name' },
    { title: '版本', dataIndex: 'version' },
    { title: '范围', dataIndex: 'scope' },
    { title: '风险', dataIndex: 'risk', render: riskTag },
    { title: '状态', dataIndex: 'status', render: statusTag },
    {
      title: '操作',
      render: (_, record) => (
        <div className={styles.rowActions}>
          <Button variant="outline" size="sm" onClick={() => setSelectedTool(record)}>
            详情
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canManage}
            onClick={() =>
              onAction({
                action: record.status === 'active' ? '停用工具' : '启用工具',
                targetLabel: record.name,
                targetType: 'tool',
                targetId: record.name,
                execute: async () => {
                  await updateAdminToolStatus(
                    record.name,
                    record.status === 'active' ? 'disabled' : 'active',
                    record.revision ?? 1,
                  );
                },
                onApply: () => {
                  record.status = record.status === 'active' ? 'disabled' : 'active';
                },
              })
            }
          >
            启停
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminFilters placeholder="toolName / risk / scope" />
      <section className={styles.sectionLayout}>
        <Card className={styles.wideCard}>
          <div className={styles.cardHead}>
            <strong>工具注册表</strong>
            <Badge variant="destructive">高风险工具仅 admin 可停用</Badge>
          </div>
          <DataTable columns={toolColumns} data={tools} />
        </Card>
        <aside className={styles.side}>
          {selectedTool ? <ToolDetailCard tool={selectedTool} /> : null}
          <OperationAuditCard />
        </aside>
      </section>
    </>
  );
}

function ToolDetailCard({ tool }: { tool: ToolRow }) {
  return (
    <Card className={styles.card}>
      <div className={styles.cardHead}>
        <strong>工具详情</strong>
        {riskTag(tool.risk)}
      </div>
      <div className={styles.detailGrid}>
        <span>名称</span>
        <strong>{tool.name}</strong>
        <span>版本</span>
        <strong>{tool.version}</strong>
        <span>负责人域</span>
        <strong>{tool.owner}</strong>
        <span>可用范围</span>
        <strong>{tool.scope}</strong>
        <span>入参 schema</span>
        <strong>{tool.schema}</strong>
        <span>最近调用</span>
        <strong>{tool.lastCalledAt}</strong>
      </div>
    </Card>
  );
}

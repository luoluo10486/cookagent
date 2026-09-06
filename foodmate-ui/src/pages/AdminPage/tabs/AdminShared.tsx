import { Badge } from '@/components/ui/badge';
import type { TableColumnProps } from '@/components/ui/data-table';
import {
  adminAuditRows,
  adminDeletedRows,
  adminKnowledgeRows,
  adminModelUsageRows,
  adminOperationAuditRows,
  adminOverviewMetrics,
  adminOverviewRows,
  adminResourceCards,
  adminSqlAuditRows,
  adminToolRegistryRows,
  adminToolCallRows,
  adminToolRows,
  adminTraceRows,
  adminUserRows,
  adminUserBusinessSessionRows,
  adminUserOperationHistoryRows,
  adminUserSessionRows,
} from '../../../services/adminService';
import type { AdminDeletedRow, AdminToolRegistryRow, AdminToolRow } from '../../../services/adminService';
import { getAuthStatus, getAuthUser, type AuthStatus } from '../../../services/authService';

const authStatus = getAuthStatus();
const authUser = getAuthUser();

export type AdminAccess = {
  canAccess: boolean;
  canManage: boolean;
  canViewUserDetails: boolean;
  canViewAudit: boolean;
  canRestoreResources: boolean;
};

export function resolveAdminAccess(status: AuthStatus, role: string): AdminAccess {
  const canAccess = status === 'authenticated' && ['admin', 'operator', 'superadmin'].includes(role);
  const canManage = canAccess && ['admin', 'superadmin'].includes(role);
  return {
    canAccess,
    canManage,
    canViewUserDetails: canAccess,
    canViewAudit: canManage,
    canRestoreResources: canManage,
  };
}

const adminAccess = resolveAdminAccess(authStatus, authUser.role);
export const canAccessAdmin = adminAccess.canAccess;
export const canManage = adminAccess.canManage;
export const canViewAudit = adminAccess.canViewAudit;
export const canRestoreResources = adminAccess.canRestoreResources;

export {
  adminAuditRows,
  adminDeletedRows,
  adminKnowledgeRows,
  adminModelUsageRows,
  adminOperationAuditRows,
  adminOverviewMetrics,
  adminOverviewRows,
  adminResourceCards,
  adminSqlAuditRows,
  adminToolRegistryRows,
  adminToolCallRows,
  adminToolRows,
  adminTraceRows,
  adminUserRows,
  adminUserBusinessSessionRows,
  adminUserOperationHistoryRows,
  adminUserSessionRows,
};

export type AuditRow = (typeof adminAuditRows)[number];
export type ToolCallRow = (typeof adminToolCallRows)[number];
export type SqlAuditRow = (typeof adminSqlAuditRows)[number];
export type TraceRow = (typeof adminTraceRows)[number];
export type UserRow = (typeof adminUserRows)[number];
export type UserSessionRow = (typeof adminUserSessionRows)[number];
export type UserBusinessSessionRow = (typeof adminUserBusinessSessionRows)[number];
export type UserOperationHistoryRow = (typeof adminUserOperationHistoryRows)[number];
export type ToolRow = AdminToolRow;
export type ToolRegistryRow = AdminToolRegistryRow;
export type ModelUsageRow = (typeof adminModelUsageRows)[number];
export type KnowledgeRow = (typeof adminKnowledgeRows)[number];
export type DeletedRow = AdminDeletedRow;
export type OperationAuditRow = (typeof adminOperationAuditRows)[number];

export const adminNavItems: Array<{
  key: string;
  path: string;
  label: string;
  iconPath: string;
  adminOnly?: boolean;
}> = [
  {
    key: 'overview',
    path: '/admin',
    label: '概览',
    iconPath: '/assets/figma/admin/navigation/overview.svg',
  },
  {
    key: 'users',
    path: '/admin/users',
    label: '用户管理',
    iconPath: '/assets/figma/admin/navigation/users.svg',
  },
  {
    key: 'runs',
    path: '/admin/runs',
    label: 'Agent 运行',
    iconPath: '/assets/figma/admin/navigation/runs.svg',
  },
  {
    key: 'tools',
    path: '/admin/tools',
    label: '工具调用',
    iconPath: '/assets/figma/admin/navigation/tools.svg',
  },
  {
    key: 'sql',
    path: '/admin/runs?tab=sql',
    label: 'SQL 审计',
    iconPath: '/assets/figma/admin/navigation/sql.svg',
  },
  {
    key: 'trace',
    path: '/admin/runs?tab=trace',
    label: 'Trace',
    iconPath: '/assets/figma/admin/navigation/trace.svg',
  },
  {
    key: 'usage',
    path: '/admin/usage',
    label: '模型用量',
    iconPath: '/assets/figma/admin/navigation/sql.svg',
  },
  {
    key: 'knowledge',
    path: '/admin/knowledge',
    label: '知识库管理',
    iconPath: '/assets/figma/admin/navigation/knowledge.svg',
  },
  {
    key: 'registry',
    path: '/admin/tools?tab=registry',
    label: '工具注册表',
    iconPath: '/assets/figma/admin/navigation/trace.svg',
  },
  {
    key: 'deleted',
    path: '/admin/deleted',
    label: '删除资源',
    iconPath: '/assets/figma/admin/navigation/deleted.svg',
    adminOnly: true,
  },
  {
    key: 'audit',
    path: '/admin?view=audit',
    label: '操作审计',
    iconPath: '/assets/figma/admin/navigation/audit.svg',
    adminOnly: true,
  },
];

export function isAdminNavItemActive(path: string, pathname: string, search: string) {
  const target = new URL(path, 'http://foodmate.local');
  const normalizeSearch = (value: string) => {
    const params = new URLSearchParams(value);
    // 视觉验收标记只用于截图，不应改变业务导航的当前高亮状态。
    params.delete('visual-qa');
    return params.toString();
  };
  return target.pathname === pathname && normalizeSearch(target.search) === normalizeSearch(search);
}

export const sectionMeta: Record<string, { title: string; description: string; tag: string }> = {
  overview: {
    title: '系统概览',
    description: '运行、用户、工具、模型和知识库索引状态。当前为 mock 管理视图。',
    tag: 'Overview',
  },
  users: {
    title: '用户管理',
    description: '查询用户详情、登录会话、角色和状态；状态变更与会话重置仅 admin 可执行。',
    tag: 'RBAC',
  },
  runs: {
    title: 'Agent 运行',
    description: '查看 AgentRun、ToolCall、SQLAudit 和 Trace，定位失败任务与异常链路。',
    tag: 'AgentRun',
  },
  tools: { title: '工具调用', description: '管理工具注册表、版本、权限范围、风险等级和启停状态。', tag: 'Tools' },
  usage: { title: '模型用量', description: '查看供应商、模型、场景、Token、成本和耗时。', tag: 'Model Usage' },
  model: {
    title: '模型治理',
    description: '查看模型供应商、目录、路由、价格和预算策略；敏感凭据只显示安全摘要。',
    tag: 'Governance',
  },
  knowledge: { title: '知识库', description: '管理知识库文档、解析状态、索引进度和下线恢复。', tag: 'Knowledge' },
  deleted: { title: '删除资源', description: '查看已删除业务资源，并由 admin 执行恢复操作。', tag: 'Recovery' },
  audit: {
    title: '操作审计',
    description: '按动作、目标、结果和请求链路查询管理操作，并查看不可变审计详情。',
    tag: 'Audit',
  },
};

export function statusTag(value: unknown) {
  const status = String(value ?? '-');
  const color =
    status === 'active' || status === 'success' || status === 'completed' || status === 'indexed'
      ? 'default'
      : status === 'failed' || status === 'disabled' || status === 'locked'
        ? 'destructive'
        : 'warning';
  return <Badge variant={color}>{status}</Badge>;
}

export function roleTag(role: string) {
  return (
    <Badge
      variant={role === 'admin' || role === 'superadmin' ? 'outline' : role === 'operator' ? 'warning' : 'secondary'}
    >
      {role}
    </Badge>
  );
}

export function riskTag(value: unknown) {
  const risk = String(value ?? '-');
  return <Badge variant={risk === 'high' ? 'destructive' : risk === 'medium' ? 'warning' : 'default'}>{risk}</Badge>;
}

export const auditColumns: TableColumnProps<AuditRow>[] = [
  { title: 'Run', dataIndex: 'runId' },
  { title: '用户', dataIndex: 'user' },
  { title: '意图', dataIndex: 'intent' },
  { title: '状态', dataIndex: 'status', render: (_, record) => statusTag(record.status) },
  { title: '耗时 ms', dataIndex: 'durationMs' },
  { title: 'Trace', dataIndex: 'traceId' },
];

export const toolCallColumns: TableColumnProps<ToolCallRow>[] = [
  { title: 'Call ID', dataIndex: 'callId' },
  { title: 'Run', dataIndex: 'runId' },
  { title: '工具', dataIndex: 'toolName' },
  { title: '状态', dataIndex: 'status', render: (_, record) => statusTag(record.status) },
  { title: '耗时 ms', dataIndex: 'latencyMs' },
  { title: 'Trace', dataIndex: 'traceId' },
];

export const sqlAuditColumns: TableColumnProps<SqlAuditRow>[] = [
  { title: 'Audit ID', dataIndex: 'auditId' },
  { title: '执行方', dataIndex: 'actor' },
  { title: '语句摘要', dataIndex: 'statement' },
  { title: '风险', dataIndex: 'risk', render: (_, record) => riskTag(record.risk) },
  { title: '结果', dataIndex: 'result' },
  { title: 'Trace', dataIndex: 'traceId' },
];

export const traceColumns: TableColumnProps<TraceRow>[] = [
  { title: 'Trace', dataIndex: 'traceId' },
  { title: '链路', dataIndex: 'entry' },
  { title: '状态', dataIndex: 'status', render: (_, record) => statusTag(record.status) },
  { title: '开始时间', dataIndex: 'startedAt' },
];

export const modelUsageColumns: TableColumnProps<ModelUsageRow>[] = [
  { title: '供应商', dataIndex: 'provider' },
  { title: '模型', dataIndex: 'model' },
  { title: '场景', dataIndex: 'scene' },
  { title: 'Tokens', dataIndex: 'tokens' },
  { title: '成本', dataIndex: 'cost' },
  { title: '耗时 ms', dataIndex: 'latencyMs' },
  { title: '状态', dataIndex: 'status', render: (_, record) => statusTag(record.status) },
];

export const operationAuditColumns: TableColumnProps<OperationAuditRow>[] = [
  { title: 'operator_id', dataIndex: 'operator_id' },
  { title: '操作人', dataIndex: 'operator' },
  { title: '动作', dataIndex: 'action' },
  { title: '目标', render: (_, record) => `${record.target_type}:${record.target_id}` },
  { title: '结果', dataIndex: 'result', render: (_, record) => statusTag(record.result) },
  { title: 'request_id', dataIndex: 'request_id' },
  { title: 'trace_id', dataIndex: 'trace_id' },
];

export const sessionColumns: TableColumnProps<UserSessionRow>[] = [
  { title: '设备', dataIndex: 'device' },
  { title: 'IP', dataIndex: 'ip' },
  { title: '过期时间', dataIndex: 'expiresAt' },
  { title: '状态', dataIndex: 'status', render: (_, record) => statusTag(record.status) },
];

export function getSectionKey(pathname: string, search = ''): string {
  if (pathname === '/admin' && new URLSearchParams(search).get('view') === 'audit') return 'audit';
  if (pathname.endsWith('/users')) return 'users';
  if (pathname.endsWith('/runs')) return 'runs';
  if (pathname.endsWith('/tools')) return 'tools';
  if (pathname.endsWith('/usage')) return 'usage';
  if (pathname.endsWith('/model-governance')) return 'model';
  if (pathname.endsWith('/knowledge')) return 'knowledge';
  if (pathname.endsWith('/deleted')) return 'deleted';
  return 'overview';
}

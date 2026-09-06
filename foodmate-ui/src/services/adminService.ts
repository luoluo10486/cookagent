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
} from '../mock/admin';
import { apiRequest } from './apiClient';

export type AdminDashboard = {
  overview_metrics: AdminMetricRow[];
  runs: AdminRunRow[];
  tool_calls: AdminToolCallRow[];
  sql_audits: AdminSqlAuditRow[];
  traces: AdminTraceRow[];
  tools: AdminToolRow[];
  usage: AdminUsageRow[];
  knowledge: AdminKnowledgeRow[];
  deleted: AdminDeletedRow[];
  operation_audits: AdminOperationAuditRow[];
};

type AdminDashboardResponse = {
  overview_metrics: AdminMetricResponse[];
  runs: AdminRunResponse[];
  tool_calls: AdminToolCallResponse[];
  sql_audits: AdminSqlAuditResponse[];
  traces?: AdminTraceResponse[];
  tools: AdminToolResponse[];
  usage: AdminUsageResponse[];
  knowledge: AdminKnowledgeResponse[];
  deleted: AdminDeletedResponse[];
  operation_audits: AdminOperationAuditResponse[];
};

type AdminMetricResponse = { label: string; value: string; hint: string; tone: string };
type AdminRunResponse = {
  agent_run_id: number | null;
  session_id: number | null;
  intent: string;
  status: string;
  trace_id: string;
  duration_ms: number | string | null;
  username: string;
  result_type?: string;
  error_code?: string;
  stage?: string;
  model?: string;
  created_at?: string;
};
type AdminToolCallResponse = {
  tool_call_id: number | null;
  agent_run_id: number | null;
  tool_name: string;
  status: string;
  latency_ms: number | null;
  trace_id: string;
  request_id?: string;
  input_summary?: string;
  output_summary?: string;
  error_code?: string;
  started_at?: string;
  completed_at?: string;
};
type AdminSqlAuditResponse = {
  sql_audit_id: number | null;
  actor: number | null;
  statement: string;
  result: string;
  trace_id: string;
  risk?: string;
  duration_ms?: number | null;
  row_count?: number | null;
  policy?: string;
  query_hash?: string;
  error_code?: string;
  created_at?: string;
};
type AdminTraceResponse = {
  trace_id: string;
  run_id?: number | string | null;
  entry?: string;
  status: string;
  started_at?: string;
  duration_ms?: number | null;
  span_count?: number | null;
  root_service?: string;
  error_code?: string;
};
type AdminToolResponse = {
  name: string;
  version: string;
  risk: string;
  status: string;
  scope: string;
  owner: string;
  last_called_at: string;
  revision?: number;
};
type AdminToolRegistryResponse = {
  tool_id: number;
  name: string;
  display_name: string;
  description: string;
  category: string;
  risk_level: string;
  availability_scope: string;
  status: string;
  current_version: string;
  version: string;
  input_schema: unknown;
  output_schema: unknown;
  permissions: unknown;
  timeout_ms: number;
  retryable: boolean;
  idempotent: boolean;
  published_at: string | null;
  revision: number;
};
type AdminUsageResponse = {
  provider: string;
  model: string;
  scene: string;
  tokens: string;
  cost: number | string | null;
  latency_ms: number | null;
  status: string;
};
type AdminKnowledgeResponse = {
  document_id: number | null;
  title: string;
  status: string;
  visibility?: string;
  chunks: number | null;
  owner: string;
  source: string;
  index_progress: string;
  updated_at: string | null;
};
type AdminDeletedResponse = {
  resource_type: string;
  resource_id: number | null;
  summary?: string;
  owner: string;
  deleted_by?: string;
  deleted_at: string | null;
  revision?: number;
  restorable?: boolean;
  reason: string;
};
type AdminOperationAuditResponse = {
  operator_id: number | null;
  action: string;
  target_type: string;
  target_id: string;
  result: string;
  request_id: string;
  trace_id: string;
  created_at: string | null;
  request_summary?: string;
  before_state?: string;
  after_state?: string;
  error_code?: string;
  client_info?: string;
};

export type AdminMetricRow = AdminMetricResponse;
export type AdminRunRow = {
  key: string;
  runId: string;
  userId?: string;
  user: string;
  intent: string;
  status: string;
  durationMs: number;
  toolCalls?: number;
  traceId: string;
  sessionId?: string;
  resultType?: string;
  errorCode?: string;
  stage?: string;
  model?: string;
  createdAt?: string;
};
export type AdminToolCallRow = {
  key: string;
  callId: string;
  runId: string;
  toolName: string;
  status: string;
  latencyMs: number;
  traceId: string;
  requestId?: string;
  inputSummary?: string;
  outputSummary?: string;
  errorCode?: string;
  startedAt?: string;
  completedAt?: string;
};
export type AdminSqlAuditRow = {
  key: string;
  auditId: string;
  actor: string;
  statement: string;
  risk: string;
  result: string;
  traceId: string;
  durationMs?: number;
  rowCount?: number;
  policy?: string;
  queryHash?: string;
  errorCode?: string;
  createdAt?: string;
};
export type AdminTraceRow = {
  key: string;
  traceId: string;
  runId?: string;
  entry: string;
  status: string;
  startedAt: string;
  durationMs?: number;
  spanCount?: number;
  rootService?: string;
  errorCode?: string;
};
export type AdminToolRow = {
  key: string;
  name: string;
  version: string;
  risk: string;
  status: string;
  scope: string;
  owner: string;
  schema: string;
  lastCalledAt: string;
  revision?: number;
  timeoutMs?: string;
  retryPolicy?: string;
  failedRate?: string;
  displayName?: string;
  description?: string;
  category?: string;
  currentVersion?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  permissions?: unknown;
  retryable?: boolean;
  idempotent?: boolean;
  publishedAt?: string;
};
export type AdminToolRegistryRow = AdminToolRow & {
  timeoutMs: string;
  retryPolicy: string;
  failedRate: string;
};
export type AdminUsageRow = {
  key: string;
  provider: string;
  model: string;
  scene: string;
  tokens: string;
  cost: string;
  latencyMs: number;
  status: string;
};
export type AdminKnowledgeRow = {
  key: string;
  documentId: string;
  title: string;
  status: string;
  visibility?: 'draft' | 'published' | 'disabled' | 'deleted' | string;
  chunks: number;
  owner: string;
  source: string;
  indexProgress: string;
  updatedAt: string;
};
export type AdminDeletedRow = {
  key: string;
  resourceType: string;
  resourceId: string;
  summary: string;
  owner: string;
  deletedBy: string;
  deletedAt: string;
  restorable: boolean;
  reason: string;
  revision?: number;
};
export type AdminOperationAuditRow = {
  key: string;
  operator_id: string;
  operator: string;
  action: string;
  target_type: string;
  target_id: string;
  result: string;
  request_id: string;
  trace_id: string;
  createdAt: string;
  requestSummary: string;
  beforeState: string;
  afterState: string;
  errorCode: string;
  clientInfo: string;
};

const text = (value: string | number | null | undefined) => (value == null ? '-' : String(value));
const numeric = (value: number | string | null | undefined) => (value == null ? 0 : Number(value));

function normalizeKnowledgeRow(row: AdminKnowledgeResponse, index: number): AdminKnowledgeRow {
  return {
    key: `knowledge-${row.document_id ?? index}`,
    documentId: text(row.document_id),
    title: row.title,
    status: row.status,
    visibility: row.visibility || 'draft',
    chunks: row.chunks ?? 0,
    owner: row.owner,
    source: row.source,
    indexProgress: row.index_progress,
    updatedAt: text(row.updated_at),
  };
}

function normalizeDashboard(data: AdminDashboardResponse): AdminDashboard {
  return {
    overview_metrics: data.overview_metrics,
    runs: data.runs.map((row, index) => ({
      key: `run-${row.agent_run_id ?? index}`,
      runId: text(row.agent_run_id),
      userId: row.session_id == null ? undefined : String(row.session_id),
      user: row.username || '-',
      intent: row.intent || '-',
      status: row.status || '-',
      durationMs: numeric(row.duration_ms),
      traceId: row.trace_id || '-',
      toolCalls: 0,
      sessionId: row.session_id == null ? undefined : String(row.session_id),
      resultType: row.result_type || '-',
      errorCode: row.error_code || '-',
      stage: row.stage || '-',
      model: row.model || '-',
      createdAt: row.created_at || '-',
    })),
    tool_calls: data.tool_calls.map((row, index) => ({
      key: `call-${row.tool_call_id ?? index}`,
      callId: text(row.tool_call_id),
      runId: text(row.agent_run_id),
      toolName: row.tool_name,
      status: row.status,
      latencyMs: row.latency_ms ?? 0,
      traceId: row.trace_id || '-',
      requestId: row.request_id || '-',
      inputSummary: row.input_summary || '-',
      outputSummary: row.output_summary || '-',
      errorCode: row.error_code || '-',
      startedAt: row.started_at || '-',
      completedAt: row.completed_at || '-',
    })),
    sql_audits: data.sql_audits.map((row, index) => ({
      key: `sql-${row.sql_audit_id ?? index}`,
      auditId: text(row.sql_audit_id),
      actor: text(row.actor),
      statement: row.statement,
      risk: row.risk || 'low',
      result: row.result,
      traceId: row.trace_id || '-',
      durationMs: row.duration_ms ?? 0,
      rowCount: row.row_count ?? 0,
      policy: row.policy || '-',
      queryHash: row.query_hash || '-',
      errorCode: row.error_code || '-',
      createdAt: row.created_at || '-',
    })),
    traces: (data.traces ?? []).map((row, index) => ({
      key: `trace-${row.trace_id || index}`,
      traceId: row.trace_id || '-',
      runId: row.run_id == null ? undefined : String(row.run_id),
      entry: row.entry || '-',
      status: row.status || '-',
      startedAt: row.started_at || '-',
      durationMs: row.duration_ms ?? 0,
      spanCount: row.span_count ?? 0,
      rootService: row.root_service || '-',
      errorCode: row.error_code || '-',
    })),
    tools: data.tools.map((row, index) => ({
      key: `tool-${row.name || index}`,
      name: row.name,
      version: row.version,
      risk: row.risk,
      status: row.status,
      scope: row.scope,
      owner: row.owner,
      schema: '-',
      lastCalledAt: row.last_called_at || '-',
      revision: row.revision ?? 1,
    })),
    usage: data.usage.map((row, index) => ({
      key: `usage-${row.provider}-${row.model}-${index}`,
      provider: row.provider,
      model: row.model,
      scene: row.scene,
      tokens: row.tokens,
      cost: text(row.cost),
      latencyMs: row.latency_ms ?? 0,
      status: row.status,
    })),
    knowledge: data.knowledge.map(normalizeKnowledgeRow),
    deleted: data.deleted.map((row, index) => ({
      key: `deleted-${row.resource_id ?? index}`,
      resourceType: row.resource_type,
      resourceId: text(row.resource_id),
      summary: row.summary || row.reason || '-',
      owner: row.owner,
      deletedBy: row.deleted_by || 'system_cleanup',
      deletedAt: text(row.deleted_at),
      restorable: row.restorable ?? true,
      reason: row.reason,
      revision: row.revision ?? 1,
    })),
    operation_audits: data.operation_audits.map((row, index) => ({
      key: `operation-${row.request_id || index}`,
      operator_id: text(row.operator_id),
      operator: text(row.operator_id),
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      result: row.result,
      request_id: row.request_id,
      trace_id: row.trace_id,
      createdAt: text(row.created_at),
      requestSummary: row.request_summary || '-',
      beforeState: row.before_state || '-',
      afterState: row.after_state || '-',
      errorCode: row.error_code || '-',
      clientInfo: row.client_info || '-',
    })),
  };
}

export async function loadAdminDashboard(): Promise<AdminDashboard> {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') throw new Error('Real admin API is disabled');
  return normalizeDashboard(await apiRequest<AdminDashboardResponse>('/api/admin/dashboard'));
}

function normalizeToolRegistryRow(row: AdminToolRegistryResponse): AdminToolRegistryRow {
  return {
    key: `tool-registry-${row.tool_id}`,
    name: row.name,
    version: row.version || row.current_version,
    risk: row.risk_level,
    status: row.status,
    scope: row.availability_scope,
    owner: row.category,
    schema: JSON.stringify(row.input_schema) ?? '-',
    lastCalledAt: '-',
    revision: row.revision,
    timeoutMs: String(row.timeout_ms),
    retryPolicy: row.retryable ? '可重试' : '不可重试',
    failedRate: '-',
    displayName: row.display_name,
    description: row.description,
    category: row.category,
    currentVersion: row.current_version,
    inputSchema: row.input_schema,
    outputSchema: row.output_schema,
    permissions: row.permissions,
    retryable: row.retryable,
    idempotent: row.idempotent,
    publishedAt: row.published_at ?? undefined,
  };
}

export async function loadAdminToolRegistry(): Promise<AdminToolRegistryRow[]> {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') throw new Error('Real admin API is disabled');
  const response = await apiRequest<{ tools: AdminToolRegistryResponse[] }>('/api/admin/tools/registry');
  return response.tools.map(normalizeToolRegistryRow);
}

type AdminOperationalQueryResponse<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};

export type AdminQueryRun = {
  agent_run_id: number | null;
  session_id: number | null;
  intent: string;
  status: string;
  trace_id: string;
  duration_ms: number | string | null;
  actor_ref: string;
};

export type AdminQueryTrace = {
  trace_id: string;
  run_id: number | null;
  entry: string;
  status: string;
  started_at: string | null;
  duration_ms: number | string | null;
  span_count: number | null;
  root_service: string;
  error_code: string | null;
};

export type AdminTraceSpan = {
  span_id: string;
  span_type: string;
  name: string;
  service: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | string | null;
  error_code: string | null;
  sequence_no: number | null;
};

export type AdminTraceDetail = {
  summary: AdminQueryTrace;
  spans: AdminTraceSpan[];
};

export type AdminQueryToolCall = {
  tool_call_id: number | null;
  agent_run_id: number | null;
  tool_name: string;
  status: string;
  latency_ms: number | null;
  trace_id: string;
};

export type AdminQuerySqlAudit = {
  sql_audit_id: number | null;
  actor: number | null;
  query_hash: string;
  result: string;
  trace_id: string;
  latency_ms: number | null;
  row_count: number | null;
  error_code: string;
  created_at: string | null;
};

export type AdminQueryDlq = {
  dlq_id: number | null;
  consumer_group: string;
  source_topic: string;
  message_id: string;
  run_id: string | null;
  dispatch_id: string | null;
  event_id: string | null;
  attempt: number | null;
  reconsume_times: number | null;
  error_code: string;
  reconciliation_state: string;
  first_seen_at: string | null;
  reconciled_at: string | null;
};

export type AdminQueryParams = {
  page?: number;
  size?: number;
  query?: string;
  status?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
};

export async function loadAdminQuery<T>(resource: string, params: AdminQueryParams = {}) {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') throw new Error('Real admin API is disabled');
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('size', String(params.size ?? 100));
  if (params.query) search.set('query', params.query);
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.sort) search.set('sort', params.sort);
  if (params.direction) search.set('direction', params.direction);
  return apiRequest<AdminOperationalQueryResponse<T>>(`/api/admin/queries/${resource}?${search.toString()}`);
}

/** 管理端知识库使用专用分页查询，避免把 dashboard 概览当成明细数据源。 */
export async function loadAdminKnowledge(params: AdminQueryParams = {}): Promise<{
  items: AdminKnowledgeRow[];
  total: number;
  page: number;
  size: number;
}> {
  const data = await loadAdminQuery<AdminKnowledgeResponse>('knowledge', {
    size: 100,
    ...params,
  });
  return {
    items: data.items.map(normalizeKnowledgeRow),
    total: data.total,
    page: data.page,
    size: data.size,
  };
}

export async function loadAdminTraceDetail(traceId: string): Promise<AdminTraceDetail> {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') throw new Error('Real admin API is disabled');
  return apiRequest<AdminTraceDetail>(`/api/admin/queries/traces/${encodeURIComponent(traceId)}`);
}

type AdminDeletedQueryItem = {
  resource_type: string;
  resource_id: number | null;
  owner_ref: string;
  deleted_at: string | null;
  reason: string;
  revision?: number;
};

export async function loadAdminDeletedResources(): Promise<AdminDeletedRow[]> {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') throw new Error('Real admin API is disabled');
  const data = await apiRequest<AdminOperationalQueryResponse<AdminDeletedQueryItem>>(
    '/api/admin/queries/deleted?size=100',
  );
  return data.items.map((row, index) => ({
    key: `deleted-${row.resource_id ?? index}`,
    resourceType: row.resource_type,
    resourceId: text(row.resource_id),
    summary: row.reason || '-',
    owner: row.owner_ref || '-',
    deletedBy: '-',
    deletedAt: text(row.deleted_at),
    restorable: true,
    reason: row.reason || '-',
    revision: row.revision ?? 1,
  }));
}

export async function loadAdminOperationAudits(): Promise<AdminOperationAuditResponse[]> {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') throw new Error('Real admin API is disabled');
  const data = await apiRequest<AdminOperationalQueryResponse<AdminOperationAuditResponse>>(
    '/api/admin/queries/operation-audits?size=100',
  );
  return data.items;
}

export type AdminExportStatus = {
  export_job_id: number;
  resource: string;
  status: string;
  expires_at: string | null;
  completed_at: string | null;
  download_consumed_at: string | null;
  failure_code: string | null;
};

export async function requestAdminExport(
  resource: string,
  filters: { query?: string; status?: string; visibility?: string; sort?: string; direction?: 'asc' | 'desc' } = {},
  fields?: string[],
) {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') throw new Error('Real admin API is disabled');
  return apiRequest<{ export_job_id: number }>('/api/admin/exports', {
    method: 'POST',
    headers: { 'Idempotency-Key': randomIdempotencyKey(`admin-export-${resource}`) },
    body: JSON.stringify({
      resource,
      ...filters,
      fields,
    }),
  });
}

export async function loadAdminExportStatus(jobId: number) {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') throw new Error('Real admin API is disabled');
  return apiRequest<AdminExportStatus>(`/api/admin/exports/${jobId}`);
}

export async function downloadAdminExport(jobId: number) {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') throw new Error('Real admin API is disabled');
  return apiRequest<{ download_url: string }>(`/api/admin/exports/${jobId}/download`, { method: 'POST' });
}

export type AdminUserRow = {
  key: string;
  userId: string;
  username: string;
  displayName: string;
  role: string;
  status: string;
  email: string;
  phone: string;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  dietGoal: string;
  calorieTarget: number;
  proteinTarget: number;
  allergens: string;
  dislikes: string;
  preferredUnits: string;
  loginFailedCount: number;
  lockedUntil: string;
  lastLoginAt: string;
  createdAt: string;
  revision?: number;
};

type AdminUserResponse = {
  user_id: number;
  username: string;
  nickname?: string;
  email: string;
  role: string;
  status: string;
  revision?: number;
  phone?: string;
  gender?: string;
  height_cm?: number;
  weight_kg?: number;
  activity_level?: string;
  diet_goal?: string;
  calorie_target?: number;
  protein_target?: number;
  allergens?: string;
  dislikes?: string;
  preferred_units?: string;
  login_failed_count?: number;
  locked_until?: string;
  last_login_at?: string;
  created_at?: string;
};

export async function loadAdminUsers(): Promise<AdminUserRow[]> {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') return adminUserRows;
  const data = await apiRequest<AdminUserResponse[]>('/api/admin/users');
  return data.map((user) => ({
    key: `user-${user.user_id}`,
    userId: String(user.user_id),
    username: user.username,
    displayName: user.nickname ?? user.username,
    role: user.role,
    status: user.status,
    email: user.email,
    phone: user.phone ?? '-',
    gender: user.gender ?? '-',
    heightCm: user.height_cm ?? 0,
    weightKg: user.weight_kg ?? 0,
    activityLevel: user.activity_level ?? '-',
    dietGoal: user.diet_goal ?? '-',
    calorieTarget: user.calorie_target ?? 0,
    proteinTarget: user.protein_target ?? 0,
    allergens: user.allergens ?? '-',
    dislikes: user.dislikes ?? '-',
    preferredUnits: user.preferred_units ?? '-',
    loginFailedCount: user.login_failed_count ?? 0,
    lockedUntil: user.locked_until ?? '-',
    lastLoginAt: user.last_login_at ?? '-',
    createdAt: user.created_at ?? '-',
    revision: user.revision ?? 1,
  }));
}

async function adminWrite<T>(path: string, method: string, payload?: object, idempotencyPrefix?: string): Promise<T> {
  return apiRequest<T>(path, {
    method,
    headers: idempotencyPrefix ? { 'Idempotency-Key': randomIdempotencyKey(idempotencyPrefix) } : undefined,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

export async function updateAdminUserStatus(id: string, status: string, revision = 1) {
  const digest = await confirmationDigest('admin.user.status.update', id, status, revision);
  return adminWrite(
    `/api/admin/users/${encodeURIComponent(id)}/status`,
    'PATCH',
    { status, revision, confirmed: true, confirmationDigest: digest },
    'admin-user-status',
  );
}

export async function revokeAdminUserSessions(id: string, revision = 1) {
  const digest = await confirmationDigest('admin.user.sessions.revoke_all', id, '', revision);
  return adminWrite(
    `/api/admin/users/${encodeURIComponent(id)}/sessions/revoke-all`,
    'POST',
    { revision, confirmed: true, confirmationDigest: digest },
    'admin-user-sessions',
  );
}
export async function updateAdminToolStatus(name: string, status: string, revision = 1) {
  const action = 'admin.tool.status.update';
  const digest = await confirmationDigest(action, name, status, revision);
  return modelGovernanceWrite<ModelGovernanceMutation>(
    `/api/admin/tools/${encodeURIComponent(name)}/status`,
    'PATCH',
    { status, revision, confirmed: true, confirmationDigest: digest },
    'admin-tool-status',
  );
}
export const updateKnowledgeStatus = (id: string, status: string) =>
  adminWrite(`/api/admin/knowledge/${encodeURIComponent(id)}/status`, 'PATCH', { status });
export async function restoreAdminResource(type: string, id: string, revision = 1) {
  const action = 'admin.resource.restore';
  const digest = await confirmationDigest(action, type, id, revision);
  return modelGovernanceWrite<ModelGovernanceMutation>(
    `/api/admin/resources/${encodeURIComponent(type)}/${encodeURIComponent(id)}/restore`,
    'POST',
    { revision, confirmed: true, confirmationDigest: digest },
    'admin-resource-restore',
  );
}

export async function uploadKnowledgeDocument(file: File) {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  const csrf = document.cookie
    .split('; ')
    .find((value) => value.startsWith('foodmate_csrf='))
    ?.split('=')[1];
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${baseUrl}/api/admin/knowledge`, {
    method: 'POST',
    credentials: 'include',
    headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    body: form,
  });
  const body = (await response.json()) as {
    success: boolean;
    data: { document_id: number };
    error?: { message?: string };
  };
  if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Knowledge document upload failed');
  return body.data;
}

export type KnowledgeUploadBatch = {
  sourceType: string;
  sourceName: string;
  sourceVersion: string;
  licenseNotice: string;
  idempotencyKey: string;
  files: File[];
};

export type KnowledgeBatchDetail = {
  batch: {
    job: { job_id: string; status: string; total_items: number; indexed_items: number; failed_items: number };
    items: Array<{
      item_id: string;
      document_id: string;
      filename: string;
      upload_status: string;
      index_status: string;
      attempts: number;
      error_code?: string;
    }>;
  };
};

export type KnowledgeBatchEvent = {
  event_id: string;
  event_type: string;
  payload: unknown;
};

export async function uploadKnowledgeBatch(batch: KnowledgeUploadBatch): Promise<{ batch_id: string }> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  const csrf = document.cookie
    .split('; ')
    .find((value) => value.startsWith('foodmate_csrf='))
    ?.split('=')[1];
  const form = new FormData();
  batch.files.forEach((file) => form.append('files', file));
  form.append('source_type', batch.sourceType);
  form.append('source_name', batch.sourceName);
  form.append('source_version', batch.sourceVersion);
  form.append('license_notice', batch.licenseNotice);
  form.append('idempotency_key', batch.idempotencyKey);
  const response = await fetch(`${baseUrl}/api/admin/knowledge-documents/upload-batches`, {
    method: 'POST',
    credentials: 'include',
    headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    body: form,
  });
  const body = (await response.json()) as {
    success: boolean;
    data?: { batch_id: string };
    error?: { message?: string };
  };
  if (!response.ok || !body.success || !body.data) throw new Error(body.error?.message ?? '知识库批次上传失败');
  return body.data;
}

export const loadKnowledgeBatch = (batchId: string) =>
  apiRequest<KnowledgeBatchDetail>(`/api/admin/knowledge-upload-batches/${encodeURIComponent(batchId)}`);

export function streamKnowledgeBatch(batchId: string, onEvent: (event: KnowledgeBatchEvent) => void): () => void {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  const source = new EventSource(
    `${baseUrl}/api/admin/knowledge-upload-batches/${encodeURIComponent(batchId)}/events`,
    {
      withCredentials: true,
    },
  );
  const eventTypes = [
    'knowledge.index.indexed',
    'knowledge.index.index_failed',
    'knowledge.index.retry',
    'knowledge.batch.progress',
  ];
  const listeners = eventTypes.map((eventType) => {
    const listener = (message: Event) => {
      const event = message as MessageEvent<string>;
      let payload: unknown = event.data;
      try {
        payload = JSON.parse(event.data);
      } catch {
        // The server may return a safe textual error payload; progress refresh still remains authoritative.
      }
      onEvent({ event_id: event.lastEventId, event_type: eventType, payload });
    };
    source.addEventListener(eventType, listener);
    return [eventType, listener] as const;
  });
  return () => {
    listeners.forEach(([eventType, listener]) => source.removeEventListener(eventType, listener));
    source.close();
  };
}
export const retryKnowledgeItem = (batchId: string, itemId: string) =>
  adminWrite(
    `/api/admin/knowledge-upload-batches/${encodeURIComponent(batchId)}/documents/${encodeURIComponent(itemId)}/retry`,
    'POST',
  );
export const changeKnowledgeVisibility = (
  documentId: string,
  visibility: 'published' | 'disabled' | 'draft' | 'deleted',
) =>
  adminWrite(
    `/api/admin/knowledge-documents/${encodeURIComponent(documentId)}/${visibility === 'draft' ? 'restore' : visibility}`,
    'POST',
  );

export type ModelGovernanceProvider = {
  provider_id: number;
  provider_code: string;
  display_name: string;
  status: 'active' | 'disabled' | string;
  endpoint_config_key: string;
  configured: boolean;
  fingerprint: string;
  revision: number;
};

export type ModelGovernanceModel = {
  model_id: number;
  provider_code: string;
  model_name: string;
  model_type: string;
  status: 'active' | 'disabled' | string;
  context_tokens: number | null;
  max_output_tokens: number | null;
  timeout_ms: number;
  revision: number;
};

export type ModelGovernanceRoute = {
  route_id: number;
  tenant_id: number;
  scene: string;
  model_type: string;
  provider_code: string;
  model_name: string;
  fallback_provider_code: string | null;
  fallback_model_name: string | null;
  priority: number;
  route_version: string;
  price_version: string;
  budget_policy_version: string;
  max_cost: number | string | null;
  max_latency_ms: number | null;
  status: 'active' | 'disabled' | string;
  revision: number;
};

export type ModelGovernancePrice = {
  price_version_id: number;
  provider_code: string;
  model_name: string;
  price_version: string;
  input_price_per_million: number | string;
  output_price_per_million: number | string;
  currency: string;
  status: string;
  effective_at: string;
};

export type ModelGovernanceBudget = {
  budget_policy_id: number;
  policy_key: string;
  scene: string;
  scope_type: string;
  max_total_tokens: number;
  max_cost_cny: number | string;
  max_model_calls: number;
  max_step_retries: number;
  window_type: string;
  policy_version: string;
  status: string;
  revision: number;
};

export type ModelGovernanceUsage = {
  provider_code: string;
  model_name: string;
  scene: string;
  status: string;
  calls: number;
  total_tokens: number;
  total_cost: number | string;
  average_latency_ms: number | string;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

export type ModelGovernanceView = {
  providers: ModelGovernanceProvider[];
  models: ModelGovernanceModel[];
  routes: ModelGovernanceRoute[];
  prices: ModelGovernancePrice[];
  budgets: ModelGovernanceBudget[];
  usage: ModelGovernanceUsage[];
};

type ModelGovernanceMutation = {
  changed: boolean;
  resource_id: number;
  version: string;
  revision: number;
};

function randomIdempotencyKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

async function confirmationDigest(action: string, target: string, value: string, revision: number) {
  const input = new TextEncoder().encode(`${action}|${target}|${value}|${revision}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function modelGovernanceWrite<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT',
  payload: object,
  idempotencyPrefix: string,
) {
  return apiRequest<T>(path, {
    method,
    headers: { 'Idempotency-Key': randomIdempotencyKey(idempotencyPrefix) },
    body: JSON.stringify(payload),
  });
}

export async function loadModelGovernance(): Promise<ModelGovernanceView> {
  if (import.meta.env.VITE_AGENT_MODE !== 'real') throw new Error('Real model governance API is disabled');
  return apiRequest<ModelGovernanceView>('/api/admin/model-governance');
}

export async function updateModelProviderStatus(provider: ModelGovernanceProvider, status: string) {
  const action = 'model.provider.status.update';
  const target = provider.provider_code;
  const digest = await confirmationDigest(action, target, status, provider.revision);
  return modelGovernanceWrite<ModelGovernanceMutation>(
    `/api/admin/model-governance/providers/${encodeURIComponent(provider.provider_code)}/status`,
    'PATCH',
    { status, revision: provider.revision, confirmed: true, confirmationDigest: digest },
    'model-provider-status',
  );
}

export async function updateModelCatalogStatus(model: ModelGovernanceModel, status: string) {
  const action = 'model.catalog.status.update';
  const target = String(model.model_id);
  const digest = await confirmationDigest(action, target, status, model.revision);
  return modelGovernanceWrite<ModelGovernanceMutation>(
    `/api/admin/model-governance/models/${encodeURIComponent(model.model_id)}/status`,
    'PATCH',
    { status, revision: model.revision, confirmed: true, confirmationDigest: digest },
    'model-catalog-status',
  );
}

export async function updateModelRoute(route: ModelGovernanceRoute, status: string) {
  const action = 'model.route.update';
  const target = String(route.route_id);
  const digest = await confirmationDigest(action, target, route.route_version, route.revision);
  return modelGovernanceWrite<ModelGovernanceMutation>(
    `/api/admin/model-governance/routes/${encodeURIComponent(route.route_id)}`,
    'PUT',
    {
      providerCode: route.provider_code,
      modelName: route.model_name,
      fallbackProviderCode: route.fallback_provider_code,
      fallbackModelName: route.fallback_model_name,
      priority: route.priority,
      routeVersion: route.route_version,
      priceVersion: route.price_version,
      budgetPolicyVersion: route.budget_policy_version,
      maxCost: route.max_cost,
      maxLatencyMs: route.max_latency_ms,
      status,
      revision: route.revision,
      confirmed: true,
      confirmationDigest: digest,
    },
    'model-route-update',
  );
}

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

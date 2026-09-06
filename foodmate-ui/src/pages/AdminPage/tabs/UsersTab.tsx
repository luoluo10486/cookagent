import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarDays,
  CircleX,
  CircleUserRound,
  Copy,
  History,
  MoreHorizontal,
  Monitor,
  Search,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type TableColumnProps } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import styles from '../AdminPage.module.css';
import { AdminOnlyNotice } from './AdminComponents';
import {
  type UserBusinessSessionRow,
  type UserOperationHistoryRow,
  type UserRow,
  adminUserBusinessSessionRows,
  adminUserOperationHistoryRows,
  adminUserSessionRows,
  canAccessAdmin,
  canManage,
  sessionColumns,
  statusTag,
} from './AdminShared';
import type { AdminActionPayload } from './types';
import {
  loadAdminUserDetail,
  loadAdminUsers,
  revokeAdminUserSessions,
  type AdminUserDetail,
  updateAdminUserStatus,
} from '../../../services/adminService';
import { FIGMA_ADMIN_AVATARS, resolveAvatarUrl } from '../../../lib/avatar';

const isMockMode = import.meta.env.VITE_AGENT_MODE !== 'real';

type AdminUserView = UserRow & {
  activeSessions?: number;
  customModel?: string;
  registeredLabel?: string;
  revision?: number;
};

// This fixture mirrors Figma node 801:215. Real mode continues to use the API response unchanged.
const figmaUserRows: AdminUserView[] = [
  {
    key: 'figma-user-098a1',
    userId: 'usr_098a1',
    username: 'anddy_lab',
    email: 'anddy@lab.io',
    displayName: 'Anddy 实验室',
    role: 'admin',
    status: 'active',
    avatarUrl: FIGMA_ADMIN_AVATARS.userDetail,
    phone: '-',
    gender: '男',
    heightCm: 0,
    weightKg: 0,
    activityLevel: '-',
    dietGoal: '生酮 - 高蛋白',
    calorieTarget: 0,
    proteinTarget: 0,
    allergens: '-',
    dislikes: '-',
    preferredUnits: '公制',
    loginFailedCount: 0,
    lockedUntil: '-',
    lastLoginAt: 'Today, 10:24 AM',
    createdAt: 'Mar 14, 2024',
    activeSessions: 3,
    customModel: 'KetoMealFormer_v4',
    registeredLabel: 'Registered Mar 14, 2024',
  },
  {
    key: 'figma-user-112b9',
    userId: 'usr_112b9',
    username: 'sarah_chen',
    email: 'sarah@chen.me',
    displayName: 'Sarah Chen',
    role: 'operator',
    status: 'active',
    avatarUrl: '',
    phone: '-',
    gender: '-',
    heightCm: 0,
    weightKg: 0,
    activityLevel: '-',
    dietGoal: '-',
    calorieTarget: 0,
    proteinTarget: 0,
    allergens: '-',
    dislikes: '-',
    preferredUnits: '公制',
    loginFailedCount: 0,
    lockedUntil: '-',
    lastLoginAt: '-',
    createdAt: '-',
    activeSessions: 1,
  },
  {
    key: 'figma-user-774x2',
    userId: 'usr_774x2',
    username: 'kyle_smith',
    email: 'kyle@smith.com',
    displayName: 'Kyle Smith',
    role: 'user',
    status: 'disabled',
    avatarUrl: '',
    phone: '-',
    gender: '-',
    heightCm: 0,
    weightKg: 0,
    activityLevel: '-',
    dietGoal: '-',
    calorieTarget: 0,
    proteinTarget: 0,
    allergens: '-',
    dislikes: '-',
    preferredUnits: '公制',
    loginFailedCount: 0,
    lockedUntil: '-',
    lastLoginAt: '-',
    createdAt: '-',
    activeSessions: 0,
  },
  {
    key: 'figma-user-889d4',
    userId: 'usr_889d4',
    username: 'malicious_bot',
    email: 'bot@spam.xyz',
    displayName: 'Malicious Bot',
    role: 'user',
    status: 'locked',
    avatarUrl: '',
    phone: '-',
    gender: '-',
    heightCm: 0,
    weightKg: 0,
    activityLevel: '-',
    dietGoal: '-',
    calorieTarget: 0,
    proteinTarget: 0,
    allergens: '-',
    dislikes: '-',
    preferredUnits: '公制',
    loginFailedCount: 0,
    lockedUntil: '-',
    lastLoginAt: '-',
    createdAt: '-',
    activeSessions: 0,
  },
];

const businessSessionColumns: TableColumnProps<UserBusinessSessionRow>[] = [
  { title: '会话 ID', dataIndex: 'sessionId' },
  { title: '类型', dataIndex: 'type' },
  { title: '标题', dataIndex: 'title' },
  { title: '状态', dataIndex: 'status', render: (_, record) => statusTag(record.status) },
  { title: '最近活动', dataIndex: 'lastActivityAt' },
];

const operationHistoryColumns: TableColumnProps<UserOperationHistoryRow>[] = [
  { title: '动作', dataIndex: 'action' },
  { title: '操作者', dataIndex: 'actor' },
  { title: '结果', dataIndex: 'result', render: (_, record) => statusTag(record.result) },
  { title: 'request_id', dataIndex: 'requestId' },
  { title: '时间', dataIndex: 'createdAt' },
];

export function UsersSection({ onAction }: { onAction: (payload: AdminActionPayload) => void }) {
  const [selectedUser, setSelectedUser] = useState<AdminUserView | undefined>(
    isMockMode ? figmaUserRows[0] : undefined,
  );
  const [users, setUsers] = useState<AdminUserView[]>(isMockMode ? figmaUserRows : []);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [filtersChanged, setFiltersChanged] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<AdminUserDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    if (isMockMode) return;
    loadAdminUsers()
      .then((items) => {
        setUsers(items as AdminUserView[]);
        setSelectedUser(items[0] as AdminUserView | undefined);
      })
      .catch((error) => {
        setUsers([]);
        setSelectedUser(undefined);
        setLoadError(error instanceof Error ? error.message : '用户列表加载失败');
      });
  }, []);

  useEffect(() => {
    if (isMockMode || !selectedUser) return;
    let active = true;
    // 详情单独加载，避免用户列表接口被迫携带会话和审计明细。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailLoading(true);
    setDetailError('');
    setSelectedDetail(undefined);
    loadAdminUserDetail(selectedUser.userId)
      .then((detail) => {
        if (active) setSelectedDetail(detail);
      })
      .catch((error) => {
        if (active) setDetailError(error instanceof Error ? error.message : '用户详情加载失败');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedUser?.userId]);

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !normalizedQuery || [user.userId, user.username, user.email].join(' ').toLowerCase().includes(normalizedQuery);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = !filtersChanged || statusFilter === 'all' || user.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [filtersChanged, query, roleFilter, statusFilter, users]);

  if (!canAccessAdmin) return <AdminOnlyNotice title="无权访问用户管理" />;

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setFiltersChanged(true);
  };

  const requestUserStatus = (record: AdminUserView, action: string, status: string) => {
    onAction({
      action,
      targetLabel: record.userId,
      targetType: 'user',
      targetId: record.userId,
      execute: async () => {
        await updateAdminUserStatus(record.userId, status, record.revision ?? 1);
      },
      onApply: () => {
        setUsers((current) =>
          current.map((user) =>
            user.userId === record.userId
              ? { ...user, status, lockedUntil: status === 'locked' ? '2026-06-30 23:59' : '-' }
              : user,
          ),
        );
      },
    });
  };

  const revokeSessions = (record: AdminUserView) => {
    onAction({
      action: '撤销所有会话',
      targetLabel: record.userId,
      targetType: 'user_session',
      targetId: record.userId,
      execute: async () => {
        await revokeAdminUserSessions(record.userId, record.revision ?? 1);
      },
      onApply: () => {
        adminUserSessionRows
          .filter((session) => session.userId === record.userId)
          .forEach((session) => {
            session.status = 'revoked';
          });
      },
    });
  };

  return (
    <section className={`${styles.usersLayout} ${isMockMode ? styles.usersLayoutFigma : ''}`}>
      <div className={styles.usersListColumn}>
        <div className={styles.usersFilters}>
          <label className={styles.usersSearch}>
            <Search aria-hidden="true" />
            <Input
              className={styles.usersSearchInput}
              aria-label="搜索用户名、ID或邮箱"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索用户名、ID或邮箱..."
            />
          </label>
          <FilterSelect
            ariaLabel="角色筛选"
            value={roleFilter}
            onChange={(value) => updateFilter(setRoleFilter, value)}
            options={[
              ['all', '角色：全部'],
              ['admin', '角色：管理员'],
              ['operator', '角色：操作员'],
              ['user', '角色：用户'],
            ]}
          />
          <FilterSelect
            ariaLabel="状态筛选"
            value={statusFilter}
            onChange={(value) => updateFilter(setStatusFilter, value)}
            options={[
              ['active', '状态：活跃'],
              ['all', '状态：全部'],
              ['disabled', '状态：已禁用'],
              ['locked', '状态：已锁定'],
            ]}
          />
          <Button
            variant="outline"
            className={styles.usersDateFilter}
            type="button"
            aria-label="注册时间筛选"
            onClick={() => setFiltersChanged(true)}
          >
            <span>Registered: Last 30 Days</span>
            <CalendarDays aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            className={styles.usersResetFilter}
            type="button"
            onClick={() => {
              setQuery('');
              setRoleFilter('all');
              setStatusFilter('active');
              setFiltersChanged(false);
            }}
          >
            重置筛选
          </Button>
        </div>

        {loadError ? <Badge variant="destructive">{loadError}</Badge> : null}
        {!canManage ? (
          <div className={styles.readOnlyNotice} role="status">
            <ShieldCheck aria-hidden="true" />
            <span>当前为 operator，只能查看用户详情，状态和会话操作已禁用。</span>
          </div>
        ) : null}

        <div className={styles.usersTable} role="table" aria-label="用户列表">
          <div className={styles.usersTableHeader} role="row">
            <span role="columnheader">用户 ID</span>
            <span role="columnheader">用户名</span>
            <span role="columnheader">邮箱</span>
            <span role="columnheader">角色</span>
            <span role="columnheader">状态</span>
            <span role="columnheader">活跃会话</span>
            <span role="columnheader">操作</span>
          </div>
          {visibleUsers.map((user, index) => (
            <UserTableRow
              key={user.key}
              user={user}
              index={index}
              isSelected={selectedUser?.userId === user.userId}
              canWrite={canManage && user.role !== 'admin'}
              onSelect={() => setSelectedUser(user)}
              onStatus={(status, action) => requestUserStatus(user, action, status)}
              onRevoke={() => revokeSessions(user)}
            />
          ))}
          {!visibleUsers.length ? <div className={styles.usersTableEmpty}>暂无匹配用户</div> : null}
        </div>

        <div className={styles.usersPagination}>
          <span>Showing 1-{visibleUsers.length} of 1,284 users</span>
          <div>
            <Button variant="outline" size="sm" type="button" disabled aria-label="上一页">
              上一页
            </Button>
            <Button variant="outline" size="sm" className={styles.usersPageActive} type="button" aria-current="page">
              1
            </Button>
            <Button variant="outline" size="sm" type="button">
              2
            </Button>
            <Button variant="outline" size="sm" type="button">
              下一页
            </Button>
          </div>
        </div>
      </div>

      <aside className={styles.usersDetailColumn}>
        {selectedUser ? (
          <UserDetailCard
            user={selectedUser}
            detail={selectedDetail}
            detailLoading={detailLoading}
            detailError={detailError}
            onRevoke={() => revokeSessions(selectedUser)}
          />
        ) : (
          <Card className={styles.userDetailCard}>
            <div className={styles.emptyState}>
              <CircleUserRound aria-hidden="true" />
              <strong>暂无用户详情</strong>
              <span>{isMockMode ? '请选择用户查看详情。' : '详情接口尚未返回数据。'}</span>
            </div>
          </Card>
        )}
      </aside>
    </section>
  );
}

function FilterSelect({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={styles.usersSelect} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, label]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UserTableRow({
  user,
  index,
  isSelected,
  canWrite,
  onSelect,
  onStatus,
  onRevoke,
}: {
  user: AdminUserView;
  index: number;
  isSelected: boolean;
  canWrite: boolean;
  onSelect: () => void;
  onStatus: (status: string, action: string) => void;
  onRevoke: () => void;
}) {
  const statusAction = user.status === 'active' ? 'locked' : 'active';
  const statusActionLabel = user.status === 'active' ? '锁定用户' : '启用用户';
  return (
    <div
      className={`${styles.usersTableRow} ${index === 3 ? styles.usersTableRowMuted : ''} ${isSelected ? styles.usersTableRowSelected : ''}`}
      role="row"
      aria-label={`${user.userId} ${user.username}`}
      onClick={onSelect}
    >
      <div className={styles.userIdCell} role="cell">
        <code>{user.userId}</code>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={`复制 ${user.userId}`}
          onClick={(event) => {
            event.stopPropagation();
            void navigator.clipboard?.writeText(user.userId);
          }}
        >
          <Copy aria-hidden="true" />
        </Button>
      </div>
      <strong role="cell">{user.username}</strong>
      <span className={styles.userEmailCell} role="cell">
        {user.email}
      </span>
      <span role="cell" className={styles.userTagCell}>
        <UserRoleTag role={user.role} />
      </span>
      <span role="cell" className={styles.userTagCell}>
        <UserStatusTag status={user.status} />
      </span>
      <span role="cell" className={styles.activeSessionsCell}>
        {user.activeSessions == null ? '-' : `${user.activeSessions} active`}
      </span>
      <div role="cell" className={styles.userRowMenu} onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" type="button" aria-label={`${user.userId} 操作`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.userActionMenu}>
            <DropdownMenuItem onSelect={onSelect}>查看详情</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canWrite} onSelect={() => onStatus(statusAction, statusActionLabel)}>
              {statusActionLabel}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canWrite} onSelect={onRevoke}>
              撤销所有会话
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function UserRoleTag({ role }: { role: string }) {
  const label = role === 'admin' ? '管理员' : role === 'operator' ? '操作员' : '用户';
  return <span className={`${styles.userStatusTag} ${styles[`userRole${role}`]}`}>{label}</span>;
}

function UserStatusTag({ status }: { status: string }) {
  const label =
    status === 'active' ? '活跃' : status === 'disabled' ? '已禁用' : status === 'locked' ? '已锁定' : status;
  return <span className={`${styles.userStatusTag} ${styles[`userStatus${status}`]}`}>{label}</span>;
}

function UserDetailCard({
  user,
  detail,
  detailLoading,
  detailError,
  onRevoke,
}: {
  user: AdminUserView;
  detail?: AdminUserDetail;
  detailLoading: boolean;
  detailError: string;
  onRevoke: () => void;
}) {
  const profile = detail?.profile;
  const sessions = isMockMode
    ? adminUserSessionRows.filter((item) => item.userId === user.userId)
    : (detail?.login_sessions ?? []).map((item) => ({
        key: `session-${item.auth_session_id}`,
        userId: user.userId,
        device: item.user_agent || item.device_id || '-',
        ip: item.ip_address || '-',
        expiresAt: item.expires_at || '-',
        status: item.revoked_at ? 'revoked' : 'active',
      }));
  const businessSessions = isMockMode
    ? adminUserBusinessSessionRows.filter((item) => item.userId === user.userId)
    : (detail?.business_sessions.items ?? []).map((item) => ({
        key: `business-session-${item.session_id}`,
        userId: user.userId,
        sessionId: String(item.session_id),
        type: item.mode,
        title: item.title,
        status: item.status,
        lastActivityAt: item.last_message_at || '-',
      }));
  const operationHistory = isMockMode
    ? adminUserOperationHistoryRows.filter((item) => item.userId === user.userId)
    : (detail?.operation_history.items ?? []).map((item, index) => ({
        key: `user-history-${item.request_id || index}`,
        userId: user.userId,
        action: item.action,
        actor: item.operator_id == null ? '-' : String(item.operator_id),
        result: item.result,
        requestId: item.request_id,
        createdAt: item.created_at || '-',
      }));
  const displayName = profile?.display_name || user.displayName;
  const initials = displayName.slice(0, 1) || user.username.slice(0, 1).toUpperCase();
  const avatarSource = resolveAvatarUrl(user.avatarUrl, profile?.gender || user.gender);

  return (
    <Card className={styles.userDetailCard}>
      <div className={styles.userDetailTitle}>
        <strong>用户详情</strong>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label="关闭用户详情"
          data-figma-asset="admin-user-detail-close"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('foodmate:admin-notice', { detail: { message: '详情面板保持打开以便对照用户信息。' } }),
            )
          }
        >
          <CircleX aria-hidden="true" />
        </Button>
      </div>
      <div className={styles.userDetailIdentity}>
        <div className={styles.userDetailAvatar} aria-hidden="true">
          {avatarSource ? <img src={avatarSource} alt="" /> : initials}
        </div>
        <div className={styles.userDetailName}>
          <strong>{displayName}</strong>
          <span>{user.registeredLabel ?? `Registered ${user.createdAt}`}</span>
        </div>
        <UserRoleTag role={user.role} />
      </div>
      <Tabs defaultValue="profile" className={styles.userDetailTabsRoot}>
        <TabsList className={styles.userDetailTabsList} aria-label="用户详情分区">
          <TabsTrigger value="profile">资料</TabsTrigger>
          <TabsTrigger value="diet">饮食</TabsTrigger>
          <TabsTrigger value="login-sessions">登录会话</TabsTrigger>
          <TabsTrigger value="history">历史</TabsTrigger>
          <TabsTrigger value="business-sessions">业务会话</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className={styles.userDetailPanel}>
          <DetailGrid
            items={[
              ['账号 ID', user.userId],
              ['最近登录', user.lastLoginAt],
              ['饮食类型', user.dietGoal],
              ['自定义模型', user.customModel ?? '-'],
            ]}
          />
        </TabsContent>
        <TabsContent value="diet" className={styles.userDetailPanel}>
          <DetailSectionHeading icon={<Utensils aria-hidden="true" />} title="饮食画像" />
          <DetailGrid
            items={[
              ['性别', profile?.gender || user.gender],
              ['身高', profile?.height_cm ? `${profile.height_cm} cm` : user.heightCm ? `${user.heightCm} cm` : '-'],
              ['体重', profile?.weight_kg ? `${profile.weight_kg} kg` : user.weightKg ? `${user.weightKg} kg` : '-'],
              ['活动水平', profile?.activity_level || user.activityLevel],
              ['饮食目标', profile?.diet_goal || user.dietGoal],
              [
                '热量目标',
                profile?.calorie_target ? `${profile.calorie_target} kcal` : user.calorieTarget ? `${user.calorieTarget} kcal` : '-',
              ],
              [
                '蛋白质目标',
                profile?.protein_target ? `${profile.protein_target} g` : user.proteinTarget ? `${user.proteinTarget} g` : '-',
              ],
              ['过敏原', profile?.allergens || user.allergens],
              ['忌口', profile?.dislikes || user.dislikes],
              ['常用单位', profile?.preferred_units || user.preferredUnits],
            ]}
          />
        </TabsContent>
        <TabsContent value="login-sessions" className={styles.userDetailPanel}>
          <DetailSectionHeading icon={<Monitor aria-hidden="true" />} title="登录会话" />
          <DetailTableState
            isMockMode={isMockMode}
            loading={detailLoading}
            error={detailError}
            hasData={sessions.length > 0}
          >
            <DataTable columns={sessionColumns} data={sessions} />
          </DetailTableState>
        </TabsContent>
        <TabsContent value="history" className={styles.userDetailPanel}>
          <DetailSectionHeading icon={<History aria-hidden="true" />} title="操作历史" />
          <DetailTableState
            isMockMode={isMockMode}
            loading={detailLoading}
            error={detailError}
            hasData={operationHistory.length > 0}
          >
            <DataTable columns={operationHistoryColumns} data={operationHistory} />
          </DetailTableState>
        </TabsContent>
        <TabsContent value="business-sessions" className={styles.userDetailPanel}>
          <DetailSectionHeading icon={<Utensils aria-hidden="true" />} title="业务会话" />
          <DetailTableState
            isMockMode={isMockMode}
            loading={detailLoading}
            error={detailError}
            hasData={businessSessions.length > 0}
          >
            <DataTable columns={businessSessionColumns} data={businessSessions} />
          </DetailTableState>
        </TabsContent>
      </Tabs>
      <div className={styles.userDetailActions}>
        <Button
          variant="outline"
          className={styles.userCredentialButton}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('foodmate:admin-notice', {
                detail: { message: '重置凭证接口尚未接入，未执行任何操作。' },
              }),
            )
          }
        >
          重置凭证
        </Button>
        <Button variant="outline" className={styles.userRevokeButton} disabled={!canManage} onClick={onRevoke}>
          撤销所有会话
        </Button>
      </div>
      <aside className={styles.userDetailGuidance} aria-label="用户详情 Tab">
        <h2>用户详情 Tab</h2>
        <p>资料 · 饮食画像 · 登录会话 · 业务会话 · 操作历史</p>
        <p>资料字段：注册时间 · 最近登录 · 账号状态 · 角色 · 活跃会话数</p>
        <p className={styles.userDetailGuidanceDanger}>
          禁用 / 锁定前显示影响：撤销会话、停止新运行、保留审计记录；admin 需二次确认。
        </p>
        <p className={styles.userDetailGuidanceMuted}>operator：只读；无启用、禁用、锁定和撤销全部会话权限。</p>
      </aside>
    </Card>
  );
}

function DetailSectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className={styles.detailSectionHeading}>
      {icon}
      <strong>{title}</strong>
    </div>
  );
}

function DetailGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className={styles.detailGrid}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailTableState({
  isMockMode: mockMode,
  loading,
  error,
  hasData,
  children,
}: {
  isMockMode: boolean;
  loading: boolean;
  error: string;
  hasData: boolean;
  children: ReactNode;
}) {
  if (hasData) return children;
  if (loading) return <div className={styles.detailEmptyState}>正在加载详情...</div>;
  if (error) return <div className={styles.detailEmptyState}>{error}</div>;
  return (
    <div className={styles.detailEmptyState} role="status">
      <span>{mockMode ? '暂无记录' : '暂无记录'}</span>
    </div>
  );
}

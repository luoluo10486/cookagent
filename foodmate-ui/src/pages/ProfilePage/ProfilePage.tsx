import {
  Check,
  CircleAlert,
  CircleCheck,
  Download,
  Edit3,
  Eye,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { WorkspaceLayout } from '@/layouts/WorkspaceLayout/WorkspaceLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FigmaWorkspaceAsset } from '@/components/workspace/FigmaWorkspaceAsset';
import { AvatarImage } from '@/components/common/AvatarImage';
import { cn } from '@/lib/utils';
import { FIGMA_PROFILE_AVATARS, resolveAvatarUrl } from '@/lib/avatar';
import { getAuthUser, logout } from '@/services/authService';
import {
  changePassword,
  deleteAvatar,
  downloadDataExport,
  getAuthSessions,
  getDataExport,
  getProfile,
  requestAccountDeletion,
  requestDataExport,
  revokeAllAuthSessions,
  revokeAuthSession,
  updateProfile,
  uploadAvatar,
} from '@/services/accountService';
import type { AuthSession, Profile, ProfileUpdateRequest } from '@/services/accountService';
import type { AuthUser } from '@/mock/auth';
import type { SessionSummary } from '@/types/session';
import { confirmMemory, deleteMemory, loadMemories, updateMemory, type MemoryRecord } from '@/services/memoryService';
import styles from './ProfilePage.module.css';

type ProfileTab = 'basic' | 'memories' | 'security' | 'privacy';
type AsyncState = 'idle' | 'submitting' | 'success' | 'failed';
type ExportStatus = 'queued' | 'running' | 'completed' | 'failed' | 'expired';

type ProfileForm = {
  displayName: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  dietGoal: string;
  calorieTarget: string;
  proteinTarget: string;
  allergens: string[];
  dislikes: string[];
};

type Memory = {
  id: number;
  category: string;
  scope?: string;
  source: string;
  relativeTime: string;
  content: string;
  status: 'confirmed' | 'pending' | 'conflict';
};

const memoryTypeLabels: Record<string, string> = {
  preference: '偏好',
  constraint: '限制',
  routine: '膳食模式',
  plan: '计划',
  meal_plan: '计划',
  recipe_plan: '计划',
  weekly_recipe: '计划',
  allergy: '过敏原',
  goal: '目标',
  unit: '单位',
  meal_type: '常用餐型',
  temporary: '临时记忆',
  session_context: '会话上下文',
};

function memoryTypeLabel(type: string): string {
  return memoryTypeLabels[type] ?? (type || '未分类');
}

function memoryTone(category: string): 'red' | 'blue' | 'neutral' {
  if (category === '限制' || category === '过敏原') return 'red';
  if (category === '膳食模式' || category === '计划') return 'blue';
  return 'neutral';
}

function memoryRelativeTime(value?: string): string {
  if (!value) return '未知时间';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return '刚刚更新';
  if (minutes < 60) return `${minutes} 分钟前更新`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前更新`;
  if (minutes < 2880) return '昨日更新';
  return `${Math.floor(minutes / 1440)} 天前更新`;
}

type ExportRow = {
  id: string;
  date: string;
  status: ExportStatus;
  size: string;
  jobId?: number;
};

const memorySeed: Memory[] = [
  {
    id: 1,
    category: '偏好',
    source: '在每周饮食微调中识别',
    relativeTime: '昨日记录',
    content: 'Prefers wild caught salmon over farmed salmon varieties due to texture profile and higher omega density.',
    status: 'confirmed',
  },
  {
    id: 2,
    category: '限制',
    source: '在训练前零食建议中识别',
    relativeTime: 'Identified 3 hours ago',
    content: 'Attempts to avoid soy protein isolates. Expressed interest in pea or brown rice protein sources instead.',
    status: 'pending',
  },
  {
    id: 3,
    category: '膳食模式',
    source: '在每周饮食微调中识别',
    relativeTime: 'Logged 2 days ago',
    content: 'Consistently targets 80g carbohydrates limit for evening meals to maintain steady insulin recovery.',
    status: 'confirmed',
  },
];

const exportSeed: ExportRow[] = [
  { id: 'export-1', date: '2024年3月14日', status: 'completed', size: '142 MB' },
  { id: 'export-2', date: '2024年2月28日', status: 'failed', size: '0 KB' },
];

const figmaProfileUser: AuthUser = {
  id: '1234567',
  username: 'anddy_operator_9',
  displayName: 'Anddy',
  avatarUrl: '',
  role: 'operator',
  status: 'active',
  email: 'anddy@foodmate.io',
  gender: '男',
  lastLoginAt: '今天 09:42',
  profile: {
    heightCm: 180,
    weightKg: 78,
    activityLevel: 'Moderately Active (3-5d/wk)',
    dietGoal: '精益增肌',
    proteinMultiplierRange: [1.5, 2],
    proteinTargetRange: [110, 150],
    calorieTarget: 2500,
    proteinTarget: 150,
    preference: '三餐 + 加餐',
    allergens: ['花生', '乳糖'],
    dislikes: [],
    preferredUnits: { weight: 'g', energy: 'kcal' },
  },
  permissions: [],
  security: {
    tokenStrategy: 'Access Token + HttpOnly Refresh Cookie',
    accessTokenTtl: '15-30 分钟',
    refreshTokenMode: '7-30 天，可撤销',
  },
};

const activityOptions = ['Low Activity', 'Moderately Active (3-5d/wk)', 'Highly Active (6-7d/wk)'];

function normalizeActivityLevel(value?: string): string {
  const normalized = value?.trim();
  if (!normalized) return activityOptions[1];
  if (activityOptions.includes(normalized)) return normalized;

  const aliases: Record<string, string> = {
    低活动: activityOptions[0],
    轻度活动: activityOptions[0],
    少量活动: activityOptions[0],
    中等活动: activityOptions[1],
    适度活动: activityOptions[1],
    高活动: activityOptions[2],
    高度活动: activityOptions[2],
  };
  return aliases[normalized] ?? activityOptions[1];
}

function getTab(pathname: string): ProfileTab {
  if (pathname.endsWith('/memories')) return 'memories';
  if (pathname.endsWith('/security')) return 'security';
  if (pathname.endsWith('/data')) return 'privacy';
  return 'basic';
}

type ProfileFixtureState =
  | 'basic-avatar-uploading'
  | 'basic-avatar-failed'
  | 'basic-unsaved-leave-confirmation'
  | 'security-password-submitting'
  | 'security-password-success'
  | 'security-password-failed'
  | 'privacy-export-queued'
  | 'privacy-export-running'
  | 'privacy-export-expired'
  | 'privacy-deletion-submitting'
  | 'privacy-deletion-success'
  | 'privacy-deletion-failed'
  | 'memories-empty'
  | 'security-logout-confirm'
  | 'privacy-delete-confirm';

type ProfileBaseFigmaState = 'basic' | 'memories' | 'security' | 'privacy';

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

function getProfileBaseFigmaState(value: string | null): ProfileBaseFigmaState | undefined {
  return value === 'basic' || value === 'memories' || value === 'security' || value === 'privacy' ? value : undefined;
}

function getProfileFixtureState(value: string | null): ProfileFixtureState | undefined {
  const states: ProfileFixtureState[] = [
    'basic-avatar-uploading',
    'basic-avatar-failed',
    'basic-unsaved-leave-confirmation',
    'security-password-submitting',
    'security-password-success',
    'security-password-failed',
    'privacy-export-queued',
    'privacy-export-running',
    'privacy-export-expired',
    'privacy-deletion-submitting',
    'privacy-deletion-success',
    'privacy-deletion-failed',
    'memories-empty',
    'security-logout-confirm',
    'privacy-delete-confirm',
  ];
  return value && states.includes(value as ProfileFixtureState) ? (value as ProfileFixtureState) : undefined;
}

function ProfileFixtureOverlay({ state, onDismiss }: { state: ProfileFixtureState; onDismiss: () => void }) {
  const isError = state.includes('failed');
  const isSuccess = state.includes('success');
  const title =
    state === 'basic-avatar-uploading'
      ? '正在上传头像'
      : state === 'basic-avatar-failed'
        ? '头像上传失败'
        : state === 'basic-unsaved-leave-confirmation'
          ? '放弃未保存的修改？'
          : state === 'security-password-submitting'
            ? '正在更新密码'
            : state === 'security-password-success'
              ? '密码已更新'
              : state === 'security-password-failed'
                ? '密码更新失败'
                : state === 'privacy-export-queued'
                  ? '数据导出已排队'
                  : state === 'privacy-export-running'
                    ? '正在生成数据导出'
                    : state === 'privacy-export-expired'
                      ? '导出文件已过期'
                      : state === 'privacy-deletion-submitting'
                        ? '正在注销账号'
                        : state === 'privacy-deletion-success'
                          ? '账号已注销'
                          : state === 'privacy-deletion-failed'
                            ? '账号注销失败'
                            : state === 'security-logout-confirm'
                              ? '退出其他设备？'
                              : '确认注销 FoodMate 账号';
  const detail =
    state === 'basic-avatar-uploading'
      ? '正在校验格式并上传，请保持当前页面打开。上传进度 68% · JPG · 2.4 MB'
      : state === 'basic-avatar-failed'
        ? '头像上传失败，请使用 JPG、PNG 或 WEBP，且文件不超过 2MB。'
        : state === 'basic-unsaved-leave-confirmation'
          ? '头像、饮食偏好等资料有未保存内容。离开后这些修改将丢失。'
          : state === 'security-password-submitting'
            ? '正在校验当前密码并撤销旧会话，请不要重复提交。'
            : state === 'security-password-success'
              ? '新密码已生效，其他设备的会话已按安全策略处理。完成 · request_id: req_pwd_42ac'
              : state === 'security-password-failed'
                ? '当前密码不正确或服务暂不可用，请重新填写。错误码：PASSWORD_UPDATE_FAILED · request_id: req_pwd_8d10'
                : state === 'privacy-export-queued'
                  ? '任务已创建，后台整理完成后提供一次性下载。状态: queued · 预计等待 1-2 分钟 · export_id: exp_20260731_01'
                  : state === 'privacy-export-running'
                    ? '正在脱敏并打包数据，完成后会显示一次性下载入口。状态: running · 已处理 68% · export_id: exp_20260731_01'
                    : state === 'privacy-export-expired'
                      ? '下载链接已过期，请重新创建导出任务。状态：expired · export_id: exp_20260729_18'
                      : state === 'privacy-deletion-submitting'
                        ? '正在禁用账号并撤销会话，后台清理已排队。提交中 · request_id: req_delete_91ba'
                        : state === 'privacy-deletion-success'
                          ? '账号已禁用，全部会话已撤销，后台清理任务已创建。完成 · request_id: req_delete_91ba'
                          : state === 'privacy-deletion-failed'
                            ? '清理任务失败，账号状态保持不变，请重新创建。错误码：ACCOUNT_DELETION_FAILED · request_id: req_delete_b721'
                            : state === 'security-logout-confirm'
                              ? '这将退出除当前设备以外的 2 个活跃会话。当前设备会保留登录状态，最近的运行和审计记录不会被删除。'
                              : '确认后账号会立即禁用，全部登录会话将被撤销，并开始后台清理个人资料、饮食记录、记忆和知识库数据。';
  const progress =
    state === 'basic-avatar-uploading' ||
    state === 'security-password-submitting' ||
    state === 'privacy-export-running';
  const isLogoutConfirmation = state === 'security-logout-confirm';
  const isDeleteConfirmation = state === 'privacy-delete-confirm';
  const isExportQueued = state === 'privacy-export-queued';
  const isExportRunning = state === 'privacy-export-running';
  const isExportExpired = state === 'privacy-export-expired';
  const isDeletionSubmitting = state === 'privacy-deletion-submitting';
  const isDeletionSuccess = state === 'privacy-deletion-success';
  const isDeletionFailed = state === 'privacy-deletion-failed';
  const isUnsavedConfirmation = state === 'basic-unsaved-leave-confirmation';
  return (
    <div
      className={cn(
        styles.fixtureOverlay,
        isUnsavedConfirmation ? styles.fixtureOverlayUnsaved : undefined,
        isSuccess ? styles.fixtureOverlaySuccess : undefined,
        isLogoutConfirmation ? styles.fixtureOverlayLogout : undefined,
        isDeleteConfirmation ? styles.fixtureOverlayDelete : undefined,
        isExportQueued ? styles.fixtureOverlayExportQueued : undefined,
        isExportRunning ? styles.fixtureOverlayExportRunning : undefined,
        isExportExpired ? styles.fixtureOverlayExportExpired : undefined,
        isDeletionSubmitting ? styles.fixtureOverlayDeletionSubmitting : undefined,
        isDeletionFailed ? styles.fixtureOverlayDeletionFailed : undefined,
      )}
      role="presentation"
    >
      <section
        className={cn(
          styles.fixtureModal,
          isUnsavedConfirmation ? styles.fixtureModalUnsaved : undefined,
          isError ? styles.fixtureModalError : undefined,
          isLogoutConfirmation ? styles.fixtureModalLogout : undefined,
          isDeleteConfirmation ? styles.fixtureModalDelete : undefined,
          isExportQueued ? styles.fixtureModalExportQueued : undefined,
          isExportRunning ? styles.fixtureModalExportRunning : undefined,
          isExportExpired ? styles.fixtureModalExportExpired : undefined,
          isDeletionSubmitting ? styles.fixtureModalDeletionSubmitting : undefined,
          isDeletionSuccess ? styles.fixtureModalDeletionSuccess : undefined,
          isDeletionFailed ? styles.fixtureModalDeletionFailed : undefined,
        )}
        role="alert"
        aria-live="polite"
        data-figma-modal={isUnsavedConfirmation ? 'profile-basic-unsaved-leave-confirmation' : undefined}
      >
        {isExportRunning ? (
          <>
            <span className={styles.fixtureExportRunningAccent} aria-hidden="true" />
            <h2 className={styles.fixtureExportRunningTitle}>{title}</h2>
            <p className={styles.fixtureExportRunningDetail}>正在脱敏并打包数据，完成后会显示一次性下载入口。</p>
            <p className={styles.fixtureExportRunningStatus}>状态: running · 已处理 68% · export_id: exp_20260731_01</p>
            <span className={styles.fixtureExportRunningProgress} aria-label="数据导出进度 68%">
              <i />
            </span>
            <Button className={styles.fixtureExportQueuedClose} variant="ghost" aria-label="关闭" onClick={onDismiss}>
              <X aria-hidden="true" />
            </Button>
          </>
        ) : isExportQueued ? (
          <>
            <span className={styles.fixtureExportQueuedAccent} aria-hidden="true" />
            <h2 className={styles.fixtureExportQueuedTitle}>{title}</h2>
            <p className={styles.fixtureExportQueuedDetail}>任务已创建，后台整理完成后提供一次性下载。</p>
            <p className={styles.fixtureExportQueuedStatus}>
              状态: queued · 预计等待 1-2 分钟 · export_id: exp_20260731_01
            </p>
            <Button className={styles.fixtureExportQueuedClose} variant="ghost" aria-label="关闭" onClick={onDismiss}>
              <X aria-hidden="true" />
            </Button>
          </>
        ) : isExportExpired ? (
          <>
            <span className={styles.fixtureExportExpiredAccent} aria-hidden="true" />
            <h2 className={styles.fixtureExportExpiredTitle}>{title}</h2>
            <p className={styles.fixtureExportExpiredDetail}>下载链接已过期，请重新创建导出任务。</p>
            <p className={styles.fixtureExportExpiredStatus}>状态: expired · export_id: exp_20260729_18</p>
            <Button className={styles.fixtureExportExpiredAction} variant="ghost" onClick={onDismiss}>
              重新创建导出
            </Button>
            <Button className={styles.fixtureExportExpiredClose} variant="ghost" aria-label="关闭" onClick={onDismiss}>
              <X aria-hidden="true" />
            </Button>
          </>
        ) : isDeletionSubmitting ? (
          <>
            <span className={styles.fixtureDeletionSubmittingAccent} aria-hidden="true" />
            <h2 className={styles.fixtureDeletionSubmittingTitle}>{title}</h2>
            <p className={styles.fixtureDeletionSubmittingDetail}>正在禁用账号并撤销会话，后台清理已排队。</p>
            <p className={styles.fixtureDeletionSubmittingStatus}>提交中 · request_id: req_delete_91ba</p>
            <Button
              className={styles.fixtureDeletionSubmittingClose}
              variant="ghost"
              aria-label="关闭"
              onClick={onDismiss}
            >
              <X aria-hidden="true" />
            </Button>
          </>
        ) : isDeletionSuccess ? (
          <>
            <span className={styles.fixtureDeletionSuccessAccent} aria-hidden="true" />
            <h2 className={styles.fixtureDeletionSuccessTitle}>{title}</h2>
            <p className={styles.fixtureDeletionSuccessDetail}>账号已禁用，全部会话已撤销，后台清理任务已创建。</p>
            <p className={styles.fixtureDeletionSuccessStatus}>完成 · request_id: req_delete_91ba</p>
            <Button
              className={styles.fixtureDeletionSuccessClose}
              variant="ghost"
              aria-label="关闭"
              onClick={onDismiss}
            >
              <X aria-hidden="true" />
            </Button>
          </>
        ) : isDeletionFailed ? (
          <>
            <h2 className={styles.fixtureDeletionFailedTitle}>{title}</h2>
            <p className={styles.fixtureDeletionFailedDetail}>清理任务失败，账号状态保持不变，请重新创建。</p>
            <p className={styles.fixtureDeletionFailedStatus}>
              错误码: ACCOUNT_DELETION_FAILED · request_id: req_delete_b721
            </p>
            <Button className={styles.fixtureDeletionFailedAction} variant="ghost" onClick={onDismiss}>
              重新创建注销请求
            </Button>
          </>
        ) : isDeleteConfirmation ? (
          <>
            <p className={styles.fixtureDeleteEyebrow}>DANGER ZONE · CONFIRM</p>
            <h2 className={styles.fixtureDeleteTitle}>{title}</h2>
            <p className={styles.fixtureDeleteDetail}>{detail}</p>
            <p className={styles.fixtureDeleteSecondary}>请先导出需要保留的数据；取消或失败不会改变现有数据。</p>
            <label className={styles.fixtureDeleteLabel}>
              输入 DELETE 继续
              <Input className={styles.fixtureDeleteInput} defaultValue="DELETE" aria-label="输入 DELETE 继续" />
            </label>
            <div className={styles.fixtureDeleteActions}>
              <Button className={styles.fixtureDeleteCancel} variant="outline" onClick={onDismiss}>
                取消
              </Button>
              <Button className={styles.fixtureDeleteConfirm} variant="default" onClick={onDismiss}>
                确认注销
              </Button>
            </div>
          </>
        ) : isLogoutConfirmation ? (
          <>
            <p className={styles.fixtureLogoutEyebrow}>SECURITY · CONFIRM</p>
            <h2 className={styles.fixtureLogoutTitle}>{title}</h2>
            <p className={styles.fixtureLogoutDetail}>{detail}</p>
            <p className={styles.fixtureLogoutTargets}>将退出：iPhone 15 Pro · iOS App；Google Chrome · Windows 11</p>
          </>
        ) : (
          <>
            <h2>{title}</h2>
            <p>{detail}</p>
            {progress ? (
              <span className={styles.fixtureProgress}>
                <i />
              </span>
            ) : null}
          </>
        )}
        {state === 'basic-unsaved-leave-confirmation' ? (
          <div className={cn(styles.fixtureModalActions, styles.fixtureUnsavedActions)}>
            <Button variant="outline" onClick={onDismiss}>
              继续编辑
            </Button>
            <Button variant="default" onClick={onDismiss}>
              放弃并离开
            </Button>
          </div>
        ) : null}
        {isLogoutConfirmation ? (
          <div className={styles.fixtureLogoutActions}>
            <Button className={styles.fixtureLogoutCancel} variant="outline" onClick={onDismiss}>
              取消
            </Button>
            <Button className={styles.fixtureLogoutConfirm} variant="default" onClick={onDismiss}>
              确认退出
            </Button>
          </div>
        ) : null}
        {state === 'security-password-failed' || (state === 'privacy-export-expired' && !isExportExpired) ? (
          <Button type="button" onClick={onDismiss}>
            重新创建
          </Button>
        ) : null}
      </section>
    </div>
  );
}

function profileFromUser(user: AuthUser): ProfileForm {
  return {
    displayName: `${user.displayName} 的工作区`,
    gender: '男',
    heightCm: String(user.profile.heightCm),
    weightKg: String(user.profile.weightKg),
    activityLevel: normalizeActivityLevel(user.profile.activityLevel),
    dietGoal: user.profile.dietGoal || '精益增肌',
    calorieTarget: String(user.profile.calorieTarget),
    proteinTarget: String(user.profile.proteinTarget),
    allergens: user.profile.allergens.filter((item) => item && item !== '暂无过敏原'),
    dislikes: user.profile.dislikes,
  };
}

function profileFromApi(user: Profile, current: ProfileForm): ProfileForm {
  return {
    ...current,
    displayName: user.display_name ?? current.displayName,
    gender: user.gender ?? current.gender,
    heightCm: user.height_cm == null ? current.heightCm : String(user.height_cm),
    weightKg: user.weight_kg == null ? current.weightKg : String(user.weight_kg),
    activityLevel: normalizeActivityLevel(user.activity_level ?? current.activityLevel),
    dietGoal: user.diet_goal ?? current.dietGoal,
    calorieTarget: user.calorie_target == null ? current.calorieTarget : String(user.calorie_target),
    proteinTarget: user.protein_target == null ? current.proteinTarget : String(user.protein_target),
    allergens: user.allergens ? splitList(user.allergens) : current.allergens,
    dislikes: user.dislikes ? splitList(user.dislikes) : current.dislikes,
  };
}

function splitList(value: string): string[] {
  return value
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function notice(message: string, tone: 'info' | 'warning' | 'success' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('foodmate:notice', { detail: { message, tone } }));
}

function roleLabel(role: AuthUser['role']) {
  return { admin: '首席运营', operator: '运营人员', superadmin: '超级管理员', user: '普通用户' }[role];
}

function statusLabel(status: AuthUser['status']) {
  return { active: '已启用', disabled: '已禁用', locked: '已锁定' }[status];
}

function exportStatusLabel(status: ExportStatus) {
  return { queued: '排队中', running: '生成中', completed: '已完成', failed: '失败', expired: '已过期' }[status];
}

function stateIcon(state: AsyncState) {
  if (state === 'submitting') return <LoaderCircle className={styles.spin} aria-hidden="true" />;
  if (state === 'success') return <CircleCheck aria-hidden="true" />;
  if (state === 'failed') return <CircleAlert aria-hidden="true" />;
  return null;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </label>
  );
}

function StatusChip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'green' | 'orange' | 'red' | 'blue' | 'neutral';
}) {
  return (
    <Badge className={cn(styles.statusChip, styles[`chip${tone[0].toUpperCase()}${tone.slice(1)}`])}>{children}</Badge>
  );
}

function IconAction({
  label,
  children,
  onClick,
  danger = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className={cn(styles.iconAction, danger && styles.iconActionDanger)}
          variant="ghost"
          size="icon"
          type="button"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function BasicTab({
  authUser,
  realMode,
  figmaFixture = false,
  fixtureAvatarSrc,
}: {
  authUser: AuthUser;
  realMode: boolean;
  figmaFixture?: boolean;
  fixtureAvatarSrc?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState(authUser.avatarUrl || fixtureAvatarSrc || '');
  const [avatarFileName, setAvatarFileName] = useState('');
  const [avatarState, setAvatarState] = useState<AsyncState>('idle');
  const [profileForm, setProfileForm] = useState(() => profileFromUser(authUser));
  const [savedForm, setSavedForm] = useState(() => profileFromUser(authUser));
  const [loading, setLoading] = useState(realMode);
  const [saving, setSaving] = useState(false);
  const [allergenDraft, setAllergenDraft] = useState('');

  useEffect(() => {
    if (!realMode) return;
    let cancelled = false;
    getProfile()
      .then((profile) => {
        if (cancelled) return;
        setProfileForm((current) => profileFromApi(profile, current));
        setSavedForm((current) => profileFromApi(profile, current));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [realMode]);

  useEffect(
    () => () => {
      if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  const profileChanged = JSON.stringify(profileForm) !== JSON.stringify(savedForm);
  const setField = (key: keyof ProfileForm, value: string) =>
    setProfileForm((current) => ({ ...current, [key]: value }));
  const removeAllergen = (item: string) =>
    setProfileForm((current) => ({ ...current, allergens: current.allergens.filter((value) => value !== item) }));
  const addAllergen = () => {
    const value = allergenDraft.trim();
    if (!value || profileForm.allergens.includes(value)) return;
    setProfileForm((current) => ({ ...current, allergens: [...current.allergens, value] }));
    setAllergenDraft('');
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setAvatarFileName(file.name);
      setAvatarState('failed');
      notice('头像上传失败：请使用 JPG、PNG 或 WebP，且文件不超过 2MB。', 'error');
      return;
    }
    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setAvatarFileName(file.name);
    setAvatarState(realMode ? 'submitting' : 'success');
    if (!realMode) {
      notice('头像已更新。', 'success');
      return;
    }
    void uploadAvatar(file)
      .then(() => {
        setAvatarState('success');
        notice('头像已更新。', 'success');
      })
      .catch((error) => {
        setAvatarState('failed');
        notice(error instanceof Error ? error.message : '头像上传失败。', 'error');
      });
  };

  const handleDeleteAvatar = () => {
    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview('');
    setAvatarFileName('');
    setAvatarState('idle');
    if (realMode) {
      void deleteAvatar()
        .then(() => notice('头像已删除。', 'success'))
        .catch(() => notice('头像删除失败，请重试。', 'error'));
    } else notice('头像已删除。', 'success');
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const payload: ProfileUpdateRequest = {
      display_name: profileForm.displayName,
      gender: profileForm.gender || undefined,
      height_cm: Number(profileForm.heightCm),
      weight_kg: Number(profileForm.weightKg),
      activity_level: profileForm.activityLevel,
      diet_goal: profileForm.dietGoal,
      calorie_target: Number(profileForm.calorieTarget),
      protein_target: Number(profileForm.proteinTarget),
    };
    try {
      if (realMode) await updateProfile(payload);
      setSavedForm(profileForm);
      notice('资料已保存。', 'success');
    } catch (error) {
      notice(error instanceof Error ? error.message : '资料保存失败，请重试。', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.loadingPanel}>正在加载个人资料...</div>;

  // 头像统一经过运行时资源解析，避免历史 Figma 人物素材绕过默认资源策略。
  const avatarSource = resolveAvatarUrl(avatarPreview, profileForm.gender);

  return (
    <div className={styles.basicLayout}>
      <div className={styles.basicLeft}>
        <Card className={cn(styles.profileCard, figmaFixture && styles.figmaProfileCard)}>
          <p className={styles.overline}>头像与账号概览</p>
          <div className={styles.avatarShell}>
            <div className={styles.avatarRing}>
              <AvatarImage
                className={styles.avatarImage}
                avatarUrl={avatarSource}
                gender={profileForm.gender}
                alt="个人头像"
              />
            </div>
          </div>
          <div className={styles.avatarActions}>
            <input
              ref={inputRef}
              className={styles.hiddenInput}
              accept="image/jpeg,image/png,image/webp"
              type="file"
              onChange={handleAvatarChange}
            />
            <Button
              className={styles.softAction}
              variant="outline"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              选择图片
            </Button>
            <Button className={styles.deleteTextButton} variant="ghost" type="button" onClick={handleDeleteAvatar}>
              删除头像
            </Button>
          </div>
          <p className={styles.uploadHint}>Supports JPG, PNG or WEBP. Max 2MB.</p>
          {avatarFileName ? <span className={styles.fileName}>{avatarFileName}</span> : null}
          {avatarState !== 'idle' ? (
            <div className={cn(styles.inlineState, avatarState === 'failed' && styles.inlineStateError)} role="status">
              {stateIcon(avatarState)}
              <span>
                {avatarState === 'submitting'
                  ? '正在上传头像...'
                  : avatarState === 'success'
                    ? '头像已更新'
                    : '头像上传失败，请检查格式和大小'}
              </span>
            </div>
          ) : null}
          <div className={cn(styles.avatarSummary, styles.summaryStatus)}>
            <span>账号状态</span>
            <strong>{statusLabel(authUser.status)}</strong>
          </div>
          <div className={cn(styles.avatarSummary, styles.summaryLogin)}>
            <span>最近登录</span>
            <strong>{realMode ? authUser.lastLoginAt : '今天 09:42'}</strong>
          </div>
          <div className={cn(styles.avatarSummary, styles.summaryUnits)}>
            <span>常用单位</span>
            <strong>公制</strong>
          </div>
          <div className={cn(styles.avatarSummary, styles.summaryTimezone)}>
            <span>时区</span>
            <strong>UTC+08:00</strong>
          </div>
        </Card>

        <Card className={styles.profileCard + ' ' + styles.credentialCard}>
          <h2>系统凭证</h2>
          <div className={styles.credentialList}>
            <div>
              <span>用户名</span>
              <strong>{authUser.username}</strong>
            </div>
            <div>
              <span>角色</span>
              <StatusChip tone="orange">
                {/* Figma Basic 的示例角色文案仅覆盖 fixture 展示，不改变真实权限角色。 */}
                {roleLabel(figmaFixture ? 'admin' : authUser.role)}
              </StatusChip>
            </div>
            <div>
              <span>邮箱地址</span>
              <strong>{authUser.email}</strong>
            </div>
            <div>
              <span>创建时间</span>
              <strong>March 14, 2024</strong>
            </div>
          </div>
        </Card>

        <Card className={styles.profileCard + ' ' + styles.preferenceCard}>
          <h2>偏好速览</h2>
          <p>用于生成更贴合你的饮食建议</p>
          <div className={styles.preferenceGrid}>
            <SummaryTile label="常用餐型" value="三餐 + 加餐" />
            <SummaryTile label="当前目标" value={profileForm.dietGoal || '精益增肌'} />
            <SummaryTile
              label="已记录过敏原"
              value={profileForm.allergens.length ? profileForm.allergens.join(' · ') : '暂无'}
              tone="red"
            />
            <SummaryTile label="最近更新" value="今天 12:45" tone="green" />
          </div>
        </Card>
      </div>

      <Card className={cn(styles.goalsCard, figmaFixture && styles.figmaGoalsCard)}>
        {!figmaFixture ? <div className={styles.goalsAccent} /> : null}
        <h1>饮食与身体目标</h1>
        <form onSubmit={handleSave}>
          {figmaFixture ? (
            <div className={styles.goalsGrid}>
              <Field label="展示名称">
                <Input
                  value={profileForm.displayName}
                  onChange={(event) => setField('displayName', event.target.value)}
                />
              </Field>
              <Field label="性别（可选）">
                <Select
                  value={profileForm.gender || 'unset'}
                  onValueChange={(value) => setField('gender', value === 'unset' ? '' : value)}
                >
                  <SelectTrigger className={styles.select} aria-label="性别（可选）">
                    <SelectValue placeholder="未设置" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">未设置</SelectItem>
                    <SelectItem value="男">男</SelectItem>
                    <SelectItem value="女">女</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="身高 (cm)">
                <Input
                  inputMode="decimal"
                  value={profileForm.heightCm}
                  onChange={(event) => setField('heightCm', event.target.value)}
                />
              </Field>
              <Field label="体重 (kg)">
                <Input
                  inputMode="decimal"
                  value={profileForm.weightKg}
                  onChange={(event) => setField('weightKg', event.target.value)}
                />
              </Field>
              <Field label="活动水平">
                <Select value={profileForm.activityLevel} onValueChange={(value) => setField('activityLevel', value)}>
                  <SelectTrigger className={styles.select} aria-label="活动水平">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="饮食目标">
                <Input value={profileForm.dietGoal} onChange={(event) => setField('dietGoal', event.target.value)} />
              </Field>
              <Field label="每日热量目标 (千卡)">
                <Input
                  inputMode="numeric"
                  value={profileForm.calorieTarget}
                  onChange={(event) => setField('calorieTarget', event.target.value)}
                />
              </Field>
              <Field label="每日蛋白质目标 (g)">
                <Input
                  inputMode="numeric"
                  value={profileForm.proteinTarget}
                  onChange={(event) => setField('proteinTarget', event.target.value)}
                />
              </Field>
            </div>
          ) : (
            <div className={styles.goalsGrid}>
              <Field label="展示名称">
                <Input
                  value={profileForm.displayName}
                  onChange={(event) => setField('displayName', event.target.value)}
                />
              </Field>
              <Field label="性别（可选）">
                <Select
                  value={profileForm.gender || 'unset'}
                  onValueChange={(value) => setField('gender', value === 'unset' ? '' : value)}
                >
                  <SelectTrigger className={styles.select} aria-label="性别（可选）">
                    <SelectValue placeholder="未设置" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">未设置</SelectItem>
                    <SelectItem value="男">男</SelectItem>
                    <SelectItem value="女">女</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="身高 (cm)">
                <Input
                  inputMode="decimal"
                  value={profileForm.heightCm}
                  onChange={(event) => setField('heightCm', event.target.value)}
                />
              </Field>
              <Field label="体重 (kg)">
                <Input
                  inputMode="decimal"
                  value={profileForm.weightKg}
                  onChange={(event) => setField('weightKg', event.target.value)}
                />
              </Field>
              <Field label="活动水平">
                <Select value={profileForm.activityLevel} onValueChange={(value) => setField('activityLevel', value)}>
                  <SelectTrigger className={styles.select} aria-label="活动水平">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="饮食目标">
                <Input value={profileForm.dietGoal} onChange={(event) => setField('dietGoal', event.target.value)} />
              </Field>
              <Field label="每日热量目标 (千卡)">
                <Input
                  inputMode="numeric"
                  value={profileForm.calorieTarget}
                  onChange={(event) => setField('calorieTarget', event.target.value)}
                />
              </Field>
              <Field label="每日蛋白质目标 (g)">
                <Input
                  inputMode="numeric"
                  value={profileForm.proteinTarget}
                  onChange={(event) => setField('proteinTarget', event.target.value)}
                />
              </Field>
            </div>
          )}
          <div className={styles.allergenSection}>
            <span className={styles.fieldLabel}>过敏原与不耐受</span>
            <div className={styles.tagRow}>
              {profileForm.allergens.map((item) => (
                <Button
                  key={item}
                  className={styles.allergenTag}
                  variant="ghost"
                  type="button"
                  onClick={() => removeAllergen(item)}
                >
                  {item}
                  <X aria-hidden="true" />
                </Button>
              ))}
              <div className={styles.addAllergen}>
                <Input
                  aria-label="添加过敏原"
                  placeholder="+ 添加过敏原..."
                  value={allergenDraft}
                  onChange={(event) => setAllergenDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addAllergen();
                    }
                  }}
                />
                <Button
                  className={styles.addButton}
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="添加过敏原"
                  onClick={addAllergen}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
          <div className={styles.formFooter}>
            <Button
              className={styles.cancelButton}
              variant="ghost"
              type="button"
              disabled={!profileChanged || saving}
              onClick={() => setProfileForm(savedForm)}
            >
              放弃更改
            </Button>
            <Button className={styles.saveButton} type="submit" disabled={saving}>
              {saving ? (
                <LoaderCircle className={styles.spin} aria-hidden="true" />
              ) : figmaFixture ? null : (
                <Check aria-hidden="true" />
              )}{' '}
              {saving ? '保存中...' : '保存资料'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'red' | 'green';
}) {
  return (
    <div
      className={cn(
        styles.summaryTile,
        tone === 'red' && styles.summaryTileRed,
        tone === 'green' && styles.summaryTileGreen,
      )}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MemoriesTab({
  figmaFixture = false,
  emptyFixture = false,
}: {
  figmaFixture?: boolean;
  emptyFixture?: boolean;
}) {
  const navigate = useNavigate();
  const [memories, setMemories] = useState(emptyFixture ? [] : memorySeed);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [category, setCategory] = useState('全部分类');
  const [deleting, setDeleting] = useState<Memory>();
  const [editing, setEditing] = useState<Memory>();
  const [editValue, setEditValue] = useState('');
  const visibleMemories = useMemo(
    () =>
      memories.filter(
        (item) =>
          (filter === 'all' || item.status === filter) && (category === '全部分类' || item.category === category),
      ),
    [category, filter, memories],
  );

  const editMemory = (memory: Memory) => {
    setEditing(memory);
    setEditValue(memory.content);
  };

  return (
    <div
      className={cn(
        styles.memoryPage,
        figmaFixture && styles.figmaMemoriesPage,
        emptyFixture && styles.figmaMemoriesEmptyPage,
      )}
      data-figma-layout={figmaFixture ? (emptyFixture ? 'profile-memories-empty' : 'profile-memories') : undefined}
    >
      <Card className={styles.memoryIntro}>
        <h1>记忆系统</h1>
        <p>
          FoodMate 在 Agent
          对话中持续学习，提取长期偏好、模式和饮食规则。这种动态记忆确保未来的餐食推荐和营养目标能完美适配，无需重复问卷。
        </p>
      </Card>
      <div className={styles.memoryToolbar}>
        <div className={styles.filterGroup} role="tablist" aria-label="记忆状态">
          {(
            [
              ['all', '全部 (24)'],
              ['pending', '待确认 (3)'],
              ['confirmed', '已确认 (21)'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              className={cn(styles.filterButton, filter === value && styles.filterButtonActive)}
              variant="ghost"
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className={styles.categorySelect} aria-label="记忆分类">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部分类">全部分类</SelectItem>
            <SelectItem value="偏好">偏好</SelectItem>
            <SelectItem value="限制">限制</SelectItem>
            <SelectItem value="过敏原">过敏原</SelectItem>
            <SelectItem value="目标">目标</SelectItem>
            <SelectItem value="单位">单位</SelectItem>
            <SelectItem value="常用餐型">常用餐型</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {visibleMemories.length ? (
        <div className={styles.memoryList}>
          {visibleMemories.map((memory) => (
            <MemoryRow
              key={memory.id}
              memory={memory}
              figmaFixture={figmaFixture}
              onConfirm={() =>
                setMemories((items) =>
                  items.map((item) => (item.id === memory.id ? { ...item, status: 'confirmed' } : item)),
                )
              }
              onEdit={() => editMemory(memory)}
              onDelete={() => setDeleting(memory)}
              onSource={() => navigate('/chat')}
            />
          ))}
        </div>
      ) : (
        <Card className={styles.memoryEmpty}>
          <div className={styles.emptyEyebrow}>MEMORY · EMPTY</div>
          <h2>暂无长期记忆</h2>
          <p>当你在 Agent 会话中确认一条偏好后，它会出现在这里。临时偏好不会自动保存。</p>
          <span>可保存类别：忌口 · 过敏原 · 目标 · 单位 · 常用餐型</span>
          <Button className={styles.saveButton} type="button" onClick={() => navigate('/chat')}>
            去会话确认
          </Button>
        </Card>
      )}
      {!emptyFixture ? (
        <Card className={styles.memoryGuidance}>
          <h2>长期记忆管理</h2>
          <p>仅在你明确确认后，才会保存为长期记忆；会话中的临时偏好不会自动写入。</p>
          <p>每条记忆展示：类别 · 创建时间 · 更新时间 · 最近使用时间 · 来源会话</p>
          <p>支持类别：忌口 · 过敏原 · 目标 · 单位 · 常用餐型；来源会话可追溯且可撤回。</p>
          <p className={styles.guidanceAction}>操作：编辑 · 删除并二次确认 · 查看来源会话 · 取消保存</p>
          <p>无记忆时显示空态：去会话中确认一条偏好，或清除全部记忆。</p>
        </Card>
      ) : null}
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>删除这条记忆？</DialogTitle>
            <DialogDescription>删除后不会影响来源会话，之后仍可在会话中重新确认。</DialogDescription>
          </DialogHeader>
          <p className={styles.dialogQuote}>{deleting?.content}</p>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDeleting(undefined)}>
              取消
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={() => {
                if (deleting) setMemories((items) => items.filter((item) => item.id !== deleting.id));
                setDeleting(undefined);
                notice('记忆已删除。', 'success');
              }}
            >
              删除记忆
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(undefined)}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>编辑记忆</DialogTitle>
            <DialogDescription>保存后会更新这条长期记忆的内容。</DialogDescription>
          </DialogHeader>
          <Textarea
            className={styles.dialogTextarea}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setEditing(undefined)}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (editing && editValue.trim())
                  setMemories((items) =>
                    items.map((item) => (item.id === editing.id ? { ...item, content: editValue.trim() } : item)),
                  );
                setEditing(undefined);
                notice('记忆已更新。', 'success');
              }}
            >
              保存记忆
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemoryRow({
  memory,
  figmaFixture = false,
  onConfirm,
  onEdit,
  onDelete,
  onSource,
}: {
  memory: Memory;
  figmaFixture?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSource: () => void;
}) {
  const needsAction = memory.status !== 'confirmed';
  const isConflict = memory.status === 'conflict';
  return (
    <Card className={cn(styles.memoryRow, needsAction && styles.memoryRowPending)}>
      <div className={styles.memoryAccent} />
      <div className={styles.memoryContent}>
        <div className={styles.memoryMeta}>
          <StatusChip tone={memoryTone(memory.category)}>{memory.category}</StatusChip>
          <span>{memory.source}</span>
        </div>
        <p className={styles.memoryQuote}>"{memory.content}"</p>
        <StatusChip tone={isConflict ? 'red' : needsAction ? 'orange' : 'green'}>
          {isConflict ? '存在冲突' : needsAction ? '待确认' : '已确认'}
        </StatusChip>
      </div>
      <span className={styles.memoryTime}>{memory.relativeTime}</span>
      <div className={styles.memoryActions}>
        {needsAction ? (
          <Button className={styles.confirmButton} type="button" size="sm" onClick={onConfirm}>
            {isConflict ? '确认并替换' : '确认记忆'}
          </Button>
        ) : null}
        <IconAction label="查看来源会话" onClick={onSource}>
          {figmaFixture ? (
            <FigmaWorkspaceAsset variant="profile" name="memoryView" className={styles.figmaMemoryIcon} />
          ) : (
            <Eye aria-hidden="true" />
          )}
        </IconAction>
        <IconAction label="编辑记忆" onClick={onEdit}>
          {figmaFixture ? (
            <FigmaWorkspaceAsset variant="profile" name="memoryEdit" className={styles.figmaMemoryIcon} />
          ) : (
            <Edit3 aria-hidden="true" />
          )}
        </IconAction>
        <IconAction label="删除记忆" danger onClick={onDelete}>
          {figmaFixture ? (
            <FigmaWorkspaceAsset variant="profile" name="memoryDelete" className={styles.figmaMemoryIcon} />
          ) : (
            <Trash2 aria-hidden="true" />
          )}
        </IconAction>
      </div>
    </Card>
  );
}

function SecurityTab({ figmaFixture = false }: { figmaFixture?: boolean }) {
  const realMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordState, setPasswordState] = useState<AsyncState>('idle');
  const [sessions, setSessions] = useState<AuthSession[]>([
    {
      auth_session_id: 1,
      device_id: 'current',
      user_agent: 'MacBook Pro 16" · macOS',
      ip_address: '192.168.1.42',
      last_seen_at: 'Authorized 10:30 AM',
      expires_at: '2026-09-01',
    },
    {
      auth_session_id: 2,
      device_id: 'iphone',
      user_agent: 'iPhone 15 Pro · iOS App',
      ip_address: '85.22.91.104',
      last_seen_at: 'Authorized March 12',
      expires_at: '2026-09-01',
    },
    {
      auth_session_id: 3,
      device_id: 'chrome',
      user_agent: 'Google Chrome · Windows 11',
      ip_address: '184.22.12.9',
      last_seen_at: 'Authorized March 08',
      expires_at: '2026-09-01',
    },
  ]);
  const [loadingSessions, setLoadingSessions] = useState(realMode);
  const [logoutTarget, setLogoutTarget] = useState<'others' | AuthSession>();

  useEffect(() => {
    if (!realMode) return;
    getAuthSessions()
      .then(setSessions)
      .catch(() => notice('设备会话加载失败，请刷新重试。', 'error'))
      .finally(() => setLoadingSessions(false));
  }, [realMode]);

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      passwords.next.length < 12 ||
      !/[A-Z]/.test(passwords.next) ||
      !/[a-z]/.test(passwords.next) ||
      !/[\d\W]/.test(passwords.next)
    ) {
      setPasswordState('failed');
      notice('新密码需至少 12 位，并包含数字、特殊符号和大小写字母。', 'error');
      return;
    }
    if (passwords.next !== passwords.confirm || !passwords.current) {
      setPasswordState('failed');
      notice('请检查当前密码和两次输入的新密码。', 'error');
      return;
    }
    setPasswordState('submitting');
    try {
      if (realMode) await changePassword(passwords.current, passwords.next);
      setPasswordState('success');
      setPasswords({ current: '', next: '', confirm: '' });
      notice('密码已更新，其他设备会话已按安全策略处理。', 'success');
    } catch (error) {
      setPasswordState('failed');
      notice(error instanceof Error ? error.message : '密码更新失败，请重新填写。', 'error');
    }
  };

  const confirmLogout = async () => {
    try {
      if (logoutTarget === 'others') {
        if (realMode) await revokeAllAuthSessions();
        setSessions((items) => items.filter((item) => item.device_id === 'current'));
        notice('其他设备已退出，当前设备保持登录。', 'success');
      } else if (logoutTarget) {
        if (realMode) await revokeAuthSession(logoutTarget.auth_session_id);
        setSessions((items) => items.filter((item) => item.auth_session_id !== logoutTarget.auth_session_id));
        notice('设备会话已退出。', 'success');
      }
    } catch (error) {
      notice(error instanceof Error ? error.message : '设备退出失败，请重试。', 'error');
    } finally {
      setLogoutTarget(undefined);
    }
  };

  return (
    <div
      className={cn(styles.securityPage, figmaFixture && styles.figmaSecurityPage)}
      data-figma-layout={figmaFixture ? 'profile-security' : undefined}
    >
      <div className={styles.securityTopGrid}>
        <Card className={cn(styles.securityCard, styles.passwordCard, figmaFixture && styles.figmaSecurityCard)}>
          <div className={styles.securityAccent} />
          <h1>修改账号密码</h1>
          <form className={styles.passwordForm} onSubmit={submitPassword}>
            <Field label="当前密码">
              <Input
                type="password"
                value={passwords.current}
                onChange={(event) => setPasswords((current) => ({ ...current, current: event.target.value }))}
                placeholder="••••••••••••"
              />
            </Field>
            <Field label="新密码">
              <Input
                type="password"
                value={passwords.next}
                onChange={(event) => setPasswords((current) => ({ ...current, next: event.target.value }))}
                placeholder="FustatSec99!"
              />
            </Field>
            <div className={styles.passwordRules}>
              <span className={passwords.next.length >= 12 ? styles.rulePass : ''}>
                <i />
                At least 12 characters
              </span>
              <span className={/[\d\W]/.test(passwords.next) ? styles.rulePass : ''}>
                <i />
                包含数字和特殊符号
              </span>
              <span className={/[A-Z]/.test(passwords.next) && /[a-z]/.test(passwords.next) ? styles.rulePass : ''}>
                <i />
                包含大小写字母
              </span>
            </div>
            <Field label="确认密码">
              <Input
                type="password"
                value={passwords.confirm}
                onChange={(event) => setPasswords((current) => ({ ...current, confirm: event.target.value }))}
                placeholder="••••••••••••"
              />
            </Field>
            <Button
              className={styles.saveButton + ' ' + styles.passwordButton}
              type="submit"
              disabled={passwordState === 'submitting'}
            >
              {stateIcon(passwordState)} 更新密码
            </Button>
            {!figmaFixture ? (
              <StatusChip tone="green">
                <ShieldCheck aria-hidden="true" /> SECURE
              </StatusChip>
            ) : null}
          </form>
          {passwordState === 'success' ? (
            <div className={styles.successPanel}>
              <CircleCheck aria-hidden="true" />
              密码已更新
            </div>
          ) : null}
          {passwordState === 'failed' ? (
            <div className={styles.errorPanel}>
              <CircleAlert aria-hidden="true" />
              密码更新失败，请重新填写
            </div>
          ) : null}
        </Card>

        <Card className={cn(styles.securityCard, styles.sessionCard, figmaFixture && styles.figmaSecurityCard)}>
          <div className={styles.sessionAccent} />
          <div className={styles.securityCardHeader}>
            <h1>活跃工作区会话</h1>
            <Button
              className={styles.logoutOthersButton}
              variant="ghost"
              type="button"
              onClick={() => setLogoutTarget('others')}
            >
              退出其他设备
            </Button>
          </div>
          {loadingSessions ? (
            <div className={styles.loadingPanel}>正在加载设备会话...</div>
          ) : (
            <div className={styles.sessionList}>
              {sessions.map((session) => (
                <SessionRow key={session.auth_session_id} session={session} onLogout={() => setLogoutTarget(session)} />
              ))}
            </div>
          )}
          <StatusChip tone="blue">{Math.max(0, sessions.length - 1)} ACTIVE DEVICES</StatusChip>
          <p className={styles.securityHint}>设备状态在每次登录后更新</p>
        </Card>
      </div>
      <Card className={styles.activityCard}>
        <div className={styles.activityAccent} />
        <div className={styles.activityHeader}>
          <div>
            <h2>最近安全活动</h2>
            <p>查看最近的登录、密码和设备状态变化</p>
          </div>
          <Button type="button" className={styles.textLink} variant="ghost">
            查看登录历史 &gt;
          </Button>
        </div>
        <div className={styles.activityList}>
          <ActivityRow dot="green" title="密码更新" detail="今天 09:42 · 当前设备" status="已完成" />
          <ActivityRow dot="blue" title="新设备登录" detail="iPhone 15 Pro · 3月12日" status="已验证" />
          <ActivityRow
            dot="green"
            title="设备会话检查"
            detail={`已检查 ${sessions.length} 台设备，未发现异常`}
            status="正常"
          />
        </div>
        <p className={styles.securityHint}>
          设备详情包含创建时间 / 过期时间 / 当前状态；单设备退出需确认，退出全部设备时保留当前会话并二次确认。
        </p>
      </Card>
      <Dialog open={Boolean(logoutTarget)} onOpenChange={(open) => !open && setLogoutTarget(undefined)}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <div className={styles.dialogEyebrow}>
              <ShieldCheck aria-hidden="true" /> SECURITY · CONFIRM
            </div>
            <DialogTitle>{logoutTarget === 'others' ? '退出其他设备？' : '退出此设备？'}</DialogTitle>
            <DialogDescription>
              {logoutTarget === 'others'
                ? `这将退出除当前设备以外的 ${Math.max(0, sessions.length - 1)} 个活跃会话。当前设备会保留登录状态，最近的运行和审计记录不会被删除。`
                : '此设备的登录会话会立即失效，当前设备不会受到影响。'}
            </DialogDescription>
          </DialogHeader>
          {logoutTarget !== 'others' && logoutTarget ? (
            <p className={styles.dialogQuote}>{logoutTarget.user_agent}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setLogoutTarget(undefined)}>
              取消
            </Button>
            <Button variant="destructive" type="button" onClick={() => void confirmLogout()}>
              <LogOut aria-hidden="true" />
              确认退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionRow({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const current = session.device_id === 'current';
  return (
    <div className={styles.sessionRow}>
      <div className={styles.sessionInfo}>
        <strong>{session.user_agent ?? '未知设备'}</strong>
        <span>
          {session.ip_address ?? 'IP 未记录'} · {session.last_seen_at ?? '最近活动未知'}
        </span>
        <small>
          {current ? '当前在线' : session.device_id === 'iphone' ? 'Active 4 hours ago' : 'Active 3 days ago'}
        </small>
      </div>
      {current ? (
        <StatusChip tone="green">当前设备</StatusChip>
      ) : (
        <Button className={styles.logoutButton} variant="outline" size="sm" type="button" onClick={onLogout}>
          退出登录
        </Button>
      )}
    </div>
  );
}

function ActivityRow({
  dot,
  title,
  detail,
  status,
}: {
  dot: 'green' | 'blue';
  title: string;
  detail: string;
  status: string;
}) {
  return (
    <div className={styles.activityRow}>
      <span className={cn(styles.activityDot, dot === 'blue' && styles.activityDotBlue)} />
      <strong>{title}</strong>
      <span>{detail}</span>
      <b className={dot === 'blue' ? styles.activityStatusBlue : ''}>{status}</b>
    </div>
  );
}

function PrivacyTab({ figmaFixture = false }: { figmaFixture?: boolean }) {
  const realMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const [exportRows, setExportRows] = useState(exportSeed);
  const [exportJobId, setExportJobId] = useState<number>();
  const [exportStatus, setExportStatus] = useState<ExportStatus>();
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deletionConfirmation, setDeletionConfirmation] = useState('');
  const [deletionState, setDeletionState] = useState<AsyncState>('idle');
  const pollRef = useRef<number>();

  useEffect(
    () => () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    },
    [],
  );

  const createExport = async () => {
    setExportStatus('queued');
    if (!realMode) {
      setExportRows((rows) => [
        { id: `export-${Date.now()}`, date: '今天', status: 'queued', size: '生成中' },
        ...rows,
      ]);
      notice('数据导出已排队。', 'success');
      return;
    }
    try {
      const created = await requestDataExport();
      setExportJobId(created.export_job_id);
      setExportRows((rows) => [
        {
          id: `export-${created.export_job_id}`,
          date: '今天',
          status: 'queued',
          size: '生成中',
          jobId: created.export_job_id,
        },
        ...rows,
      ]);
      pollRef.current = window.setInterval(async () => {
        try {
          const job = await getDataExport(created.export_job_id);
          const status = job.status as ExportStatus;
          setExportStatus(status);
          setExportRows((rows) =>
            rows.map((row) =>
              row.jobId === created.export_job_id
                ? { ...row, status, size: status === 'completed' ? '142 MB' : row.size }
                : row,
            ),
          );
          if (status === 'completed' || status === 'failed' || status === 'expired') {
            if (pollRef.current) window.clearInterval(pollRef.current);
          }
        } catch {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setExportStatus('failed');
        }
      }, 2000);
    } catch (error) {
      setExportStatus('failed');
      notice(error instanceof Error ? error.message : '数据导出创建失败，请重试。', 'error');
    }
  };

  const downloadExport = async (row: ExportRow) => {
    if (row.status !== 'completed') return;
    if (!realMode) {
      notice('导出归档已开始下载。', 'success');
      return;
    }
    if (!row.jobId && !exportJobId) return;
    try {
      const result = await downloadDataExport(row.jobId ?? exportJobId!);
      window.open(result.download_url, '_blank', 'noopener,noreferrer');
      notice('导出归档已开始下载。', 'success');
    } catch (error) {
      notice(error instanceof Error ? error.message : '下载链接已失效，请重新创建导出。', 'error');
    }
  };

  const submitDeletion = async () => {
    if (deletionConfirmation !== 'DELETE_MY_ACCOUNT' || !deletionPassword) {
      notice('请输入当前密码和 DELETE_MY_ACCOUNT。', 'warning');
      return;
    }
    setDeletionState('submitting');
    try {
      if (realMode) {
        await requestAccountDeletion(deletionConfirmation, deletionPassword);
        await logout();
        window.location.href = '/login';
        return;
      }
      setDeletionState('success');
      setDeletionOpen(false);
      notice('注销请求已提交。', 'success');
    } catch (error) {
      setDeletionState('failed');
      notice(error instanceof Error ? error.message : '注销请求失败，请重新创建。', 'error');
    }
  };

  return (
    <div className={styles.privacyPage}>
      <Card className={styles.exportCard}>
        <div className={styles.exportHeader}>
          <div>
            <h1>导出个人工作区数据</h1>
            <p>生成包含您的饮食历史、偏好和会话记录的完整档案。</p>
          </div>
          <Button
            className={styles.exportButton}
            type="button"
            onClick={() => void createExport()}
            disabled={exportStatus === 'queued' || exportStatus === 'running'}
          >
            {!figmaFixture ? <Download aria-hidden="true" /> : null} 创建数据导出
          </Button>
        </div>
        {exportStatus && exportStatus !== 'completed' ? (
          <div className={styles.exportProgress}>
            {exportStatus === 'running' ? <Progress value={68} className={styles.progress} /> : null}
            <span>
              {exportStatusLabel(exportStatus)} ·{' '}
              {exportStatus === 'queued' ? '预计等待 1-2 分钟' : '请稍候，完成后提供一次性下载入口'}
            </span>
          </div>
        ) : null}
        <div className={styles.exportTable} role="table" aria-label="数据导出记录">
          <div className={styles.exportTableHead} role="row">
            <span>创建日期</span>
            <span>状态</span>
            <span>大小</span>
            <span>操作</span>
          </div>
          {exportRows.map((row) => (
            <div className={styles.exportTableRow} role="row" key={row.id}>
              <strong>{row.date}</strong>
              <span>
                <StatusChip
                  tone={
                    row.status === 'completed'
                      ? 'green'
                      : row.status === 'failed' || row.status === 'expired'
                        ? 'red'
                        : 'orange'
                  }
                >
                  {exportStatusLabel(row.status)}
                </StatusChip>
              </span>
              <span>{row.size}</span>
              <span>
                {row.status === 'completed' ? (
                  <Button
                    className={styles.textLink}
                    variant="ghost"
                    type="button"
                    onClick={() => void downloadExport(row)}
                  >
                    {!figmaFixture ? <Download aria-hidden="true" /> : null}
                    下载归档
                  </Button>
                ) : row.status === 'expired' ? (
                  <Button
                    className={styles.textLinkOrange}
                    variant="ghost"
                    type="button"
                    onClick={() => void createExport()}
                  >
                    {!figmaFixture ? <RefreshCw aria-hidden="true" /> : null}
                    重新创建
                  </Button>
                ) : row.status === 'failed' ? (
                  <Button
                    className={styles.textLinkOrange}
                    variant="ghost"
                    type="button"
                    onClick={() => void createExport()}
                  >
                    {!figmaFixture ? <RefreshCw aria-hidden="true" /> : null}
                    重新创建
                  </Button>
                ) : (
                  <span className={styles.mutedText}>处理中</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className={styles.dangerCard}>
        <h1>危险区域</h1>
        <div className={styles.dangerRow}>
          <div>
            <strong>删除 FoodMate 账户</strong>
            <p>永久删除所有个人工作区历史、个人指标、记忆和访问记录。此操作不可逆。</p>
          </div>
          <Button
            className={styles.dangerButton}
            variant="destructive"
            type="button"
            onClick={() => setDeletionOpen(true)}
          >
            申请注销账号
          </Button>
        </div>
      </Card>
      <div className={styles.deletionImpact}>
        <h2>注销影响与二次确认</h2>
        <p>确认后立即禁用账号、撤销全部登录会话，并开始后台清理个人资料、饮食记录、记忆和知识库数据。</p>
        <p>必须输入确认词后提交；提交中 / 成功 / 失败状态均展示 request_id，失败可重新创建。</p>
        <p>不可逆操作前保留导出文件；取消或失败不改变现有数据。</p>
      </div>
      {deletionState === 'success' ? (
        <div className={styles.successPanel}>
          <CircleCheck aria-hidden="true" />
          账号已注销 · request_id: req_delete_91ba
        </div>
      ) : null}
      {deletionState === 'failed' ? (
        <div className={styles.errorPanel}>
          <CircleAlert aria-hidden="true" />
          账号注销失败 · request_id: req_delete_b721
        </div>
      ) : null}
      <Dialog
        open={deletionOpen}
        onOpenChange={(open) => {
          setDeletionOpen(open);
          if (!open) {
            setDeletionPassword('');
            setDeletionConfirmation('');
          }
        }}
      >
        <DialogContent className={styles.dialogContent + ' ' + styles.dangerDialog}>
          <DialogHeader>
            <div className={cn(styles.dialogEyebrow, styles.dangerEyebrow)}>
              <CircleAlert aria-hidden="true" /> DANGER ZONE · CONFIRM
            </div>
            <DialogTitle>确认注销 FoodMate 账号</DialogTitle>
            <DialogDescription>
              确认后账号会立即禁用，全部登录会话将被撤销，并开始后台清理个人资料、饮食记录、记忆和知识库数据。请先导出需要保留的数据；取消或失败不会改变现有数据。
            </DialogDescription>
          </DialogHeader>
          <Field label="当前密码">
            <Input
              type="password"
              value={deletionPassword}
              onChange={(event) => setDeletionPassword(event.target.value)}
            />
          </Field>
          <Field label="输入 DELETE 继续">
            <Input
              value={deletionConfirmation}
              placeholder="DELETE_MY_ACCOUNT"
              onChange={(event) => setDeletionConfirmation(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDeletionOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={deletionState === 'submitting'}
              onClick={() => void submitDeletion()}
            >
              {stateIcon(deletionState)}确认注销
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RealMemoriesTab() {
  const navigate = useNavigate();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'attention' | 'confirmed'>('all');
  const [deleting, setDeleting] = useState<Memory>();
  const [editing, setEditing] = useState<Memory>();
  const [editValue, setEditValue] = useState('');

  const attentionCount = memories.filter((memory) => memory.status !== 'confirmed').length;
  const conflictCount = memories.filter((memory) => memory.status === 'conflict').length;
  const confirmedCount = memories.filter((memory) => memory.status === 'confirmed').length;
  const visibleMemories = memories.filter(
    (memory) =>
      filter === 'all' || (filter === 'confirmed' ? memory.status === 'confirmed' : memory.status !== 'confirmed'),
  );

  const refresh = () => {
    setLoading(true);
    return loadMemories()
      .then((items) => setMemories(items.map(toMemory)))
      .catch((error) => notice(error instanceof Error ? error.message : 'Memory load failed.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Initial refresh is the subscription boundary for the real memory list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  const runMutation = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      await refresh();
      notice(success, 'success');
    } catch (error) {
      notice(error instanceof Error ? error.message : 'Memory operation failed.', 'error');
    }
  };

  return (
    <div className={styles.memoryPage}>
      <Card className={styles.memoryIntro}>
        <h1>记忆系统</h1>
        <p>FoodMate 会将你在 Agent 对话中明确确认的偏好、限制和饮食模式保存为长期记忆。</p>
      </Card>
      <div className={styles.memoryToolbar}>
        <div className={styles.filterGroup} role="tablist" aria-label="真实记忆状态">
          {(
            [
              ['all', `全部 (${memories.length})`],
              ['attention', `待处理 (${attentionCount})`],
              ['confirmed', `已确认 (${confirmedCount})`],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              className={cn(styles.filterButton, filter === value && styles.filterButtonActive)}
              variant="ghost"
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
          {conflictCount > 0 ? <span className={styles.memoryConflictCount}>含 {conflictCount} 条冲突</span> : null}
        </div>
        <Button variant="outline" size="sm" type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw aria-hidden="true" /> 刷新
        </Button>
      </div>
      {loading ? <Card className={styles.memoryEmpty}>正在加载记忆...</Card> : null}
      {!loading && visibleMemories.length ? (
        <div className={styles.memoryList}>
          {visibleMemories.map((memory) => (
            <MemoryRow
              key={memory.id}
              memory={memory}
              onConfirm={() => void runMutation(() => confirmMemory(memory.id), '记忆已确认。')}
              onEdit={() => {
                setEditing(memory);
                setEditValue(memory.content);
              }}
              onDelete={() => setDeleting(memory)}
              onSource={() => navigate('/chat')}
            />
          ))}
        </div>
      ) : null}
      {!loading && !visibleMemories.length ? (
        <Card className={styles.memoryEmpty}>
          <div className={styles.emptyEyebrow}>MEMORY / EMPTY</div>
          <h2>{memories.length ? '没有匹配的记忆' : '暂无长期记忆'}</h2>
          <p>{memories.length ? '当前状态筛选没有返回记录。' : '在 Agent 对话中确认一条偏好后，它会显示在这里。'}</p>
          {!memories.length ? (
            <Button className={styles.saveButton} type="button" onClick={() => navigate('/chat')}>
              前往对话
            </Button>
          ) : null}
        </Card>
      ) : null}
      <Card className={styles.memoryGuidance}>
        <h2>长期记忆管理</h2>
        <p>列表、确认、编辑和删除均使用现有的 /api/memories 接口；操作失败时会保留当前页面数据。</p>
      </Card>
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>删除这条记忆？</DialogTitle>
            <DialogDescription>这只会删除长期记忆，不会删除来源会话。</DialogDescription>
          </DialogHeader>
          <p className={styles.dialogQuote}>{deleting?.content}</p>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDeleting(undefined)}>
              取消
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={() => {
                if (!deleting) return;
                void runMutation(() => deleteMemory(deleting.id), '记忆已删除。');
                setDeleting(undefined);
              }}
            >
              删除记忆
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(undefined)}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>编辑记忆</DialogTitle>
            <DialogDescription>保存后会通过已登录的记忆接口更新长期记忆。</DialogDescription>
          </DialogHeader>
          <Textarea
            className={styles.dialogTextarea}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setEditing(undefined)}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!editing || !editValue.trim()) return;
                void runMutation(() => updateMemory(editing.id, editValue.trim(), editing.scope), '记忆已更新。');
                setEditing(undefined);
              }}
            >
              保存记忆
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toMemory(item: MemoryRecord): Memory {
  const memoryType = item.memory_type ?? item.memoryType ?? '';
  const rawValue = item.memory_value ?? item.memoryValue ?? '';
  const memoryId = item.memory_id ?? item.memoryId;
  const confirmationStatus = item.confirmation_status ?? item.confirmationStatus;
  const updatedAt = item.updated_at ?? item.updatedAt;
  let content = rawValue;
  try {
    const value = JSON.parse(content) as unknown;
    if (typeof value === 'string') content = value;
    else if (value && typeof value === 'object' && 'value' in value)
      content = String((value as { value: unknown }).value);
  } catch {
    // Keep legacy plain-text memory values readable.
  }
  return {
    id: memoryId ?? 0,
    category: memoryTypeLabel(memoryType),
    scope: item.scope,
    source: item.source || 'Agent 对话',
    relativeTime: memoryRelativeTime(updatedAt),
    content,
    status:
      confirmationStatus === 'conflict' ? 'conflict' : confirmationStatus === 'confirmed' ? 'confirmed' : 'pending',
  };
}

export function ProfilePage() {
  const authUser = getAuthUser();
  const realMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fixtureState = getProfileFixtureState(searchParams.get('state'));
  const baseFigmaState = getProfileBaseFigmaState(searchParams.get('state'));
  const activeTab = fixtureState?.startsWith('security')
    ? 'security'
    : fixtureState?.startsWith('privacy')
      ? 'privacy'
      : fixtureState === 'memories-empty'
        ? 'memories'
        : (baseFigmaState ?? getTab(location.pathname));
  const isFigmaFixture = !realMode || Boolean(baseFigmaState || fixtureState);
  const securityFigmaFixture =
    isFigmaFixture && (baseFigmaState === 'security' || Boolean(fixtureState?.startsWith('security-')));
  const displayedUser = isFigmaFixture ? figmaProfileUser : authUser;
  return (
    <WorkspaceLayout
      activeModule="profile"
      displayNameOverride={isFigmaFixture ? 'Anddy' : undefined}
      profileIdOverride={isFigmaFixture ? '1234567' : undefined}
      profileActiveTab={isFigmaFixture ? activeTab : undefined}
      sidebarAvatarSrc={isFigmaFixture ? FIGMA_PROFILE_AVATARS.sidebar : undefined}
      topAvatarSrc={isFigmaFixture ? FIGMA_PROFILE_AVATARS.topbar : undefined}
      topbarShowMarkLetter={!isFigmaFixture}
      showWindowControls={isFigmaFixture}
      // Profile 画板使用独立导出的壳层资源，真实模式继续使用 Lucide fallback。
      fixtureVariant={isFigmaFixture ? 'profile' : undefined}
      sidebarFixture={
        isFigmaFixture
          ? {
              currentPage: 1,
              sessions: figmaSidebarSessions,
            }
          : undefined
      }
      pageOverlay={
        fixtureState && fixtureState !== 'memories-empty' ? (
          <ProfileFixtureOverlay state={fixtureState} onDismiss={() => navigate('/profile')} />
        ) : null
      }
    >
      <div className={cn(styles.page, 'fm-enter')}>
        {activeTab === 'basic' ? (
          <BasicTab
            authUser={displayedUser}
            realMode={isFigmaFixture ? false : realMode}
            figmaFixture={isFigmaFixture}
            fixtureAvatarSrc={isFigmaFixture ? FIGMA_PROFILE_AVATARS.main : undefined}
          />
        ) : null}
        {activeTab === 'memories' ? (
          realMode ? (
            <RealMemoriesTab />
          ) : (
            <MemoriesTab figmaFixture={isFigmaFixture} emptyFixture={fixtureState === 'memories-empty'} />
          )
        ) : null}
        {activeTab === 'security' ? <SecurityTab figmaFixture={securityFigmaFixture} /> : null}
        {activeTab === 'privacy' ? <PrivacyTab figmaFixture={isFigmaFixture} /> : null}
      </div>
    </WorkspaceLayout>
  );
}

import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Calculator,
  Check,
  CircleAlert,
  Leaf,
  Paperclip,
  Search,
  SendHorizontal,
  Utensils,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { FigmaWorkspaceAsset } from '../../components/workspace/FigmaWorkspaceAsset';
import { WorkspaceLayout } from '../../layouts/WorkspaceLayout/WorkspaceLayout';
import { getAuthUser } from '../../services/authService';
import { getHomeSessions, getRecommendedPrompts, getTaskCards } from '../../services/sessionService';
import type { SessionSummary } from '../../types/session';
import styles from './HomePage.module.css';

const metricCards = [
  { label: '热量', value: '1,850', unit: '千卡', progress: '74', tone: 'green', figmaAsset: 'metricEnergy' },
  { label: '蛋白质', value: '120', unit: 'g', progress: '80', tone: 'purple', figmaAsset: 'metricProtein' },
  { label: '碳水', value: '210', unit: 'g', progress: '65', tone: 'orange', figmaAsset: 'metricCarbs' },
  { label: '脂肪', value: '58', unit: 'g', progress: '55', tone: 'red', figmaAsset: 'metricFat' },
] as const;

const pendingItems = [
  {
    id: 'beef',
    title: '牛油果酸面包吐司',
    detail: '记录为 340 千卡 · 置信度：94%',
    figmaDetail: '记录为 340千卡 · 置信度：94%',
    prompt: '确认记录牛油果酸面包吐司',
  },
  {
    id: 'fish',
    title: '煎三文鱼碗',
    detail: '记录为 620 千卡 · 置信度：88%',
    figmaDetail: '记录为 620千卡 · 置信度：88%',
    prompt: '确认记录煎三文鱼碗',
  },
];

const figmaSidebarSessions: SessionSummary[] = [
  { id: 'weekly-adjustment', title: '每周饮食微调', subtitle: '12:45', active: true },
  { id: 'pre-workout-snack', title: '运动前零食建议', subtitle: '12:45' },
  { id: 'allergen-rules', title: '过敏原排除规则', subtitle: '12:45' },
  { id: 'protein-supplement', title: '蛋白质补充方案', subtitle: '12:45' },
  { id: 'bedtime-snack', title: '睡前加餐建议', subtitle: '12:45' },
  { id: 'breakfast-carbs', title: '早餐碳水搭配', subtitle: '12:45' },
  { id: 'dinner-protein', title: '晚餐蛋白质补充', subtitle: '12:45' },
  { id: 'low-carb-diet', title: '低碳水饮食建议', subtitle: '12:45' },
  { id: 'breakfast-smoothie', title: '早餐奶昔配方', subtitle: '12:45' },
];

const FIGMA_HOME_SIDEBAR_AVATAR = '/assets/figma/workspace/home-sidebar-avatar.png';
const FIGMA_HOME_TOPBAR_AVATAR = '/assets/figma/workspace/home-topbar-avatar.png';

type HomeState = 'default' | 'loading' | 'empty' | 'error' | 'input-states';

function getHomeState(value: string | null): HomeState {
  return value === 'loading' || value === 'empty' || value === 'error' || value === 'input-states' ? value : 'default';
}

function HomeStatePanel({
  state,
  onRetry,
}: {
  state: Exclude<HomeState, 'default' | 'input-states'>;
  onRetry: () => void;
}) {
  if (state === 'loading') {
    return (
      <section
        className={`${styles.homeStatePanel} ${styles.homeStateLoading}`}
        aria-busy="true"
        aria-label="工作台正在加载"
      >
        <div className={styles.loadingHeading}>
          <div>
            <h2>工作台正在加载</h2>
            <p>正在整理你的营养摘要和任务数据</p>
          </div>
          <span>加载中</span>
        </div>
        <div className={styles.homeStateSkeletonChips}>
          {[1, 2, 3, 4, 5].map((item) => (
            <span key={item} />
          ))}
        </div>
        <div className={styles.homeStateMetricSkeletons}>
          {[1, 2, 3, 4].map((item) => (
            <span key={item} />
          ))}
        </div>
        <div className={styles.homeStateGridSkeletons}>
          <span />
          <span />
        </div>
      </section>
    );
  }

  const isError = state === 'error';
  const Icon = isError ? CircleAlert : Leaf;
  return (
    <section
      className={`${styles.homeStatePanel} ${isError ? styles.homeStateError : styles.homeStateEmpty}`}
      role={isError ? 'alert' : undefined}
    >
      <div className={styles.homeStateCenteredContent}>
        <span className={styles.homeStateIcon}>
          <Icon aria-hidden="true" />
        </span>
        <div>
          <h2>{isError ? '数据加载失败' : '还没有任何数据'}</h2>
          <p>{isError ? '无法获取您的营养摘要和任务数据' : '开始你的第一次对话来记录饮食吧'}</p>
        </div>
        <Button className={styles.homeStateAction} type="button" onClick={onRetry}>
          {isError ? '重新加载' : '开始使用'}
        </Button>
      </div>
    </section>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const homeState = getHomeState(searchParams.get('state'));
  const isFigmaFixture = searchParams.get('state') === 'figma-v2';
  const [prompt, setPrompt] = useState('');
  const [confirmedItems, setConfirmedItems] = useState<string[]>([]);
  const [attachmentName, setAttachmentName] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const currentUser = getAuthUser();
  const taskCards = getTaskCards();
  const recommendedPrompts = getRecommendedPrompts();
  const sessions = getHomeSessions();

  const quickActions = useMemo(
    () => [
      { label: '记录饮食', prompt: recommendedPrompts[0], icon: Utensils, figmaIcon: '🍽', tone: 'green' },
      {
        label: '分析摄入',
        prompt: taskCards.find((task) => task.id === 'analysis')?.prompt ?? recommendedPrompts[2],
        icon: BarChart3,
        figmaIcon: '📊',
        tone: 'purple',
      },
      {
        label: '创建计划',
        prompt: taskCards.find((task) => task.id === 'planning')?.prompt ?? recommendedPrompts[1],
        icon: CalendarDays,
        figmaIcon: '📋',
        tone: 'red',
      },
      { label: '搜索知识', prompt: recommendedPrompts[3], icon: Search, figmaIcon: '🔍', tone: 'blue' },
      {
        label: '快速计算',
        prompt: taskCards.find((task) => task.id === 'calorie')?.prompt ?? '计算这份食物的热量',
        icon: Calculator,
        figmaIcon: '🧮',
        tone: 'orange',
      },
    ],
    [recommendedPrompts, taskCards],
  );

  const startPrompt = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    const target = import.meta.env.VITE_AGENT_MODE === 'real' ? '/chat' : '/chat/quick-start';
    navigate(`${target}?prompt=${encodeURIComponent(normalized)}`);
  };

  const confirmItem = (id: string, value: string) => {
    setConfirmedItems((items) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]));
    startPrompt(value);
  };

  return (
    <WorkspaceLayout
      activeModule="home"
      displayNameOverride={isFigmaFixture ? 'Anddy' : undefined}
      fixtureVariant={isFigmaFixture ? 'home' : undefined}
      profileIdOverride={isFigmaFixture ? '1234567' : undefined}
      sidebarAvatarSrc={isFigmaFixture ? FIGMA_HOME_SIDEBAR_AVATAR : undefined}
      topAvatarSrc={isFigmaFixture ? FIGMA_HOME_TOPBAR_AVATAR : undefined}
      showKnowledgeTopNav={!isFigmaFixture}
      sidebarFixture={isFigmaFixture ? { sessions: figmaSidebarSessions } : undefined}
    >
      <div className={`${styles.page} ${isFigmaFixture ? styles.figmaHomePage : ''} fm-enter`}>
        <section className={styles.intro}>
          <div>
            <h1>👋 早上好，{isFigmaFixture ? 'Anddy' : currentUser.displayName}！</h1>
            <p>今天是 2024年3月14日 星期二</p>
          </div>
          <span className={styles.environment}>生产环境</span>
        </section>

        <section className={styles.taskComposer} aria-label="开始一个新任务">
          <Button
            className={styles.attachmentButton}
            variant="ghost"
            size="icon"
            aria-label="添加附件"
            onClick={() => attachmentInputRef.current?.click()}
          >
            {isFigmaFixture ? (
              <FigmaWorkspaceAsset variant="home" name="attachment" />
            ) : (
              <Paperclip aria-hidden="true" />
            )}
          </Button>
          <input
            ref={attachmentInputRef}
            className={styles.fileInput}
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => setAttachmentName(event.target.files?.[0]?.name ?? '')}
          />
          <Input
            className={styles.taskInput}
            value={prompt}
            placeholder="分析早餐照片，计算热量摄入并记录营养指标..."
            aria-label="任务内容"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              const composing = event.nativeEvent.isComposing || event.keyCode === 229;
              if (event.key === 'Enter' && !event.shiftKey && !composing) {
                event.preventDefault();
                startPrompt(prompt);
              }
            }}
          />
          <Button
            className={styles.sendButton}
            size="icon"
            aria-label="发送任务"
            disabled={!prompt.trim()}
            onClick={() => startPrompt(prompt)}
          >
            {isFigmaFixture ? (
              <FigmaWorkspaceAsset variant="home" name="send" />
            ) : (
              <SendHorizontal aria-hidden="true" />
            )}
          </Button>
        </section>

        {attachmentName ? (
          <span className={styles.visuallyHidden} role="status">
            {attachmentName}
          </span>
        ) : null}

        {homeState === 'loading' || homeState === 'empty' || homeState === 'error' ? (
          <HomeStatePanel state={homeState} onRetry={() => navigate('/')} />
        ) : (
          <>
            <section className={styles.quickActions} aria-label="快速操作">
              {quickActions.map(({ icon: Icon, figmaIcon, label, prompt: actionPrompt, tone }) => (
                <Button
                  className={`${styles.quickButton} ${styles[`quick${tone[0].toUpperCase()}${tone.slice(1)}`]}`}
                  key={label}
                  variant="outline"
                  onClick={() => setPrompt(actionPrompt)}
                >
                  {isFigmaFixture ? (
                    <span className={styles.quickEmoji} aria-hidden="true">
                      {figmaIcon}
                    </span>
                  ) : (
                    <Icon aria-hidden="true" />
                  )}
                  <span>{label}</span>
                </Button>
              ))}
            </section>

            <section className={styles.metrics} aria-label="今日营养指标">
              {metricCards.map((metric) => (
                <article className={styles.metricCard} key={metric.label}>
                  <div>
                    <span className={styles.metricLabel}>{metric.label}</span>
                    <strong>
                      {metric.value}
                      <small>{metric.unit}</small>
                    </strong>
                  </div>
                  <span
                    className={`${styles.progress} ${styles[`progress${metric.tone[0].toUpperCase()}${metric.tone.slice(1)}`]}`}
                  >
                    {isFigmaFixture ? (
                      <FigmaWorkspaceAsset className={styles.figmaMetricRing} variant="home" name={metric.figmaAsset} />
                    ) : null}
                    <span>{metric.progress}%</span>
                  </span>
                </article>
              ))}
            </section>

            <section className={styles.dashboardGrid}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h2>活跃会话</h2>
                </div>
                <div className={styles.sessionCards}>
                  {sessions.map((session, index) => (
                    <Button
                      className={styles.sessionCard}
                      variant="ghost"
                      key={session.id}
                      type="button"
                      onClick={() => navigate(`/chat/${session.id}`)}
                    >
                      {isFigmaFixture ? (
                        <FigmaWorkspaceAsset
                          className={styles.figmaActivityDot}
                          variant="home"
                          name={
                            index === 0 ? 'activityDotGreen' : index === 1 ? 'activityDotYellow' : 'activityDotBlue'
                          }
                        />
                      ) : (
                        <span className={`${styles.sessionDot} ${styles[`dot${index}`]}`} aria-hidden="true" />
                      )}
                      <span>
                        <strong>{session.title}</strong>
                        <small>{session.subtitle}</small>
                      </span>
                      {isFigmaFixture ? (
                        <FigmaWorkspaceAsset className={styles.figmaArrow} variant="home" name="arrowRight" />
                      ) : (
                        <ArrowRight aria-hidden="true" />
                      )}
                    </Button>
                  ))}
                </div>
              </article>

              <article className={`${styles.panel} ${styles.pendingPanel}`}>
                <div className={styles.panelHeader}>
                  <h2>待确认队列</h2>
                </div>
                <div className={styles.pendingCards}>
                  {pendingItems.map((item) => {
                    const confirmed = confirmedItems.includes(item.id);
                    return (
                      <div
                        className={`${styles.pendingCard} ${confirmed ? styles.pendingConfirmed : ''}`}
                        key={item.id}
                      >
                        <span>
                          <strong>{item.title}</strong>
                          <small>{confirmed ? '已提交确认' : isFigmaFixture ? item.figmaDetail : item.detail}</small>
                        </span>
                        <Button
                          className={styles.confirmButton}
                          size="sm"
                          onClick={() => confirmItem(item.id, item.prompt)}
                        >
                          {confirmed ? <Check aria-hidden="true" /> : null}
                          {confirmed ? '已确认' : '确认'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>

            {isFigmaFixture ? (
              <section className={styles.statusPanel} aria-labelledby="status-title">
                <h2 id="status-title">任务入口与状态</h2>
                <p>输入器：空输入时发送禁用 · 有内容时启用 · Agent 运行中切换为停止 · 附件解析中显示进度</p>
                <p>高频任务点击后带入输入器；继续任务打开原会话；查看全部进入会话列表。</p>
                <p className={styles.statusGreen}>
                  Tools / Agents 面板可展开查看健康状态；待处理事项覆盖写入确认、预算追加、记忆确认和失败任务。
                </p>
                <p className={styles.statusMuted}>
                  摘要局部失败支持重试，不替换已有成功数据；空态不展示虚构营养或任务数据。
                </p>
              </section>
            ) : null}
          </>
        )}
      </div>
    </WorkspaceLayout>
  );
}

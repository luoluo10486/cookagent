import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  ChartColumn,
  CircleSlash,
  LoaderCircle,
  MessageCircle,
  Search,
  XCircle,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AgentRunView, AgentDisplayStatus, AgentStreamConnection } from '../../types/agent';
import type { Message } from '../../types/session';
import type { SessionSummary } from '../../types/session';
import { WorkspaceLayout } from '../../layouts/WorkspaceLayout/WorkspaceLayout';
import { Composer } from '../../components/workspace/Composer';
import { AgentStatusStrip } from '../../components/agent/AgentStatusStrip';
import { CitationBlock } from '../../components/agent/CitationBlock';
import { AgentFeedback } from '../../components/agent/AgentFeedback';
import { ResultCard } from '../../components/agent/ResultCard';
import { ClarificationCard } from '../../components/agent/ClarificationCard';
import { ConfirmationCard } from '../../components/agent/ConfirmationCard';
import { ErrorState } from '../../components/common/ErrorState';
import { AvatarImage } from '../../components/common/AvatarImage';
import { DEFAULT_AVATARS, FIGMA_CHAT_AVATARS, resolveAvatarUrl } from '../../lib/avatar';
import { getAuthUser } from '../../services/authService';
import { useAgentReplay } from '../../services/agentService';
import { ApiError } from '../../services/apiClient';
import { createSession, loadSessionMessages, sendUserMessage, type RealMessage } from '../../services/sessionService';
import {
  cancelAgentRun,
  confirmAgentWrite,
  executeAgentWrite,
  extendAgentRunBudget,
  openAgentRunStream,
  rejectAgentWrite,
  recoverAgentRun,
  type AgentRunEvent,
} from '../../services/agentRunService';
import styles from './ChatPage.module.css';

const FIGMA_CHAT_SIDEBAR_AVATAR = FIGMA_CHAT_AVATARS.sidebar;
const FIGMA_CHAT_TOPBAR_AVATAR = FIGMA_CHAT_AVATARS.topbar;
const FIGMA_CHAT_MESSAGE_AVATAR = FIGMA_CHAT_AVATARS.message;

type ChatMessage = {
  id: string;
  role: Message['role'];
  content: string;
  time: string;
  source?: string;
  wide?: boolean;
  agentRunId?: string;
};

function displayRunStatus(status: string): AgentDisplayStatus {
  if (status === 'queued' || status === 'routed') return 'routing';
  if (status === 'planning' || status === 'retrieving' || status === 'executing') {
    return status === 'executing' ? 'executing_tools' : status;
  }
  if (status === 'validating') return 'validating';
  if (status === 'waiting_user') return 'waiting_user';
  if (status === 'failed' || status === 'cancelled' || status === 'completed' || status === 'superseded') return status;
  return 'routing';
}

function runtimeErrorMessage(payload: { code?: string; error_message?: string; message?: string }) {
  if (payload.code === 'RUNTIME_COORDINATION_UNAVAILABLE') return '系统暂时异常，运行协调服务不可用，请稍后重试。';
  if (payload.code === 'RUNTIME_CAPACITY_EXCEEDED') return '当前运行队列已满，请稍后重试。';
  if (payload.code === 'RUNTIME_QUEUE_TIMEOUT') return '请求排队超时，请稍后重试。';
  if (payload.code === 'MODEL_PROVIDER_UNAVAILABLE') return '模型服务暂时不可用，请稍后重试。';
  return payload.error_message ?? payload.message ?? 'Agent 运行失败。';
}

function formatMessageTime(value: string) {
  if (!value.includes('-')) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({
  message,
  children,
  userAvatarSrc,
}: {
  message: ChatMessage;
  children?: ReactNode;
  userAvatarSrc?: string;
}) {
  const isUser = message.role === 'user';
  const authUser = getAuthUser();
  // 消息头像也走统一解析，避免历史 Fixture 路径通过组件参数直接渲染。
  const userAvatar = resolveAvatarUrl(userAvatarSrc ?? authUser.avatarUrl, authUser.gender);
  return (
    <article className={`${styles.message} ${isUser ? styles.user : styles.assistant}`}>
      {isUser ? (
        <>
          <div className={styles.userLine}>
            <div className={styles.messageBubble}>{message.content}</div>
            <span className={styles.srOnly}>你</span>
            <span className={styles.userAvatar} aria-hidden="true">
              <AvatarImage avatarUrl={userAvatar} gender={authUser.gender} alt="" />
            </span>
          </div>
          <div className={styles.messageMeta}>Anddy · {formatMessageTime(message.time)} PM</div>
        </>
      ) : (
        <>
          <span className={styles.agentAvatar} aria-hidden="true" />
          <div className={`${styles.assistantBody} ${message.wide ? styles.assistantBodyWide : ''}`}>
            <div className={styles.messageBubble}>
              <p className={styles.messageText}>{message.content}</p>
              {message.source ? <div className={styles.source}>{message.source}</div> : null}
              {children}
            </div>
            <div className={styles.messageMeta}>Fustat-v2 Agent · {formatMessageTime(message.time)} PM</div>
          </div>
        </>
      )}
    </article>
  );
}

function TraceRail({ run, designChat = false }: { run: AgentRunView; designChat?: boolean }) {
  const [tab, setTab] = useState<'steps' | 'json'>('steps');
  return (
    <aside className={`${styles.tracePanel} ${designChat ? styles.designTracePanel : ''}`} aria-label="运行轨迹">
      <div className={styles.traceTitle}>运行轨迹</div>
      <span className={styles.srOnly}>工具与引用</span>
      <Tabs value={tab} onValueChange={(value) => setTab(value as 'steps' | 'json')}>
        <TabsList className={styles.traceTabs} aria-label="运行轨迹视图">
          <TabsTrigger value="steps">步骤</TabsTrigger>
          <TabsTrigger value="json">原始 JSON</TabsTrigger>
        </TabsList>
        <TabsContent className={styles.traceBody} value="steps">
          <span className={styles.runId}>RUN ID: {run.id}</span>
          {run.toolCalls.length ? (
            <div className={styles.traceList}>
              {run.toolCalls.map((tool) => (
                <div
                  className={`${styles.traceStep} ${tool.status === 'running' ? styles.traceStepActive : ''} ${tool.status === 'pending' ? styles.traceStepPending : ''}`}
                  key={tool.id}
                >
                  <strong>{tool.displayName || tool.name}</strong>
                  <span>{tool.latencyMs ? `${tool.latencyMs}ms` : tool.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.traceEmpty}>等待运行事件...</div>
          )}
        </TabsContent>
        <TabsContent className={styles.traceBody} value="json">
          <pre className={styles.traceJson}>{JSON.stringify(run, null, 2)}</pre>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function CitationList({ citations }: { citations: AgentRunView['citations'] }) {
  if (!citations.length) return null;
  return (
    <div className={styles.citationList} aria-label="知识库引用">
      {citations.map((citation) => (
        <CitationBlock citation={citation} key={citation.id} />
      ))}
    </div>
  );
}

function InlineConfirmationCard({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <section className={styles.inlineConfirmation} aria-label="饮食记录确认">
      <h3>是否将此记录到你的周二饮食日志？</h3>
      <RadioGroup aria-label="饮食记录目标" className={styles.inlineConfirmationOptions} defaultValue="add-to-lunch">
        <div className={styles.inlineConfirmationOption}>
          <RadioGroupItem aria-label="是，添加到今天的午餐" id="meal-log-add-to-lunch" value="add-to-lunch" />
          <label htmlFor="meal-log-add-to-lunch">是，添加到今天的午餐</label>
        </div>
        <div className={styles.inlineConfirmationOption}>
          <RadioGroupItem aria-label="否，仅作为对话参考" id="meal-log-reference-only" value="reference-only" />
          <label htmlFor="meal-log-reference-only">否，仅作为对话参考</label>
        </div>
      </RadioGroup>
      <div className={styles.inlineConfirmationActions}>
        <Button type="button" onClick={onConfirm}>
          提交并继续
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </section>
  );
}

type ChatSurfaceProps = {
  run: AgentRunView;
  messagesRef: React.RefObject<HTMLDivElement>;
  children: ReactNode;
  input: string;
  running: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  placeholder: string;
  showTrace?: boolean;
  avatarSrc?: string;
  sidebarAvatarSrc?: string;
  topAvatarSrc?: string;
  displayNameOverride?: string;
  profileIdOverride?: string;
  showKnowledgeTopNav?: boolean;
  designChat?: boolean;
  fixtureVariant?: 'chat';
  pageVariant?: 'completed-citations' | 'figma-default';
  statusForStrip?: AgentDisplayStatus;
  statusVisualState?: 'user-cancelled';
  pageOverlay?: ReactNode;
  sidebarFixture?: {
    sessions: SessionSummary[];
    currentPage: number;
    searchValue?: string;
  };
};

function ChatSurface({
  run,
  messagesRef,
  children,
  input,
  running,
  disabled,
  onChange,
  onSend,
  onStop,
  placeholder,
  showTrace = true,
  avatarSrc,
  sidebarAvatarSrc,
  topAvatarSrc,
  displayNameOverride,
  profileIdOverride,
  showKnowledgeTopNav,
  designChat,
  fixtureVariant,
  pageVariant,
  statusForStrip,
  statusVisualState,
  pageOverlay,
  sidebarFixture,
}: ChatSurfaceProps) {
  return (
    <WorkspaceLayout
      activeModule="chat"
      avatarSrc={avatarSrc}
      designChat={designChat}
      fixtureVariant={fixtureVariant}
      displayNameOverride={displayNameOverride}
      profileIdOverride={profileIdOverride}
      pageOverlay={pageOverlay}
      rightRail={showTrace ? <TraceRail run={run} designChat={designChat} /> : undefined}
      sidebarFixture={sidebarFixture}
      showKnowledgeTopNav={showKnowledgeTopNav}
      sidebarAvatarSrc={sidebarAvatarSrc}
      topAvatarSrc={topAvatarSrc}
    >
      <div
        className={`${styles.page} ${designChat ? styles.designChatPage : ''} ${pageVariant === 'completed-citations' ? styles.completedCitationsPage : ''} ${pageVariant === 'figma-default' ? styles.figmaDefaultPage : ''}`}
      >
        <section className={styles.workspace}>
          <div className={styles.center}>
            <AgentStatusStrip
              status={statusForStrip ?? run.status}
              failedStep={run.failedStep}
              preserveTones={designChat}
              visualState={statusVisualState}
            />
            <div className={styles.messages} ref={messagesRef}>
              {children}
            </div>
          </div>
        </section>
        <Composer
          value={input}
          running={running}
          disabled={disabled}
          placeholder={placeholder}
          onChange={onChange}
          onSend={onSend}
          onStop={onStop}
          fixtureVariant={fixtureVariant}
        />
      </div>
    </WorkspaceLayout>
  );
}

function approvalParameters(details: NonNullable<AgentRunEvent['details']>) {
  return {
    meal_time: details.meal_time,
    meal_type: details.meal_type,
    notes: details.notes ?? null,
    items: (details.items ?? []).map((item) => ({
      name: item.name,
      amount: item.amount,
      unit: item.unit,
    })),
  };
}

export function ChatPage() {
  const [searchParams] = useSearchParams();
  const auxiliaryState = getChatAuxState(searchParams.get('state'));
  if (auxiliaryState) return <ChatAuxStatePage state={auxiliaryState} />;
  if (searchParams.get('state') === 'empty') return <EmptyChatPage />;
  if (searchParams.get('state') === 'planning') return <PlanningStatePage />;
  if (searchParams.get('state') === 'tool-executing') return <ToolExecutingStatePage />;
  if (searchParams.get('state') === 'awaiting-clarification') return <AwaitingClarificationStatePage />;
  if (searchParams.get('state') === 'write-confirmation') return <AgentStatePage state="write-confirmation" />;
  if (searchParams.get('state') === 'budget-limit') return <AgentStatePage state="budget-limit" />;
  if (searchParams.get('state') === 'tool-failed-retryable') return <AgentStatePage state="tool-failed-retryable" />;
  if (searchParams.get('state') === 'safety-degraded') return <AgentStatePage state="safety-degraded" />;
  if (searchParams.get('state') === 'user-cancelled') return <AgentStatePage state="user-cancelled" />;
  if (searchParams.get('state') === 'sse-reconnecting') return <AgentStatePage state="sse-reconnecting" />;
  return import.meta.env.VITE_AGENT_MODE === 'real' ? <RealChatPage /> : <MockChatPage />;
}

const emptyPrompts = [
  {
    title: '分析我今天的饮食',
    description: '计算卡路里及三大营养素比例',
    prompt: '分析我今天的饮食，计算卡路里及三大营养素比例',
    icon: ChartColumn,
  },
  {
    title: '制定本周餐食计划',
    description: '根据我的减脂目标个性化定制',
    prompt: '根据我的减脂目标制定本周餐食计划',
    icon: CalendarDays,
  },
  {
    title: '查询食物营养成分',
    description: '快速查询牛油果/奇亚籽等营养价值',
    prompt: '查询牛油果和奇亚籽的营养成分',
    icon: Search,
  },
] as const;

function EmptyChatPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');

  const send = () => {
    const prompt = input.trim();
    if (!prompt) return;
    navigate(`/chat?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <WorkspaceLayout activeModule="home">
      <div className={styles.emptyPage}>
        <section className={styles.emptyBody} aria-labelledby="empty-chat-title">
          <div className={styles.emptyIntro}>
            <div className={styles.emptyIcon} aria-hidden="true">
              <MessageCircle />
            </div>
            <h1 id="empty-chat-title">开始新的对话</h1>
            <p>
              你可以询问任何关于营养、饮食和健康的问题。FoodMate 饮食管家已接入 Fustat-v2
              营养大模型，将为你提供专业支持。
            </p>
          </div>
          <div className={styles.emptyPrompts} aria-label="推荐问题">
            {emptyPrompts.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  className={styles.emptyPrompt}
                  variant="ghost"
                  key={item.title}
                  type="button"
                  onClick={() => setInput(item.prompt)}
                >
                  <span className={styles.emptyPromptIcon} aria-hidden="true">
                    <Icon />
                  </span>
                  <span className={styles.emptyPromptCopy}>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </span>
                </Button>
              );
            })}
          </div>
        </section>
        <Composer
          value={input}
          placeholder="输入消息或添加自定义指令..."
          onChange={setInput}
          onSend={send}
          onStop={() => undefined}
        />
      </div>
    </WorkspaceLayout>
  );
}

function PlanningStatePage() {
  const planningAvatarSrc = DEFAULT_AVATARS.male;
  const planningLoaderSrc = '/assets/figma/agent-chat/planning-loader.svg';
  const planningSidebar = { ...historyFixture('history-page-2').sidebar, currentPage: 1 };
  const planningRun: AgentRunView = {
    id: 'run_planning_fixture',
    status: 'planning',
    intent: 'analysis',
    toolsUsed: 0,
    toolsTotal: 6,
    agentsUsed: 0,
    agentsTotal: 1,
    toolCalls: [],
    citations: [],
  };

  return (
    <ChatSurface
      run={planningRun}
      messagesRef={useRef<HTMLDivElement>(null)}
      input=""
      running
      disabled
      onChange={() => undefined}
      onSend={() => undefined}
      onStop={() => undefined}
      placeholder="正在规划任务流程，请稍候..."
      showTrace={false}
      avatarSrc={planningAvatarSrc}
      sidebarAvatarSrc={planningAvatarSrc}
      topAvatarSrc={planningAvatarSrc}
      displayNameOverride="Anddy"
      profileIdOverride="1234567"
      showKnowledgeTopNav={false}
      designChat
      sidebarFixture={planningSidebar}
    >
      <article className={styles.planningUserMessage}>
        <div className={styles.planningUserLine}>
          <div className={styles.planningUserBubble}>帮我分析这周的蛋白质摄入情况</div>
          <span className={styles.planningUserAvatar} aria-hidden="true">
            <AvatarImage avatarUrl={planningAvatarSrc} gender="男" alt="" />
          </span>
        </div>
        <div className={styles.planningMessageMeta}>Anddy · 12:45 PM</div>
      </article>
      <article className={styles.planningAssistantMessage}>
        <span className={styles.planningAgentAvatar} aria-hidden="true" />
        <div className={styles.planningAssistantBody}>
          <div className={styles.planningBubble}>
            <div className={styles.planningTitle}>
              <img className={styles.planningLoader} src={planningLoaderSrc} alt="" />
              <strong>Planning...</strong>
            </div>
            <div className={styles.planningSteps}>
              <span className={styles.planningStepDone}>✓ 理解用户意图</span>
              <strong className={styles.planningStepActive}>● 制定分析方案...</strong>
              <span className={styles.planningStepPending}>○ 获取这周饮食数据</span>
              <span className={styles.planningStepPending}>○ 汇总并生成评估图表</span>
            </div>
          </div>
        </div>
      </article>
    </ChatSurface>
  );
}

const executingToolSteps = [
  {
    label: '向量索引检索 - 12ms ✓',
    status: 'success' as const,
    iconSrc: '/assets/figma/agent-chat/tool-executing-check.svg',
  },
  {
    label: '数据库调用 - running...',
    status: 'running' as const,
    iconSrc: '/assets/figma/agent-chat/tool-executing-loader-running.svg',
  },
  {
    label: '营养计算 - pending',
    status: 'pending' as const,
    iconSrc: '/assets/figma/agent-chat/tool-executing-minus.svg',
  },
];

function ToolExecutingStatePage() {
  const executingAvatarSrc = DEFAULT_AVATARS.male;
  const executingSidebar = { ...historyFixture('history-page-2').sidebar, currentPage: 1 };
  const executingRun: AgentRunView = {
    id: 'fst_trace_9821aa',
    status: 'executing_tools',
    intent: 'analysis',
    toolsUsed: 1,
    toolsTotal: 3,
    agentsUsed: 0,
    agentsTotal: 1,
    toolCalls: [
      {
        id: 'intent-parse',
        name: 'intent_parse',
        displayName: '意图解析',
        status: 'success',
        latencyMs: 8,
        summary: '已完成意图解析',
      },
      {
        id: 'vector-search',
        name: 'vector_search',
        displayName: '向量检索: 蛋白质推荐',
        status: 'success',
        latencyMs: 12,
        summary: '正在读取蛋白质推荐索引',
      },
      {
        id: 'meal-log-query',
        name: 'meal_log_query',
        displayName: '数据库调用: 饮食日志表',
        status: 'running',
        summary: '正在读取饮食日志表',
      },
      {
        id: 'result-compose',
        name: 'result_compose',
        displayName: '结果合成',
        status: 'pending',
        summary: '等待前置工具完成',
      },
    ],
    citations: [],
  };

  return (
    <ChatSurface
      run={executingRun}
      messagesRef={useRef<HTMLDivElement>(null)}
      input=""
      running
      disabled
      onChange={() => undefined}
      onSend={() => undefined}
      onStop={() => undefined}
      placeholder="正在运行数据计算工具..."
      avatarSrc={executingAvatarSrc}
      sidebarAvatarSrc={executingAvatarSrc}
      topAvatarSrc={executingAvatarSrc}
      displayNameOverride="Anddy"
      profileIdOverride="1234567"
      showKnowledgeTopNav={false}
      designChat
      sidebarFixture={executingSidebar}
    >
      <article className={styles.executingUserMessage}>
        <div className={styles.executingUserLine}>
          <div className={styles.executingUserBubble}>帮我分析这周的蛋白质摄入情况</div>
          <span className={styles.executingUserAvatar} aria-hidden="true">
            <AvatarImage avatarUrl={executingAvatarSrc} gender="男" alt="" />
          </span>
        </div>
        <div className={styles.executingMessageMeta}>Anddy · 12:45 PM</div>
      </article>
      <article className={styles.executingAssistantMessage}>
        <span className={styles.executingAgentAvatar} aria-hidden="true" />
        <div className={styles.executingAssistantBody}>
          <div className={styles.executingBubble}>
            <div className={styles.executingTitle}>
              <img className={styles.executingLoader} src="/assets/figma/agent-chat/tool-executing-loader.svg" alt="" />
              <strong>Executing Tools...</strong>
            </div>
            <div className={styles.executingToolSteps}>
              {executingToolSteps.map((step) => {
                return (
                  <div
                    className={`${styles.executingToolStep} ${styles[`executingToolStep${step.status}`]}`}
                    key={step.label}
                  >
                    <img className={styles.executingToolIcon} src={step.iconSrc} alt="" />
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </article>
    </ChatSurface>
  );
}

function AwaitingClarificationStatePage() {
  const awaitingMessageAvatarSrc = DEFAULT_AVATARS.male;
  const awaitingSidebar = { ...historyFixture('history-page-2').sidebar, currentPage: 1 };
  const awaitingRun: AgentRunView = {
    id: 'run_awaiting_clarification_fixture',
    status: 'planning',
    intent: 'record',
    toolsUsed: 0,
    toolsTotal: 2,
    agentsUsed: 0,
    agentsTotal: 1,
    toolCalls: [],
    citations: [],
  };

  return (
    <ChatSurface
      run={awaitingRun}
      messagesRef={useRef<HTMLDivElement>(null)}
      input=""
      running={false}
      avatarSrc={awaitingMessageAvatarSrc}
      designChat
      displayNameOverride="Anddy"
      profileIdOverride="1234567"
      sidebarAvatarSrc={DEFAULT_AVATARS.male}
      topAvatarSrc={DEFAULT_AVATARS.male}
      onChange={() => undefined}
      onSend={() => undefined}
      onStop={() => undefined}
      placeholder="输入你的详细食物或份量，例如：150克野生三文鱼..."
      showKnowledgeTopNav={false}
      showTrace={false}
      sidebarFixture={awaitingSidebar}
    >
      <article className={styles.awaitingUserMessage}>
        <div className={styles.awaitingUserLine}>
          <div className={styles.awaitingUserBubble}>记录一下我的午餐</div>
          <span className={styles.awaitingUserAvatar} aria-hidden="true">
            <AvatarImage avatarUrl={awaitingMessageAvatarSrc} gender="男" alt="" />
          </span>
        </div>
        <div className={styles.awaitingMessageMeta}>Anddy · 12:45 PM</div>
      </article>
      <article className={styles.awaitingAssistantMessage}>
        <span className={styles.awaitingAgentAvatar} aria-hidden="true" />
        <div className={styles.awaitingAssistantBody}>
          <ClarificationCard
            options={['补充食物和份量', '上传照片识别']}
            presentation="figma-compact"
            question="你的午餐具体包含哪些食物？"
            title="需要确认以下信息："
          />
        </div>
      </article>
    </ChatSurface>
  );
}

type AgentFixtureState =
  | 'write-confirmation'
  | 'budget-limit'
  | 'tool-failed-retryable'
  | 'safety-degraded'
  | 'user-cancelled'
  | 'sse-reconnecting';

type ChatAuxState =
  | 'completed-with-citations'
  | 'redesign-default'
  | 'nav-loading'
  | 'nav-hover-preview'
  | 'pagination'
  | 'history-page-2'
  | 'history-page-3'
  | 'search-results'
  | 'session-actions'
  | 'renamed'
  | 'archived'
  | 'trash'
  | 'running-stop';

function getChatAuxState(value: string | null): ChatAuxState | undefined {
  const states: ChatAuxState[] = [
    'completed-with-citations',
    'redesign-default',
    'nav-loading',
    'nav-hover-preview',
    'pagination',
    'history-page-2',
    'history-page-3',
    'search-results',
    'session-actions',
    'renamed',
    'archived',
    'trash',
    'running-stop',
  ];
  return value && states.includes(value as ChatAuxState) ? (value as ChatAuxState) : undefined;
}

type FixtureAction =
  | 'idle'
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'continued'
  | 'ended'
  | 'retried'
  | 'skipped'
  | 'restarted'
  | 'error';

function fixtureRun(state: AgentFixtureState): AgentRunView {
  const status: AgentRunView['status'] =
    state === 'tool-failed-retryable'
      ? 'failed'
      : state === 'safety-degraded'
        ? 'completed'
        : state === 'user-cancelled'
          ? 'cancelled'
          : state === 'sse-reconnecting'
            ? 'executing_tools'
            : 'composing';
  return {
    id: `fixture_${state}`,
    status,
    failedStep: state === 'tool-failed-retryable' ? 'executing_tools' : undefined,
    intent: state === 'write-confirmation' ? 'record' : state === 'budget-limit' ? 'analysis' : 'planning',
    toolsUsed: state === 'sse-reconnecting' ? 2 : state === 'tool-failed-retryable' ? 2 : 6,
    toolsTotal: 6,
    agentsUsed: 1,
    agentsTotal: 1,
    toolCalls: [],
    citations: [],
  };
}

type HistoryFixture = {
  prompt: string;
  response: string;
  source?: string;
  run: AgentRunView;
  sidebar: {
    sessions: SessionSummary[];
    currentPage: number;
    searchValue?: string;
  };
};

function historyFixture(
  state: Extract<ChatAuxState, 'history-page-2' | 'history-page-3' | 'search-results'>,
): HistoryFixture {
  const isSearch = state === 'search-results';
  const isPageThree = state === 'history-page-3';
  const baseSessions: SessionSummary[] = [
    { id: 'weekly-adjustment', title: '每周饮食微调', subtitle: '12:45', active: true, status: 'completed' },
    { id: 'pre-workout-snack', title: '运动前零食建议', subtitle: '12:45', status: 'completed' },
    { id: 'allergen-rules', title: '过敏原排除规则', subtitle: '12:45', status: 'completed' },
    { id: 'protein-supplement', title: '蛋白质补充方案', subtitle: '12:45', status: 'completed' },
    { id: 'bedtime-snack', title: '睡前加餐建议', subtitle: '12:45', status: 'completed' },
    { id: 'breakfast-carbs', title: '早餐碳水搭配', subtitle: '12:45', status: 'completed' },
    { id: 'dinner-protein', title: '晚餐蛋白质补充', subtitle: '12:45', status: 'completed' },
    { id: 'low-carb-diet', title: '低碳水饮食建议', subtitle: '12:45', status: 'completed' },
  ];
  const searchSessions: SessionSummary[] = [
    { id: 'protein-supplement', title: '蛋白质补充方案', subtitle: '12:45', active: true, status: 'completed' },
    { id: 'high-protein-breakfast', title: '高蛋白早餐建议', subtitle: '12:45', status: 'completed' },
    { id: 'dinner-protein', title: '晚餐蛋白质补充', subtitle: '12:45', status: 'completed' },
    { id: 'protein-supplement-history', title: '蛋白质补充方案', subtitle: '12:45', status: 'completed' },
    { id: 'bedtime-snack', title: '睡前加餐建议', subtitle: '12:45', status: 'completed' },
    { id: 'breakfast-carbs', title: '早餐碳水搭配', subtitle: '12:45', status: 'completed' },
    { id: 'dinner-protein-history', title: '晚餐蛋白质补充', subtitle: '12:45', status: 'completed' },
    { id: 'low-carb-diet', title: '低碳水饮食建议', subtitle: '12:45', status: 'completed' },
  ];
  return {
    prompt: '我午餐吃了一些野生三文鱼和藜麦，但我不确定具体的蛋白质含量。',
    response:
      'I have analyzed the typical values for wild salmon (150g) and cooked quinoa (100g). Together, they provide approximately 38g of high-quality protein.',
    source: 'Source: USDA FoodData Central Ref #451992',
    run: {
      id: 'fst_trace_88192a',
      status: 'executing_tools',
      intent: 'analysis',
      toolsUsed: 4,
      toolsTotal: 4,
      agentsUsed: 1,
      agentsTotal: 1,
      citations: [],
      toolCalls: [
        {
          id: 'query-expansion',
          name: 'query_expansion',
          displayName: '查询扩展',
          status: 'success',
          latencyMs: 12,
          summary: '已完成查询扩展',
        },
        {
          id: 'vector-search',
          name: 'vector_search',
          displayName: '向量索引检索',
          status: 'success',
          latencyMs: 184,
          summary: '已命中知识库向量索引',
        },
        {
          id: 'usda-lookup',
          name: 'usda_lookup',
          displayName: 'USDA 数据库调用',
          status: 'success',
          latencyMs: 92,
          summary: '已返回标准营养值',
        },
        {
          id: 'response-compose',
          name: 'response_compose',
          displayName: '响应合成',
          status: 'success',
          latencyMs: 45,
          summary: '已生成可追溯回答',
        },
      ],
    },
    sidebar: {
      sessions: isSearch ? searchSessions : baseSessions,
      currentPage: isSearch ? 1 : isPageThree ? 3 : 2,
      searchValue: isSearch ? '高蛋白' : undefined,
    },
  };
}

function navigationFixture(): HistoryFixture {
  const fixture = historyFixture('history-page-2');
  return {
    ...fixture,
    sidebar: {
      ...fixture.sidebar,
      currentPage: 1,
    },
    prompt: '我午餐吃了一些野生三文鱼和藜麦，但我不确定具体的蛋白质含量。',
    response:
      '我已为您分析了野生三文鱼（150克）和熟藜麦（100克）的标准营养价值。它们一共可提供大约 38 克的优质蛋白质。',
    source: '来源: USDA FoodData Central Ref #451992',
    run: {
      ...fixture.run,
      toolCalls: [
        {
          id: 'query-expansion',
          name: 'query_expansion',
          displayName: '查询扩展 (Query Expansion)',
          status: 'success',
          latencyMs: 12,
          summary: '已完成查询扩展',
        },
        {
          id: 'vector-search',
          name: 'vector_search',
          displayName: '向量索引检索 (RAG Search)',
          status: 'success',
          latencyMs: 184,
          summary: '已命中知识库向量索引',
        },
        {
          id: 'usda-lookup',
          name: 'usda_lookup',
          displayName: 'USDA 数据库调用 (API Call)',
          status: 'success',
          latencyMs: 92,
          summary: '已返回标准营养值',
        },
        {
          id: 'response-compose',
          name: 'response_compose',
          displayName: '响应合成 (Response Generation)',
          status: 'success',
          latencyMs: 45,
          summary: '已生成可追溯回答',
        },
      ],
    },
  };
}

function redesignDefaultFixture(): HistoryFixture {
  const fixture = historyFixture('history-page-2');
  return {
    ...fixture,
    sidebar: {
      ...fixture.sidebar,
      currentPage: 1,
    },
  };
}

function completedCitationsFixture(): HistoryFixture {
  const fixture = historyFixture('history-page-2');
  return {
    ...fixture,
    prompt: '分析我这周的蛋白质摄入',
    response:
      '我已对你本周的饮食记录进行了完整分析。整体来看，你的蛋白质摄入表现健康，有明显的规律性，但在周末略有下滑。',
    source: undefined,
    run: {
      ...fixture.run,
      id: 'fixture_completed_with_citations',
      status: 'completed',
      intent: 'analysis',
      toolsUsed: 4,
      toolsTotal: 4,
      citations: [
        {
          id: '4451002',
          title: 'USDA FoodData Central - Ref #4451002',
          snippet: '标准食物营养数据',
          source: 'USDA FoodData Central',
        },
        {
          id: 'meal-log-2024-03-08',
          title: '用户饮食记录 2024-03-08~03-14',
          snippet: '本周饮食记录',
          source: 'FoodMate 饮食记录',
        },
      ],
    },
    sidebar: {
      ...fixture.sidebar,
      currentPage: 1,
    },
  };
}

function ProteinAnalysisCard() {
  return (
    <>
      <section className={styles.completedAnalysisCard} aria-label="本周蛋白质摄入分析">
        <h2>本周蛋白质摄入分析</h2>
        <div className={styles.completedMetricGrid}>
          <div>
            <span>日均摄入</span>
            <strong>85g</strong>
          </div>
          <div>
            <span>目标达成率</span>
            <strong>78%</strong>
          </div>
          <div>
            <span>最低日</span>
            <strong>周三 62g</strong>
          </div>
        </div>
      </section>
      <div className={styles.completedCitations} aria-label="数据源引用">
        <strong>数据源引用：</strong>
        <div className={styles.completedCitationList}>
          <span>[1] USDA FoodData Central - Ref #4451002</span>
          <span>[2] 用户饮食记录 2024-03-08~03-14</span>
        </div>
      </div>
    </>
  );
}

type SessionOverlayState = Extract<ChatAuxState, 'session-actions' | 'renamed' | 'archived' | 'trash'>;

function SessionStateOverlay({
  state,
  onAction,
  onClose,
}: {
  state: SessionOverlayState;
  onAction: (message: string) => void;
  onClose: () => void;
}) {
  if (state === 'session-actions') {
    return (
      <div className={styles.sessionActionsBackdrop}>
        <Card className={styles.sessionActionsOverlay} role="dialog" aria-label="会话管理">
          <span className={styles.sessionActionsOverlayStatus}>操作</span>
          <Button
            size="icon"
            variant="ghost"
            className={styles.sessionActionsOverlayClose}
            aria-label="关闭会话管理"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
          <h2>会话管理</h2>
          <p>选择一个会话后可重命名、归档，或移入回收站</p>
          <section className={styles.sessionActionsSelected} aria-label="当前会话">
            <span className={styles.sessionActionsRunningDot} aria-hidden="true" />
            <div>
              <strong>每周饮食微调</strong>
              <span>进行中 · 今天 12:45 更新</span>
            </div>
            <span className={styles.sessionActionsRunningStatus}>RUNNING</span>
          </section>
          <div className={styles.sessionActionsOverlayActions}>
            <Button size="sm" variant="ghost" onClick={() => onAction('已打开会话重命名入口。')}>
              重命名会话
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAction('会话已归档，可从归档列表恢复。')}>
              归档会话
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAction('会话已移入回收站，保留期内可恢复。')}>
              移入回收站
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (state === 'renamed') {
    return (
      <div className={styles.sessionRenamedBackdrop}>
        <Card className={styles.sessionRenamedCard} role="dialog" aria-modal="true" aria-label="会话已重命名">
          <span className={styles.sessionRenamedAccent} aria-hidden="true" />
          <span className={styles.sessionRenamedStatus}>SAVED</span>
          <Button
            size="icon"
            variant="ghost"
            className={styles.sessionRenamedClose}
            aria-label="关闭重命名结果"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
          <h2>会话已重命名</h2>
          <p>“每周饮食微调”已更新为“本周饮食分析”。</p>
          <span className={styles.sessionRenamedSync}>列表已同步，可继续查看此会话</span>
          <Button
            size="sm"
            variant="ghost"
            className={styles.sessionRenamedBack}
            onClick={() => onAction('已返回会话列表。')}
          >
            返回会话列表
          </Button>
        </Card>
      </div>
    );
  }

  if (state === 'archived') {
    return (
      <div className={styles.sessionArchivedBackdrop}>
        <Card className={styles.sessionArchivedCard} role="dialog" aria-modal="true" aria-label="已归档会话">
          <span className={styles.sessionArchivedAccent} aria-hidden="true" />
          <span className={styles.sessionArchivedStatus}>ARCHIVED</span>
          <Button
            size="icon"
            variant="ghost"
            className={styles.sessionArchivedClose}
            aria-label="关闭归档结果"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
          <h2>已归档会话</h2>
          <p>本页显示已归档的会话，可恢复到 Agent 对话列表。</p>
          <div className={styles.sessionArchivedItem}>每周饮食微调 · 归档于今天 12:45</div>
          <span className={styles.sessionArchivedSync}>保留会话内容，恢复后回到 Agent 对话列表</span>
          <Button
            size="sm"
            variant="ghost"
            className={styles.sessionArchivedRestore}
            onClick={() => onAction('已恢复会话，可从 Agent 对话列表继续查看。')}
          >
            恢复会话
          </Button>
        </Card>
      </div>
    );
  }

  if (state === 'trash') {
    return (
      <div className={styles.sessionTrashBackdrop}>
        <Card className={styles.sessionTrashCard} role="dialog" aria-modal="true" aria-label="会话回收站">
          <span className={styles.sessionTrashAccent} aria-hidden="true" />
          <span className={styles.sessionTrashStatus}>RECOVERABLE</span>
          <Button
            size="icon"
            variant="ghost"
            className={styles.sessionTrashClose}
            aria-label="关闭回收站结果"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
          <h2>会话回收站</h2>
          <p>删除的会话将在保留期内可恢复，不提供永久删除入口。</p>
          <div className={styles.sessionTrashItem}>运动前零食建议 · 移入回收站于今天 12:45</div>
          <span className={styles.sessionTrashSync}>回收站仅支持恢复，不提供永久删除</span>
          <Button
            size="sm"
            variant="ghost"
            className={styles.sessionTrashRestore}
            onClick={() => onAction('已恢复回收站会话，可从 Agent 对话列表继续查看。')}
          >
            恢复会话
          </Button>
        </Card>
      </div>
    );
  }
}

function ChatAuxStatePage({ state }: { state: ChatAuxState }) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const [sessionOverlayVisible, setSessionOverlayVisible] = useState(true);
  const isRunning = state === 'running-stop';
  const isCompletedCitations = state === 'completed-with-citations';
  const isHistoryState = state === 'history-page-2' || state === 'history-page-3' || state === 'search-results';
  const isSessionOverlayState =
    state === 'session-actions' || state === 'renamed' || state === 'archived' || state === 'trash';
  const isRedesignDefault = state === 'redesign-default';
  const isNavigationState = state === 'nav-loading' || state === 'nav-hover-preview' || state === 'pagination';
  const history = isCompletedCitations
    ? completedCitationsFixture()
    : isHistoryState
      ? historyFixture(state)
      : isSessionOverlayState
        ? historyFixture('search-results')
        : isRedesignDefault
          ? redesignDefaultFixture()
          : isNavigationState
            ? navigationFixture()
            : isRunning
              ? historyFixture('history-page-2')
              : undefined;
  const run = isRunning
    ? { ...(history?.run ?? fixtureRun('sse-reconnecting')), status: 'executing_tools' as const }
    : (history?.run ?? fixtureRun('tool-failed-retryable'));
  const labels: Record<ChatAuxState, string> = {
    'completed-with-citations': '分析已完成，以下内容包含可追溯引用。',
    'redesign-default': '我分析了野生三文鱼和熟藜麦的标准营养值。',
    'nav-loading': '正在载入会话与运行轨迹…',
    'nav-hover-preview': '会话预览：本周蛋白质补充方案',
    pagination: '当前显示会话列表第 1 / 3 页',
    'history-page-2': '会话历史第 2 页',
    'history-page-3': '会话历史第 3 页',
    'search-results': '会话搜索结果：蛋白质补充方案',
    'session-actions': '会话管理：可重命名、归档或移入回收站',
    renamed: '会话名称已更新：每周饮食微调',
    archived: '会话已归档，可从归档列表恢复',
    trash: '会话已移入回收站，30 天内可恢复',
    'running-stop': '正在执行早餐营养分析，可随时停止当前 Run',
  };
  return (
    <ChatSurface
      run={run}
      messagesRef={messagesRef}
      input={input}
      running={isRunning}
      disabled={false}
      onChange={setInput}
      onSend={() => setNotice('已保留输入内容，等待当前会话继续处理。')}
      onStop={() => setNotice('已请求停止当前 Run；已接收文本会保留。')}
      placeholder={isRunning ? '运行中，可停止…' : '追问或添加自定义指令...'}
      showTrace={!isCompletedCitations}
      designChat
      pageVariant={isCompletedCitations ? 'completed-citations' : undefined}
      displayNameOverride="Anddy"
      profileIdOverride="1234567"
      showKnowledgeTopNav={false}
      sidebarAvatarSrc={isCompletedCitations ? DEFAULT_AVATARS.male : undefined}
      topAvatarSrc={isCompletedCitations ? DEFAULT_AVATARS.male : undefined}
      pageOverlay={
        isSessionOverlayState && sessionOverlayVisible ? (
          <SessionStateOverlay
            state={state}
            onAction={setNotice}
            onClose={() => {
              setSessionOverlayVisible(false);
              setNotice(
                state === 'session-actions'
                  ? '已关闭会话管理面板。'
                  : state === 'renamed'
                    ? '已关闭重命名结果。'
                    : state === 'archived'
                      ? '已关闭归档结果。'
                      : '已关闭回收站结果。',
              );
            }}
          />
        ) : undefined
      }
      sidebarFixture={history?.sidebar}
    >
      {history ? (
        <>
          <MessageBubble
            message={{
              id: `${state}-user`,
              role: 'user',
              content: history.prompt,
              time: '12:45',
              wide: isNavigationState,
            }}
            userAvatarSrc={isCompletedCitations ? DEFAULT_AVATARS.male : undefined}
          />
          <MessageBubble
            message={{
              id: `${state}-assistant`,
              role: 'assistant',
              content: history.response,
              source: history.source,
              time: '12:46',
              wide: isNavigationState,
            }}
          >
            {isCompletedCitations ? (
              <ProteinAnalysisCard />
            ) : (
              <InlineConfirmationCard
                onConfirm={() => setNotice('fixture 已记录写入确认；未调用任何后端写入接口。')}
                onCancel={() => setNotice('已保留本次分析，仅作为对话参考。')}
              />
            )}
          </MessageBubble>
        </>
      ) : (
        <>
          <article className={styles.fixtureUserMessage}>
            <div className={styles.fixtureUserBubble}>帮我分析这周的饮食与蛋白质摄入情况</div>
            <span className={styles.fixtureMessageMeta}>Anddy · 12:45 PM</span>
          </article>
          <article className={styles.fixtureAuxMessage}>
            <strong>{labels[state]}</strong>
            {state === 'completed-with-citations' ? (
              <span>来源：USDA FoodData Central Ref #451992 · PubMed Central</span>
            ) : null}
            {state === 'running-stop' ? (
              <Button variant="outline" onClick={() => setNotice('已请求停止当前 Run。')}>
                <CircleSlash aria-hidden="true" />
                停止
              </Button>
            ) : null}
          </article>
        </>
      )}
      {notice ? (
        <p className={styles.fixtureActionMessage} role="status">
          {notice}
        </p>
      ) : null}
    </ChatSurface>
  );
}

function AgentStatePage({ state }: { state: AgentFixtureState }) {
  const [searchParams] = useSearchParams();
  const messagesRef = useRef<HTMLDivElement>(null);
  const [action, setAction] = useState<FixtureAction>('idle');
  const [actionMessage, setActionMessage] = useState('');
  const [input, setInput] = useState('');
  const realMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const approvalId = searchParams.get('approval_id');
  const runId = searchParams.get('run_id');
  const run = fixtureRun(state);
  const isWriteConfirmation = state === 'write-confirmation';
  const fixtureSidebar = isWriteConfirmation
    ? { ...historyFixture('history-page-2').sidebar, currentPage: 1 }
    : undefined;
  const fixtureSidebarAvatarSrc = isWriteConfirmation ? DEFAULT_AVATARS.male : undefined;
  const fixtureTopAvatarSrc = isWriteConfirmation ? DEFAULT_AVATARS.male : undefined;
  const fixtureMessageAvatarSrc = isWriteConfirmation
    ? DEFAULT_AVATARS.male
    : state === 'sse-reconnecting'
      ? DEFAULT_AVATARS.male
      : undefined;

  const report = (nextAction: FixtureAction, message: string) => {
    setAction(nextAction);
    setActionMessage(message);
  };

  const confirmWrite = async () => {
    if (!realMode) {
      report('confirmed', 'fixture 已记录确认动作，真实写入仍需后端审批事件。');
      return;
    }
    if (!approvalId) {
      report('error', '真实模式缺少 approval_id，未执行任何写入。');
      return;
    }
    report('pending', '确认请求已提交，等待后端执行事件。');
    try {
      await confirmAgentWrite(approvalId, { source: 'figma-write-confirmation' });
      report('pending', '确认请求已提交，等待后端执行事件。');
    } catch (reason) {
      report('error', reason instanceof Error ? reason.message : '写入确认失败，请稍后重试。');
    }
  };

  const cancelWrite = async () => {
    if (!realMode) {
      report('cancelled', '已取消写入，本次对话不会修改饮食记录。');
      return;
    }
    if (!approvalId) {
      report('error', '真实模式缺少 approval_id，未执行取消请求。');
      return;
    }
    report('pending', '取消请求已提交，等待后端确认。');
    try {
      await rejectAgentWrite(approvalId, { source: 'figma-write-confirmation' });
      report('pending', '取消请求已提交，等待后端确认。');
    } catch (reason) {
      report('error', reason instanceof Error ? reason.message : '取消写入失败，请稍后重试。');
    }
  };

  const extendBudget = async () => {
    if (!realMode) {
      report('continued', 'fixture 已记录追加预算动作，当前 Run 不会被伪造为新会话。');
      return;
    }
    if (!runId) {
      report('error', '真实模式缺少 run_id，未执行预算追加。');
      return;
    }
    report('pending', '预算追加请求已提交，等待当前 Run 的后续事件。');
    try {
      await extendAgentRunBudget(runId, 20000, '0.15');
      report('pending', '预算追加请求已提交，等待当前 Run 的后续事件。');
    } catch (reason) {
      report('error', reason instanceof Error ? reason.message : '预算追加失败，请稍后重试。');
    }
  };

  const endBudgetSession = async () => {
    if (!realMode) {
      report('ended', '已结束当前会话。');
      return;
    }
    if (!runId) {
      report('error', '真实模式缺少 run_id，未执行取消请求。');
      return;
    }
    report('pending', '结束请求已提交，等待当前 Run 的取消事件。');
    try {
      await cancelAgentRun(runId);
      report('pending', '结束请求已提交，等待当前 Run 的取消事件。');
    } catch (reason) {
      report('error', reason instanceof Error ? reason.message : '结束会话失败，请稍后重试。');
    }
  };

  const retryFailedTool = async () => {
    if (!realMode) {
      report('retried', 'fixture 已记录重试动作，等待新的工具事件。');
      return;
    }
    if (!runId) {
      report('error', '真实模式缺少 run_id，未执行重试。');
      return;
    }
    report('pending', '重试请求需要后端运行恢复事件，当前页面不会伪造成功。');
    try {
      await recoverAgentRun(runId);
      report('pending', '重试请求已提交，等待新的工具事件。');
    } catch (reason) {
      report('error', reason instanceof Error ? reason.message : '重试请求失败，请稍后重试。');
    }
  };

  const content = (() => {
    if (state === 'write-confirmation') {
      return (
        <div className={styles.fixtureCardWrap}>
          <Card className={`${styles.fixtureCard} ${styles.fixtureWriteCard}`}>
            <div className={styles.fixtureCardHeader}>
              <h2>确认写入以下记录</h2>
              <span>目标对象: 饮食记录</span>
            </div>
            <dl className={styles.fixtureDetails}>
              <div>
                <dt>分类</dt>
                <dd>2024年3月14日 午餐</dd>
              </div>
              <div>
                <dt>食物</dt>
                <dd>三文鱼寿司 x6</dd>
              </div>
              <div>
                <dt>热量</dt>
                <dd>约 620 千卡</dd>
              </div>
              <div>
                <dt>蛋白质</dt>
                <dd>38g</dd>
              </div>
            </dl>
            <div className={styles.fixtureMeta}>
              <span>来源: USDA FoodData Central</span>
              <span>假设: 按标准份量估算</span>
            </div>
            <div className={styles.fixtureActions}>
              <Button disabled={action === 'pending'} onClick={() => void confirmWrite()}>
                确认写入
              </Button>
              <Button disabled={action === 'pending'} variant="ghost" onClick={() => void cancelWrite()}>
                取消
              </Button>
            </div>
          </Card>
        </div>
      );
    }
    if (state === 'budget-limit') {
      return (
        <>
          <div className={styles.fixtureAssistantRow}>
            <span className={styles.fixtureAgentAvatar} aria-hidden="true" />
            <p className={styles.fixtureBudgetIntro}>
              我已在后台调用历史数据解析服务。此分析需要读取超长数据块，将会消耗较多计算令牌。
            </p>
          </div>
          <div className={`${styles.fixtureAssistantRow} ${styles.fixtureBudgetRowWrap}`}>
            <span className={styles.fixtureAgentAvatar} aria-hidden="true" />
            <Card className={`${styles.fixtureCard} ${styles.fixtureBudgetCard}`}>
              <div className={styles.fixtureBudgetTitle}>
                <AlertTriangle aria-hidden="true" />
                <h2 className={styles.fixtureBudgetTitleText}>已达到预算上限</h2>
              </div>
              <p className={styles.fixtureBudgetDescription}>
                本次会话已使用 50,000 tokens（单次会话预算上限）。为了保证资源分配合理及避免异常资费产生，你可以：
              </p>
              <div className={styles.fixtureChoiceList}>
                <span>
                  <strong>● 追加预算继续当前会话</strong>
                </span>
                <span>● 开始新会话 (之前的分析进度将会重置)</span>
              </div>
              <div className={styles.fixtureBudgetMeter}>
                <div className={styles.fixtureBudgetRow}>
                  <span>Token 用量 (100%)</span>
                  <strong>预计费用: $0.15</strong>
                </div>
                <div
                  aria-label="预算用量 100%"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={100}
                  className={styles.fixtureBudgetProgress}
                  role="progressbar"
                >
                  <span />
                </div>
              </div>
              <div className={styles.fixtureActions}>
                <Button
                  className={styles.fixtureBudgetPrimaryButton}
                  disabled={action === 'pending'}
                  onClick={() => void extendBudget()}
                >
                  追加 20,000 tokens
                </Button>
                <Button
                  className={styles.fixtureBudgetSecondaryButton}
                  disabled={action === 'pending'}
                  variant="ghost"
                  onClick={() => void endBudgetSession()}
                >
                  结束会话
                </Button>
              </div>
            </Card>
          </div>
        </>
      );
    }
    if (state === 'tool-failed-retryable') {
      return (
        <div className={styles.fixtureAssistantRow}>
          <span className={styles.fixtureAgentAvatar} aria-hidden="true" />
          <Card className={`${styles.fixtureCard} ${styles.fixtureFailureCard}`}>
            <div className={styles.fixtureStatusTitle}>
              <AlertTriangle aria-hidden="true" />
              <h2>工具执行失败</h2>
            </div>
            <div className={styles.fixtureFailureDetails}>
              <strong className={styles.fixtureErrorTitle}>数据库查询超时 (错误码: TOOL_TIMEOUT_001)</strong>
              <p className={styles.fixtureParagraph}>
                向量索引检索服务暂时不可用。FoodMate 代理在尝试读取外部知识库时失去连接。
              </p>
            </div>
            <div className={styles.fixtureActions}>
              <Button
                className={styles.fixtureRetryButton}
                disabled={action === 'pending'}
                onClick={() => void retryFailedTool()}
              >
                重试
              </Button>
              <Button
                className={styles.fixtureSkipButton}
                disabled={action === 'pending'}
                variant="outline"
                onClick={() => report('skipped', '已跳过此步骤，后续结果会明确标注数据范围受限。')}
              >
                跳过此步骤
              </Button>
            </div>
          </Card>
        </div>
      );
    }
    if (state === 'safety-degraded') {
      return (
        <div className={styles.fixtureSafetyBlock}>
          <div className={styles.fixtureSafetyTopRow}>
            <div className={styles.fixtureSafetyIdentity}>
              <span className={styles.fixtureAgentAvatar} aria-hidden="true" />
              <span className={styles.fixtureSafetyLabel}>安全降级</span>
            </div>
            <div className={`${styles.fixtureSafetyBody} ${styles.fixtureSafetyBodyAligned}`}>
              <Alert variant="warning" className={styles.fixtureSafetyAlert}>
                <AlertTitle>⚠️ 安全降级提示</AlertTitle>
                <AlertDescription>
                  由于部分工具不可用，以下回答基于有限数据生成，可能不够完整。建议稍后重试以获取完整分析。
                </AlertDescription>
              </Alert>
              <div className={styles.fixtureSafetyResponse}>
                <p className={styles.fixtureSafetyIntro}>
                  由于无法连接到本地营养配方数据库，以下为您推荐基础低钠食谱：
                </p>
                <div className={styles.fixtureSafetyDetails}>
                  <p>1. **清蒸鳕鱼配西兰花**（预计钠含量：120mg）</p>
                  <p>2. **香草烤鸡胸肉配糙米饭**（预计钠含量：150mg）</p>
                  <p>注意：由于当前未结合您的个人高血压排除条件，请谨慎添加额外酱料。</p>
                </div>
              </div>
              <p className={styles.fixtureSafetyMeta}>Fustat-v2 Agent · 1:31 PM</p>
            </div>
          </div>
        </div>
      );
    }
    if (state === 'user-cancelled') {
      return (
        <div className={`${styles.fixtureCancelledWrap} ${styles.fixtureCancelledWrapAligned}`}>
          <div className={`${styles.fixtureCancelledAssistantRow} ${styles.fixtureCancelledAssistantRowAligned}`}>
            <span className={styles.fixtureAgentAvatar} aria-hidden="true" />
            <div className={styles.fixtureCancelledAssistantBody}>
              <p className={styles.fixtureAssistantText}>
                正在为您生成减脂餐计划... 已检索到您历史减脂卡路里基准为 1600kcal...
              </p>
            </div>
          </div>
          <div className={`${styles.fixtureCancelledNotice} ${styles.fixtureCancelledNoticeAligned}`}>
            <img src="/assets/figma/agent-chat/cancel-slash.svg" alt="" />
            <span>用户已取消此次运行 · 2:16 PM</span>
          </div>
          <p className={styles.fixtureCenteredText}>你可以重新提问或开始新的对话</p>
        </div>
      );
    }
    return (
      <div className={styles.fixtureReconnectWrap}>
        <div className={styles.fixtureReconnectAssistantRow}>
          <span className={styles.fixtureAgentAvatar} aria-hidden="true" />
          <div className={styles.fixtureReconnectAssistantBody}>
            <p className={styles.fixtureAssistantText}>
              正在查询水果数据库，提取符合低生糖指数（GI &lt; 55）的食材列表...
            </p>
          </div>
        </div>
        <div className={styles.fixtureReconnectBottom}>
          <div className={`${styles.fixtureReconnectNotice} ${styles.fixtureReconnectNoticeFigma}`}>
            <img src="/assets/figma/agent-chat/tool-executing-loader-running.svg" alt="" />
            <div>
              <strong>连接已中断，正在重新连接...</strong>
              <span>第 2 次重连尝试 (最多 5 次)</span>
            </div>
          </div>
          <p className={styles.fixtureCenteredText}>如果持续失败，请刷新页面</p>
        </div>
      </div>
    );
  })();

  return (
    <ChatSurface
      run={run}
      messagesRef={messagesRef}
      input={input}
      running={state === 'sse-reconnecting'}
      disabled={state === 'budget-limit' || state === 'sse-reconnecting'}
      statusForStrip={state === 'user-cancelled' ? 'planning' : undefined}
      statusVisualState={state === 'user-cancelled' ? 'user-cancelled' : undefined}
      onChange={setInput}
      onSend={() => {
        if (state === 'safety-degraded' && input.trim())
          setActionMessage('已保留追问入口；真实模式下将由当前 Run 继续处理。');
        if (state === 'user-cancelled' && input.trim())
          report('restarted', '已准备重新开始；真实运行需要由后端创建新的 Run。');
      }}
      onStop={() => setActionMessage('取消状态会保留已接收文本，真实取消请求需要绑定具体 run_id。')}
      placeholder={
        state === 'write-confirmation'
          ? '请确认上述饮食数据是否正确...'
          : state === 'budget-limit'
            ? '追加预算以继续当前会话...'
            : state === 'sse-reconnecting'
              ? '等待重新连接...'
              : state === 'user-cancelled'
                ? '重新开始提问...'
                : '追问或添加自定义指令...'
      }
      showTrace={false}
      designChat
      displayNameOverride="Anddy"
      profileIdOverride="1234567"
      showKnowledgeTopNav={false}
      sidebarAvatarSrc={fixtureSidebarAvatarSrc}
      topAvatarSrc={fixtureTopAvatarSrc}
      sidebarFixture={fixtureSidebar}
    >
      <article className={styles.fixtureUserMessage}>
        <div className={styles.fixtureUserLine}>
          <div className={styles.fixtureUserBubble}>
            {state === 'write-confirmation'
              ? '把刚才吃的三文鱼寿司记录到午餐里吧'
              : state === 'budget-limit'
                ? '帮我导出2023整年每个月的膳食结构趋势报告'
                : state === 'tool-failed-retryable'
                  ? '查询我今天晚餐的热量'
                  : state === 'safety-degraded'
                    ? '推荐一份低钠晚餐食谱'
                    : state === 'user-cancelled'
                      ? '生成下周的减脂餐食规划'
                      : '推荐低GI的水果'}
          </div>
          {fixtureMessageAvatarSrc ? (
            <span className={styles.fixtureUserAvatar} aria-hidden="true">
              <AvatarImage avatarUrl={fixtureMessageAvatarSrc} gender="男" alt="" />
            </span>
          ) : null}
        </div>
        <span className={styles.fixtureMessageMeta}>
          Anddy ·{' '}
          {state === 'user-cancelled'
            ? '02:15 PM'
            : state === 'safety-degraded'
              ? '01:30 PM'
              : state === 'sse-reconnecting'
                ? '03:00 PM'
                : '12:45 PM'}
        </span>
      </article>
      {content}
      {actionMessage ? (
        <p className={styles.fixtureActionMessage} role="status">
          {actionMessage}
        </p>
      ) : null}
    </ChatSurface>
  );
}

function RealChatPage() {
  const { session_id: sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<RealMessage[]>([]);
  const [input, setInput] = useState(searchParams.get('prompt') ?? '');
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [sending, setSending] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string>();
  const [citations, setCitations] = useState<AgentRunView['citations']>([]);
  const [runStatus, setRunStatus] = useState('idle');
  const [assistantText, setAssistantText] = useState('');
  const [assistantMessageId, setAssistantMessageId] = useState<string>();
  const [error, setError] = useState<string>();
  const [budgetConfirmation, setBudgetConfirmation] = useState(false);
  const [checkpointAvailable, setCheckpointAvailable] = useState(false);
  const [approval, setApproval] = useState<{
    id: string;
    details: NonNullable<AgentRunEvent['details']>;
  }>();
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [connection, setConnection] = useState<AgentStreamConnection>({ state: 'closed', attempt: 0, maxAttempts: 5 });
  const messagesRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<{ close: () => void }>();

  useEffect(() => {
    let cancelled = false;
    // Reset state when the route changes; the following stream subscription owns these values.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveRunId(undefined);
    setRunStatus('idle');
    setAssistantText('');
    setAssistantMessageId(undefined);
    setCitations([]);
    setBudgetConfirmation(false);
    setCheckpointAvailable(false);
    setApproval(undefined);
    setApprovalSubmitting(false);
    setConnection({ state: 'closed', attempt: 0, maxAttempts: 5 });
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    loadSessionMessages(sessionId)
      .then((rows) => {
        if (cancelled) return;
        const ordered = rows.sort((a, b) => a.sequence_no - b.sequence_no);
        setMessages(ordered);
        // 重新进入历史会话时恢复最近一次 Run，才能回放终态事件和引用。
        const latestRunId = [...ordered].reverse().find((message) => message.agent_run_id)?.agent_run_id;
        if (latestRunId) setActiveRunId(String(latestRunId));
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '消息加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, assistantText]);

  useEffect(() => {
    if (!activeRunId) return undefined;
    const hasPersistedAnswer = messages.some(
      (message) => message.agent_run_id === activeRunId && message.role === 'assistant',
    );
    // The stream subscription establishes the queued state before receiving runtime events.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunStatus('queued');
    setAssistantText('');
    const stream = openAgentRunStream(
      activeRunId,
      (eventType, payload) => {
        if (eventType === 'run.answer_stream') {
          setRunStatus('validating');
          if (!hasPersistedAnswer) setAssistantText((current) => current + (payload.text ?? ''));
          return;
        }
        if (eventType === 'run.completed') {
          setRunStatus('completed');
          setCheckpointAvailable(false);
          setApproval(undefined);
          if (!hasPersistedAnswer) setAssistantText((current) => payload.answer ?? current);
          if (sessionId) {
            void loadSessionMessages(sessionId).then((rows) => {
              const assistant = rows.find(
                (message) => message.agent_run_id === activeRunId && message.role === 'assistant',
              );
              setAssistantMessageId(assistant?.message_id);
            });
          }
          setCitations(
            (payload.citations ?? []).map((citation) => ({
              id: citation.citation_id,
              title: citation.title,
              snippet: citation.snippet,
              source: [citation.version, citation.section_path].filter(Boolean).join(' · '),
            })),
          );
          setBudgetConfirmation(
            payload.result_type === 'safety_degraded' &&
              (payload.requires_confirmation === true || payload.budget_actions?.requires_confirmation === true),
          );
          return;
        }
        if (eventType === 'run.checkpoint_saved') {
          if (payload.approval_request_id) {
            setRunStatus('waiting_user');
            setCheckpointAvailable(false);
            setApproval({ id: payload.approval_request_id, details: payload.details ?? {} });
          } else {
            setRunStatus('waiting_user');
            setCheckpointAvailable(true);
          }
          return;
        }
        if (eventType === 'run.failed') {
          setRunStatus('failed');
          setCheckpointAvailable(false);
          setError(runtimeErrorMessage(payload));
          return;
        }
        if (eventType === 'run.cancelled') {
          setRunStatus('cancelled');
          setCheckpointAvailable(false);
          return;
        }
        if (eventType === 'run.superseded') {
          setRunStatus('superseded');
          setCheckpointAvailable(false);
          return;
        }
        if (eventType === 'run.clarification_requested') {
          setRunStatus('waiting_user');
          if (payload.approval_request_id) {
            setCheckpointAvailable(false);
            setApproval({ id: payload.approval_request_id, details: payload.details ?? {} });
          }
          return;
        }
        setRunStatus(payload.status ?? eventType.replace('run.', ''));
      },
      {
        maxAttempts: 5,
        onStateChange: setConnection,
        onError: (nextConnection) => {
          if (nextConnection.state === 'exhausted') setError('运行事件连接重试已达上限，请刷新页面后重试。');
          else setError(undefined);
        },
      },
    );
    streamRef.current = stream;
    return () => {
      stream.close();
      streamRef.current = undefined;
    };
  }, [activeRunId, messages, sessionId]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setError(undefined);
    setSending(true);
    try {
      let target = sessionId;
      if (!target) {
        const created = await createSession(content.slice(0, 40));
        target = String(created.session_id);
        navigate(`/chat/${target}`, { replace: true });
      }
      const saved = await sendUserMessage(target, content);
      setMessages((current) => [...current, saved].sort((a, b) => a.sequence_no - b.sequence_no));
      if (saved.agent_run_id) setActiveRunId(String(saved.agent_run_id));
      setCitations([]);
      setInput('');
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'FORBIDDEN') setError(reason.message);
      setError(reason instanceof Error ? reason.message : '消息发送失败');
    } finally {
      setSending(false);
    }
  };

  const realRun: AgentRunView = {
    id: activeRunId ?? '等待运行',
    status: displayRunStatus(runStatus === 'idle' ? 'completed' : runStatus),
    intent: 'planning',
    toolsUsed: 0,
    toolsTotal: 6,
    agentsUsed: 0,
    agentsTotal: 1,
    toolCalls: [],
    citations,
    connection,
  };

  const mappedMessages: ChatMessage[] = messages.map((message) => ({
    id: message.message_id,
    role: message.role,
    content: message.content,
    time: message.created_at,
    source: undefined,
    agentRunId: message.agent_run_id,
  }));

  return (
    <ChatSurface
      run={realRun}
      messagesRef={messagesRef}
      input={input}
      running={
        runStatus !== 'idle' && !['completed', 'failed', 'cancelled', 'waiting_user', 'superseded'].includes(runStatus)
      }
      disabled={loading || sending}
      onChange={setInput}
      onSend={() => void send()}
      onStop={() => {
        streamRef.current?.close();
        if (activeRunId) void cancelAgentRun(activeRunId);
      }}
      placeholder="追问或添加自定义指令..."
    >
      {loading ? <p className={styles.systemMessage}>正在加载消息...</p> : null}
      {!loading && mappedMessages.length === 0 ? (
        <p className={styles.systemMessage}>暂无消息，发送第一条内容开始会话。</p>
      ) : null}
      {error ? <ErrorState message={error} /> : null}
      {connection.state === 'reconnecting' ? (
        <div className={styles.connectionNotice} role="status" aria-live="polite">
          <LoaderCircle aria-hidden="true" />
          <div>
            <strong>连接已中断，正在重新连接...</strong>
            <span>
              第 {connection.attempt} 次重连尝试 (最多 {connection.maxAttempts} 次)
            </span>
          </div>
        </div>
      ) : null}
      {connection.state === 'exhausted' ? (
        <div className={`${styles.connectionNotice} ${styles.connectionNoticeError}`} role="alert">
          <XCircle aria-hidden="true" />
          <div>
            <strong>连接重试已耗尽</strong>
            <span>如果持续失败，请刷新页面</span>
          </div>
        </div>
      ) : null}
      {mappedMessages.map((message) => (
        <MessageBubble key={message.id} message={message}>
          {message.role === 'assistant' && message.agentRunId === activeRunId && runStatus === 'completed' ? (
            <CitationList citations={citations} />
          ) : null}
          {message.role === 'assistant' && message.agentRunId ? (
            <AgentFeedback runId={message.agentRunId} messageId={message.id} />
          ) : null}
        </MessageBubble>
      ))}
      {assistantText ? (
        <MessageBubble
          message={{
            id: 'assistant-stream',
            role: 'assistant',
            content: assistantText,
            time: '12:46',
            agentRunId: activeRunId,
          }}
        >
          {runStatus === 'completed' ? <CitationList citations={citations} /> : null}
          {assistantMessageId && activeRunId ? (
            <AgentFeedback runId={activeRunId} messageId={assistantMessageId} />
          ) : null}
        </MessageBubble>
      ) : null}
      {approval && activeRunId ? (
        <div className={styles.cardWrap}>
          <ConfirmationCard
            title="请确认将这条内容写入饮食日志"
            helperText="确认后才会创建饮食记录；取消不会修改业务数据。"
            state={approvalSubmitting ? 'disabled' : 'normal'}
            data={[
              { label: '餐型', value: approval.details.meal_type ?? '未识别' },
              {
                label: '时间',
                value: approval.details.meal_time ?? '未识别',
              },
              {
                label: '食物',
                value: (approval.details.items ?? [])
                  .map((item) => `${item.name ?? '未命名'} ${item.amount ?? ''}${item.unit ?? ''}`)
                  .join('、'),
              },
            ]}
            onConfirm={() => {
              const parameters = approvalParameters(approval.details);
              setApprovalSubmitting(true);
              void confirmAgentWrite(approval.id, parameters)
                .then(() => executeAgentWrite(approval.id, parameters))
                .catch((reason) => setError(reason instanceof Error ? reason.message : '饮食记录写入失败'))
                .finally(() => setApprovalSubmitting(false));
            }}
            onEdit={() => setError('请发送一条新消息修改食物和份量。')}
            onCancel={() => {
              const parameters = approvalParameters(approval.details);
              setApprovalSubmitting(true);
              void rejectAgentWrite(approval.id, parameters)
                .catch((reason) => setError(reason instanceof Error ? reason.message : '取消写入失败'))
                .finally(() => setApprovalSubmitting(false));
            }}
          />
        </div>
      ) : null}
      {checkpointAvailable && !approval && activeRunId ? (
        <div className={styles.cardWrap}>
          <ConfirmationCard
            title="运行已暂停，可从检查点继续"
            helperText="系统已保存运行进度。继续后会创建新的 dispatch attempt，不会重复已完成的工具调用。"
            data={[
              { label: '恢复方式', value: '从已校验 checkpoint 恢复' },
              { label: '安全校验', value: 'Java 服务端完成' },
            ]}
            onConfirm={() => {
              void recoverAgentRun(activeRunId)
                .then(() => {
                  setCheckpointAvailable(false);
                  setRunStatus('queued');
                })
                .catch((reason) => setError(reason instanceof Error ? reason.message : '运行恢复失败'));
            }}
            onEdit={() => setError('当前恢复入口不接受浏览器修改 checkpoint 内容。')}
            onCancel={() => setCheckpointAvailable(false)}
          />
        </div>
      ) : null}
      {budgetConfirmation && activeRunId ? (
        <div className={styles.cardWrap}>
          <ConfirmationCard
            title="本次运行已达到预算上限"
            helperText="继续执行会创建新的预算 revision，并接续当前 Run。"
            data={[
              { label: '追加 Token', value: '30000' },
              { label: '追加成本上限', value: '¥1.00' },
            ]}
            onConfirm={() => {
              void extendAgentRunBudget(activeRunId, 30000, '1.00')
                .then(() => setBudgetConfirmation(false))
                .catch((reason) => setError(reason instanceof Error ? reason.message : '预算追加失败'));
            }}
            onEdit={() => setError('当前开发版本使用固定追加额度。')}
            onCancel={() => setBudgetConfirmation(false)}
          />
        </div>
      ) : null}
    </ChatSurface>
  );
}

function MockChatPage() {
  const params = useParams();
  const sessionId = params.session_id;
  const [searchParams] = useSearchParams();
  const isFigmaFixture = searchParams.get('state') === 'figma-v2';
  const agent = useAgentReplay(sessionId, searchParams.get('prompt'));
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [agent.messages, agent.card]);

  return (
    <ChatSurface
      run={agent.run}
      messagesRef={messagesRef}
      input={agent.input}
      running={agent.running}
      designChat={isFigmaFixture}
      fixtureVariant={isFigmaFixture ? 'chat' : undefined}
      displayNameOverride={isFigmaFixture ? 'Anddy' : undefined}
      profileIdOverride={isFigmaFixture ? '1234567' : undefined}
      showKnowledgeTopNav={!isFigmaFixture}
      pageVariant={isFigmaFixture ? 'figma-default' : undefined}
      sidebarAvatarSrc={isFigmaFixture ? FIGMA_CHAT_SIDEBAR_AVATAR : undefined}
      topAvatarSrc={isFigmaFixture ? FIGMA_CHAT_TOPBAR_AVATAR : undefined}
      onChange={agent.setInput}
      onSend={() => agent.send()}
      onStop={agent.stop}
      placeholder="追问或添加自定义指令..."
    >
      {agent.messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={{ ...message, wide: isFigmaFixture }}
          userAvatarSrc={isFigmaFixture ? FIGMA_CHAT_MESSAGE_AVATAR : undefined}
        >
          {index === agent.messages.length - 1 && agent.card.type === 'confirmation' ? (
            <InlineConfirmationCard onConfirm={agent.confirmWrite} onCancel={agent.cancelWrite} />
          ) : null}
        </MessageBubble>
      ))}
      {agent.card.type === 'result' ? (
        <div className={styles.cardWrap}>
          <ResultCard
            label={agent.card.label}
            title={agent.card.title}
            description={agent.card.description}
            primaryAction={agent.card.primaryAction}
            secondaryAction={agent.card.secondaryAction}
            onPrimary={agent.handleResultPrimary}
            onSecondary={agent.handleResultSecondary}
          />
        </div>
      ) : null}
      {agent.card.type === 'clarification' ? (
        <div className={styles.cardWrap}>
          <ClarificationCard
            title={agent.card.title}
            options={agent.card.options}
            fields={agent.card.fields}
            submitLabel={agent.card.submitLabel}
            onSelect={agent.answerClarification}
            onSubmit={agent.answerClarification}
          />
        </div>
      ) : null}
      {agent.card.type === 'confirmation' ? null : null}
      {agent.card.type === 'error' ? <ErrorState message={agent.card.message} /> : null}
      {/* Figma 640:428 的说明面板属于默认画板内容，只在 fixture 中复现。 */}
      {isFigmaFixture ? (
        <section className={styles.messageActions} aria-label="消息操作">
          <h2>消息操作</h2>
          <p>{'用户消息：编辑  ·  复制  ·  重试（保留原消息并新建一次运行）'}</p>
          <p>{'Agent 回答：复制  ·  查看引用  ·  查看运行详情  ·  继续提问'}</p>
          <p className={styles.actionGreen}>
            工具失败时显示重试；运行中发送按钮切换停止；写入确认 / 预算追加仍需确认后继续。
          </p>
          <p>{'右侧面板：运行  ·  工具  ·  引用     原始 JSON 默认折叠并隐藏敏感参数。'}</p>
        </section>
      ) : null}
    </ChatSurface>
  );
}

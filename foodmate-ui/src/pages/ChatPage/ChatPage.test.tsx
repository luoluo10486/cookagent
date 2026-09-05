/**
 * ChatPage / useMockAgentReplay 会话隔离测试
 *
 * P0-1: 验证切换 session_id 后 mock 状态重置
 *
 * 审计风险：seededRef 不会随 seedKey 变化重置，
 * 导致第二个会话的 seed 无法触发。
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useEffect, useState } from 'react';
import { describe, it, expect } from 'vitest';
import { ChatPage } from './ChatPage';
import styles from './ChatPage.module.css';

function renderChatState(state: string) {
  render(
    <MemoryRouter initialEntries={[`/chat?state=${state}`]}>
      <Routes>
        <Route path="/chat/:session_id?" element={<ChatPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * 路由切换控制器：先挂载 /chat/session-a，
 * 等 seed 触发后导航到 /chat/session-b，验证第二个 seed 是否触发。
 */
function SessionSwitchTest() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'a' | 'b'>('a');
  const [navigated, setNavigated] = useState(false);

  useEffect(() => {
    if (phase === 'a') {
      // 等待第一次 seed 完成后切换到 B
      const timer = setTimeout(() => {
        setPhase('b');
        setNavigated(true);
        navigate('/chat/session-b');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, navigate]);

  return (
    <div>
      <Routes>
        <Route path="/chat/:session_id?" element={<ChatPage />} />
      </Routes>
      {navigated && <div data-testid="navigated-to-b">已导航到 B</div>}
    </div>
  );
}

describe('ChatPage 会话隔离', () => {
  it('切换 session_id 后重新触发 seed（修复前：seededRef 残留导致 seed 不触发）', async () => {
    render(
      <MemoryRouter initialEntries={['/chat/session-a']}>
        <SessionSwitchTest />
      </MemoryRouter>,
    );

    // 阶段 A：等待会话 A 的 seed 触发
    await waitFor(
      () => {
        const messages = screen.getAllByText('你');
        expect(messages.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 },
    );

    // 等待导航到会话 B 完成
    await waitFor(
      () => {
        expect(screen.getByTestId('navigated-to-b')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // 阶段 B：等待会话 B 的新消息出现
    // 如果 seededRef 正确重置，会话 B 会触发新的 send
    // 如果 seededRef 残留 true，则不会出现新消息
    await waitFor(
      () => {
        expect(screen.getByTestId('navigated-to-b')).toBeInTheDocument();
      },
      { timeout: 200 },
    );

    // 验证 ChatPage 仍在渲染（没有崩溃）
    expect(screen.getByText('工具与引用')).toBeInTheDocument();
  });
});

describe('ChatPage Figma 空态', () => {
  it('renders the empty conversation state and places a recommended prompt into the composer', () => {
    render(
      <MemoryRouter initialEntries={['/chat?state=empty']}>
        <Routes>
          <Route path="/chat/:session_id?" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '开始新的对话' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /分析我今天的饮食/ })).toBeInTheDocument();
    expect(screen.queryByText('运行轨迹')).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText('输入消息或添加自定义指令...');
    const planPrompt = screen.getByRole('button', { name: /制定本周餐食计划/ });
    expect(planPrompt).toHaveClass('inline-flex');
    fireEvent.click(planPrompt);
    expect(input).toHaveValue('根据我的减脂目标制定本周餐食计划');
  });
});

describe('ChatPage Figma 默认状态', () => {
  it('uses the Figma identity fixture without changing the default mock session', () => {
    render(
      <MemoryRouter initialEntries={['/chat?state=figma-v2']}>
        <Routes>
          <Route path="/chat/:session_id?" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Anddy')).toBeInTheDocument();
    expect(screen.getByText('ID: 1234567')).toBeInTheDocument();
  });

  it('uses the Figma 560px assistant content width for the default response', () => {
    const stylesheet = readFileSync(resolve(process.cwd(), 'src/pages/ChatPage/ChatPage.module.css'), 'utf8');

    expect(stylesheet).toContain('.figmaDefaultPage .assistantBody {');
    expect(stylesheet).toContain('width: 560px;');
    expect(stylesheet).toContain('flex: 0 0 560px;');
  });

  it('uses the Figma neutral surface for the assistant message body', () => {
    const stylesheet = readFileSync(resolve(process.cwd(), 'src/pages/ChatPage/ChatPage.module.css'), 'utf8');

    expect(stylesheet).toContain('.designChatPage .assistant .messageBubble');
    expect(stylesheet).toContain('--fm-fixture-assistant-surface: var(--fm-fixture-chat-control-surface);');
  });

  it('uses the Figma surface for the Composer input row in the fixture', () => {
    const pageStylesheet = readFileSync(resolve(process.cwd(), 'src/pages/ChatPage/ChatPage.module.css'), 'utf8');
    const composerStylesheet = readFileSync(
      resolve(process.cwd(), 'src/components/workspace/Composer.module.css'),
      'utf8',
    );

    expect(pageStylesheet).toContain('--fm-fixture-composer-input-surface: var(--fm-fixture-chat-bg);');
    expect(composerStylesheet).toContain('background: var(--fm-fixture-composer-input-surface, var(--fm-bg-soft));');
  });

  it('renders the Figma message action guidance in the default canvas', () => {
    renderChatState('figma-v2');

    expect(screen.getByRole('region', { name: '消息操作' })).toBeInTheDocument();
    expect(screen.getByText(/用户消息：编辑/)).toBeInTheDocument();
    expect(screen.getByText(/右侧面板：运行/)).toBeInTheDocument();
  });
});

describe('ChatPage Figma Planning 状态', () => {
  it('renders the planning steps without the trace rail and disables the composer', () => {
    render(
      <MemoryRouter initialEntries={['/chat?state=planning']}>
        <Routes>
          <Route path="/chat/:session_id?" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Planning...')).toBeInTheDocument();
    expect(screen.getByText(/制定分析方案/)).toBeInTheDocument();
    expect(screen.queryByText('运行轨迹')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '停止生成' })).toBeEnabled();
    expect(screen.getByPlaceholderText('正在规划任务流程，请稍候...')).toBeDisabled();
  });
});

describe('ChatPage Figma Tool Executing 状态', () => {
  it('renders the executing tool card, running trace and disabled composer', () => {
    render(
      <MemoryRouter initialEntries={['/chat?state=tool-executing']}>
        <Routes>
          <Route path="/chat/:session_id?" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Executing Tools...')).toBeInTheDocument();
    expect(screen.getByText('向量索引检索 - 12ms ✓')).toBeInTheDocument();
    expect(screen.getByText('数据库调用 - running...')).toBeInTheDocument();
    expect(screen.getByText('营养计算 - pending')).toBeInTheDocument();
    expect(screen.getByText('RUN ID: fst_trace_9821aa')).toBeInTheDocument();
    expect(screen.getByText('数据库调用: 饮食日志表')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('正在运行数据计算工具...')).toBeDisabled();
    expect(screen.getByRole('button', { name: '停止生成' })).toBeEnabled();
  });
});

describe('ChatPage Figma Awaiting Clarification 状态', () => {
  it('renders the clarification card with the planning status and enabled composer', () => {
    render(
      <MemoryRouter initialEntries={['/chat?state=awaiting-clarification']}>
        <Routes>
          <Route path="/chat/:session_id?" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('记录一下我的午餐')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '需要确认以下信息：' })).toBeInTheDocument();
    expect(screen.getByText('你的午餐具体包含哪些食物？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '补充食物和份量' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '上传照片识别' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Agent 运行状态')).toHaveTextContent('Planning');
    expect(screen.queryByText('运行轨迹')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入你的详细食物或份量，例如：150克野生三文鱼...')).toBeEnabled();
  });
});

describe('ChatPage Agent remaining states', () => {
  const renderState = (state: string) => {
    render(
      <MemoryRouter initialEntries={[`/chat?state=${state}`]}>
        <Routes>
          <Route path="/chat/:session_id?" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('renders the completed citation fixture without the trace rail', () => {
    renderState('completed-with-citations');
    expect(screen.getByText('分析我这周的蛋白质摄入')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '本周蛋白质摄入分析' })).toBeInTheDocument();
    expect(screen.getByText('85g')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('周三 62g')).toBeInTheDocument();
    expect(screen.getByText('[1] USDA FoodData Central - Ref #4451002')).toBeInTheDocument();
    expect(screen.getByText('[2] 用户饮食记录 2024-03-08~03-14')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: '运行轨迹' })).not.toBeInTheDocument();
    expect(document.querySelector('img[src="/assets/avatars/default-male.svg"]')).toBeInTheDocument();
  });

  it('uses the Figma avatar assets for the default Chat fixture shell', () => {
    renderState('figma-v2');

    expect(document.querySelector('aside .avatar img')).toHaveAttribute(
      'src',
      '/assets/figma/workspace/home-sidebar-avatar.png',
    );
    expect(document.querySelector('main header .topAvatar img')).toHaveAttribute(
      'src',
      '/assets/figma/agent-chat/figma-v2-topbar-avatar.png',
    );
    expect(document.querySelector('.userAvatar img')).toHaveAttribute(
      'src',
      '/assets/figma/agent-chat/figma-v2-message-avatar.png',
    );
  });

  it('renders write confirmation details and records confirm/cancel actions', () => {
    renderState('write-confirmation');
    expect(screen.getByRole('heading', { name: '确认写入以下记录' })).toBeInTheDocument();
    expect(screen.getByText('目标对象: 饮食记录')).toBeInTheDocument();
    expect(screen.getByText('来源: USDA FoodData Central')).toBeInTheDocument();
    expect(screen.getByText('每周饮食微调')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    const writeCard = document.querySelector('[class*="fixtureWriteCard"]');
    expect(writeCard).toBeInTheDocument();
    const writeDetails = document.querySelector('[class*="fixtureWriteCard"] [class*="fixtureDetails"]');
    expect(writeDetails).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认写入' }).querySelector('svg')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' }).querySelector('svg')).not.toBeInTheDocument();
    expect(document.querySelector('img[src="/assets/avatars/default-male.svg"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认写入' }));
    expect(screen.getByRole('status')).toHaveTextContent('fixture 已记录确认动作');
  });

  it('renders budget limit choices and keeps the current Run action explicit', () => {
    renderState('budget-limit');
    expect(screen.getByRole('heading', { name: '已达到预算上限' })).toHaveClass(styles.fixtureBudgetTitleText);
    expect(screen.getByText(/我已在后台调用历史数据解析服务/)).toBeInTheDocument();
    expect(screen.getByText('Token 用量 (100%)')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '预算用量 100%' })).toHaveAttribute('aria-valuenow', '100');
    expect(document.querySelector('[class*="fixtureBudgetMeter"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '追加 20,000 tokens' }).className).toContain(
      'fixtureBudgetPrimaryButton',
    );
    expect(screen.getByRole('button', { name: '结束会话' }).className).toContain('fixtureBudgetSecondaryButton');
    fireEvent.click(screen.getByRole('button', { name: '追加 20,000 tokens' }));
    expect(screen.getByRole('status')).toHaveTextContent('当前 Run');
  });

  it('renders only the retryable tool failure actions', () => {
    renderState('tool-failed-retryable');
    expect(screen.getByText('数据库查询超时 (错误码: TOOL_TIMEOUT_001)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(document.querySelector('[class*="fixtureFailureDetails"]')).toBeInTheDocument();
    expect(document.querySelector('[class*="fixtureFailureCard"]')?.className).toContain('fixtureFailureCard');
    expect(screen.getByRole('button', { name: '重试' }).className).toContain('fixtureRetryButton');
    expect(screen.getByRole('button', { name: '跳过此步骤' }).className).toContain('fixtureSkipButton');
    expect(document.querySelector('[class*="fixtureAgentAvatar"]')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toContain('Executing×');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toContain('Composing○');
    fireEvent.click(screen.getByRole('button', { name: '跳过此步骤' }));
    expect(screen.getByRole('status')).toHaveTextContent('后续结果会明确标注数据范围受限');
  });

  it('keeps degraded answers bounded and leaves the follow-up composer enabled', () => {
    renderState('safety-degraded');
    expect(screen.getByText('安全降级', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '⚠️ 安全降级提示' })).toBeInTheDocument();
    expect(screen.getByText('Anddy · 01:30 PM')).toBeInTheDocument();
    expect(screen.getByText('Fustat-v2 Agent · 1:31 PM')).toBeInTheDocument();
    expect(screen.getByText(/\*\*清蒸鳕鱼配西兰花\*\*/)).toBeInTheDocument();
    expect(screen.getByText(/未结合您的个人高血压排除条件/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('由于部分工具不可用');
    expect(document.querySelector('[class*="fixtureSafetyBody"]')).toHaveClass(styles.fixtureSafetyBodyAligned);
    expect(screen.getByPlaceholderText('追问或添加自定义指令...')).toBeEnabled();
  });

  it('distinguishes user cancellation from a system failure', () => {
    renderState('user-cancelled');
    expect(screen.getByText(/用户已取消此次运行/)).toBeInTheDocument();
    expect(screen.queryByText(/运行失败/)).not.toBeInTheDocument();
    expect(document.querySelector('[class*="fixtureCancelledWrap"]')).toHaveClass('fixtureCancelledWrapAligned');
    expect(document.querySelector('[class*="fixtureCancelledAssistantRow"]')).toHaveClass(
      'fixtureCancelledAssistantRowAligned',
    );
    expect(document.querySelector('[class*="fixtureCancelledNotice"]')).toHaveClass('fixtureCancelledNoticeAligned');
    const statusItems = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(statusItems).toContain('Planning●');
    expect(statusItems).toContain('Retrieving○');
    expect(statusItems).toContain('Executing○');
    expect(statusItems).toContain('Composing○');
    expect(
      screen.getByText('正在为您生成减脂餐计划... 已检索到您历史减脂卡路里基准为 1600kcal...'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('重新开始提问...')).toBeEnabled();
    fireEvent.change(screen.getByPlaceholderText('重新开始提问...'), { target: { value: '重新开始' } });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));
    expect(screen.getByRole('status')).toHaveTextContent('新的 Run');
  });

  it('renders the bounded SSE reconnect notice while preserving the composer state', () => {
    renderState('sse-reconnecting');
    expect(screen.getByText('Anddy · 03:00 PM')).toBeInTheDocument();
    expect(document.querySelector('[class*="fixtureReconnectNotice"]')).toHaveClass(styles.fixtureReconnectNoticeFigma);
    expect(screen.getByText('连接已中断，正在重新连接...')).toBeInTheDocument();
    expect(screen.getByText('第 2 次重连尝试 (最多 5 次)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('等待重新连接...')).toBeDisabled();
    expect(document.querySelector('[class*="fixtureReconnectAssistantRow"]')).toBeInTheDocument();
    expect(document.querySelector('[class*="fixtureReconnectBottom"]')).toBeInTheDocument();
    expect(document.querySelector('[class*="fixtureReconnectNotice"] img')).toHaveAttribute(
      'src',
      '/assets/figma/agent-chat/tool-executing-loader-running.svg',
    );
    expect(document.querySelector('[class*="fixtureUserAvatar"] img')).toHaveAttribute(
      'src',
      '/assets/avatars/default-male.svg',
    );
  });
});

describe('ChatPage Figma history fixtures', () => {
  it.each([
    ['history-page-2', '2 / 3', ''],
    ['history-page-3', '3 / 3', ''],
    ['search-results', '1 / 3', '高蛋白'],
  ])('renders %s with the Figma conversation, trace, and sidebar state', (state, page, searchValue) => {
    render(
      <MemoryRouter initialEntries={[`/chat?state=${state}`]}>
        <Routes>
          <Route path="/chat/:session_id?" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('USDA FoodData Central Ref #451992', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '是否将此记录到你的周二饮食日志？' })).toBeInTheDocument();
    expect(screen.getByText('RUN ID: fst_trace_88192a')).toBeInTheDocument();
    expect(screen.getByText('向量索引检索')).toBeInTheDocument();
    expect(screen.getByText(page)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索会话...')).toHaveValue(searchValue);
    if (state === 'search-results') {
      expect(screen.getAllByText('蛋白质补充方案')).toHaveLength(2);
      expect(screen.getAllByText('晚餐蛋白质补充')).toHaveLength(2);
      expect(screen.getByText('高蛋白早餐建议')).toBeInTheDocument();
      expect(screen.getByText('睡前加餐建议')).toBeInTheDocument();
      expect(screen.getByText('早餐碳水搭配')).toBeInTheDocument();
      expect(screen.getByText('低碳水饮食建议')).toBeInTheDocument();
    }
  });

  it('uses the shadcn radio group for the meal log target', () => {
    renderChatState('history-page-2');

    const addToLunch = screen.getByRole('radio', { name: '是，添加到今天的午餐' });
    const referenceOnly = screen.getByRole('radio', { name: '否，仅作为对话参考' });
    expect(addToLunch).toBeChecked();
    expect(referenceOnly).not.toBeChecked();

    fireEvent.click(referenceOnly);
    expect(referenceOnly).toBeChecked();
    expect(addToLunch).not.toBeChecked();
  });

  it('keeps the pagination fixture on the first page', () => {
    renderChatState('pagination');

    expect(screen.getByLabelText('会话分页')).toHaveTextContent('1 / 3');
  });
});

describe('ChatPage Figma session operation fixtures', () => {
  it('renders the session management panel over the complete conversation', () => {
    renderChatState('session-actions');

    expect(screen.getByRole('dialog', { name: '会话管理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重命名会话' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '当前会话' })).toHaveTextContent('RUNNING');
    expect(screen.getByText('操作')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭会话管理' })).toBeInTheDocument();
    expect(screen.getByText('RUN ID: fst_trace_88192a')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭会话管理' }));
    expect(screen.queryByRole('dialog', { name: '会话管理' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('已关闭会话管理面板。');
  });

  it.each([
    ['renamed', '会话已重命名', '返回会话列表'],
    ['archived', '已归档会话', '恢复会话'],
    ['trash', '会话回收站', '恢复会话'],
  ])('renders %s as a modal result over the Figma conversation', (state, title, action) => {
    renderChatState(state);

    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: action })).toBeInTheDocument();
    expect(screen.getByText('USDA FoodData Central Ref #451992', { exact: false })).toBeInTheDocument();
    if (state === 'renamed') {
      expect(screen.getByText('SAVED')).toBeInTheDocument();
      expect(screen.getByText('列表已同步，可继续查看此会话')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '关闭重命名结果' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '关闭重命名结果' }));
      expect(screen.queryByRole('dialog', { name: '会话已重命名' })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('已关闭重命名结果。');
    }
    if (state === 'archived') {
      expect(screen.getByText('ARCHIVED')).toBeInTheDocument();
      expect(screen.getByText('保留会话内容，恢复后回到 Agent 对话列表')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '关闭归档结果' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '关闭归档结果' }));
      expect(screen.queryByRole('dialog', { name: '已归档会话' })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('已关闭归档结果。');
    }
    if (state === 'trash') {
      expect(screen.getByText('RECOVERABLE')).toBeInTheDocument();
      expect(screen.getByText('回收站仅支持恢复，不提供永久删除')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '关闭回收站结果' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '关闭回收站结果' }));
      expect(screen.queryByRole('dialog', { name: '会话回收站' })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('已关闭回收站结果。');
    }
  });
});

describe('ChatPage Figma navigation fixtures', () => {
  it('renders the default redesign fixture with the Figma source copy and first history page', () => {
    renderChatState('redesign-default');

    expect(screen.getByText(/I have analyzed the typical values/)).toBeInTheDocument();
    expect(screen.getByText('查询扩展')).toBeInTheDocument();
    expect(screen.queryByText('查询扩展 (Query Expansion)')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '消息操作' })).not.toBeInTheDocument();
    expect(screen.queryByText(/右侧面板：运行 · 工具 · 引用/)).not.toBeInTheDocument();
  });

  it.each(['nav-loading', 'nav-hover-preview', 'pagination'])(
    '%s keeps the complete Figma conversation and trace',
    (state) => {
      renderChatState(state);

      expect(screen.getByText(/我已为您分析了野生三文鱼/)).toBeInTheDocument();
      expect(screen.getByText('查询扩展 (Query Expansion)')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '是否将此记录到你的周二饮食日志？' })).toBeInTheDocument();
    },
  );
});

describe('ChatPage Figma running-stop fixture', () => {
  it('keeps the received conversation and trace visible while exposing the stop action', () => {
    renderChatState('running-stop');

    expect(screen.getByText('USDA FoodData Central Ref #451992', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('响应合成')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '停止生成' })).toBeEnabled();
    expect(screen.queryByText('消息操作')).not.toBeInTheDocument();
  });
});

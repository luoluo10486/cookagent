import { ArrowRight, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FIGMA_KNOWLEDGE_AVATARS } from '../../lib/avatar';
import { WorkspaceLayout } from '../../layouts/WorkspaceLayout/WorkspaceLayout';
import { searchKnowledge, type KnowledgeCitation } from '../../services/knowledgeService';
import type { SessionSummary } from '../../types/session';
import styles from './KnowledgePage.module.css';

type KnowledgeState = 'default' | 'empty' | 'search-failed' | 'source-unavailable';

type KnowledgeResult = {
  title: string;
  match: string;
  snippet: string;
  source: string;
  updated: string;
  sourceTone: 'green' | 'blue' | 'purple';
  topic: 'nutrition';
  details: {
    sourceName: string;
    documentId: string;
    access: string;
    quote: string;
  };
};

function toKnowledgeResult(citation: KnowledgeCitation): KnowledgeResult {
  const version = citation.version || '未标注版本';
  const sectionPath = citation.section_path || '未标注章节';
  return {
    title: citation.title,
    match: citation.citation_id,
    snippet: citation.snippet,
    source: `版本 ${version}`,
    updated: `章节 ${sectionPath}`,
    sourceTone: 'blue',
    topic: 'nutrition',
    details: {
      sourceName: citation.title,
      documentId: `DOC ID: ${citation.document_id}`,
      access: `版本 ${version} · 章节 ${sectionPath} · 引用 ID ${citation.citation_id}`,
      quote: citation.snippet,
    },
  };
}

const knowledgeResults: KnowledgeResult[] = [
  {
    title: '烹饪温度对牛油果健康脂肪的影响',
    match: '98% Match',
    snippet: '120°C以上的高温处理会引发单不饱和油酸的轻度脂质过氧化。冷压或新鲜食用仍是系统性抗氧化吸收的最佳方式。',
    source: 'NIH §4.2',
    updated: '2天前更新',
    sourceTone: 'blue',
    topic: 'nutrition',
    details: {
      sourceName: 'NIH 研究实验室文献库',
      documentId: 'DOC ID: NIH-451992-B',
      access: 'Access: Open Access Dataset, last cached 12h ago.',
      quote:
        'Peroxidation of monounsaturated chains remains statistically minor compared to polyunsaturated chains under identical baking parameters...',
    },
  },
  {
    title: '藜麦与酸面包淀粉的血糖指数动态',
    match: '92% Match',
    snippet: '比较全籽白皂苷水洗藜麦与长发酵乳酸菌酸面包。藜麦因不溶性结构纤维，血糖负荷稳定在13。',
    source: 'USDA 数据库',
    updated: '1周前更新',
    sourceTone: 'green',
    topic: 'nutrition',
    details: {
      sourceName: 'USDA FoodData Central',
      documentId: 'DOC ID: USDA-GLYCEMIC-2204',
      access: 'Access: Open Access Dataset, last cached 1d ago.',
      quote: 'Quinoa retains a more stable glycemic load when its insoluble structural fiber remains intact...',
    },
  },
  {
    title: '运动后最佳蛋白质吸收窗口期',
    match: '89% Match',
    snippet: '肌肉蛋白质合成触发机制概述。氨基酸循环在运动后45-75分钟达峰时效率最高，有同行评审的运动营养数据支持。',
    source: 'PubMed Central',
    updated: '3天前更新',
    sourceTone: 'purple',
    topic: 'nutrition',
    details: {
      sourceName: 'PubMed Central research archive',
      documentId: 'DOC ID: PMC-PROTEIN-4571',
      access: 'Access: Open Access Dataset, last cached 6h ago.',
      quote: 'Amino acid circulation reaches peak efficiency during the 45-75 minute post-exercise window...',
    },
  },
];

const topics = [
  { icon: '🥑', title: '牛油果脂质', count: '12 篇引用' },
  { icon: '🍞', title: '酸面包淀粉', count: '8 篇引用' },
  { icon: '🥩', title: '氨基酸合成', count: '19 篇引用' },
];

const filterOptions = ['全部主题', '营养素', '仅引用', '近90天'];

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

function getKnowledgeState(value: string | null): KnowledgeState {
  return value === 'empty' || value === 'search-failed' || value === 'source-unavailable' ? value : 'default';
}

export function KnowledgePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isRealMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [selectedResultTitle, setSelectedResultTitle] = useState(knowledgeResults[0].title);
  const [activeFilter, setActiveFilter] = useState('全部主题');
  const [remoteResults, setRemoteResults] = useState<KnowledgeResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string>();
  const [hasSearched, setHasSearched] = useState(false);
  const initialQuery = useRef(searchParams.get('q') ?? '');
  const knowledgeState = getKnowledgeState(searchParams.get('state'));
  const displayedState: KnowledgeState = isRealMode
    ? searchError
      ? 'search-failed'
      : hasSearched && !searchLoading && remoteResults.length === 0
        ? 'empty'
        : 'default'
    : knowledgeState;

  const sourceResults = isRealMode ? remoteResults : knowledgeResults;
  const selected =
    sourceResults.find((item) => item.title === selectedResultTitle) ??
    sourceResults[0] ??
    (!isRealMode ? knowledgeResults[0] : undefined);
  const isFigmaFixture = !isRealMode;

  const visibleResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filterMatches = (item: KnowledgeResult) => {
      if (activeFilter === '营养素') return item.topic === 'nutrition';
      return true;
    };

    if (!normalizedQuery || isRealMode) return sourceResults.filter(filterMatches);
    return sourceResults.filter(
      (item) =>
        filterMatches(item) && `${item.title} ${item.snippet} ${item.source}`.toLowerCase().includes(normalizedQuery),
    );
  }, [activeFilter, isRealMode, query, sourceResults]);

  const updateState = useCallback(
    (state: KnowledgeState) => {
      const next = new URLSearchParams(searchParams);
      if (state === 'default') next.delete('state');
      else next.set('state', state);
      if (query.trim()) next.set('q', query.trim());
      else next.delete('q');
      setSearchParams(next);
    },
    [query, searchParams, setSearchParams],
  );

  const executeRemoteSearch = useCallback(
    async (value: string) => {
      const normalizedQuery = value.trim();
      setSearchError(undefined);
      setHasSearched(Boolean(normalizedQuery));
      if (!normalizedQuery) {
        setRemoteResults([]);
        updateState('default');
        return;
      }
      setSearchLoading(true);
      try {
        const citations = await searchKnowledge(normalizedQuery);
        const results = citations.map(toKnowledgeResult);
        setRemoteResults(results);
        setSelectedResultTitle(results[0]?.title ?? '');
        updateState('default');
      } catch (cause) {
        setRemoteResults([]);
        setSelectedResultTitle('');
        setSearchError(cause instanceof Error ? cause.message : '知识库检索失败，请稍后重试');
      } finally {
        setSearchLoading(false);
      }
    },
    [updateState],
  );

  useEffect(() => {
    if (!isRealMode || !initialQuery.current.trim()) return;
    initialQuery.current = '';
    void executeRemoteSearch(query);
  }, [executeRemoteSearch, isRealMode, query]);

  const handleSearch = () => {
    if (isRealMode) {
      void executeRemoteSearch(query);
      return;
    }
    if (!query.trim() || visibleResults.length === 0) {
      updateState('empty');
      return;
    }
    updateState('default');
  };

  const clearFilters = () => {
    setQuery('');
    setActiveFilter('全部主题');
    setRemoteResults([]);
    setSearchError(undefined);
    setHasSearched(false);
    setSearchParams(new URLSearchParams());
  };

  return (
    <WorkspaceLayout
      activeModule="knowledge"
      displayNameOverride={isFigmaFixture ? 'Anddy' : undefined}
      profileIdOverride={isFigmaFixture ? '1234567' : undefined}
      sidebarAvatarSrc={isFigmaFixture ? FIGMA_KNOWLEDGE_AVATARS.sidebar : undefined}
      topAvatarSrc={isFigmaFixture ? FIGMA_KNOWLEDGE_AVATARS.topbar : undefined}
      showWindowControls={isFigmaFixture}
      // Knowledge 画板使用独立导出的 Figma 壳层资产，真实模式仍使用 Lucide fallback。
      fixtureVariant={isFigmaFixture ? 'knowledge' : undefined}
      sidebarFixture={isFigmaFixture ? { currentPage: 1, sessions: figmaSidebarSessions } : undefined}
      topbarShowMarkLetter={!isFigmaFixture}
      pageOverlay={
        displayedState !== 'default' ? (
          <KnowledgeStateCard
            state={displayedState}
            detail={isRealMode ? searchError : undefined}
            onAction={
              displayedState === 'empty'
                ? clearFilters
                : isRealMode
                  ? () => void executeRemoteSearch(query)
                  : () => updateState('default')
            }
          />
        ) : null
      }
    >
      <div className={`${styles.page} ${isFigmaFixture ? styles.figmaFixture : ''} fm-enter`}>
        <main className={styles.resultsPanel} aria-label="知识库检索结果">
          <header className={styles.pageHeader}>
            <h1>知识库</h1>
            <form
              className={styles.searchForm}
              onSubmit={(event) => {
                event.preventDefault();
                handleSearch();
              }}
            >
              <Search aria-hidden="true" className={styles.searchIcon} />
              <Input
                aria-label="搜索食物知识、食材、烹饪技巧"
                className={styles.knowledgeSearch}
                placeholder="搜索食物知识、食材、烹饪技巧..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
            <div className={styles.filters} aria-label="知识库筛选">
              {filterOptions.map((filter) => (
                <Button
                  className={`${styles.filter} ${activeFilter === filter ? styles.filterActive : ''}`}
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  type="button"
                  variant="outline"
                  aria-pressed={activeFilter === filter}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </header>

          <div className={styles.resultCount}>
            {searchLoading
              ? '正在检索知识库...'
              : `显示 ${isRealMode ? visibleResults.length : visibleResults.length === 0 ? 0 : 24} 条结果`}
          </div>

          <section aria-busy={searchLoading} className={styles.resultList} aria-label="知识库结果列表">
            {visibleResults.map((item) => (
              <Card
                aria-labelledby={`knowledge-result-${item.title}`}
                className={styles.resultCard}
                key={item.title}
                role="article"
              >
                <div className={styles.resultTitleRow}>
                  <h2 id={`knowledge-result-${item.title}`}>{item.title}</h2>
                  <Badge className={styles.matchBadge}>{item.match}</Badge>
                </div>
                <p className={styles.snippet}>{item.snippet}</p>
                <div className={styles.resultFooter}>
                  <div className={styles.resultMeta}>
                    <Badge className={`${styles.sourceBadge} ${styles[`source-${item.sourceTone}`]}`}>
                      {item.source}
                    </Badge>
                    <span>{item.updated}</span>
                  </div>
                  <div className={styles.resultActions}>
                    <Button
                      className={styles.citationButton}
                      onClick={() => setSelectedResultTitle(item.title)}
                      type="button"
                      variant="link"
                    >
                      查看引用
                    </Button>
                    <Button
                      className={styles.askButton}
                      onClick={() =>
                        navigate(
                          `/chat/knowledge?prompt=${encodeURIComponent(`请基于「${item.title}」为我解释相关营养知识`)}`,
                        )
                      }
                    >
                      就此提问
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        </main>

        <aside className={styles.detailsPanel} aria-label={`当前引用详情${selected ? `：${selected.title}` : ''}`}>
          <h2>当前引用详情</h2>
          {selected ? (
            <>
              <Card className={styles.sourceCard}>
                <strong>{selected.details.sourceName}</strong>
                <span>{selected.details.documentId}</span>
                <p>{selected.details.access}</p>
              </Card>
              <blockquote aria-label={`引用原文：${selected.details.quote}`} className={styles.quote}>
                &quot;
                {selected.details.quote.length > 28
                  ? `${selected.details.quote.slice(0, 28)}...`
                  : selected.details.quote}
                &quot;
              </blockquote>
              {!isRealMode ? (
                <Button
                  className={styles.sourceLink}
                  onClick={() => updateState('source-unavailable')}
                  type="button"
                  variant="link"
                >
                  打开原始来源 <ArrowRight aria-hidden="true" />
                </Button>
              ) : null}
            </>
          ) : (
            <p className={styles.snippet}>提交关键词后，选择一条引用查看版本、章节和安全片段。</p>
          )}
          {!isRealMode ? (
            <>
              <div className={styles.divider} />
              <h3>推荐主题</h3>
              <div className={styles.topicList}>
                {topics.map((topic) => (
                  <Button
                    className={styles.topic}
                    key={topic.title}
                    onClick={() => setQuery(topic.title)}
                    type="button"
                    variant="ghost"
                  >
                    <span className={styles.topicIcon} aria-hidden="true">
                      {topic.icon}
                    </span>
                    <span>
                      <strong>{topic.title}</strong>
                      <small>{topic.count}</small>
                    </span>
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </WorkspaceLayout>
  );
}

function KnowledgeStateCard({
  state,
  detail,
  onAction,
}: {
  state: Exclude<KnowledgeState, 'default'>;
  detail?: string;
  onAction: () => void;
}) {
  const content = {
    empty: {
      status: 'EMPTY · NO MATCHES',
      title: '没有找到相关内容',
      body: '换一个关键词，或清除主题与来源筛选后重试。',
      action: '清除筛选',
    },
    'search-failed': {
      status: 'ERROR · RETRY AVAILABLE',
      title: '检索失败',
      body: '知识库服务暂时不可用，当前没有返回结果。请稍后重试。',
      detail: '错误码: KB_SEARCH_UNAVAILABLE · request_id: req_kb_73e2',
      action: '重新检索',
    },
    'source-unavailable': {
      status: 'PARTIAL ACCESS',
      title: '来源暂时不可访问',
      body: '当前结果仍可查看匹配片段，但原始来源暂时无法打开。',
      detail: '来源状态: unavailable · 已保留引用与文档 ID',
      action: '稍后重试',
    },
  }[state];

  return (
    <div className={`${styles.stateOverlay} ${styles[`state-${state}`]}`} role="presentation">
      <section aria-live="polite" className={styles.stateCard} role="alert">
        <span className={styles.stateStatus}>{content.status}</span>
        <h2>{content.title}</h2>
        <p>{content.body}</p>
        {detail || content.detail ? <span className={styles.stateDetail}>{detail ?? content.detail}</span> : null}
        <Button className={styles.stateAction} onClick={onAction} type="button" variant="link">
          {content.action}
        </Button>
      </section>
    </div>
  );
}

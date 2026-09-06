import { CircleAlert, Info, Plus, RotateCcw, UtensilsCrossed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { WorkspaceLayout } from '../../layouts/WorkspaceLayout/WorkspaceLayout';
import { FIGMA_WORKSPACE_AVATARS } from '../../lib/avatar';
import type { SessionSummary } from '../../types/session';
import {
  createMealPlan,
  loadMealPlans,
  loadShoppingList,
  type MealPlan,
  type MealPlanDraft,
  type ShoppingList,
} from '../../services/planningService';
import { MealPlanningFlow, type MealPlanningFlowView } from './MealPlanningFlow';
import styles from './PlanningPage.module.css';

type DayKey = string;
type PlanningView = 'default' | 'loading' | 'empty' | 'error' | MealPlanningFlowView;

type Meal = {
  name?: string;
  kcal?: string;
};

type MealRow = {
  label: string;
  meals: Meal[];
};

const mealSlots = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
] as const;

const initialMealPlanDraft: MealPlanDraft = {
  planName: '我的本地餐食计划',
  startDate: '2026-08-24',
  endDate: '2026-08-30',
  calories: '2200',
  protein: '130',
  budget: '120',
  allergens: [],
  dislikes: [],
};

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function firstText(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

function realMeal(value: unknown): Meal {
  const meal = objectValue(value);
  if (!meal) return {};
  const directName = firstText(meal, ['name', 'title', 'dish_name', 'dishName']);
  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients : [];
  const ingredientNames = ingredients
    .map((ingredient) => objectValue(ingredient))
    .map((ingredient) => (ingredient ? firstText(ingredient, ['name', 'raw_name', 'rawName']) : undefined))
    .filter((name): name is string => Boolean(name));
  const calories = meal.calories_kcal ?? meal.calories ?? meal.kcal;
  const kcal = typeof calories === 'number' || typeof calories === 'string' ? `${calories} kcal` : undefined;
  return {
    name: directName ?? (ingredientNames.length ? ingredientNames.join('、') : undefined),
    kcal,
  };
}

function realSchedule(plan: MealPlan) {
  const planDays = Array.isArray(plan.days_plan) ? plan.days_plan : [];
  const scheduleDays = planDays.map((_, index) => ({ key: String(index), label: `第${index + 1}天` }));
  const rows = mealSlots.map<MealRow>(({ key, label }) => ({
    label,
    meals: planDays.map((day) => realMeal(objectValue(day)?.[key])),
  }));
  return { days: scheduleDays, rows };
}

const days: Array<{ key: DayKey; label: string }> = [
  { key: '13', label: '周一 13' },
  { key: '14', label: '周二 14' },
  { key: '15', label: '周三 15' },
  { key: '16', label: '周四 16' },
  { key: '17', label: '周五 17' },
];

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

const mealRows: MealRow[] = [
  {
    label: '早餐',
    meals: [
      { name: '燕麦莓果碗', kcal: '420 kcal' },
      { name: '蛋白酸面包', kcal: '420 kcal' },
      { name: '牛油果奶昔', kcal: '420 kcal' },
      { name: '燕麦莓果碗', kcal: '420 kcal' },
      {},
    ],
  },
  {
    label: '午餐',
    meals: [
      { name: '三文鱼饭碗', kcal: '420 kcal' },
      { name: '鸡肉藜麦', kcal: '420 kcal' },
      {},
      { name: '三文鱼饭碗', kcal: '420 kcal' },
      { name: '火鸡卷', kcal: '420 kcal' },
    ],
  },
  {
    label: '晚餐',
    meals: [
      {},
      { name: 'Sirloin Sweet Potato', kcal: '420 kcal' },
      { name: 'Baked Cod Broccoli', kcal: '420 kcal' },
      { name: 'Sirloin Sweet Potato', kcal: '420 kcal' },
      { name: 'Tofu Brown Rice', kcal: '420 kcal' },
    ],
  },
];

const constraints = [
  { label: '蛋白质目标（最低110g）', status: 'Pass ✓', tone: 'pass' },
  { label: '每日热量缺口', status: 'Pass ✓', tone: 'pass' },
  { label: '钠上限（<2300mg）', status: 'Pass ✓', tone: 'pass' },
  { label: '过敏原验证', status: 'Review ✗', tone: 'review' },
] as const;

const shoppingGroups = [
  {
    label: '蛋白质类',
    items: ['野生三文鱼 (450g)', 'Chicken Breast (600g)', '火鸡胸肉 (200g)'],
  },
  {
    label: '蔬果类',
    items: ['蓝莓 (2盒)', '新鲜西兰花 (1颗)', '红薯 (3个)'],
  },
];

const isPlanningView = (value: string | null): value is PlanningView =>
  value === 'loading' ||
  value === 'empty' ||
  value === 'error' ||
  value === 'list' ||
  value === 'wizard-step1' ||
  value === 'wizard-step2' ||
  value === 'wizard-step3' ||
  value === 'conflict' ||
  value === 'shopping-list' ||
  value === 'generating';

function PlanLoadingView() {
  return (
    <div className={`${styles.statePage} ${styles.loadingPage}`} aria-label="餐食规划加载中" aria-busy="true">
      <div className={styles.loadingMain} aria-hidden="true">
        <div className={styles.loadingBanner}>
          <div className={styles.loadingSummary}>
            <span className={`${styles.skeleton} ${styles.loadingTitle}`} />
            <div className={styles.loadingMeta}>
              <span className={`${styles.skeleton} ${styles.loadingGoal}`} />
              <span className={`${styles.skeleton} ${styles.loadingDuration}`} />
            </div>
          </div>
          <div className={styles.loadingActions}>
            <span className={`${styles.skeleton} ${styles.loadingAction}`} />
            <span className={`${styles.skeleton} ${styles.loadingAction}`} />
          </div>
        </div>

        <section className={styles.loadingSchedule}>
          <span className={`${styles.skeleton} ${styles.loadingSectionTitle}`} />
          <div className={styles.loadingDays}>
            <span className={styles.loadingDaySpacer} aria-hidden="true" />
            {days.map((day) => (
              <span className={styles.loadingDay} key={day.key}>
                <span className={`${styles.skeleton} ${styles.loadingDaySkeleton}`} />
              </span>
            ))}
          </div>
          {['早餐', '午餐', '晚餐'].map((label) => (
            <div className={styles.loadingMealRow} key={label}>
              <span className={styles.loadingMealLabel}>{label}</span>
              {days.map((day) => (
                <span className={styles.loadingMealCard} key={`${label}-${day.key}`}>
                  <span className={`${styles.skeleton} ${styles.loadingMealName}`} />
                  <span className={`${styles.skeleton} ${styles.loadingKcal}`} />
                </span>
              ))}
            </div>
          ))}
        </section>
      </div>

      <aside className={styles.loadingSidebar} aria-hidden="true">
        <span className={`${styles.skeleton} ${styles.loadingSidebarTitle}`} />
        <div className={styles.loadingChecks}>
          {Array.from({ length: 4 }, (_, index) => (
            <span className={styles.loadingCheck} key={index}>
              <span className={`${styles.skeleton} ${styles.loadingCheckLabel}`} />
              <span className={`${styles.skeleton} ${styles.loadingCheckBadge}`} />
            </span>
          ))}
        </div>
        <div className={styles.loadingDivider} />
        <span className={`${styles.skeleton} ${styles.loadingShoppingTitle}`} />
        <div className={styles.loadingShoppingGroup}>
          <span className={`${styles.skeleton} ${styles.loadingGroupTitle}`} />
          {Array.from({ length: 3 }, (_, index) => (
            <span className={`${styles.skeleton} ${styles.loadingShoppingItem}`} key={index} />
          ))}
        </div>
      </aside>
    </div>
  );
}

type PlanningFeedbackViewProps = {
  kind: 'empty' | 'error';
  onPrimary: () => void;
  onSecondary?: () => void;
};

function PlanningFeedbackView({ kind, onPrimary, onSecondary }: PlanningFeedbackViewProps) {
  const isError = kind === 'error';

  return (
    <div
      className={`${styles.statePage} ${styles.feedbackPage}`}
      aria-label={isError ? '餐食规划加载失败' : '暂无周餐食规划'}
    >
      <section className={`${styles.feedbackCard} ${isError ? styles.feedbackCardError : styles.feedbackCardEmpty}`}>
        <div className={`${styles.feedbackIcon} ${isError ? styles.feedbackIconError : ''}`} aria-hidden="true">
          {isError ? <CircleAlert /> : <UtensilsCrossed />}
        </div>
        <div className={styles.feedbackCopy}>
          <h1>{isError ? '规划方案加载失败' : '暂无周餐食规划'}</h1>
          <p>
            {isError
              ? '由于网络连接中断或云端模型服务异常，暂时无法加载您在 FoodMate 上的餐食规划日程。'
              : 'FoodMate 还没有为您生成本周的科学减脂/增肌饮食方案。即刻告诉 AI 助手您的膳食目标，一键生成健康食谱。'}
          </p>
        </div>
        {isError ? <span className={styles.errorCode}>错误代码: GATEWAY_TIMEOUT (504)</span> : null}
        <div className={styles.feedbackActions}>
          <Button className={styles.feedbackPrimary} onClick={onPrimary}>
            <span className={styles.feedbackPrimaryIcon}>
              {isError ? <RotateCcw aria-hidden="true" /> : <Plus aria-hidden="true" />}
            </span>
            {isError ? '重新加载' : '创建首个规划方案'}
          </Button>
          {onSecondary ? (
            <Button className={styles.feedbackSecondary} variant="outline" onClick={onSecondary}>
              返回工作台
            </Button>
          ) : null}
        </div>
      </section>
      <p className={styles.feedbackHint}>
        {isError ? (
          <>
            仍有疑问？请联系 <span className={styles.feedbackHintSupport}>系统客服支持</span>
          </>
        ) : (
          <>
            <Info aria-hidden="true" />
            <span className={styles.feedbackHintText}>
              提示：可在"饮食记录"中快速上传日常用餐，数据越准确规划越懂你
            </span>
          </>
        )}
      </p>
    </div>
  );
}

function DefaultPlanningView({ plan }: { plan?: MealPlan }) {
  const schedule = plan ? realSchedule(plan) : { days, rows: mealRows };
  const [activeDay, setActiveDay] = useState<DayKey>(plan ? (schedule.days[0]?.key ?? '0') : '14');
  const [notice, setNotice] = useState('');
  const firstDayKey = plan ? (schedule.days[0]?.key ?? '0') : '14';

  useEffect(() => {
    // Reset the selected day when the authoritative plan schedule changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveDay(firstDayKey);
  }, [firstDayKey]);

  const announce = (message: string) => setNotice(message);
  const planName = plan ? plan.plan_name?.trim() || '餐食计划' : '增肌计划 v3';
  const calorieTarget = plan ? plan.constraints.calorie_target : 2400;
  const dayCount = Math.max(schedule.days.length, 1);
  const scheduleColumns = { gridTemplateColumns: `100px repeat(${dayCount}, minmax(0, 1fr))` };
  const dayButtonColumns = { gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` };

  return (
    <main className={styles.planMain} aria-label="餐食规划" data-figma-node-id="640:974">
      <section className={styles.planBanner} aria-labelledby="plan-title" data-figma-node-id="640:975">
        <div className={styles.planSummary}>
          <h1 id="plan-title">{planName}</h1>
          <div className={styles.planMeta}>
            <span className={styles.goalTag}>
              目标：{calorieTarget == null ? '未设置' : `${calorieTarget.toLocaleString()}千卡`}
            </span>
            <span className={styles.durationTag}>时长：{plan?.days ?? 7}天</span>
          </div>
        </div>
        <div className={styles.bannerActions}>
          <Button
            className={styles.regenerateButton}
            variant="ghost"
            onClick={() => announce(plan ? '重新生成需要通过聊天 AgentRun 发起。' : '已重新生成当前 7 天计划。')}
          >
            重新生成
          </Button>
          <Button className={styles.saveButton} variant="outline" onClick={() => announce('计划已保存。')}>
            保存计划
          </Button>
        </div>
      </section>

      <section className={styles.scheduleSection} aria-labelledby="schedule-title" data-figma-node-id="640:988">
        <h2 id="schedule-title">每周日程</h2>
        <div className={styles.scheduleGrid} style={scheduleColumns}>
          <div className={styles.scheduleSpacer} aria-hidden="true" />
          <div className={styles.dayButtons} role="tablist" aria-label="每周日程日期" style={dayButtonColumns}>
            {schedule.days.map((day) => (
              <Button
                className={`${styles.dayButton} ${activeDay === day.key ? styles.dayButtonActive : ''}`}
                variant="ghost"
                key={day.key}
                type="button"
                role="tab"
                aria-selected={activeDay === day.key}
                onClick={() => {
                  setActiveDay(day.key);
                  announce(`已查看${day.label}的计划。`);
                }}
              >
                {day.label}
              </Button>
            ))}
          </div>

          {schedule.rows.map((row) => (
            <div className={styles.mealRow} key={row.label}>
              <div className={styles.mealLabel}>{row.label}</div>
              {row.meals.map((meal, index) =>
                meal.name ? (
                  <article className={styles.mealCard} key={`${row.label}-${index}`}>
                    <strong>{meal.name}</strong>
                    <span>{meal.kcal}</span>
                  </article>
                ) : (
                  <Button
                    className={styles.emptyMeal}
                    variant="ghost"
                    key={`${row.label}-${index}`}
                    type="button"
                    onClick={() => announce(`已打开${row.label}的计划入口。`)}
                  >
                    + 计划
                  </Button>
                ),
              )}
            </div>
          ))}
        </div>
      </section>

      {notice ? (
        <p className={styles.notice} role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}
    </main>
  );
}

function shoppingItemLabel(item: Record<string, unknown>) {
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '未命名食材';
  const amount = item.amount == null ? '' : `${item.amount}`;
  const unit = typeof item.unit === 'string' ? item.unit : '';
  const detail = amount || unit ? ` (${amount}${unit})` : '';
  return `${name}${detail}`;
}

function PlanSidebar({
  plan,
  shoppingList,
  shoppingLoading,
}: {
  plan?: MealPlan;
  shoppingList?: ShoppingList;
  shoppingLoading?: boolean;
}) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleShoppingItem = (item: string) => {
    setCheckedItems((current) => ({ ...current, [item]: !current[item] }));
  };

  return (
    <aside className={styles.planSidebar} aria-label="计划校验与购物清单" data-figma-node-id="640:1077">
      <section className={styles.constraintSection} aria-labelledby="constraints-title">
        <h2 id="constraints-title">约束校验</h2>
        <div className={styles.constraintList}>
          {(plan
            ? [
                {
                  label: '每日热量目标',
                  status:
                    plan.constraints.calorie_target == null ? '未设置' : `${plan.constraints.calorie_target} kcal`,
                  tone: plan.constraints.calorie_target == null ? 'review' : 'pass',
                },
                {
                  label: '蛋白质目标',
                  status: plan.constraints.protein_target == null ? '未设置' : `${plan.constraints.protein_target} g`,
                  tone: plan.constraints.protein_target == null ? 'review' : 'pass',
                },
                {
                  label: '过敏原',
                  status: plan.constraints.allergens?.length ? `${plan.constraints.allergens.length} 项` : '无',
                  tone: 'pass',
                },
                {
                  label: '忌口',
                  status: plan.constraints.dislikes?.length ? `${plan.constraints.dislikes.length} 项` : '无',
                  tone: 'pass',
                },
              ]
            : constraints
          ).map((item) => (
            <div className={styles.constraintRow} key={item.label}>
              <span>{item.label}</span>
              <strong className={item.tone === 'pass' ? styles.pass : styles.review}>{item.status}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.divider} aria-hidden="true" />

      <section className={styles.shoppingSection} aria-labelledby="shopping-title">
        <h2 id="shopping-title">购物清单预览</h2>
        {plan ? (
          shoppingLoading ? (
            <p className={styles.notice}>正在读取购物清单...</p>
          ) : shoppingList?.items?.length ? (
            <div className={styles.shoppingItems}>
              {shoppingList.items.map((item, index) => {
                const label = shoppingItemLabel(item);
                return (
                  <div className={styles.shoppingRow} key={`${label}-${index}`}>
                    <Checkbox
                      aria-label={label}
                      checked={Boolean(checkedItems[label])}
                      className={styles.shoppingCheckbox}
                      onCheckedChange={() => toggleShoppingItem(label)}
                    />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.notice}>当前计划暂无购物清单。</p>
          )
        ) : (
          shoppingGroups.map((group) => (
            <div className={styles.shoppingGroup} key={group.label}>
              <h3>{group.label}</h3>
              <div className={styles.shoppingItems}>
                {group.items.map((item) => (
                  <div className={styles.shoppingRow} key={item}>
                    <Checkbox
                      aria-label={item}
                      checked={Boolean(checkedItems[item])}
                      className={styles.shoppingCheckbox}
                      onCheckedChange={() => toggleShoppingItem(item)}
                    />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </aside>
  );
}

export function PlanningPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('state');
  const view: PlanningView = isPlanningView(requestedView) ? requestedView : 'default';
  const isRealMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const [realPlans, setRealPlans] = useState<MealPlan[]>([]);
  const [realLoading, setRealLoading] = useState(isRealMode);
  const [realError, setRealError] = useState<string>();
  const [realShoppingList, setRealShoppingList] = useState<ShoppingList>();
  const [realShoppingLoading, setRealShoppingLoading] = useState(false);
  const [realDraft, setRealDraft] = useState<MealPlanDraft>(initialMealPlanDraft);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [createPlanError, setCreatePlanError] = useState<string>();

  useEffect(() => {
    if (!isRealMode) return;
    let cancelled = false;
    // The effect owns the request lifecycle, so loading state starts with each external data request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRealLoading(true);
    loadMealPlans()
      .then((value) => {
        if (!cancelled) {
          setRealPlans(value);
          setRealError(undefined);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setRealError(error instanceof Error ? error.message : '餐食计划加载失败，请重试');
      })
      .finally(() => {
        if (!cancelled) setRealLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isRealMode]);

  const selectedPlanId = searchParams.get('planId');
  const selectedPlan =
    realPlans.find((plan) => plan.meal_plan_id === selectedPlanId) ??
    realPlans.find((plan) => !plan.deleted) ??
    realPlans[0];

  useEffect(() => {
    if (!isRealMode || !selectedPlan || selectedPlan.deleted || selectedPlan.status !== 'saved') {
      // The effect clears stale data when the selected plan is no longer eligible for this subscription.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRealShoppingList(undefined);
      setRealShoppingLoading(false);
      return;
    }
    let cancelled = false;
    setRealShoppingLoading(true);
    loadShoppingList(selectedPlan.meal_plan_id)
      .then((value) => {
        if (!cancelled) setRealShoppingList(value);
      })
      .catch(() => {
        if (!cancelled) setRealShoppingList(undefined);
      })
      .finally(() => {
        if (!cancelled) setRealShoppingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isRealMode, selectedPlan]);
  const isFigmaFixture = !isRealMode && (requestedView === 'v2' || view !== 'default');
  // 错误态画板不包含会话搜索和历史列表，避免把默认工作台壳层带入状态稿。
  const isPlanningErrorFixture = isFigmaFixture && view === 'error';

  const navigatePlanningView = (nextView: MealPlanningFlowView | 'default') => {
    navigate(nextView === 'default' ? '/planning' : `/planning?state=${nextView}`);
  };

  const openRealPlan = (mealPlanId: string) => navigate(`/planning?planId=${encodeURIComponent(mealPlanId)}`);

  const updateRealDraft = (patch: Partial<MealPlanDraft>) => {
    setCreatePlanError(undefined);
    setRealDraft((current) => ({ ...current, ...patch }));
  };

  const submitRealPlan = async () => {
    if (creatingPlan) return;
    setCreatingPlan(true);
    setCreatePlanError(undefined);
    try {
      const created = await createMealPlan(realDraft);
      setRealPlans((current) => [created, ...current.filter((plan) => plan.meal_plan_id !== created.meal_plan_id)]);
      navigate(`/planning?planId=${encodeURIComponent(created.meal_plan_id)}`);
    } catch (error: unknown) {
      setCreatePlanError(error instanceof Error ? error.message : '计划创建失败，请检查参数后重试');
    } finally {
      setCreatingPlan(false);
    }
  };

  const content = isRealMode ? (
    realLoading ? (
      <PlanLoadingView />
    ) : realError ? (
      <PlanningFeedbackView kind="error" onPrimary={() => navigate('/planning')} onSecondary={() => navigate('/')} />
    ) : view === 'list' ? (
      <MealPlanningFlow
        view="list"
        onNavigate={navigatePlanningView}
        realPlans={realPlans}
        onOpenPlan={openRealPlan}
        realDraft={realDraft}
        onDraftChange={updateRealDraft}
        onCreatePlan={() => void submitRealPlan()}
        creatingPlan={creatingPlan}
        createError={createPlanError}
      />
    ) : view === 'wizard-step1' ||
      view === 'wizard-step2' ||
      view === 'wizard-step3' ||
      view === 'conflict' ||
      view === 'shopping-list' ||
      view === 'generating' ? (
      <MealPlanningFlow
        view={view}
        onNavigate={navigatePlanningView}
        realPlans={realPlans}
        onOpenPlan={openRealPlan}
        realDraft={realDraft}
        onDraftChange={updateRealDraft}
        onCreatePlan={() => void submitRealPlan()}
        creatingPlan={creatingPlan}
        createError={createPlanError}
      />
    ) : view === 'empty' || realPlans.length === 0 ? (
      <PlanningFeedbackView kind="empty" onPrimary={() => navigate('/planning?state=wizard-step1')} />
    ) : (
      <DefaultPlanningView plan={selectedPlan} />
    )
  ) : view === 'loading' ? (
    <PlanLoadingView />
  ) : view === 'empty' ? (
    <PlanningFeedbackView kind="empty" onPrimary={() => navigate('/chat?prompt=请为我创建本周餐食规划')} />
  ) : view === 'error' ? (
    <PlanningFeedbackView kind="error" onPrimary={() => navigate('/planning')} onSecondary={() => navigate('/')} />
  ) : view === 'list' ||
    view === 'wizard-step1' ||
    view === 'wizard-step2' ||
    view === 'wizard-step3' ||
    view === 'conflict' ||
    view === 'shopping-list' ||
    view === 'generating' ? (
    <MealPlanningFlow view={view} onNavigate={navigatePlanningView} />
  ) : (
    <DefaultPlanningView />
  );

  return (
    <WorkspaceLayout
      activeModule="planning"
      fixtureVariant={isFigmaFixture ? 'planning' : undefined}
      rightRail={
        view === 'default' && (!isRealMode || selectedPlan) ? (
          <PlanSidebar
            plan={isRealMode ? selectedPlan : undefined}
            shoppingList={isRealMode ? realShoppingList : undefined}
            shoppingLoading={isRealMode ? realShoppingLoading : false}
          />
        ) : undefined
      }
      rightRailWidth={view === 'default' && (!isRealMode || selectedPlan) ? 340 : undefined}
      displayNameOverride={isFigmaFixture ? 'Anddy' : undefined}
      profileIdOverride={isFigmaFixture ? '1234567' : undefined}
      topbarVariant={isFigmaFixture && view === 'list' ? 'planning-list' : undefined}
      sidebarAvatarSrc={isFigmaFixture ? FIGMA_WORKSPACE_AVATARS.sidebar : undefined}
      topAvatarSrc={isFigmaFixture ? FIGMA_WORKSPACE_AVATARS.topbar : undefined}
      showKnowledgeTopNav={!isFigmaFixture}
      hideSessionHistory={isPlanningErrorFixture}
      sidebarFixture={
        isFigmaFixture
          ? {
              sessions: figmaSidebarSessions,
              hideSessionSearch: isPlanningErrorFixture,
              hideSessionPagination: isPlanningErrorFixture,
            }
          : undefined
      }
    >
      {content}
    </WorkspaceLayout>
  );
}

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Utensils,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FIGMA_WORKSPACE_AVATARS } from '../../lib/avatar';
import { WorkspaceLayout } from '../../layouts/WorkspaceLayout/WorkspaceLayout';
import {
  createFoodLog,
  deleteFoodLog,
  loadDeletedFoodLogs,
  loadFoodLogs,
  restoreFoodLog,
  updateFoodLog,
  type FoodLog,
} from '../../services/foodLogService';
import type { SessionSummary } from '../../types/session';
import styles from './DietRecordsPage.module.css';

type FoodItem = {
  id: string;
  name: string;
  status: 'confirmed' | 'pending';
  carbs: string;
  protein: string;
  fat: string;
  logId?: string;
  revision?: number;
};

type MealSection = {
  id: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  icon: string;
  title: string;
  time: string;
  items: FoodItem[];
};

const initialDate = new Date(2024, 2, 14);

const initialMeals: MealSection[] = [
  {
    id: 'breakfast',
    icon: '🌅',
    title: 'Breakfast',
    time: '上午 8:30',
    items: [
      {
        id: 'blueberry-oatmeal',
        name: '蓝莓燕麦粥',
        status: 'confirmed',
        carbs: 'C: 45g',
        protein: 'P: 8g',
        fat: 'F: 4g',
      },
    ],
  },
  {
    id: 'lunch',
    icon: '🌞',
    title: 'Lunch',
    time: '下午 1:15',
    items: [
      {
        id: 'salmon-bowl',
        name: '煎三文鱼碗',
        status: 'confirmed',
        carbs: 'C: 55g',
        protein: 'P: 34g',
        fat: 'F: 18g',
      },
      {
        id: 'greek-yogurt',
        name: '希腊酸奶蜂蜜',
        status: 'pending',
        carbs: 'C: 18g',
        protein: 'P: 12g',
        fat: 'F: 2g',
      },
    ],
  },
];

type Metric = {
  label: string;
  value: string;
  unit: string;
  percentage: number;
  tone: 'purple' | 'green' | 'orange' | 'red';
};

const metrics: Metric[] = [
  { label: '能量完成', value: '1,420', unit: '/ 2,000 kcal', percentage: 71, tone: 'purple' },
  { label: '蛋白质目标', value: '98', unit: '/ 120 g', percentage: 81, tone: 'green' },
  { label: '碳水目标', value: '150', unit: '/ 250 g', percentage: 60, tone: 'orange' },
  { label: '脂肪目标', value: '44', unit: '/ 70 g', percentage: 62, tone: 'red' },
] as const;

// 默认 fixture 使用 Figma 导出的进度环，避免浏览器 conic-gradient 光栅化造成视觉偏差。
const figmaMetricAssets: Record<Metric['tone'], string> = {
  purple: '/assets/figma/diet-records/metric-ring-energy.svg',
  green: '/assets/figma/diet-records/metric-ring-protein.svg',
  orange: '/assets/figma/diet-records/metric-ring-carbs.svg',
  red: '/assets/figma/diet-records/metric-ring-fat.svg',
};

const emptyMetrics = metrics.map((metric) => ({ ...metric, value: '0', percentage: 0 }));

const figmaSidebarSessions: SessionSummary[] = [
  { id: 'weekly-adjustment', title: '每周饮食微调', subtitle: '12:45', active: true },
  { id: 'pre-workout-snack', title: '运动前零食建议', subtitle: '12:45', active: false },
  { id: 'allergen-rules', title: '过敏原排除规则', subtitle: '12:45', active: false },
  { id: 'protein-plan', title: '蛋白质补充方案', subtitle: '12:45', active: false },
  { id: 'bedtime-snack', title: '睡前加餐建议', subtitle: '12:45', active: false },
  { id: 'breakfast-carbs', title: '早餐碳水搭配', subtitle: '12:45', active: false },
  { id: 'dinner-protein', title: '晚餐蛋白质补充', subtitle: '12:45', active: false },
  { id: 'low-carb-plan', title: '低碳水饮食建议', subtitle: '12:45', active: false },
];

type RecordsState = 'default' | 'loading' | 'empty' | 'error';

function getRecordsState(value: string | null): RecordsState {
  return value === 'loading' || value === 'empty' || value === 'error' ? value : 'default';
}

function formatDateLabel(date: Date, realMode = false) {
  const today = new Date();
  const isInitialDate = realMode
    ? date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    : date.getTime() === initialDate.getTime();
  return isInitialDate
    ? `今天，${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getMonth() + 1}月${date.getDate()}日`;
}

function shiftDate(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function weekWindow(date: Date) {
  const from = startOfWeek(date);
  const to = shiftDate(from, 7);
  return { from: from.toISOString(), to: to.toISOString() };
}

function sameLocalDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatWeekLabel(date: Date) {
  const from = startOfWeek(date);
  const to = shiftDate(from, 6);
  return `${from.getMonth() + 1}月${from.getDate()}日 - ${to.getMonth() + 1}月${to.getDate()}日`;
}

type WeekDay = { date: Date; meals: MealSection[] };

function mapWeekLogs(logs: FoodLog[], date: Date): WeekDay[] {
  const from = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDate(from, index);
    return {
      date: day,
      meals: mapFoodLogs(logs.filter((log) => sameLocalDate(new Date(log.meal_time), day))),
    };
  });
}

function ProgressRing({ percentage, tone, assetSrc }: { percentage: number; tone: Metric['tone']; assetSrc?: string }) {
  const style = { '--progress': percentage } as CSSProperties;
  return (
    <div
      className={`${styles.progressRing} ${styles[tone]} ${assetSrc ? styles.progressRingWithAsset : ''}`}
      style={style}
      aria-label={`${percentage}% 完成`}
    >
      {assetSrc ? <img className={styles.progressRingAsset} src={assetSrc} alt="" aria-hidden="true" /> : null}
      <span>{percentage}%</span>
    </div>
  );
}

const realMealMeta: Record<MealSection['id'], { icon: string; title: string }> = {
  breakfast: { icon: '🌅', title: '早餐' },
  lunch: { icon: '🌞', title: '午餐' },
  dinner: { icon: '🌙', title: '晚餐' },
  snack: { icon: '🍎', title: '加餐' },
};

function dayWindow(date: Date) {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatMetricNumber(value: number) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
}

function asNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function mapFoodLogs(logs: FoodLog[]): MealSection[] {
  const sections = Object.keys(realMealMeta).map((id) => {
    const mealId = id as MealSection['id'];
    const meta = realMealMeta[mealId];
    const relatedLogs = logs.filter((log) => log.meal_type === mealId);
    return {
      id: mealId,
      icon: meta.icon,
      title: meta.title,
      time: relatedLogs[0]
        ? new Date(relatedLogs[0].meal_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : '暂无记录',
      items: relatedLogs.flatMap((log) =>
        log.items.map((item) => ({
          id: `${log.food_log_id}-${item.food_log_item_id}`,
          name: item.raw_name,
          status: item.nutrition_status === 'matched' ? ('confirmed' as const) : ('pending' as const),
          carbs: item.carbs_g == null ? 'C: 待估算' : `C: ${formatMetricNumber(asNumber(item.carbs_g))}g`,
          protein: item.protein_g == null ? 'P: 待估算' : `P: ${formatMetricNumber(asNumber(item.protein_g))}g`,
          fat: item.fat_g == null ? 'F: 待估算' : `F: ${formatMetricNumber(asNumber(item.fat_g))}g`,
          logId: log.food_log_id,
          revision: log.revision,
        })),
      ),
    } satisfies MealSection;
  });
  return sections.filter((section) => section.items.length > 0);
}

function realMetrics(logs: FoodLog[]): Metric[] {
  const items = logs.flatMap((log) => log.items);
  const total = (key: 'calories_kcal' | 'protein_g' | 'carbs_g' | 'fat_g') =>
    items.reduce((sum, item) => sum + asNumber(item[key]), 0);
  return [
    {
      label: '能量合计',
      value: formatMetricNumber(total('calories_kcal')),
      unit: 'kcal · 未配置目标',
      percentage: 0,
      tone: 'purple',
    },
    {
      label: '蛋白质合计',
      value: formatMetricNumber(total('protein_g')),
      unit: 'g · 未配置目标',
      percentage: 0,
      tone: 'green',
    },
    {
      label: '碳水合计',
      value: formatMetricNumber(total('carbs_g')),
      unit: 'g · 当前日期',
      percentage: 0,
      tone: 'orange',
    },
    { label: '脂肪合计', value: formatMetricNumber(total('fat_g')), unit: 'g · 当前日期', percentage: 0, tone: 'red' },
  ];
}

export function DietRecordsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const recordsState = getRecordsState(searchParams.get('state'));
  const isRealMode = import.meta.env.VITE_AGENT_MODE === 'real';
  const isFigmaFixture = !isRealMode && (searchParams.get('state') === 'v2' || recordsState !== 'default');
  const [selectedDate, setSelectedDate] = useState(() => (isRealMode ? new Date() : initialDate));
  const [view, setView] = useState<'day' | 'week'>('day');
  const [meals, setMeals] = useState<MealSection[]>(initialMeals);
  const [realLogs, setRealLogs] = useState<FoodLog[]>([]);
  const [realLoading, setRealLoading] = useState(isRealMode);
  const [realError, setRealError] = useState<string>();
  const [realReloadNonce, setRealReloadNonce] = useState(0);
  const [dialogMealId, setDialogMealId] = useState<MealSection['id']>();
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingLogId, setEditingLogId] = useState<string>();
  const [dialogDate, setDialogDate] = useState(selectedDate);
  const [foodName, setFoodName] = useState('');
  const [foodAmount, setFoodAmount] = useState('1');
  const [foodUnit, setFoodUnit] = useState('份');
  const [deletedLogs, setDeletedLogs] = useState<FoodLog[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedError, setDeletedError] = useState<string>();
  const [showDeleted, setShowDeleted] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!isRealMode) return;
    let active = true;
    // The effect owns the request lifecycle, so loading state starts with each external data request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRealLoading(true);
    setRealError(undefined);
    const window = view === 'week' ? weekWindow(selectedDate) : dayWindow(selectedDate);
    loadFoodLogs(window.from, window.to)
      .then((logs) => {
        if (!active) return;
        setRealLogs(logs);
        setMeals(mapFoodLogs(logs));
      })
      .catch((cause) => {
        if (!active) return;
        setRealLogs([]);
        setMeals([]);
        setRealError(cause instanceof Error ? cause.message : '饮食记录加载失败');
      })
      .finally(() => {
        if (active) setRealLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isRealMode, realReloadNonce, selectedDate, view]);

  const selectedMeal = useMemo(() => meals.find((meal) => meal.id === dialogMealId), [dialogMealId, meals]);
  const weekDays = useMemo(() => mapWeekLogs(realLogs, selectedDate), [realLogs, selectedDate]);

  const openFoodDialog = (mealId: MealSection['id'], date = selectedDate) => {
    setDialogMode('create');
    setEditingLogId(undefined);
    setDialogMealId(mealId);
    setDialogDate(date);
    setFoodName('');
    setFoodAmount('1');
    setFoodUnit('份');
  };

  const openEditDialog = (logId: string) => {
    const log = realLogs.find((candidate) => candidate.food_log_id === logId);
    const firstItem = log?.items[0];
    if (!log || !firstItem) return;
    setDialogMode('edit');
    setEditingLogId(log.food_log_id);
    setDialogMealId(log.meal_type as MealSection['id']);
    setFoodName(firstItem.raw_name);
    setFoodAmount(String(firstItem.amount));
    setFoodUnit(firstItem.unit);
  };

  const closeFoodDialog = () => {
    setDialogMealId(undefined);
    setDialogMode('create');
    setEditingLogId(undefined);
    setFoodName('');
    setFoodAmount('1');
    setFoodUnit('份');
  };

  const addFood = () => {
    const name = foodName.trim();
    if (!name || !dialogMealId) return;
    const amount = Number(foodAmount);
    const unit = foodUnit.trim();
    if (!Number.isFinite(amount) || amount <= 0 || !unit) {
      setNotice('请填写有效的份量和单位。');
      return;
    }

    if (isRealMode) {
      if (dialogMode === 'edit' && editingLogId) {
        const current = realLogs.find((log) => log.food_log_id === editingLogId);
        if (!current || current.items.length === 0) return;
        void updateFoodLog(editingLogId, current.revision, {
          meal_time: current.meal_time,
          meal_type: current.meal_type,
          notes: current.notes ?? undefined,
          items: current.items.map((item, index) =>
            index === 0
              ? { raw_name: name, amount, unit }
              : { raw_name: item.raw_name, amount: asNumber(item.amount), unit: item.unit },
          ),
        })
          .then((updated) => {
            const nextLogs = realLogs.map((log) => (log.food_log_id === updated.food_log_id ? updated : log));
            setRealLogs(nextLogs);
            setMeals(mapFoodLogs(nextLogs));
            setNotice(`${name} 已更新。`);
            closeFoodDialog();
          })
          .catch((cause) => setNotice(cause instanceof Error ? cause.message : '饮食记录更新失败'));
        return;
      }
      void createFoodLog({
        meal_time: new Date(dialogDate).toISOString(),
        meal_type: dialogMealId,
        items: [{ raw_name: name, amount, unit }],
      })
        .then((created) => {
          setRealLogs((current) => [...current, created]);
          setMeals(mapFoodLogs([...realLogs, created]));
          setNotice(`${name} 已提交，营养值将由服务端估算。`);
          closeFoodDialog();
        })
        .catch((cause) => setNotice(cause instanceof Error ? cause.message : '饮食记录保存失败'));
      return;
    }

    setMeals((current) =>
      current.map((meal) =>
        meal.id === dialogMealId
          ? {
              ...meal,
              items: [
                ...meal.items,
                {
                  id: `${dialogMealId}-${Date.now()}`,
                  name,
                  status: 'pending',
                  carbs: 'C: 待估算',
                  protein: 'P: 待估算',
                  fat: 'F: 待估算',
                },
              ],
            }
          : meal,
      ),
    );
    setNotice(`${name} 已添加到${selectedMeal?.title ?? '餐次'}，等待营养估算。`);
    closeFoodDialog();
  };

  const removeFood = (mealId: MealSection['id'], foodId: string, foodNameToRemove: string) => {
    if (isRealMode) {
      const item = meals.find((meal) => meal.id === mealId)?.items.find((candidate) => candidate.id === foodId);
      if (!item?.logId || item.revision == null) return;
      void deleteFoodLog(item.logId, item.revision)
        .then(() => {
          const nextLogs = realLogs.filter((log) => log.food_log_id !== item.logId);
          setRealLogs(nextLogs);
          setMeals(mapFoodLogs(nextLogs));
          setNotice(`${foodNameToRemove} 已从当前记录移除。`);
        })
        .catch((cause) => setNotice(cause instanceof Error ? cause.message : '饮食记录删除失败'));
      return;
    }
    setMeals((current) =>
      current.map((meal) =>
        meal.id === mealId ? { ...meal, items: meal.items.filter((item) => item.id !== foodId) } : meal,
      ),
    );
    setNotice(`${foodNameToRemove} 已从当前记录移除。`);
  };

  const toggleDeleted = () => {
    const nextVisible = !showDeleted;
    setShowDeleted(nextVisible);
    if (!nextVisible || deletedLogs.length > 0 || deletedLoading) return;
    setDeletedLoading(true);
    setDeletedError(undefined);
    void loadDeletedFoodLogs()
      .then(setDeletedLogs)
      .catch((cause) => setDeletedError(cause instanceof Error ? cause.message : '已删除记录加载失败'))
      .finally(() => setDeletedLoading(false));
  };

  const restoreDeleted = (log: FoodLog) => {
    void restoreFoodLog(log.food_log_id, log.revision)
      .then(() => {
        setDeletedLogs((current) => current.filter((item) => item.food_log_id !== log.food_log_id));
        setRealReloadNonce((current) => current + 1);
        setNotice(`${log.items[0]?.raw_name ?? '饮食记录'} 已恢复。`);
      })
      .catch((cause) => setNotice(cause instanceof Error ? cause.message : '饮食记录恢复失败'));
  };

  const reloadRecords = () => {
    if (isRealMode) {
      setRealReloadNonce((current) => current + 1);
      return;
    }
    setSearchParams({ view: 'records' });
    setNotice('正在重新加载饮食记录。');
  };

  const realEmpty = isRealMode && !realLoading && !realError && realLogs.length === 0;
  const visibleState: RecordsState = isRealMode
    ? realLoading
      ? 'loading'
      : realError
        ? 'error'
        : realEmpty
          ? 'empty'
          : 'default'
    : recordsState;
  const recordMetrics = isRealMode ? realMetrics(realLogs) : recordsState === 'empty' ? emptyMetrics : metrics;

  const renderMealCard = (meal: MealSection, date = selectedDate) => (
    <article className={styles.mealCard} key={meal.id}>
      <header className={styles.mealHeader}>
        <div className={styles.mealHeading}>
          <h2>
            <span className={styles.mealIcon} aria-hidden="true">
              {meal.icon}
            </span>
            <span>{meal.title}</span>
          </h2>
          <span>{meal.time}</span>
        </div>
        <Button
          className={styles.addFoodButton}
          variant="ghost"
          type="button"
          onClick={() => openFoodDialog(meal.id, date)}
        >
          + 添加食物
        </Button>
      </header>
      <div className={styles.foodList}>
        {meal.items.map((item) => (
          <div className={styles.foodRow} key={item.id}>
            <div className={styles.foodName}>
              <strong>{item.name}</strong>
              <span className={item.status === 'confirmed' ? styles.confirmed : styles.pending}>
                {item.status === 'confirmed' ? '已确认' : '待确认'}
              </span>
            </div>
            <div className={styles.foodMeta}>
              <div className={styles.macroTags} aria-label="营养素">
                <span className={styles.carb}>{item.carbs}</span>
                <span className={styles.protein}>{item.protein}</span>
                <span className={styles.fat}>{item.fat}</span>
              </div>
              {isRealMode && item.logId ? (
                <Button
                  className={styles.iconAction}
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={`编辑${item.name}所在记录`}
                  title={`编辑${item.name}所在记录`}
                  onClick={() => openEditDialog(item.logId as string)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              ) : null}
              <Button
                className={styles.removeButton}
                variant="ghost"
                size="icon"
                type="button"
                aria-label={`删除${item.name}${isRealMode ? '所在记录' : ''}`}
                title={`删除${item.name}${isRealMode ? '所在记录' : ''}`}
                onClick={() => removeFood(meal.id, item.id, item.name)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );

  return (
    <WorkspaceLayout
      activeModule="records"
      fixtureVariant={isFigmaFixture ? 'diet-records' : undefined}
      displayNameOverride={isFigmaFixture ? 'Anddy' : undefined}
      profileIdOverride={isFigmaFixture ? '1234567' : undefined}
      sidebarAvatarSrc={isFigmaFixture ? FIGMA_WORKSPACE_AVATARS.sidebar : undefined}
      topAvatarSrc={isFigmaFixture ? FIGMA_WORKSPACE_AVATARS.topbar : undefined}
      showKnowledgeTopNav={!isFigmaFixture}
      sidebarFixture={isFigmaFixture ? { sessions: figmaSidebarSessions } : undefined}
    >
      <div className={`${styles.page} fm-enter`}>
        <section className={styles.recordsBody} aria-label="饮食记录" data-figma-node-id="640:660">
          <header className={styles.dateToolbar}>
            <div className={styles.dateNavigation}>
              <Button
                className={styles.dateButton}
                variant="ghost"
                size="icon"
                aria-label="前一天"
                onClick={() => setSelectedDate((current) => shiftDate(current, view === 'week' ? -7 : -1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                className={styles.dateLabel}
                variant="ghost"
                onClick={() => setSelectedDate(isRealMode ? new Date() : initialDate)}
              >
                {view === 'week'
                  ? isRealMode
                    ? formatWeekLabel(selectedDate)
                    : '本周，3月11日 - 3月17日'
                  : formatDateLabel(selectedDate, isRealMode)}
              </Button>
              <Button
                className={styles.dateButton}
                variant="ghost"
                size="icon"
                aria-label="后一天"
                onClick={() => setSelectedDate((current) => shiftDate(current, view === 'week' ? 7 : 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
            <div className={styles.viewSwitch} role="tablist" aria-label="记录视图">
              <Button
                className={view === 'day' ? styles.viewActive : ''}
                variant="ghost"
                type="button"
                role="tab"
                aria-selected={view === 'day'}
                onClick={() => setView('day')}
              >
                日视图
              </Button>
              <Button
                className={view === 'week' ? styles.viewActive : ''}
                variant="ghost"
                type="button"
                role="tab"
                aria-selected={view === 'week'}
                onClick={() => setView('week')}
              >
                周视图
              </Button>
            </div>
          </header>

          {visibleState === 'loading' ? (
            <section
              className={`${styles.loadingContent} ${isFigmaFixture ? styles.figmaLoadingContent : ''}`}
              aria-label="饮食记录加载中"
              aria-busy="true"
            >
              <div className={styles.loadingMetrics}>
                {Array.from({ length: 4 }, (_, index) => (
                  <div className={styles.loadingMetric} key={index}>
                    <span />
                    <strong />
                    <i />
                  </div>
                ))}
              </div>
              <div className={styles.loadingMeals}>
                <div className={styles.loadingMeal}>
                  <div className={styles.loadingMealHeader}>
                    <span />
                    <i />
                  </div>
                  <div className={styles.loadingMealRows}>
                    <strong />
                  </div>
                </div>
                <div className={`${styles.loadingMeal} ${styles.loadingMealDouble}`}>
                  <div className={styles.loadingMealHeader}>
                    <span />
                    <i />
                  </div>
                  <div className={styles.loadingMealRows}>
                    <strong />
                    <strong />
                  </div>
                </div>
              </div>
            </section>
          ) : visibleState === 'error' ? (
            <section
              className={`${styles.statePanel} ${isFigmaFixture ? styles.figmaErrorStatePanel : ''}`}
              aria-label="饮食记录加载失败"
              role="alert"
            >
              <div className={`${styles.stateIcon} ${styles.stateIconError}`}>
                <AlertTriangle aria-hidden="true" />
              </div>
              <div className={styles.stateCopy}>
                <h2>饮食记录加载失败</h2>
                <p>请检查网络连接后重试</p>
                {isRealMode && realError ? <p>{realError}</p> : null}
              </div>
              <Button className={styles.stateAction} onClick={reloadRecords}>
                <RefreshCw aria-hidden="true" />
                重新加载
              </Button>
            </section>
          ) : (
            <>
              <section className={styles.metrics} aria-label="营养指标" data-figma-node-id="640:674">
                {recordMetrics.map((metric) => (
                  <article className={styles.metricCard} key={metric.label}>
                    <div className={styles.metricCopy}>
                      <span>{metric.label}</span>
                      <div>
                        <strong>{metric.value}</strong>
                        <small>{metric.unit}</small>
                      </div>
                    </div>
                    <ProgressRing
                      percentage={metric.percentage}
                      tone={metric.tone}
                      assetSrc={isFigmaFixture && recordsState !== 'empty' ? figmaMetricAssets[metric.tone] : undefined}
                    />
                  </article>
                ))}
              </section>

              {visibleState === 'empty' ? (
                <section
                  className={`${styles.statePanel} ${isFigmaFixture ? styles.figmaEmptyStatePanel : ''}`}
                  aria-label="今天还没有饮食记录"
                >
                  <div className={`${styles.stateIcon} ${styles.stateIconEmpty}`}>
                    <Utensils aria-hidden="true" />
                  </div>
                  <div className={styles.stateCopy}>
                    <h2>{view === 'week' ? '本周还没有饮食记录' : '今天还没有饮食记录'}</h2>
                    <p>{view === 'week' ? '选择一个日期或记录一餐，开始建立饮食记录' : '点击下方按钮记录你的第一餐'}</p>
                  </div>
                  <Button className={styles.stateAction} onClick={() => openFoodDialog('breakfast')}>
                    <Plus aria-hidden="true" />
                    记录一餐
                  </Button>
                </section>
              ) : (
                <section className={styles.meals} aria-label="餐次记录" data-figma-node-id="640:711">
                  {isRealMode && view === 'week'
                    ? weekDays.map((day) => (
                        <section className={styles.weekDay} key={day.date.toISOString()} aria-label="周视图日期">
                          <header className={styles.weekDayHeader}>
                            <h2>{day.date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</h2>
                            <span>{sameLocalDate(day.date, new Date()) ? '今天' : ''}</span>
                          </header>
                          {day.meals.length > 0 ? (
                            day.meals.map((meal) => renderMealCard(meal, day.date))
                          ) : (
                            <p className={styles.weekDayEmpty}>暂无记录</p>
                          )}
                        </section>
                      ))
                    : meals.map((meal) => renderMealCard(meal, selectedDate))}
                </section>
              )}
            </>
          )}
        </section>

        {(visibleState === 'default' || visibleState === 'empty') && !isFigmaFixture ? (
          <section className={styles.recordsActions} aria-label="饮食记录操作">
            {visibleState === 'default' ? (
              <>
                <Button className={styles.logMealButton} type="button" onClick={() => openFoodDialog('breakfast')}>
                  记录一餐
                </Button>
                <Button
                  className={styles.analyzeDayButton}
                  variant="outline"
                  type="button"
                  onClick={() => navigate('/analysis')}
                >
                  分析这一天
                </Button>
              </>
            ) : null}
            {isRealMode ? (
              <Button
                className={styles.deletedButton}
                variant="outline"
                type="button"
                aria-expanded={showDeleted}
                onClick={toggleDeleted}
              >
                <RotateCcw aria-hidden="true" />
                {showDeleted ? '收起已删除' : '已删除记录'}
              </Button>
            ) : null}
          </section>
        ) : null}

        {isRealMode && showDeleted ? (
          <section className={styles.deletedPanel} aria-label="已删除饮食记录">
            <header className={styles.deletedHeader}>
              <div>
                <h2>已删除记录</h2>
                <p>恢复后记录会回到原来的用餐日期。</p>
              </div>
              <RotateCcw aria-hidden="true" />
            </header>
            {deletedLoading ? <p className={styles.deletedState}>正在加载已删除记录…</p> : null}
            {deletedError ? (
              <p className={styles.deletedState} role="alert">
                {deletedError}
              </p>
            ) : null}
            {!deletedLoading && !deletedError && deletedLogs.length === 0 ? (
              <p className={styles.deletedState}>暂无可恢复记录。</p>
            ) : null}
            <div className={styles.deletedList}>
              {deletedLogs.map((log) => (
                <div className={styles.deletedRow} key={log.food_log_id}>
                  <div>
                    <strong>{log.items.map((item) => item.raw_name).join('、')}</strong>
                    <span>
                      {new Date(log.meal_time).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => restoreDeleted(log)}
                    aria-label={`恢复${log.items[0]?.raw_name ?? '饮食记录'}`}
                  >
                    <RotateCcw aria-hidden="true" />
                    恢复
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {visibleState === 'default' && !isRealMode ? (
          <section className={styles.entryDetail} aria-label="记录详情" data-figma-node-id="974:3">
            <h2>{'记录详情  ·  待确认记录可在这里补充后保存'}</h2>
            <p>{'蓝莓燕麦粥  ·  早餐  ·  08:30  ·  估算值'}</p>
            <p>{'份量  350  |  单位  g  |  热量  420 kcal  |  蛋白质  18 g  |  来源  USDA  |  估算状态  待确认'}</p>
            <div className={styles.entryActions}>
              <Button variant="ghost" type="button" onClick={() => setNotice('已打开自然语言记录入口。')}>
                记录一餐（自然语言）
              </Button>
              <Button variant="ghost" type="button" onClick={() => openFoodDialog('breakfast')}>
                编辑记录
              </Button>
              <Button variant="ghost" type="button" onClick={() => setNotice('已复制到明天的记录草稿。')}>
                复制到明天
              </Button>
              <Button variant="ghost" type="button" onClick={() => navigate('/analysis')}>
                分析当天
              </Button>
              <Button variant="ghost" type="button" onClick={() => setNotice('待确认记录已标记为可软删除状态。')}>
                软删除
              </Button>
            </div>
            <p className={styles.entryNote}>保存失败时保留草稿；已删除记录进入可恢复状态，不改变当天统计历史。</p>
            {notice ? (
              <p className={styles.notice} role="status" aria-live="polite">
                {notice}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      <Dialog open={Boolean(dialogMealId)} onOpenChange={(open) => !open && closeFoodDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit' ? '编辑饮食记录' : '添加食物'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit'
                ? '只修改当前记录的第一项食物，其余明细会保留。'
                : `添加到 ${selectedMeal?.title ?? '当前餐次'}，营养值将在确认后估算。`}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="例如：煮鸡蛋 2 个"
            aria-label="食物名称"
            value={foodName}
            onChange={(event) => setFoodName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addFood();
            }}
          />
          <Input
            type="number"
            min="0.001"
            step="0.001"
            placeholder="份量"
            aria-label="食物份量"
            value={foodAmount}
            onChange={(event) => setFoodAmount(event.target.value)}
          />
          <Input
            placeholder="单位，例如：份、克"
            aria-label="食物单位"
            value={foodUnit}
            onChange={(event) => setFoodUnit(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeFoodDialog}>
              取消
            </Button>
            <Button onClick={addFood} disabled={!foodName.trim() || !foodAmount.trim() || !foodUnit.trim()}>
              {dialogMode === 'edit' ? '保存' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceLayout>
  );
}

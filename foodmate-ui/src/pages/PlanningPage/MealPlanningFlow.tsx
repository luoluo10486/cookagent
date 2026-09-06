import { Check, CircleAlert, Download, Menu, Plus, Printer, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MealPlan, MealPlanDraft } from '../../services/planningService';
import styles from './MealPlanningFlow.module.css';

export type MealPlanningFlowView =
  'list' | 'wizard-step1' | 'wizard-step2' | 'wizard-step3' | 'conflict' | 'shopping-list' | 'generating';

type NavigateToView = (view: MealPlanningFlowView | 'default') => void;

const steps = ['设置目标', '设置约束', '确认并生成', '完成计划'];

const plans = [
  {
    name: '夏日减脂轻食计划',
    status: '进行中',
    statusTone: 'active',
    dates: '2026.06.01 - 2026.06.07',
    calories: '每日目标: 1,800 kcal',
    protein: '蛋白质: 120g',
    budget: '预算: ¥100/天',
    level: '经济适用',
    updated: '最后修改: 刚刚更新',
  },
  {
    name: '高蛋白增肌能量餐',
    status: '草稿',
    statusTone: 'draft',
    dates: '2026.06.10 - 2026.06.24',
    calories: '每日目标: 2,500 kcal',
    protein: '蛋白质: 150g',
    budget: '预算: ¥180/天',
    level: '优质食材',
    updated: '最后修改: 2小时前',
  },
  {
    name: '抗炎生酮低碳饮食',
    status: '已归档',
    statusTone: 'archived',
    dates: '2026.05.15 - 2026.05.22',
    calories: '每日目标: 1,600 kcal',
    protein: '蛋白质: 90g',
    budget: '预算: ¥120/天',
    level: '家庭量贩',
    updated: '最后修改: 2周前',
  },
] as const;

type PlanCard = {
  id: string;
  name: string;
  status: string;
  statusTone: 'active' | 'validated' | 'draft' | 'archived';
  dates: string;
  calories: string;
  protein: string;
  budget: string;
  level: string;
  updated: string;
};

function realPlanCard(plan: MealPlan): PlanCard {
  const archived = plan.deleted;
  const statusTone = archived
    ? 'archived'
    : plan.status === 'draft'
      ? 'draft'
      : plan.status === 'validated'
        ? 'validated'
        : 'active';
  const status = archived
    ? '已删除'
    : plan.status === 'draft'
      ? '草稿'
      : plan.status === 'validated'
        ? '已校验'
        : plan.status === 'saved'
          ? '已保存'
          : `状态：${plan.status || '未知'}`;
  const calorieTarget = plan.constraints.calorie_target;
  const proteinTarget = plan.constraints.protein_target;
  const budget = plan.budget == null ? '未设置' : `${plan.budget}`;
  const updated = new Date(plan.updated_at).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    id: plan.meal_plan_id,
    name: plan.plan_name?.trim() || `未命名 ${plan.meal_plan_id}`,
    status,
    statusTone,
    dates: `${plan.days} 天计划`,
    calories: calorieTarget == null ? '每日目标: 未设置' : `每日目标: ${calorieTarget.toLocaleString()} kcal`,
    protein: proteinTarget == null ? '蛋白质: 未设置' : `蛋白质: ${proteinTarget}g`,
    budget: `预算: ¥${budget}/天`,
    level: '服务端计划',
    updated: `最后修改: ${updated}`,
  };
}

function RealWizardStep({
  step,
  draft,
  onDraftChange,
  onNavigate,
  onCreate,
  creating,
  error,
}: {
  step: 1 | 2 | 3;
  draft: MealPlanDraft;
  onDraftChange: (patch: Partial<MealPlanDraft>) => void;
  onNavigate: NavigateToView;
  onCreate: () => void;
  creating: boolean;
  error?: string;
}) {
  const updateList = (field: 'allergens' | 'dislikes', value: string) => {
    const normalized = value.trim();
    if (!normalized || draft[field].includes(normalized)) return;
    onDraftChange({ [field]: [...draft[field], normalized] });
  };

  if (step === 1) {
    return (
      <div className={styles.wizardPage}>
        <FlowStepper currentStep={1} onNavigate={onNavigate} />
        <div className={styles.wizardGrid}>
          <section className={styles.wizardCard} aria-labelledby="real-wizard-step-one-title">
            <h1 id="real-wizard-step-one-title">步骤 1: 设置基本目标</h1>
            <div className={styles.formGrid}>
              <Field label="计划名称" className={styles.fieldFull}>
                <Input value={draft.planName} onChange={(event) => onDraftChange({ planName: event.target.value })} />
              </Field>
              <Field label="开始日期">
                <Input
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => onDraftChange({ startDate: event.target.value })}
                />
              </Field>
              <Field label="结束日期">
                <Input
                  type="date"
                  value={draft.endDate}
                  onChange={(event) => onDraftChange({ endDate: event.target.value })}
                />
              </Field>
              <Field label="每日能量目标">
                <UnitInput
                  value={draft.calories}
                  unit="kcal"
                  onChange={(value) => onDraftChange({ calories: value })}
                />
              </Field>
              <Field label="每日蛋白质目标">
                <UnitInput value={draft.protein} unit="g" onChange={(value) => onDraftChange({ protein: value })} />
              </Field>
              <Field label="每日支出预算 (RMB)" className={styles.fieldFull}>
                <UnitInput value={draft.budget} unit="元/天" onChange={(value) => onDraftChange({ budget: value })} />
              </Field>
            </div>
            <div className={styles.wizardActions}>
              <FlowButton variant="outline" onClick={() => onNavigate('list')}>
                取消
              </FlowButton>
              <FlowButton onClick={() => onNavigate('wizard-step2')}>下一步: 膳食约束</FlowButton>
            </div>
          </section>
          <ValidationPanel step={1} />
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className={styles.wizardPage}>
        <FlowStepper currentStep={2} onNavigate={onNavigate} />
        <div className={styles.wizardGrid}>
          <section className={styles.wizardCard} aria-labelledby="real-wizard-step-two-title">
            <h1 id="real-wizard-step-two-title">步骤 2: 设置膳食约束</h1>
            <div className={styles.preferenceBlock}>
              <span className={styles.blockLabel}>过敏源</span>
              <div className={styles.allergyRow}>
                {draft.allergens.map((item) => (
                  <Button
                    className={styles.allergyChip}
                    key={item}
                    variant="ghost"
                    type="button"
                    onClick={() => onDraftChange({ allergens: draft.allergens.filter((value) => value !== item) })}
                  >
                    {item} <X aria-hidden="true" />
                  </Button>
                ))}
                <Button
                  className={styles.addAllergy}
                  variant="ghost"
                  type="button"
                  onClick={() => updateList('allergens', '坚果')}
                >
                  + 添加过敏源
                </Button>
              </div>
            </div>
            <div className={styles.preferenceBlock}>
              <span className={styles.blockLabel}>忌口</span>
              <div className={styles.allergyRow}>
                {draft.dislikes.map((item) => (
                  <Button
                    className={styles.allergyChip}
                    key={item}
                    variant="ghost"
                    type="button"
                    onClick={() => onDraftChange({ dislikes: draft.dislikes.filter((value) => value !== item) })}
                  >
                    {item} <X aria-hidden="true" />
                  </Button>
                ))}
                <Button
                  className={styles.addAllergy}
                  variant="ghost"
                  type="button"
                  onClick={() => updateList('dislikes', '猪肉')}
                >
                  + 添加忌口
                </Button>
              </div>
            </div>
            <div className={styles.wizardActions}>
              <FlowButton variant="outline" onClick={() => onNavigate('wizard-step1')}>
                上一步
              </FlowButton>
              <FlowButton onClick={() => onNavigate('wizard-step3')}>下一步: 确认并生成</FlowButton>
            </div>
          </section>
          <ValidationPanel step={2} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wizardPage}>
      <FlowStepper currentStep={3} onNavigate={onNavigate} />
      <div className={styles.wizardGrid}>
        <section className={styles.wizardCard} aria-labelledby="real-wizard-step-three-title">
          <h1 id="real-wizard-step-three-title">步骤 3: 确认并创建计划</h1>
          <p className={styles.wizardIntro}>创建后先保存为草稿，服务端会按当前约束返回可继续编辑的计划。</p>
          <div className={styles.confirmSummary}>
            <div className={styles.confirmTitleRow}>
              <strong>计划名称</strong>
              <span>{draft.planName || '我的餐食计划'}</span>
            </div>
            <div className={styles.confirmGrid}>
              <div>
                <small>规划日期范围</small>
                <strong>
                  {draft.startDate} 至 {draft.endDate}
                </strong>
              </div>
              <div>
                <small>能量/蛋白目标</small>
                <strong>
                  {draft.calories || '未设置'} kcal / {draft.protein || '未设置'}g
                </strong>
              </div>
              <div>
                <small>每日预算</small>
                <strong>{draft.budget || '未设置'} 元</strong>
              </div>
              <div>
                <small>过敏源 / 忌口</small>
                <strong>{[...draft.allergens, ...draft.dislikes].join('、') || '无'}</strong>
              </div>
            </div>
          </div>
          {error ? (
            <p className={styles.wizardIntro} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.wizardActions}>
            <FlowButton variant="outline" onClick={() => onNavigate('wizard-step2')}>
              上一步
            </FlowButton>
            <FlowButton disabled={creating} onClick={onCreate}>
              {creating ? '正在创建...' : '创建并保存计划'}
            </FlowButton>
          </div>
        </section>
        <ValidationPanel step={3} />
      </div>
    </div>
  );
}

const shoppingCategories = [
  {
    name: '蛋白类',
    tone: 'orange',
    items: [
      { name: '野生三文鱼', detail: '450g / 新鲜', status: '已买', tone: 'owned' },
      { name: '鸡胸肉', detail: '800g / 去皮', status: '待买', tone: 'pending' },
      { name: '火鸡胸肉', detail: '200g / 切片', status: '已有', tone: 'owned' },
    ],
  },
  {
    name: '蔬菜类',
    tone: 'green',
    items: [
      { name: '新鲜西兰花', detail: '1颗', status: '待买', tone: 'pending' },
      { name: '红薯', detail: '3个 / 中等大小', status: '待买', tone: 'pending' },
      { name: '无菌有机菠菜', detail: '300g / 盒装', status: '待买', tone: 'pending' },
    ],
  },
  {
    name: '水果类',
    tone: 'red',
    items: [
      { name: '蓝莓', detail: '2盒 / 新鲜', status: '已有', tone: 'owned' },
      { name: '牛油果', detail: '2个 / 即食', status: '待买', tone: 'pending' },
    ],
  },
] as const;

const planDays = ['周一 13', '周二 14', '周三 15', '周四 16', '周五 17'];

const conflictMeals = [
  { label: '早餐', meals: ['燕麦莓果碗', '超重蛋白酸面包', '牛油果奶昔', '燕麦莓果碗', '蛋白奶昔'] },
  { label: '午餐', meals: ['香煎三文鱼', '香煎鸡肉藜麦', '香煎三文鱼', '香煎三文鱼', '红薯火鸡卷'] },
];

function FlowButton({ children, className = '', variant = 'default', ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={`${styles.flowButton} ${variant === 'outline' ? styles.flowButtonOutline : ''} ${className}`}
      variant={variant}
      {...props}
    >
      {children}
    </Button>
  );
}

function FlowStepper({ currentStep, onNavigate }: { currentStep: number; onNavigate: NavigateToView }) {
  return (
    <nav className={styles.flowStepper} aria-label="餐食计划创建步骤">
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step < currentStep;
        const active = step === currentStep;
        const target = step === 1 ? 'wizard-step1' : step === 2 ? 'wizard-step2' : 'wizard-step3';
        return (
          <div className={styles.stepperItem} key={label}>
            <Button
              className={`${styles.stepperStep} ${active ? styles.stepperActive : ''} ${done ? styles.stepperDone : ''}`}
              variant="ghost"
              type="button"
              aria-current={active ? 'step' : undefined}
              onClick={() => step <= currentStep && onNavigate(target)}
            >
              <span className={styles.stepperCircle}>{done ? <Check aria-hidden="true" /> : step}</span>
              <span>{label}</span>
            </Button>
            {step < steps.length ? (
              <span className={`${styles.stepperLine} ${done ? styles.stepperLineDone : ''}`} />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function ValidationPanel({ step }: { step: 1 | 2 | 3 }) {
  const content = {
    1: {
      title: '草稿与必填校验',
      lines: [
        '必填项  ✓ 已完成',
        '日期关系：06-01 至 06-07',
        '能量 / 蛋白目标  ·  2,200 / 130g',
        '预算阈值：¥120 / 天',
        '当前状态：草稿 · 可保存后稍后继续',
      ],
      tone: 'green',
    },
    2: {
      title: '约束已记录',
      lines: [
        '偏好：低碳水 · 高蛋白 · 中 / 日轻食',
        '过敏源：花生、海鲜、乳制品',
        '单餐耗时上限：30 分钟',
        '发现冲突时：展示影响范围与放宽建议。',
        '当前状态：草稿 · 可保存后稍后继续',
      ],
      tone: 'orange',
    },
    3: {
      title: '生成前检查',
      lines: [
        '✓ 目标、日期、预算、过敏源均已确认',
        '生成将创建 7 天餐表、营养摘要和购物清单。',
        '预计耗时：10–15 秒 · 状态：queued → running',
        '失败时保留约束草稿，可重试或返回修改。',
        '确认后进入生成中页面；生成完成可查看计划与购物清单。',
      ],
      tone: 'green',
    },
  }[step];

  return (
    <aside className={`${styles.validationPanel} ${content.tone === 'orange' ? styles.validationOrange : ''}`}>
      <h2>{content.title}</h2>
      <div className={styles.validationLines}>
        {content.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </aside>
  );
}

function WizardShell({
  currentStep,
  onNavigate,
  children,
}: {
  currentStep: 1 | 2 | 3;
  onNavigate: NavigateToView;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.wizardPage}>
      <FlowStepper currentStep={currentStep} onNavigate={onNavigate} />
      <div className={styles.wizardGrid}>
        {children}
        <ValidationPanel step={currentStep} />
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`${styles.field} ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function UnitInput({ value, unit, onChange }: { value: string; unit: string; onChange: (value: string) => void }) {
  return (
    <div className={styles.unitInput}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
      <span>{unit}</span>
    </div>
  );
}

function WizardStepOne({ onNavigate }: { onNavigate: NavigateToView }) {
  const [name, setName] = useState('夏日狂欢塑形计划 v1');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-06-07');
  const [calories, setCalories] = useState('2200');
  const [protein, setProtein] = useState('130');
  const [budget, setBudget] = useState('120');

  return (
    <WizardShell currentStep={1} onNavigate={onNavigate}>
      <section className={styles.wizardCard} aria-labelledby="wizard-step-one-title">
        <h1 id="wizard-step-one-title">步骤 1: 设置基本目标</h1>
        <div className={styles.formGrid}>
          <Field label="计划名称" className={styles.fieldFull}>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="开始日期">
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="结束日期">
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
          <Field label="每日能量目标">
            <UnitInput value={calories} unit="kcal" onChange={setCalories} />
          </Field>
          <Field label="每日蛋白质目标">
            <UnitInput value={protein} unit="g" onChange={setProtein} />
          </Field>
          <Field label="每日支出预算 (RMB)" className={styles.fieldFull}>
            <UnitInput value={budget} unit="元/天" onChange={setBudget} />
          </Field>
        </div>
        <div className={styles.wizardActions}>
          <FlowButton variant="outline" onClick={() => onNavigate('list')}>
            取消
          </FlowButton>
          <FlowButton onClick={() => onNavigate('wizard-step2')}>下一步: 膳食约束</FlowButton>
        </div>
      </section>
    </WizardShell>
  );
}

function CheckChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <Checkbox
      aria-label={label}
      checked={checked}
      className={`${styles.checkChip} ${checked ? styles.checkChipActive : ''}`}
      onCheckedChange={onChange}
    >
      <span>{label}</span>
    </Checkbox>
  );
}

function WizardStepTwo({ onNavigate }: { onNavigate: NavigateToView }) {
  const [preferences, setPreferences] = useState(['低碳水 (Low Carb)', '高蛋白 (High Protein)']);
  const [allergies, setAllergies] = useState(['花生', '甲壳类海鲜', '乳制品']);
  const [minutes, setMinutes] = useState('30');
  const [cuisine, setCuisine] = useState('中式、日式轻食');
  const togglePreference = (item: string) =>
    setPreferences((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );

  return (
    <WizardShell currentStep={2} onNavigate={onNavigate}>
      <section className={styles.wizardCard} aria-labelledby="wizard-step-two-title">
        <h1 id="wizard-step-two-title">步骤 2: 设置膳食约束 &amp; 偏好</h1>
        <div className={styles.preferenceBlock}>
          <span className={styles.blockLabel}>膳食偏好属性</span>
          <div className={styles.chipRow}>
            {['低碳水 (Low Carb)', '高蛋白 (High Protein)', '无麸质 (Gluten Free)', '纯素食 (Vegan)'].map((item) => (
              <CheckChip
                key={item}
                label={item}
                checked={preferences.includes(item)}
                onChange={() => togglePreference(item)}
              />
            ))}
          </div>
        </div>
        <div className={styles.preferenceBlock}>
          <span className={styles.blockLabel}>食物过敏源过滤</span>
          <div className={styles.allergyRow}>
            {allergies.map((item) => (
              <Button
                className={styles.allergyChip}
                key={item}
                variant="ghost"
                type="button"
                onClick={() => setAllergies((current) => current.filter((value) => value !== item))}
              >
                {item} <X aria-hidden="true" />
              </Button>
            ))}
            <Button
              className={styles.addAllergy}
              variant="ghost"
              type="button"
              onClick={() => setAllergies((current) => [...current, '坚果'])}
            >
              + 添加过敏源
            </Button>
          </div>
        </div>
        <div className={styles.formGrid}>
          <Field label="单餐最大烹饪耗时">
            <UnitInput value={minutes} unit="分钟" onChange={setMinutes} />
          </Field>
          <Field label="首选菜系口味">
            <div className={styles.selectWrap}>
              <Select value={cuisine} onValueChange={setCuisine}>
                <SelectTrigger aria-label="首选菜系口味" className={styles.cuisineSelect}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="中式、日式轻食">中式、日式轻食</SelectItem>
                  <SelectItem value="地中海轻食">地中海轻食</SelectItem>
                  <SelectItem value="西式高蛋白">西式高蛋白</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>
        </div>
        <div className={styles.wizardActions}>
          <FlowButton variant="outline" onClick={() => onNavigate('wizard-step1')}>
            上一步
          </FlowButton>
          <FlowButton onClick={() => onNavigate('wizard-step3')}>下一步: 确认并生成</FlowButton>
        </div>
      </section>
    </WizardShell>
  );
}

function WizardStepThree({ onNavigate }: { onNavigate: NavigateToView }) {
  return (
    <WizardShell currentStep={3} onNavigate={onNavigate}>
      <section className={styles.wizardCard} aria-labelledby="wizard-step-three-title">
        <h1 id="wizard-step-three-title">步骤 3: 确认规则并运行规划</h1>
        <p className={styles.wizardIntro}>请核对以下约束参数。FoodMate 将基于此自动推荐一周餐单</p>
        <div className={styles.confirmSummary}>
          <div className={styles.confirmTitleRow}>
            <strong>计划目标总结</strong>
            <span>夏日狂欢塑形计划 v1</span>
          </div>
          <div className={styles.confirmGrid}>
            <div>
              <small>规划日期范围</small>
              <strong>06-01 至 06-07 (7天)</strong>
            </div>
            <div>
              <small>能量/蛋白目标</small>
              <strong>2,200 kcal / 130g蛋白质</strong>
            </div>
            <div>
              <small>每日膳食偏好</small>
              <strong>低碳水, 高蛋白, 中/日轻食</strong>
            </div>
            <div>
              <small>过敏过滤设置</small>
              <strong className={styles.dangerText}>花生, 海鲜, 乳制品</strong>
            </div>
            <div>
              <small>烹饪上限时长</small>
              <strong>单餐不超 30分钟</strong>
            </div>
            <div>
              <small>预算标准等级</small>
              <strong>¥120 / 天 (经济适用)</strong>
            </div>
          </div>
        </div>
        <div className={styles.generationTip}>
          <Sparkles aria-hidden="true" />
          <span>FoodMate 的 Fustat-v2 大模型将优化您所需的生鲜采购总链，减少 20% 食材损耗浪费。</span>
        </div>
        <div className={styles.wizardActions}>
          <FlowButton variant="outline" onClick={() => onNavigate('wizard-step2')}>
            上一步
          </FlowButton>
          <div className={styles.actionGroup}>
            <FlowButton variant="outline" onClick={() => onNavigate('list')}>
              保存为草稿
            </FlowButton>
            <FlowButton onClick={() => onNavigate('generating')}>开始生成智能计划</FlowButton>
          </div>
        </div>
      </section>
    </WizardShell>
  );
}

function PlanListView({
  onNavigate,
  realPlans,
  onOpenPlan,
}: {
  onNavigate: NavigateToView;
  realPlans?: MealPlan[];
  onOpenPlan?: (mealPlanId: string) => void;
}) {
  const [tab, setTab] = useState<'active' | 'validated' | 'draft' | 'archived'>('active');
  const planCards: PlanCard[] = realPlans
    ? realPlans.map(realPlanCard)
    : plans.map((plan) => ({ ...plan, id: plan.name }));
  const visiblePlans = realPlans
    ? planCards.filter((plan) => plan.statusTone === tab)
    : tab === 'active'
      ? planCards
      : planCards.filter((plan) => plan.statusTone === tab);

  return (
    <div className={`${styles.flowPage} ${styles.listPage}`}>
      <header className={styles.listHeader}>
        <div>
          <h1>餐食规划</h1>
          <p>生成并管理您的个性化膳食计划</p>
        </div>
        <FlowButton onClick={() => onNavigate('wizard-step1')}>+ 新建膳食计划</FlowButton>
      </header>
      <div className={styles.listTabs} role="tablist" aria-label="计划状态" data-figma-role="planning-list-tabs">
        {(realPlans
          ? [
              ['active', '已保存'],
              ['validated', '已校验'],
              ['draft', '草稿箱'],
              ['archived', '已删除'],
            ]
          : [
              ['active', '进行中'],
              ['draft', '草稿箱'],
              ['archived', '已归档'],
            ]
        ).map(([key, label]) => (
          <Button
            className={tab === key ? styles.listTabActive : ''}
            variant="ghost"
            key={key}
            type="button"
            role="tab"
            data-figma-role="planning-list-tab"
            aria-selected={tab === key}
            onClick={() => setTab(key as typeof tab)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className={styles.planList}>
        {visiblePlans.map((plan) => (
          <article className={styles.planListCard} key={plan.id}>
            <div className={styles.planListMain}>
              <div className={styles.planListTitleRow}>
                <h2>{plan.name}</h2>
                <span className={`${styles.planStatus} ${styles[`planStatus${plan.statusTone}`]}`}>{plan.status}</span>
                <span className={styles.planDate}>{plan.dates}</span>
              </div>
              <p>
                {plan.calories} | {plan.protein} | {plan.budget}
              </p>
              <div className={styles.planListMeta}>
                <span>{plan.level}</span>
                <small>{plan.updated}</small>
              </div>
            </div>
            <div className={styles.planListActions}>
              <FlowButton
                variant="outline"
                onClick={() => (onOpenPlan && realPlans ? onOpenPlan(plan.id) : onNavigate('default'))}
              >
                进入计划
              </FlowButton>
              <Button
                className={styles.iconAction}
                variant="ghost"
                size="icon"
                type="button"
                aria-label={`${plan.name}更多操作`}
              >
                <Menu aria-hidden="true" />
              </Button>
            </div>
          </article>
        ))}
      </div>
      <aside className={styles.lifecycleNote}>
        <h2>计划卡片操作与状态</h2>
        <p>视图：进行中 · 草稿箱 · 已归档 筛选：日期范围 / 目标 / 预算 / 最近更新时间</p>
        <p>每张计划显示日期范围、每日目标、预算、状态和最近更新时间；进入计划查看多日餐表与购物清单。</p>
        <p className={styles.noteGreen}>
          卡片操作：重命名 · 复制计划 · 归档 / 取消归档 · 删除（软删除，可恢复） · 查看详情
        </p>
        <p className={styles.noteMuted}>
          新建流程支持：保存草稿 · 上一步 / 下一步 · 取消；生成失败时可重试或修改约束。
        </p>
      </aside>
    </div>
  );
}

type ConflictChoice = 'protein-relax' | 'replace';

function ConflictView({ onNavigate }: { onNavigate: NavigateToView }) {
  const [choice, setChoice] = useState<ConflictChoice>('protein-relax');
  const updateChoice = (value: string) => {
    if (value === 'protein-relax' || value === 'replace') setChoice(value);
  };
  return (
    <div className={`${styles.flowPage} ${styles.conflictPage} ${styles.interPage}`}>
      <div className={styles.conflictAlert}>
        <CircleAlert aria-hidden="true" />
        <span>
          发现 2
          个约束冲突：当前的膳食规划部分超出您设定的蛋白质预算上限与食材复用限制，请在右侧选择推荐的冲突解决方案。
        </span>
      </div>
      <div className={styles.conflictGrid}>
        <section className={styles.conflictSchedule} aria-labelledby="conflict-plan-title">
          <div className={styles.conflictPlanMeta}>
            <h1 id="conflict-plan-title">增肌计划 v3 (冲突解决中)</h1>
            <div>
              <span className={styles.conflictBadge}>每日目标: 2,400千卡 (冲突中)</span>
              <span className={styles.planDate}>时长: 7天</span>
            </div>
          </div>
          <div className={styles.conflictDays}>
            {planDays.map((day, index) => (
              <span className={index === 1 || index === 3 ? styles.conflictDayActive : ''} key={day}>
                {day}
              </span>
            ))}
          </div>
          <div className={styles.conflictTable}>
            {conflictMeals.map((row) => (
              <div className={styles.conflictRow} key={row.label}>
                <strong>{row.label}</strong>
                {row.meals.map((meal, index) => (
                  <div
                    className={`${styles.conflictMeal} ${index === 1 || (row.label === '午餐' && index === 3) ? styles.conflictMealWarning : ''}`}
                    key={`${row.label}-${meal}-${index}`}
                  >
                    <b>{meal}</b>
                    <span>
                      {row.label === '早餐'
                        ? index === 1
                          ? '580 kcal'
                          : '420 kcal'
                        : index === 1
                          ? '620 kcal'
                          : '680 kcal'}
                    </span>
                    {index === 1 && row.label === '早餐' ? <em>蛋白质超限</em> : null}
                    {index === 3 && row.label === '午餐' ? <em>三文鱼复用问题</em> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
        <aside className={styles.resolutionPanel}>
          <h2>约束冲突及推荐解决</h2>
          <div className={styles.resolutionCard}>
            <div className={styles.resolutionTitle}>
              <strong>冲突 1：蛋白质贡献超出</strong>
              <span>高危</span>
            </div>
            <p>周二晚餐“超重蛋白酸面包”含蛋白质过多，使单日蛋白质达到 152g，超出设定限额上限（110g）。</p>
            <RadioGroup
              aria-label="蛋白质贡献冲突解决方案"
              className={styles.radioGroup}
              value={choice}
              onValueChange={updateChoice}
            >
              <div className={styles.radioOption}>
                <RadioGroupItem
                  aria-label="放宽约束（调整为允许150g）"
                  id="conflict-protein-relax"
                  value="protein-relax"
                />
                <label htmlFor="conflict-protein-relax">放宽约束（调整为允许150g）</label>
              </div>
              <div className={styles.radioOption}>
                <RadioGroupItem
                  aria-label="替换菜品（智能推荐低蛋白早餐）"
                  id="conflict-protein-replace"
                  value="replace"
                />
                <label htmlFor="conflict-protein-replace">替换菜品（智能推荐低蛋白早餐）</label>
              </div>
            </RadioGroup>
          </div>
          <div className={styles.resolutionCard}>
            <div className={styles.resolutionTitle}>
              <strong>冲突 2：主食材复用问题</strong>
              <span className={styles.mediumRisk}>中等</span>
            </div>
            <p>“三文鱼”在一周里两次相同餐中使用了 4 次，超出了健康和多样性的要求。</p>
            <RadioGroup
              aria-label="主食材复用冲突解决方案"
              className={styles.radioGroup}
              value={choice}
              onValueChange={updateChoice}
            >
              <div className={styles.radioOption}>
                <RadioGroupItem
                  aria-label="一键替换（将周四午餐替换为烤鸡蛋）"
                  id="conflict-ingredient-replace"
                  value="replace"
                />
                <label htmlFor="conflict-ingredient-replace">一键替换（将周四午餐替换为烤鸡蛋）</label>
              </div>
              <div className={styles.radioOption}>
                <RadioGroupItem
                  aria-label="忽略冲突（保留三文鱼套餐）"
                  id="conflict-ingredient-relax"
                  value="protein-relax"
                />
                <label htmlFor="conflict-ingredient-relax">忽略冲突（保留三文鱼套餐）</label>
              </div>
            </RadioGroup>
          </div>
          <FlowButton className={styles.applyConflict} onClick={() => onNavigate('default')}>
            应用修改并重新计划
          </FlowButton>
        </aside>
      </div>
    </div>
  );
}

type ShoppingItem = { name: string; detail: string; status: string; tone: string };

function ShoppingListView() {
  const initialItems = useMemo(
    () =>
      shoppingCategories.flatMap((category) =>
        category.items.map((item) => ({ ...item, key: `${category.name}-${item.name}` })),
      ),
    [],
  );
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialItems.filter((item) => item.tone === 'owned').map((item) => [item.key, true])),
  );
  const [notice, setNotice] = useState('');
  const allChecked = initialItems.every((item) => checked[item.key]);
  const totalItems = initialItems.length;
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const toggleAll = () =>
    setChecked(allChecked ? {} : Object.fromEntries(initialItems.map((item) => [item.key, true])));

  return (
    <div className={`${styles.flowPage} ${styles.shoppingPage} ${styles.interPage}`}>
      <header className={styles.shoppingHeader}>
        <div>
          <h1>增肌计划 v3 - 购物清单</h1>
          <p>规划周期：10月13日 - 10月17日 (共5天) | 生成系统：Fustat-v2</p>
        </div>
        <div className={styles.purchaseProgress}>
          <div>
            <strong>采购进度</strong>
            <span>
              已买 {checkedCount} / {totalItems} 项
            </span>
          </div>
          <div className={styles.progressTrack}>
            <span style={{ width: `${(checkedCount / totalItems) * 100}%` }} />
          </div>
        </div>
      </header>
      <div className={styles.shoppingGrid}>
        {shoppingCategories.map((category) => (
          <section className={styles.shoppingCategory} key={category.name}>
            <h2 className={styles[`category${category.tone}`]}>{category.name}</h2>
            <div className={styles.shoppingItemsFlow}>
              {category.items.map((item) => {
                const key = `${category.name}-${item.name}`;
                const itemChecked = Boolean(checked[key]);
                return (
                  <ShoppingRow
                    item={{ ...item, key }}
                    checked={itemChecked}
                    onChange={() => setChecked((current) => ({ ...current, [key]: !current[key] }))}
                    key={key}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <footer className={styles.shoppingToolbar}>
        <Checkbox
          aria-label="全选所有项目"
          checked={allChecked}
          className={styles.selectAll}
          onCheckedChange={toggleAll}
        >
          <span>全选所有项目</span>
        </Checkbox>
        <div className={styles.toolbarActions}>
          <FlowButton className={styles.orangeButton} onClick={() => setNotice('已添加自定义项目入口。')}>
            <Plus aria-hidden="true" />
            添加自定义项目
          </FlowButton>
          <FlowButton variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            打印清单
          </FlowButton>
          <FlowButton onClick={() => setNotice('清单导出已准备。')}>
            <Download aria-hidden="true" />
            导出清单文件
          </FlowButton>
        </div>
        {notice ? (
          <span className={styles.toolbarNotice} role="status">
            {notice}
          </span>
        ) : null}
      </footer>
    </div>
  );
}

function ShoppingRow({
  item,
  checked,
  onChange,
}: {
  item: ShoppingItem & { key: string };
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <Checkbox
      aria-label={`${item.name} (${item.detail})`}
      checked={checked}
      className={styles.shoppingRow}
      onCheckedChange={onChange}
    >
      <span className={styles.shoppingCopy}>
        <strong>{item.name}</strong>
        <small>{item.detail}</small>
      </span>
      <em className={`${styles.itemStatus} ${item.tone === 'owned' ? styles.itemOwned : styles.itemPending}`}>
        {item.status}
      </em>
    </Checkbox>
  );
}

function GeneratingView({ onNavigate }: { onNavigate: NavigateToView }) {
  return (
    <div className={`${styles.flowPage} ${styles.generatingPage} ${styles.interPage}`}>
      <div className={styles.generatingContent}>
        <div className={styles.generatingRing}>
          <span>F</span>
        </div>
        <div className={styles.generatingCopy}>
          <h1>正在生成您的智能餐食计划</h1>
          <p>根据您的约束条件（蛋白质最低 110g、每日热量缺口及过敏原限制）深度优化中，预计需要 10 - 15 秒。</p>
        </div>
        <div className={styles.generatingProgress}>
          <div>
            <span>正在寻找最佳食材配比...</span>
            <strong>60%</strong>
          </div>
          <div className={styles.progressTrack}>
            <span />
          </div>
        </div>
        <FlowButton variant="outline" onClick={() => onNavigate('wizard-step3')}>
          取消生成
        </FlowButton>
      </div>
    </div>
  );
}

export function MealPlanningFlow({
  view,
  onNavigate,
  realPlans,
  onOpenPlan,
  realDraft,
  onDraftChange,
  onCreatePlan,
  creatingPlan = false,
  createError,
}: {
  view: MealPlanningFlowView;
  onNavigate: NavigateToView;
  realPlans?: MealPlan[];
  onOpenPlan?: (mealPlanId: string) => void;
  realDraft?: MealPlanDraft;
  onDraftChange?: (patch: Partial<MealPlanDraft>) => void;
  onCreatePlan?: () => void;
  creatingPlan?: boolean;
  createError?: string;
}) {
  if (view === 'list') return <PlanListView onNavigate={onNavigate} realPlans={realPlans} onOpenPlan={onOpenPlan} />;
  if (realPlans && realDraft && onDraftChange && onCreatePlan) {
    if (view === 'wizard-step1' || view === 'wizard-step2' || view === 'wizard-step3')
      return (
        <RealWizardStep
          step={view === 'wizard-step1' ? 1 : view === 'wizard-step2' ? 2 : 3}
          draft={realDraft}
          onDraftChange={onDraftChange}
          onNavigate={onNavigate}
          onCreate={onCreatePlan}
          creating={creatingPlan}
          error={createError}
        />
      );
  }
  if (view === 'wizard-step1') return <WizardStepOne onNavigate={onNavigate} />;
  if (view === 'wizard-step2') return <WizardStepTwo onNavigate={onNavigate} />;
  if (view === 'wizard-step3') return <WizardStepThree onNavigate={onNavigate} />;
  if (view === 'conflict') return <ConflictView onNavigate={onNavigate} />;
  if (view === 'shopping-list') return <ShoppingListView />;
  return <GeneratingView onNavigate={onNavigate} />;
}

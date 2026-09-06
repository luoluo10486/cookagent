import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMealPlan, loadMealPlans, loadShoppingList } from '../../services/planningService';
import { PlanningPage } from './PlanningPage';

vi.mock('../../services/planningService', () => ({
  createMealPlan: vi.fn(),
  loadMealPlans: vi.fn(),
  loadShoppingList: vi.fn(),
}));

const plan = {
  meal_plan_id: '701',
  session_id: null,
  plan_name: '服务端增肌计划',
  people: 2,
  days: 1,
  budget: 180,
  constraints: {
    people: 2,
    calorie_target: 2400,
    protein_target: 150,
    allergens: [],
    dislikes: ['猪肉'],
  },
  days_plan: [
    {
      breakfast: { name: '服务端燕麦碗', calories_kcal: 420, ingredients: [] },
      lunch: { name: '服务端鸡肉藜麦', ingredients: [] },
      dinner: { ingredients: [{ name: '服务端豆腐' }] },
    },
  ],
  validation: { valid: true, errors: [], warnings: [] },
  status: 'saved',
  revision: 3,
  deleted: false,
  created_at: '2026-08-20T12:00:00Z',
  updated_at: '2026-08-22T12:00:00Z',
};

function renderPage(initialEntry = '/planning') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/planning" element={<PlanningPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PlanningPage real mode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AGENT_MODE', 'real');
    localStorage.setItem(
      'foodmate_auth_user',
      JSON.stringify({ id: '7', username: 'tester', displayName: 'Tester', role: 'user', status: 'active' }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: { user_id: 7, username: 'tester', email: 'tester@example.com', role: 'user' },
          }),
          { status: 200 },
        ),
      ),
    );
    vi.mocked(loadMealPlans).mockResolvedValue([plan]);
    vi.mocked(loadShoppingList).mockResolvedValue({
      shopping_list_id: '901',
      meal_plan_id: '701',
      items: [{ name: '服务端鸡胸肉', amount: 600, unit: 'g' }],
      status: 'generated',
      created_at: '2026-08-22T12:00:00Z',
      updated_at: '2026-08-22T12:00:00Z',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders server plans and uses server meal content after opening a plan', async () => {
    const user = userEvent.setup();
    renderPage('/planning?state=list');

    expect(await screen.findByRole('heading', { name: '服务端增肌计划' })).toBeInTheDocument();
    expect(screen.queryByText('夏日减脂轻食计划')).not.toBeInTheDocument();
    expect(screen.getByText(/每日目标: 2,400 kcal/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '进入计划' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: '服务端增肌计划' })).toBeInTheDocument());
    expect(screen.getByText('服务端燕麦碗')).toBeInTheDocument();
    expect(screen.getByText('服务端鸡肉藜麦')).toBeInTheDocument();
    expect(screen.getByText('服务端豆腐')).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: '服务端鸡胸肉 (600g)' })).toBeInTheDocument();
    expect(screen.queryByText('燕麦莓果碗')).not.toBeInTheDocument();
  });

  it('submits the real wizard to create a server plan', async () => {
    const user = userEvent.setup();
    vi.mocked(createMealPlan).mockResolvedValue({ ...plan, meal_plan_id: '702', plan_name: '新建服务端计划' });
    renderPage('/planning?state=list');

    await user.click(await screen.findByRole('button', { name: '+ 新建膳食计划' }));
    await user.click(screen.getByRole('button', { name: '下一步: 膳食约束' }));
    await user.click(screen.getByRole('button', { name: '下一步: 确认并生成' }));
    await user.click(screen.getByRole('button', { name: '创建并保存计划' }));

    await waitFor(() =>
      expect(createMealPlan).toHaveBeenCalledWith(expect.objectContaining({ planName: '我的本地餐食计划' })),
    );
    expect(await screen.findByRole('heading', { name: '新建服务端计划' })).toBeInTheDocument();
  });

  it('lets an empty real account enter the create wizard', async () => {
    const user = userEvent.setup();
    vi.mocked(loadMealPlans).mockResolvedValue([]);
    renderPage('/planning');

    expect(await screen.findByRole('heading', { name: '暂无周餐食规划' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '创建首个规划方案' }));

    expect(screen.getByRole('heading', { name: '步骤 1: 设置基本目标' })).toBeInTheDocument();
  });

  it('keeps validated and saved plans in separate real status views', async () => {
    vi.mocked(loadMealPlans).mockResolvedValue([
      plan,
      { ...plan, meal_plan_id: '703', plan_name: '待发布计划', status: 'validated' },
      { ...plan, meal_plan_id: '704', plan_name: '历史计划', deleted: true },
    ]);
    renderPage('/planning?state=list');

    expect(await screen.findByRole('heading', { name: '服务端增肌计划' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '已保存' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('tab', { name: '已校验' }));
    expect(screen.getByRole('heading', { name: '待发布计划' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '服务端增肌计划' })).not.toBeInTheDocument();
  });
});

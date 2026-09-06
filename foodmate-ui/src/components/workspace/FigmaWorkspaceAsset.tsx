import type { ImgHTMLAttributes } from 'react';

export type WorkspaceFixtureVariant = 'home' | 'chat' | 'diet-records' | 'analysis' | 'planning' | 'knowledge';

export type FigmaWorkspaceAssetName =
  | 'windowControls'
  | 'newTask'
  | 'sessionSearch'
  | 'home'
  | 'agentChat'
  | 'dietRecords'
  | 'intakeAnalysis'
  | 'mealPlanning'
  | 'knowledge'
  | 'settings'
  | 'topbarSearch'
  | 'notification'
  | 'statusDot'
  | 'sessionDotActive'
  | 'sessionDotDefault'
  | 'activityDotGreen'
  | 'activityDotYellow'
  | 'activityDotBlue'
  | 'attachment'
  | 'send'
  | 'arrowRight'
  | 'metricEnergy'
  | 'metricProtein'
  | 'metricCarbs'
  | 'metricFat'
  | 'chevronLeft'
  | 'chevronRight';

type FigmaWorkspaceAssetProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  variant: WorkspaceFixtureVariant;
  name: FigmaWorkspaceAssetName;
};

// 每个 Figma fixture 使用独立的工作区资源，避免把其他画板的图标带入当前页面。
const assetFileNames: Record<WorkspaceFixtureVariant, Partial<Record<FigmaWorkspaceAssetName, string>>> = {
  home: {
    windowControls: 'window-controls.svg',
    newTask: 'new-task.svg',
    sessionSearch: 'session-search.svg',
    home: 'home.svg',
    agentChat: 'agent-chat.svg',
    dietRecords: 'diet-records.svg',
    intakeAnalysis: 'intake-analysis.svg',
    mealPlanning: 'meal-planning.svg',
    knowledge: 'knowledge.svg',
    settings: 'settings.svg',
    topbarSearch: 'topbar-search.svg',
    notification: 'notification.svg',
    statusDot: 'status-dot.svg',
    sessionDotActive: 'session-dot-active.svg',
    sessionDotDefault: 'session-dot-default.svg',
    activityDotGreen: 'session-dot-green.svg',
    activityDotYellow: 'activity-dot-yellow.svg',
    activityDotBlue: 'activity-dot-blue.svg',
    attachment: 'paperclip.svg',
    send: 'send.svg',
    arrowRight: 'arrow-right.svg',
    metricEnergy: 'session-dot-red.svg',
    metricProtein: 'session-dot-purple.svg',
    metricCarbs: 'session-dot-yellow.svg',
    metricFat: 'session-dot-blue.svg',
  },
  chat: {
    windowControls: 'window-controls.svg',
    newTask: 'new-task.svg',
    sessionSearch: 'session-search.svg',
    home: 'home.svg',
    agentChat: 'agent-chat.svg',
    dietRecords: 'diet-records.svg',
    intakeAnalysis: 'intake-analysis.svg',
    mealPlanning: 'meal-planning.svg',
    knowledge: 'knowledge.svg',
    settings: 'settings.svg',
    topbarSearch: 'topbar-search.svg',
    notification: 'notification.svg',
    statusDot: 'status-dot.svg',
    sessionDotActive: 'session-dot-active.svg',
    sessionDotDefault: 'session-dot-default.svg',
    send: 'send.svg',
  },
  'diet-records': {
    windowControls: 'window-controls.svg',
    newTask: 'new-task.svg',
    sessionSearch: 'session-search.svg',
    home: 'home.svg',
    agentChat: 'agent-chat.svg',
    dietRecords: 'diet-records.svg',
    intakeAnalysis: 'intake-analysis.svg',
    mealPlanning: 'meal-planning.svg',
    knowledge: 'knowledge.svg',
    settings: 'settings.svg',
    statusDot: 'status-dot.svg',
    topbarSearch: 'topbar-search.svg',
    notification: 'notification.svg',
    sessionDotActive: 'session-dot-active.svg',
    sessionDotDefault: 'session-dot-default.svg',
    chevronLeft: 'chevron-left.svg',
    chevronRight: 'chevron-right.svg',
  },
  analysis: {
    windowControls: 'window-controls.svg',
    newTask: 'new-task.svg',
    sessionSearch: 'session-search.svg',
    home: 'home.svg',
    agentChat: 'agent-chat.svg',
    dietRecords: 'diet-records.svg',
    intakeAnalysis: 'intake-analysis.svg',
    mealPlanning: 'meal-planning.svg',
    knowledge: 'knowledge.svg',
    settings: 'settings.svg',
    statusDot: 'status-dot.svg',
    topbarSearch: 'topbar-search.svg',
    notification: 'notification.svg',
    sessionDotActive: 'session-dot-active.svg',
    sessionDotDefault: 'session-dot-default.svg',
  },
  planning: {
    windowControls: 'window-controls.svg',
    newTask: 'new-task.svg',
    sessionSearch: 'session-search.svg',
    home: 'home.svg',
    agentChat: 'agent-chat.svg',
    dietRecords: 'diet-records.svg',
    intakeAnalysis: 'intake-analysis.svg',
    mealPlanning: 'meal-planning.svg',
    knowledge: 'knowledge.svg',
    settings: 'settings.svg',
    statusDot: 'status-dot.svg',
    topbarSearch: 'topbar-search.svg',
    notification: 'notification.svg',
    sessionDotActive: 'session-dot-active.svg',
    sessionDotDefault: 'session-dot-default.svg',
  },
  knowledge: {
    windowControls: 'window-controls.svg',
    newTask: 'new-task.svg',
    sessionSearch: 'session-search.svg',
    home: 'home.svg',
    agentChat: 'agent-chat.svg',
    dietRecords: 'diet-records.svg',
    intakeAnalysis: 'intake-analysis.svg',
    mealPlanning: 'meal-planning.svg',
    knowledge: 'knowledge.svg',
    settings: 'settings.svg',
    topbarSearch: 'topbar-search.svg',
    notification: 'notification.svg',
    statusDot: 'status-dot.svg',
    sessionDotActive: 'session-dot-active.svg',
    sessionDotDefault: 'session-dot-default.svg',
  },
};

export function FigmaWorkspaceAsset({ variant, name, className, ...props }: FigmaWorkspaceAssetProps) {
  const fileName = assetFileNames[variant][name];
  if (!fileName) return null;

  return (
    <img
      {...props}
      className={className}
      src={`/assets/figma/workspace/${variant}/${fileName}`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

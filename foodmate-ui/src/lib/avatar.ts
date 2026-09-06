export const DEFAULT_AVATARS = {
  male: '/assets/avatars/default-male.svg',
  female: '/assets/avatars/default-female.svg',
} as const;

// Figma 工作台示例账号使用项目登记的男性默认头像，避免运行时加载真人素材。
export const FIGMA_WORKSPACE_AVATARS = {
  sidebar: DEFAULT_AVATARS.male,
  topbar: DEFAULT_AVATARS.male,
} as const;

// Knowledge Figma fixture 使用项目登记的男性默认头像。
export const FIGMA_KNOWLEDGE_AVATARS = {
  sidebar: DEFAULT_AVATARS.male,
  topbar: DEFAULT_AVATARS.male,
} as const;

// Profile Figma fixture 的示例账号为男性，所有默认头像统一使用男性资源。
export const FIGMA_PROFILE_AVATARS = {
  sidebar: DEFAULT_AVATARS.male,
  topbar: DEFAULT_AVATARS.male,
  main: DEFAULT_AVATARS.male,
} as const;

// Admin Figma fixture 的示例账号为男性，统一使用男性默认头像。
export const FIGMA_ADMIN_AVATARS = {
  sidebar: DEFAULT_AVATARS.male,
  userDetail: DEFAULT_AVATARS.male,
} as const;

// Chat Figma fixture 同时包含男性账号头像和女性消息示例头像。
export const FIGMA_CHAT_AVATARS = {
  sidebar: DEFAULT_AVATARS.male,
  topbar: DEFAULT_AVATARS.male,
  message: DEFAULT_AVATARS.female,
} as const;

// 历史 Figma 导出的人物素材只用于设计证据，运行时不允许再次作为头像来源。
const legacyFigmaAvatarPattern = /\/assets\/figma\/.*\/(?:[^/]*(?:avatar|user)[^/]*)\.(?:png|jpe?g|webp|svg)$/i;

export function getDefaultAvatarForGender(gender?: string): string | undefined {
  const normalized = gender?.trim().toLowerCase();
  if (normalized === '女' || normalized === 'female' || normalized === 'f') return DEFAULT_AVATARS.female;
  if (normalized === '男' || normalized === 'male' || normalized === 'm') return DEFAULT_AVATARS.male;
  return undefined;
}

export function resolveAvatarUrl(avatarUrl?: string, gender?: string): string | undefined {
  const candidate = avatarUrl?.trim();
  if (candidate && !legacyFigmaAvatarPattern.test(candidate)) return candidate;
  if (candidate) {
    // 遗留素材无法作为默认头像继续展示；性别未知时使用项目统一男性占位头像。
    return getDefaultAvatarForGender(gender) ?? DEFAULT_AVATARS.male;
  }
  return getDefaultAvatarForGender(gender);
}

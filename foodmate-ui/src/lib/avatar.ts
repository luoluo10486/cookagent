export const DEFAULT_AVATARS = {
  male: '/assets/avatars/default-male.svg',
  female: '/assets/avatars/default-female.svg',
} as const;

// Figma 工作台画板使用明确的示例账号头像，不能与真实模式的性别默认头像混用。
export const FIGMA_WORKSPACE_AVATARS = {
  sidebar: '/assets/figma/workspace/home-sidebar-avatar.png',
  topbar: '/assets/figma/workspace/home-topbar-avatar.png',
} as const;

// Knowledge Figma fixture 使用节点导出的侧栏与顶栏头像资源。
export const FIGMA_KNOWLEDGE_AVATARS = {
  sidebar: '/assets/figma/knowledge/sidebar-avatar.png',
  topbar: '/assets/figma/knowledge/topbar-avatar.png',
} as const;

// Profile Figma fixture 分别登记侧栏、顶栏和个人资料卡的导出头像资源。
export const FIGMA_PROFILE_AVATARS = {
  sidebar: '/assets/figma/profile/sidebar-avatar.png',
  topbar: '/assets/figma/profile/topbar-avatar.png',
  main: '/assets/figma/profile/main-avatar.png',
} as const;

// Admin Figma fixture 使用设计稿中的示例头像，不能与真实用户的性别默认头像混用。
export const FIGMA_ADMIN_AVATARS = {
  sidebar: '/assets/figma/admin/admin-sidebar-avatar.png',
  userDetail: '/assets/figma/admin/user-detail-avatar.png',
} as const;

export function getDefaultAvatarForGender(gender?: string): string | undefined {
  const normalized = gender?.trim().toLowerCase();
  if (normalized === '女' || normalized === 'female' || normalized === 'f') return DEFAULT_AVATARS.female;
  if (normalized === '男' || normalized === 'male' || normalized === 'm') return DEFAULT_AVATARS.male;
  return undefined;
}

export function resolveAvatarUrl(avatarUrl?: string, gender?: string): string | undefined {
  return avatarUrl?.trim() || getDefaultAvatarForGender(gender);
}

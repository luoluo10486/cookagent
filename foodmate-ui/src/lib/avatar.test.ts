import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AVATARS,
  FIGMA_ADMIN_AVATARS,
  FIGMA_CHAT_AVATARS,
  FIGMA_KNOWLEDGE_AVATARS,
  FIGMA_PROFILE_AVATARS,
  FIGMA_WORKSPACE_AVATARS,
  getDefaultAvatarForGender,
  resolveAvatarUrl,
} from './avatar';

describe('avatar defaults', () => {
  it('maps male and female gender values to the supplied assets', () => {
    expect(getDefaultAvatarForGender('男')).toBe(DEFAULT_AVATARS.male);
    expect(getDefaultAvatarForGender('female')).toBe(DEFAULT_AVATARS.female);
  });

  it('does not guess an avatar for an unset gender and preserves uploaded avatars', () => {
    expect(getDefaultAvatarForGender('-')).toBeUndefined();
    expect(resolveAvatarUrl('/uploads/profile.png', '女')).toBe('/uploads/profile.png');
    expect(resolveAvatarUrl('', '女')).toBe(DEFAULT_AVATARS.female);
  });

  it('replaces legacy Figma person assets with the registered gender defaults', () => {
    const legacySources = [
      '/assets/figma/profile/main-avatar.png',
      '/assets/figma/agent-chat/user-avatar.png',
      '/assets/figma/admin/user-detail-avatar.png',
      '/assets/figma/workspace/home-sidebar-avatar.png',
      '/assets/figma/workspace/home-topbar-avatar.png',
    ];

    expect(resolveAvatarUrl(legacySources[0], '女')).toBe(DEFAULT_AVATARS.female);
    expect(resolveAvatarUrl(legacySources[1], '男')).toBe(DEFAULT_AVATARS.male);
    expect(resolveAvatarUrl(legacySources[2], '-')).toBe(DEFAULT_AVATARS.male);
    expect(legacySources.every((source) => resolveAvatarUrl(source) === DEFAULT_AVATARS.male)).toBe(true);
  });

  it('uses the supplied SVG assets for all Figma fixture avatars', () => {
    const maleFixtureAvatars = [
      ...Object.values(FIGMA_WORKSPACE_AVATARS),
      ...Object.values(FIGMA_KNOWLEDGE_AVATARS),
      ...Object.values(FIGMA_PROFILE_AVATARS),
      ...Object.values(FIGMA_ADMIN_AVATARS),
      FIGMA_CHAT_AVATARS.sidebar,
      FIGMA_CHAT_AVATARS.topbar,
    ];

    expect(maleFixtureAvatars.every((avatar) => avatar === DEFAULT_AVATARS.male)).toBe(true);
    expect(FIGMA_CHAT_AVATARS.message).toBe(DEFAULT_AVATARS.female);
  });
});

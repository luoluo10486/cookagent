import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvatarImage } from './AvatarImage';

describe('AvatarImage', () => {
  it('replaces legacy Figma person assets before rendering', () => {
    const { container } = render(
      <AvatarImage avatarUrl="/assets/figma/profile/main-avatar.png" gender="女" alt="头像" />,
    );

    expect(container.querySelector('img')).toHaveAttribute('src', '/assets/avatars/default-female.svg');
  });

  it('falls back to the gender default when a real avatar fails to load', () => {
    const { container } = render(<AvatarImage avatarUrl="/uploads/profile.png" gender="女" alt="头像" />);
    const image = container.querySelector('img');

    expect(image).toHaveAttribute('src', '/uploads/profile.png');
    fireEvent.error(image!);
    expect(image).toHaveAttribute('src', '/assets/avatars/default-female.svg');
  });
});

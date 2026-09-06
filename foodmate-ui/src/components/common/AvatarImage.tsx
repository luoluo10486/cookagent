import { useState, type ImgHTMLAttributes } from 'react';
import { resolveAvatarUrl } from '../../lib/avatar';

type AvatarImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  avatarUrl?: string;
  gender?: string;
};

/**
 * 统一渲染用户头像，避免历史 Figma 人物素材或失效远程地址进入页面。
 * 有效的真实用户头像仍优先展示，加载失败后回退到项目登记的默认 SVG。
 */
export function AvatarImage({ avatarUrl, gender, onError, ...props }: AvatarImageProps) {
  const [failed, setFailed] = useState(false);
  const source = resolveAvatarUrl(failed ? undefined : avatarUrl, gender);

  return (
    <img
      {...props}
      src={source}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}

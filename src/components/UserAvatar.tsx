import React from 'react';

// ==========================================
// 기본 사용자 아바타 일러스트
// - Google 계정에 photoURL 이 없거나, 게스트이거나, 이미지 로딩에 실패한 경우
//   외부 랜덤 인물 사진 대신 앱 톤(카페 베이지)에 맞는 심플한 사용자 일러스트를 보여줍니다.
// ==========================================

const userSvg = (bg: string, body: string, ring: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="기본 사용자">
  <rect width="64" height="64" rx="32" fill="${bg}"/>
  <circle cx="32" cy="24" r="10.5" fill="${body}"/>
  <path d="M11.5 60c0-11.6 9.2-19.5 20.5-19.5S52.5 48.4 52.5 60z" fill="${body}"/>
  <circle cx="32" cy="32" r="30" fill="none" stroke="${ring}" stroke-width="1.5" opacity="0.55"/>
</svg>`.trim();

const toDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** 게스트/일반 사용자 기본 일러스트 */
export const DEFAULT_USER_AVATAR = toDataUri(userSvg('#EFE6DA', '#B9A48C', '#D9CBB8'));

/** 이름 글자수에 따라 살짝 다른 톤을 주는 변형 (같은 사람은 항상 같은 결과) */
const PALETTE = [
  { bg: '#EFE6DA', body: '#B9A48C', ring: '#D9CBB8' },
  { bg: '#E8EDE6', body: '#9DB39A', ring: '#CBD9C7' },
  { bg: '#EAE7F0', body: '#A9A2C2', ring: '#D3CEE2' },
  { bg: '#F3E9E4', body: '#C0A392', ring: '#E0CEC3' },
  { bg: '#E6EDF1', body: '#97AFBD', ring: '#C6D7E0' },
];

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const getDefaultAvatar = (seed?: string): string => {
  if (!seed) return DEFAULT_USER_AVATAR;
  const palette = PALETTE[hashString(seed) % PALETTE.length];
  return toDataUri(userSvg(palette.bg, palette.body, palette.ring));
};

const isUsableSrc = (src?: string | null): boolean => {
  if (!src) return false;
  const value = String(src).trim();
  if (!value) return false;
  if (value === 'null' || value === 'undefined') return false;
  // 외부 랜덤 인물 사진(예전 더미 데이터)은 기본 일러스트로 대체
  if (/gravatar\.com\/avatar\/\?d=mp/i.test(value)) return false;
  if (/images\.unsplash\.com/i.test(value)) return false;
  if (/i\.pravatar\.cc|randomuser\.me|ui-avatars\.com|dicebear/i.test(value)) return false;
  return /^(https?:|data:image\/|blob:)/i.test(value);
};

/** 화면에 표시할 아바타 URL — 사진이 없으면 기본 일러스트 */
export const avatarSrc = (src?: string | null, seed?: string): string =>
  isUsableSrc(src) ? String(src) : getDefaultAvatar(seed);

/** <img onError> 핸들러: 사진 로딩 실패 시 기본 일러스트로 교체 (1회) */
export const handleAvatarError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  img.src = getDefaultAvatar(img.alt || 'user');
};

interface UserAvatarProps {
  src?: string | null;
  name?: string;
  alt?: string;
  className?: string;
  title?: string;
  onClick?: () => void;
}

/** 아바타 표시용 공통 컴포넌트 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  alt,
  className = 'w-8 h-8 rounded-full object-cover',
  title,
  onClick,
}) => (
  <img
    src={avatarSrc(src, name)}
    alt={alt ?? name ?? 'user'}
    title={title ?? name}
    className={className}
    onError={handleAvatarError}
    onClick={onClick}
    draggable={false}
  />
);

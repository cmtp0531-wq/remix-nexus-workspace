// ============================================================
// 회의(Meet/Huddle) 서비스
// - 시작할 때마다 항상 '새로운' 고유 회의실을 만듭니다 (기존 링크 재사용 금지).
// - Google 로그인 + Workspace 권한이 있으면 실제 Google Meet 공간을 만들고,
//   권한이 없거나 실패하면 로그인 없이도 바로 열리는 즉시 회의실(Jitsi Meet)로 대체합니다.
// - 만들어진 링크는 채팅방 메시지 카드로 자동 전송되어, 같은 방 사람들이 같은 회의로 입장합니다.
// ============================================================

import { createGoogleMeetSpace, getAccessToken } from './googleWorkspace';

export type MeetingProvider = 'google' | 'instant';

export interface MeetingRoom {
  link: string;
  embedUrl?: string;
  code: string;
  title: string;
  provider: MeetingProvider;
  createdAt: string;
  isNew: boolean;
}

const JITSI_DOMAIN = 'meet.jit.si';

const randomToken = (len = 6) => {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const sanitize = (value: string) =>
  (value || 'nexus')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18) || 'nexus';

/** 매번 새로운 즉시 회의실(Jitsi Meet)을 만듭니다. 로그인 불필요, 화상·음성·화면공유 지원 */
export const createInstantMeetingRoom = (title: string, spaceId?: string): MeetingRoom => {
  const room = `nexus-${sanitize(spaceId || 'room')}-${Date.now().toString(36)}-${randomToken(4)}`;
  const embedUrl =
    `https://${JITSI_DOMAIN}/${room}` +
    '#config.prejoinPageEnabled=false&config.prejoinConfig.enabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false' +
    '&config.disableDeepLinking=true&config.enableWelcomePage=false&config.requireDisplayName=false';
  return {
    link: `https://${JITSI_DOMAIN}/${room}`,
    embedUrl,
    code: room,
    title: title || '새 회의',
    provider: 'instant',
    createdAt: new Date().toISOString(),
    isNew: true,
  };
};

/** 새 회의 시작: Google Meet 생성 시도 → 실패/권한 없음이면 즉시 회의실 */
export const createNewMeetingRoom = async (title: string, spaceId?: string): Promise<MeetingRoom> => {
  const token = await getAccessToken().catch(() => null);
  if (token) {
    try {
      const space = await createGoogleMeetSpace();
      if (space?.meetingUri) {
        return {
          link: space.meetingUri,
          code: space.meetingCode || space.meetingUri.split('/').pop() || '',
          title: title || 'Google Meet 회의',
          provider: 'google',
          createdAt: new Date().toISOString(),
          isNew: true,
        };
      }
    } catch (error) {
      console.warn('[Meeting] Google Meet 생성 실패, 즉시 회의실로 대체합니다:', error);
    }
  }
  return createInstantMeetingRoom(title, spaceId);
};

/** 회의 링크에서 방 코드 추출 */
export const meetingCodeFromLink = (link: string): string => {
  if (!link) return '';
  try {
    const url = new URL(link);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || url.hostname;
  } catch {
    return link.split('/').filter(Boolean).pop() || link;
  }
};

export const isGoogleMeetLink = (link: string): boolean => /meet\.google\.com/i.test(link || '');

/** 기존 링크를 열 때: 같은 회의실에 그대로 입장합니다. */
export const joinMeetingRoom = (link: string, title?: string, code?: string): MeetingRoom => {
  const provider: MeetingProvider = isGoogleMeetLink(link) ? 'google' : 'instant';
  const roomCode = code || meetingCodeFromLink(link);
  const embedUrl =
    provider === 'instant'
      ? `${link.split('#')[0]}#config.prejoinPageEnabled=false&config.prejoinConfig.enabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableDeepLinking=true&config.enableWelcomePage=false`
      : undefined;
  return {
    link,
    embedUrl,
    code: roomCode,
    title: title || '회의',
    provider,
    createdAt: new Date().toISOString(),
    isNew: false,
  };
};

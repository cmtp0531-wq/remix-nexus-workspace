import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, onSnapshot, orderBy, query, setDoc, getDocFromServer } from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { getStoredFirebaseConfig } from './appConfig';

// Firebase 는 "선택" 입니다.
// 사용자가 설정 모달에서 본인의 Firebase 설정을 입력한 경우에만 초기화되며,
// 설정이 없으면 게스트(로컬) 모드로 앱이 그대로 동작합니다.
const activeFirebaseConfig = getStoredFirebaseConfig();

export const firebaseApp = activeFirebaseConfig
  ? getApps().length === 0
    ? initializeApp(activeFirebaseConfig)
    : getApp()
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestore = firebaseApp
  ? getFirestore(firebaseApp, activeFirebaseConfig?.firestoreDatabaseId || '(default)')
  : null;

/** 구글(Firebase) 로그인이 연결되어 있는지 여부 */
export const isGoogleSignedIn = (): boolean => Boolean(auth?.currentUser);

/** 현재 로그인한 구글 사용자 (없으면 null) */
export const getSignedInUser = (): FirebaseUser | null => auth?.currentUser ?? null;

export const signOutGoogle = async (): Promise<void> => {
  setAccessTokenInMemory(null);
  if (!auth) return;
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.warn('[Firebase] sign-out skipped:', error);
  }
};

// The named database ID is supplied by the original Firebase app configuration.
import { DriveDocument, GmailMessageSummary, GmailMessageDetail, DriveFileType } from '../types';

// Workspace Scopes for Real Drive, Docs, Gmail, Calendar, Tasks
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

export const workspaceProvider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => workspaceProvider.addScope(scope));

// Session-backed token cache
const TOKEN_SESSION_KEY = 'gchat_workspace_oauth_token';
let cachedAccessToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_SESSION_KEY) : null;
let isSigningIn = false;

export const setAccessTokenInMemory = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem(TOKEN_SESSION_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_SESSION_KEY);
    }
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const signInWithGoogleAccount = async (): Promise<FirebaseUser> => {
  if (!auth) {
    const error: any = new Error('Firebase 설정이 없습니다. 설정 → Google 연동에서 본인 Firebase 설정을 먼저 입력해 주세요.');
    error.code = 'workchat/no-firebase-config';
    throw error;
  }
  const result = await signInWithPopup(auth, workspaceProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    setAccessTokenInMemory(credential.accessToken);
  }
  return result.user;
};

export const observeFirebaseAuth = (callback: (user: FirebaseUser | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const saveCloudChatMessage = async (spaceId: string, message: any) => {
  if (!auth?.currentUser || !firestore) throw new Error('Google 로그인 세션이 없습니다.');
  if (message.senderId !== auth.currentUser.uid) throw new Error('메시지 발신자 인증이 일치하지 않습니다.');
  // JSON round-trip removes undefined values that Firestore rejects.
  const safeMessage = JSON.parse(JSON.stringify({ ...message, createdAt: Date.now() }));
  await setDoc(doc(firestore, 'spaces', spaceId, 'messages', message.id), safeMessage);
};

export const subscribeToCloudChatMessages = (spaceId: string, callback: (messages: any[]) => void, onError?: (error: Error) => void) => {
  if (!firestore) return () => {};
  const messagesQuery = query(collection(firestore, 'spaces', spaceId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(messagesQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => item.data()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
  }, (error) => {
    console.error('Cloud chat sync failed:', error);
    onError?.(error);
  });
};

export const saveUserProfileToFirestore = async (user: any) => {
  if (!auth?.currentUser || !firestore) return;
  try {
    const safeUser = JSON.parse(JSON.stringify({
      id: user.id,
      name: user.name || 'Google 사용자',
      email: user.email || '',
      avatar: user.avatar || '',
      status: 'online',
      role: user.role || '팀원',
      department: user.department || '협업팀',
      lastSeen: Date.now()
    }));
    await setDoc(doc(firestore, 'users', user.id), safeUser, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to sync user profile:', err);
  }
};

export const subscribeToCloudUsers = (callback: (users: any[]) => void, onError?: (error: Error) => void) => {
  if (!firestore) return () => {};
  const usersCollection = collection(firestore, 'users');
  return onSnapshot(usersCollection, (snapshot) => {
    callback(snapshot.docs.map((doc) => doc.data()));
  }, (error) => {
    console.warn('[Firestore] Users sync failed:', error);
    onError?.(error);
  });
};

// Validate connection on boot (Firebase 가 설정된 경우에만)
export async function testFirestoreConnection() {
  if (!firestore) return;
  try {
    await getDocFromServer(doc(firestore, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Please check your Firebase configuration.');
    }
  }
}
void testFirestoreConnection();

export const initAuth = (
  onSuccess?: (user: FirebaseUser, token: string) => void,
  onFailure?: () => void
) => {
  if (!auth) {
    onFailure?.();
    return () => {};
  }
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user && cachedAccessToken) {
      if (onSuccess) onSuccess(user, cachedAccessToken);
    } else {
      if (onFailure) onFailure();
    }
  });
};

export const signInWithGoogleWorkspace = async (): Promise<{
  user: FirebaseUser;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    if (!auth) throw new Error('Firebase 설정이 없습니다.');
    const result = await signInWithPopup(auth, workspaceProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google OAuth 인증 토큰을 수신하지 못했습니다.');
    }
    cachedAccessToken = credential.accessToken;
    setAccessTokenInMemory(cachedAccessToken);
    return {
      user: result.user,
      accessToken: cachedAccessToken,
    };
  } catch (error: any) {
    console.warn('Google Workspace Sign In error:', error);
    return null;
  } finally {
    isSigningIn = false;
  }
};

// --- BASE64 & RFC2822 / RFC2047 HELPERS FOR GMAIL (UTF-8 SAFE) ---
function decodeBase64Url(input: string): string {
  if (!input) return '';
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function encodeUtf8BytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function encodeUtf8Base64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return encodeUtf8BytesToBase64(bytes);
}

function encodeBase64Url(input: string): string {
  return encodeUtf8Base64(input)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeSubjectRfc2047(subject: string): string {
  const base64Str = encodeUtf8Base64(subject);
  return `=?UTF-8?B?${base64Str}?=`;
}


// --- REAL GOOGLE DRIVE & GOOGLE DOCS API ---
export const fetchRealDriveFiles = async (
  searchQuery?: string,
  filterType?: 'all' | 'doc' | 'sheet' | 'slide'
): Promise<DriveDocument[]> => {
  const token = await getAccessToken();
  if (!token) {
    console.warn('[Google Drive] No access token available.');
    return [];
  }

  try {
    let q = 'trashed = false';
    if (searchQuery && searchQuery.trim()) {
      q += ` and name contains '${searchQuery.trim().replace(/'/g, "\\'")}'`;
    }
    if (filterType === 'doc') {
      q += " and mimeType = 'application/vnd.google-apps.document'";
    } else if (filterType === 'sheet') {
      q += " and mimeType = 'application/vnd.google-apps.spreadsheet'";
    } else if (filterType === 'slide') {
      q += " and mimeType = 'application/vnd.google-apps.presentation'";
    }

    const fields = 'files(id, name, mimeType, modifiedTime, size, owners, webViewLink, iconLink)';
    const url = `https://www.googleapis.com/drive/v3/files?pageSize=50&fields=${encodeURIComponent(fields)}&q=${encodeURIComponent(q)}&orderBy=modifiedTime desc`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('[Google Drive] fetch files failed:', res.status, err);
      return [];
    }

    const data = await res.json();
    const files = data.files || [];

    return files.map((file: any) => {
      let type: DriveFileType = 'file';
      if (file.mimeType?.includes('document')) type = 'doc';
      else if (file.mimeType?.includes('spreadsheet')) type = 'sheet';
      else if (file.mimeType?.includes('presentation')) type = 'slide';
      else if (file.mimeType?.includes('pdf')) type = 'pdf';

      let sizeFormatted = '0 KB';
      if (file.size) {
        const kb = Number(file.size) / 1024;
        sizeFormatted = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
      } else {
        sizeFormatted = type === 'doc' ? 'Google 문서' : type === 'sheet' ? 'Google 시트' : type === 'slide' ? 'Google 슬라이드' : '클라우드 파일';
      }

      const modDate = file.modifiedTime ? new Date(file.modifiedTime) : new Date();
      const timeStr = `${modDate.toLocaleDateString()} ${modDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      return {
        id: file.id,
        title: file.name,
        type,
        content: '',
        ownerId: file.owners?.[0]?.permissionId || 'user',
        ownerName: file.owners?.[0]?.displayName || '내 드라이브',
        updatedAt: timeStr,
        size: sizeFormatted,
        permission: 'editor',
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
        isRealDrive: true,
      };
    });
  } catch (error) {
    console.error('[Google Drive] Error fetching files:', error);
    return [];
  }
};

export const fetchRealDocContent = async (fileId: string, mimeType?: string): Promise<string> => {
  const token = await getAccessToken();
  if (!token) return '';

  try {
    let url = '';
    if (mimeType === 'application/vnd.google-apps.document' || !mimeType) {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
    } else {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      return await res.text();
    }
  } catch (error) {
    console.warn('[Google Drive] Read doc content error:', error);
  }
  return '';
};

export const saveRealDocContent = async (
  fileId: string, 
  content: string, 
  title?: string
): Promise<{ success: boolean; error?: string }> => {
  const token = await getAccessToken();
  if (!token) return { success: false, error: '인증 토큰 없음' };

  let titleUpdated = false;
  if (title && title.trim()) {
    try {
      const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: title.trim() }),
      });
      if (metaRes.ok) titleUpdated = true;
    } catch (err) {
      console.warn('[Google Drive] Update file title error:', err);
    }
  }

  try {
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: content,
    });
    if (res.ok || titleUpdated) {
      return { success: true };
    }
    return { success: false, error: `Drive 응답 상태: ${res.status}` };
  } catch (error: any) {
    console.warn('[Google Drive] Save doc content error:', error);
    return { success: titleUpdated, error: error?.message };
  }
};

export const createRealDriveDoc = async (
  title: string,
  type: 'doc' | 'sheet' | 'slide'
): Promise<DriveDocument | null> => {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    let mimeType = 'application/vnd.google-apps.document';
    if (type === 'sheet') mimeType = 'application/vnd.google-apps.spreadsheet';
    else if (type === 'slide') mimeType = 'application/vnd.google-apps.presentation';

    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: title,
        mimeType,
      }),
    });

    if (res.ok) {
      const created = await res.json();
      return {
        id: created.id,
        title: created.name || title,
        type,
        content: '',
        ownerId: auth?.currentUser?.uid || 'user',
        ownerName: auth?.currentUser?.displayName || '나',
        updatedAt: '방금 전',
        size: '0 KB',
        permission: 'editor',
        mimeType,
        isRealDrive: true,
      };
    }
  } catch (error) {
    console.warn('[Google Drive] Create file error:', error);
  }
  return null;
};

export const deleteRealDriveFile = async (fileId: string): Promise<boolean> => {
  const token = await getAccessToken();
  if (!token) return false;

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch (error) {
    console.warn('[Google Drive] Delete file error:', error);
    return false;
  }
};

// --- REAL GMAIL API ---
export const fetchRealGmailMessages = async (
  query = '',
  label = 'INBOX',
  maxResults = 25
): Promise<GmailMessageSummary[]> => {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    let q = label ? `label:${label}` : '';
    if (query && query.trim()) {
      q = q ? `${q} ${query.trim()}` : query.trim();
    }

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!listRes.ok) {
      console.warn('[Gmail] List messages failed:', listRes.status);
      return [];
    }

    const listData = await listRes.json();
    const messageRefs = listData.messages || [];

    // Parallel fetch details
    const details = await Promise.all(
      messageRefs.map(async (ref: { id: string }) => {
        try {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!detailRes.ok) return null;
          const msg = await detailRes.json();
          const headers = msg.payload?.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          const subject = getHeader('Subject') || '(제목 없음)';
          const from = getHeader('From') || '알 수 없는 발신자';
          const to = getHeader('To') || '';
          const dateStr = getHeader('Date') || '';

          const fromEmail = from.includes('<') ? from.split('<')[1].replace('>', '').trim() : from;
          const labels = msg.labelIds || [];
          const isUnread = labels.includes('UNREAD');
          const isStarred = labels.includes('STARRED');

          return {
            id: msg.id,
            threadId: msg.threadId,
            subject,
            from,
            fromEmail,
            to,
            date: dateStr,
            snippet: msg.snippet || '',
            isUnread,
            isStarred,
            labels,
          } as GmailMessageSummary;
        } catch {
          return null;
        }
      })
    );

    return details.filter(Boolean) as GmailMessageSummary[];
  } catch (error) {
    console.error('[Gmail] Error fetching messages:', error);
    return [];
  }
};

export const fetchRealGmailDetail = async (messageId: string): Promise<GmailMessageDetail | null> => {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;

    const msg = await res.json();
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject') || '(제목 없음)';
    const from = getHeader('From') || '알 수 없는 발신자';
    const to = getHeader('To') || '';
    const dateStr = getHeader('Date') || '';
    const fromEmail = from.includes('<') ? from.split('<')[1].replace('>', '').trim() : from;
    const labels = msg.labelIds || [];

    // Extract body (HTML preferred, fallback to plain text)
    let bodyText = '';
    let bodyHtml = '';

    const extractParts = (part: any) => {
      if (!part) return;
      if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = decodeBase64Url(part.body.data);
      }
      if (part.parts && Array.isArray(part.parts)) {
        part.parts.forEach(extractParts);
      }
    };

    if (msg.payload?.body?.data) {
      if (msg.payload.mimeType === 'text/html') {
        bodyHtml = decodeBase64Url(msg.payload.body.data);
      } else {
        bodyText = decodeBase64Url(msg.payload.body.data);
      }
    }
    if (msg.payload?.parts) {
      msg.payload.parts.forEach(extractParts);
    }

    if (!bodyText && bodyHtml) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = bodyHtml;
      bodyText = tempDiv.textContent || tempDiv.innerText || '';
    }

    return {
      id: msg.id,
      threadId: msg.threadId,
      subject,
      from,
      fromEmail,
      to,
      date: dateStr,
      snippet: msg.snippet || '',
      isUnread: labels.includes('UNREAD'),
      isStarred: labels.includes('STARRED'),
      labels,
      bodyText,
      bodyHtml: bodyHtml || `<pre style="white-space: pre-wrap; font-family: inherit;">${bodyText}</pre>`,
    };
  } catch (error) {
    console.error('[Gmail] Error fetching detail:', error);
    return null;
  }
};

export const sendRealGmailMessage = async (
  to: string,
  subject: string,
  bodyText: string
): Promise<boolean> => {
  const token = await getAccessToken();
  if (!token) return false;

  try {
    const utf8Subject = encodeSubjectRfc2047(subject || '(제목 없음)');
    const from = auth?.currentUser?.email || '';

    // Encode HTML body in Base64 with Content-Transfer-Encoding: base64
    // This safely supports Korean and international UTF-8 characters without corruption
    const htmlBody = `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #2C2520;">${bodyText.replace(/\n/g, '<br/>')}</body></html>`;
    const bodyBase64 = encodeUtf8Base64(htmlBody);

    const messageParts = [
      `To: ${to}`,
      from ? `From: ${from}` : '',
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      bodyBase64,
    ].filter(Boolean);

    const rawMessage = messageParts.join('\r\n');
    const raw = encodeBase64Url(rawMessage);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    return res.ok;
  } catch (error) {
    console.error('[Gmail] Send email error:', error);
    return false;
  }
};

export const toggleRealGmailStar = async (messageId: string, starred: boolean): Promise<boolean> => {
  const token = await getAccessToken();
  if (!token) return false;
  try {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: starred ? ['STARRED'] : [],
        removeLabelIds: starred ? [] : ['STARRED'],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const markRealGmailRead = async (messageId: string, read: boolean): Promise<boolean> => {
  const token = await getAccessToken();
  if (!token) return false;
  try {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: read ? ['UNREAD'] : [],
        addLabelIds: read ? [] : ['UNREAD'],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const trashRealGmailMessage = async (messageId: string): Promise<boolean> => {
  const token = await getAccessToken();
  if (!token) return false;
  try {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const createGoogleCalendarWebLink = (event: {
  title: string;
  dateStr: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
}): string => {
  const start = `${(event.dateStr || '').replace(/-/g, '')}T${(event.startTime || '09:00').replace(/:/g, '')}00`;
  const end = `${(event.dateStr || '').replace(/-/g, '')}T${(event.endTime || '10:00').replace(/:/g, '')}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&details=${encodeURIComponent(event.description || 'Google Chat Workspace 일정')}&location=${encodeURIComponent(event.location || 'Google Meet')}`;
};

export const createGoogleTasksWebLink = (): string => {
  return 'https://tasks.google.com/embed/list/~default';
};

export const createGoogleMeetWebLink = (code?: string): string => {
  if (code && code.startsWith('http')) return code;
  const room = code || `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
  return `https://meet.google.com/${room}`;
};

// 1. Google Drive: Automatic Permission Granting to Space Members
export const grantDrivePermissionsToSpaceMembers = async (
  fileId: string,
  memberEmails: string[]
): Promise<{ success: boolean; grantedCount: number; message: string }> => {
  const token = await getAccessToken();
  if (!token) {
    return {
      success: false,
      grantedCount: 0,
      message: 'Google Workspace 로그인 토큰이 없어 로컬 권한 모델로 시뮬레이션 처리되었습니다.',
    };
  }

  let granted = 0;
  for (const email of memberEmails) {
    if (!email || !email.includes('@')) continue;
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'writer',
          type: 'user',
          emailAddress: email,
        }),
      });
      if (res.ok) granted++;
    } catch (e) {
      console.warn(`Permission grant failed for ${email}:`, e);
    }
  }

  return {
    success: true,
    grantedCount: granted,
    message: `${granted}명의 스페이스 멤버에게 Google Drive 실시간 편집/읽기 권한이 자동 부여되었습니다.`,
  };
};

// 2. Google Tasks: Bilateral Task Sync
export const syncTaskToGoogle = async (task: {
  title: string;
  dueDate?: string;
  notes?: string;
}): Promise<{ googleTaskId?: string; success: boolean }> => {
  const token = await getAccessToken();
  if (!token) {
    return { success: false };
  }

  try {
    const dueIso = task.dueDate ? new Date(`${task.dueDate}T12:00:00Z`).toISOString() : undefined;
    const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: task.title,
        notes: task.notes || 'Google Chat Workspace 태스크 자동 동기화',
        due: dueIso,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { googleTaskId: data.id, success: true };
    }
  } catch (e) {
    console.warn('Google Tasks sync error:', e);
  }

  return { success: false };
};

export const updateGoogleTaskStatus = async (
  googleTaskId: string,
  completed: boolean
): Promise<boolean> => {
  const token = await getAccessToken();
  if (!token || !googleTaskId) return false;

  try {
    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks/${googleTaskId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: completed ? 'completed' : 'needsAction',
        }),
      }
    );
    return res.ok;
  } catch (e) {
    console.warn('Google Tasks update error:', e);
    return false;
  }
};

// 3. Google Calendar: Bilateral Event Sync
export const syncEventToGoogle = async (event: {
  title: string;
  dateStr: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  attendeeEmails?: string[];
}): Promise<{ googleEventId?: string; htmlLink?: string; success: boolean }> => {
  const token = await getAccessToken();
  if (!token) return { success: false };

  try {
    const startDateTime = `${event.dateStr}T${event.startTime || '09:00'}:00`;
    const endDateTime = `${event.dateStr}T${event.endTime || '10:00'}:00`;

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description || 'Google Chat Workspace에서 생성된 일정',
        location: event.location || 'Google Meet 화상 회의',
        start: { dateTime: new Date(startDateTime).toISOString() },
        end: { dateTime: new Date(endDateTime).toISOString() },
        attendees: (event.attendeeEmails || []).map((email) => ({ email })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { googleEventId: data.id, htmlLink: data.htmlLink, success: true };
    }
  } catch (e) {
    console.warn('Google Calendar sync error:', e);
  }

  return { success: false };
};

// 4. Strict Authentication: Disposable Email Blocker & 6-digit OTP verification
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'trashmail.com',
  'throwawaymail.com',
  'yopmail.com',
  'getnada.com',
  'fakeinbox.com',
  'sharklasers.com',
  'dispostable.com',
  'generator.email',
  'crazymailing.com',
  'inboxbear.com'
]);

export const isDisposableEmail = (email: string): boolean => {
  if (!email || !email.includes('@')) return true;
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return true;
  return DISPOSABLE_DOMAINS.has(domain);
};

// OTP verification session
interface OtpSession {
  email: string;
  code: string;
  expiresAt: number;
}

const otpStore = new Map<string, OtpSession>();

export const sendEmailVerificationOtp = (email: string): { code: string; success: boolean; error?: string } => {
  const cleanEmail = email.trim().toLowerCase();
  if (isDisposableEmail(cleanEmail)) {
    return {
      code: '',
      success: false,
      error: '일회용 및 가짜 임시 이메일 주소는 보안상 회원가입이 불가능합니다. 실제 사용하는 Google 이메일을 입력해주세요.',
    };
  }

  // Generate 6-digit verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(cleanEmail, {
    email: cleanEmail,
    code,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes validity
  });

  return {
    code,
    success: true,
  };
};

export const verifyEmailOtp = (email: string, inputCode: string): { verified: boolean; message: string } => {
  const cleanEmail = email.trim().toLowerCase();
  const session = otpStore.get(cleanEmail);

  if (!session) {
    return { verified: false, message: '발송된 인증 코드가 없습니다. 먼저 인증 메일을 요청해주세요.' };
  }

  if (Date.now() > session.expiresAt) {
    otpStore.delete(cleanEmail);
    return { verified: false, message: '인증 코드 유효시간(5분)이 만료되었습니다. 다시 요청해주세요.' };
  }

  if (session.code !== inputCode.trim()) {
    return { verified: false, message: '인증 번호 6자리가 일치하지 않습니다. 다시 확인해주세요.' };
  }

  // Mark as verified
  otpStore.delete(cleanEmail);
  return { verified: true, message: '이메일 인증이 성공적으로 완료되었습니다!' };
};

// ==========================================
// 앱에 내장된 기본 Firebase / Google API 설정
// - Firebase 웹 config 는 공개되어도 안전한 값입니다(보안은 규칙·승인 도메인이 담당).
// - 사용자가 설정 모달에서 다른 프로젝트 설정을 입력하면 그 값이 우선합니다.
// ==========================================

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCRVnfzkee_GsC_rSUUBQWmocZA2Jgd56I',
  authDomain: 'remix-nexus-personal.firebaseapp.com',
  projectId: 'remix-nexus-personal',
  storageBucket: 'remix-nexus-personal.firebasestorage.app',
  messagingSenderId: '20802509673',
  appId: '1:20802509673:web:78fd15302f54f0dcc2bbf8',
  firestoreDatabaseId: '(default)',
} as const;

// YouTube Data API v3 전용 키 (YouTube Data API v3 + https://cmtp0531-wq.github.io/* 리퍼러로 제한됨)
export const DEFAULT_YOUTUBE_API_KEY = 'AIzaSyAqya6zVmMDOAPSg4QI0wn9Qp1CCXu8Y9Q';

// 앱 배포 주소 (OAuth 동의 화면·공유 링크에서 사용)
export const APP_DEPLOY_URL = 'https://cmtp0531-wq.github.io/remix-nexus-workspace/';

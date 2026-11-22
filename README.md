# 워크챗 (WorkChat) — Remix Nexus Workspace

Google Workspace(독스·시트·슬라이드·드라이브·지메일)와 Gemini AI를 한 화면에서 쓰는 협업 메신저입니다.
**파이어베이스 로그인 없이도 바로 동작하는 게스트(로컬) 모드**를 기본으로 하고, 원하면 설정에서 본인 Firebase/구글 계정을 연결할 수 있습니다.

- 원본 앱: Google AI Studio `Remix Nexus Workspace` (2026-11-03 16:35 버전 기반)
- 이 저장소: 그 버전을 정적 웹사이트로 배포할 수 있게 보완한 버전

## 바로 실행

```bash
npm install --legacy-peer-deps
npm run build        # dist/ 생성
npm run preview      # 빌드 결과 로컬 확인 (기본 http://localhost:4173)
```

개발 모드(서버 프록시 포함):

```bash
npm install --legacy-peer-deps
GEMINI_API_KEY=... npm run dev     # server.ts (포트 3000)
```

## 정적 호스팅 배포 (GitHub Pages / Netlify / Cloudflare Pages / Vercel)

- `npm run build` 결과인 **`dist/` 폴더만** 올리면 됩니다. 서버·환경변수 없이 동작합니다.
- `vite.config.ts` 의 `base: './'` 덕분에 `https://아이디.github.io/저장소명/` 같은 **하위 경로 배포도 그대로 동작**합니다.
- GitHub Pages 예시: `dist/` 내용을 `gh-pages` 브랜치(또는 `/docs`)에 올리고 Pages 를 그 브랜치로 지정.
- Netlify/Cloudflare Pages 예시: Build command `npm run build`, Publish directory `dist`.

### 배포 후 사용자가 처음에 할 일 (선택)

앱은 **아무 설정 없이도** 채팅·독스·시트·슬라이드·할 일이 모두 동작합니다(데이터는 그 브라우저의 localStorage에 저장).

- **AI(제미나이) 쓰기**: 우측 상단 ⚙ 설정 → **AI** 탭 → [Google AI Studio](https://aistudio.google.com/apikey)에서 발급한 API 키 저장.
  키는 브라우저 localStorage에만 저장되고 서버로 보내지 않습니다.
- **구글 로그인/Gmail/드라이브 실연동**: 설정 → **Google 연동** 탭 → Firebase 콘솔의 `firebaseConfig` 값을 붙여넣고 저장 → 새로고침 → "Google로 로그인".
  (Firebase Console → Authentication → Google 제공업체 사용 설정 + 승인된 도메인에 배포 주소 추가 필요)

## 데이터가 저장되는 방식

| 데이터 | 저장 위치 |
| --- | --- |
| 채팅방·메시지·스레드·반응 | `localStorage` (`workchat_*`), 창/탭 간 BroadcastChannel 동기화 |
| 독스·시트·슬라이드 문서 | `localStorage` (`gchat_real_drive_docs_v6`), 0.6초 디바운스 자동 저장 + 닫기/새로고침 시 flush |
| AI 패널 대화 | `localStorage` (`workchat_gemini_chat_history_v6_*`) |
| 할 일·친구·캘린더 | `localStorage` |
| (설정 시) 메시지·사용자 | Firestore 동기화 — 로컬 저장은 그대로 유지 |

설정 → **데이터** 탭에서 전체 백업(JSON) 내려받기 / 로컬 데이터 초기화가 가능합니다.

## 이번에 보완한 것 (요약)

1. **로그인 게이트 제거(게스트 모드)**: 원본은 Firebase 로그인이 안 되면 앱이 아예 열리지 않았음 → 게스트 사용자로 즉시 진입, 이후 설정에서 구글 연결 시 계정 전환.
2. **문서/시트 저장 버그 수정**: 자동 저장 타이머가 상태 갱신 때문에 매번 취소되어 저장이 안 되던 문제 수정(디바운스 저장 + beforeunload flush).
3. **오피스 기능 강화**: 독스(서식·표·이미지 삽입·미리보기/분할·인쇄/PDF·찾기·목차·실행취소), 시트(엑셀식 화살표 이동·수식 바·SUM/AVERAGE·정렬·시트 추가·차트), 슬라이드(Canva식 템플릿·요소·테마·순서 이동·복제·발표자 메모·전체화면 쇼).
4. **제목 입력 깜박임 제거**: 입력 중 부모 상태가 값을 덮어쓰지 않도록 정리.
5. **Gemini 클라이언트 직접 호출**: 서버 없이 브라우저에서 사용자 키로 호출, 서버(`server.ts`)가 있으면 자동으로 서버 경유.
6. **한글 타이포그래피**: `font-sans` 유틸리티까지 Noto Sans KR 우선 적용, `word-break: keep-all`.
7. **반응형/접근성**: 모바일 가로 스크롤 제거 확인, 설정 모달 반응형, 버튼 aria-label/title 보강.

## 참고

- 원본 버전에 하드코딩돼 있던 **타인 소유 Firebase 설정(firebase-applet-config.json)** 은 앱에서 완전히 제거했습니다(이 저장소에는 포함되어 있지 않음). 이 배포본에는 포함되어 있지 않습니다.
- `firebase-blueprint.json`, `firestore.rules`, `firebase-config.sample.json` — 본인 Firebase를 연결할 때 참고용(샘플 값).

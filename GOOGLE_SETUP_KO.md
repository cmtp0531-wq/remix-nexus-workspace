# WorkChat Google 로그인 및 실시간 채팅 설정 (선택)

이 앱은 **아무 설정 없이도 게스트(로컬) 모드로 바로 동작**합니다. 아래는 본인 Firebase 프로젝트를 연결해 Google 로그인·Firestore 실시간 동기화까지 쓰고 싶을 때의 안내입니다.

## 1. Firebase 프로젝트 준비

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트를 만들거나 본인 프로젝트를 엽니다.
2. **Authentication → Sign-in method**에서 **Google** 제공자를 활성화합니다.
3. **Authentication → Settings → Authorized domains**에 배포 사이트의 도메인을 추가합니다. 예: `아이디.github.io` (프로토콜 `https://`는 입력하지 않습니다.)

## 2. Firestore

1. 프로젝트의 Firestore Database를 만듭니다.
2. 이 저장소의 `firestore.rules` 규칙을 배포합니다. 규칙을 배포하지 않으면 로그인은 되더라도 메시지 읽기/쓰기가 거부될 수 있습니다.

## 3. 앱에 설정 입력

1. Firebase Console → 프로젝트 설정 → 내 앱(웹)의 `firebaseConfig` 값을 복사합니다.
2. 앱 우측 상단 ⚙ **설정 → Google 연동** 탭에 붙여넣고 저장한 뒤 새로고침합니다.
   (값은 그 브라우저의 `localStorage`에만 저장됩니다. 형식은 `firebase-config.sample.json` 참고.)
3. 상단의 "Google로 로그인"으로 로그인합니다.

## 주의점

- `firebaseConfig`의 `apiKey`는 Firebase 웹 앱 식별용 공개 값이지만, **Gemini API 키 같은 비밀 키는 절대 여기에 넣지 마세요.**
- Gemini 키는 앱 **설정 → AI** 탭에서 따로 저장합니다(브라우저 `localStorage`에만 보관).
- 로그인 없이 만든 데이터는 그 브라우저에 저장되고, 로그인 후에는 같은 Firebase 프로젝트 사용자끼리 동기화됩니다.

# 「양치왕」 AR 양치 습관 챌린지 설계

- 작성일: 2026-09-23
- 대상: 모바일 웹 기반 학생 참여 서비스와 1인 관리자 운영 도구
- 구현 기준: Next.js, TypeScript, MediaPipe Face Landmarker, Canvas 2D, Google Apps Script, Google Sheets, Google Drive

## 1. 목적과 성공 기준

「양치왕」은 양치 정확도를 판정하는 도구가 아니라 학생이 정해진 기간 동안 양치 챌린지에 꾸준히 참여하도록 돕는 게임형 모바일 웹앱이다. 학생은 QR로 접속하고, 카메라를 보며 양치한 뒤 하루 한 개의 캐릭터 도장을 받는다. 누적 참여에 따라 AR 스킨을 획득하고, 완주하면 양치왕 왕관과 소감 작성 화면을 받는다.

초기 성공 기준은 다음과 같다.

1. 학생이 앱 설치나 Google 로그인 없이 QR로 참여할 수 있다.
2. 개인 휴대폰에 저장된 기기 토큰으로 다음 접속 때 기존 기록을 자동 복구한다.
3. 카메라 영상과 얼굴 정보는 브라우저 밖으로 전송하거나 저장하지 않는다.
4. 동일 학생의 중복 제출과 하루 인정 횟수 초과를 서버에서 막는다.
5. 관리자는 별도 관리자 주소와 비밀번호로 챌린지, 참여 현황, 스킨을 관리한다.
6. 관리자가 PNG/WebP 스킨을 추가해도 프런트엔드를 다시 배포할 필요가 없다.
7. 5일 챌린지는 5개, 10일 챌린지는 10개의 원형 도장 칸을 자동으로 표시한다.

## 2. 범위와 원칙

### 포함 범위

- 학생 등록과 기기 자동 로그인
- 5일, 10일, 직접 설정 챌린지
- 1분, 3분 또는 학생 선택 시간
- 전면 카메라, 타이머, 얼굴 감지, 2D AR 스킨
- 원형 캐릭터 도장판과 도장 이미지 애니메이션
- 일별 도장, 보상, 스킨 컬렉션, 완주 왕관
- 완주 후 한 번만 작성하는 소감
- 관리자 챌린지 생성, QR, 참여 현황, 스킨 업로드
- Google Apps Script API와 Sheets/Drive 저장소

### 제외 범위

- 양치 부위와 정확도 판정
- 얼굴 인식에 의한 학생 식별
- 카메라 영상·사진·랜드마크 저장
- 학생 Google 계정 로그인
- 반별 경쟁 순위와 공개 리더보드
- 푸시 알림과 네이티브 앱 설치

### 설계 원칙

- 개인정보 최소수집: 목적에 필요한 값만 전송하고 저장한다.
- 서버 권위: 도장, 중복, 완주, 보상 판정은 Apps Script가 결정한다.
- 점진적 향상: 카메라나 MediaPipe가 실패해도 타이머 모드로 참여할 수 있다.
- 기능 분리: 화면, 게임 규칙, 브라우저 AR, API, Sheets 접근을 독립 모듈로 둔다.
- 확장 가능성: 데이터 접근 인터페이스를 분리해 향후 백엔드 교체가 가능하게 한다.

## 3. 전체 시스템 구조

### 학생 브라우저

- QR의 `challenge` 쿼리로 챌린지를 식별한다.
- 기기 토큰이 있으면 기존 학생 기록을 자동 복구한다.
- 카메라, Face Landmarker, Canvas 합성, 타이머를 브라우저에서 실행한다.
- 완료 시 최소 참여 결과만 Apps Script로 전송한다.
- 서버가 확정한 도장·보상 결과를 받은 뒤 애니메이션을 재생한다.

### Next.js 웹앱

- 학생 화면과 관리자 화면을 하나의 반응형 앱으로 제공한다.
- 모바일 세로 화면을 우선하며 최소 터치 영역은 약 44px로 유지한다.
- `api` 어댑터가 Apps Script의 요청 형식을 숨긴다.
- 카메라 기능은 클라이언트 전용 모듈로 지연 로딩해 일반 화면 번들을 가볍게 유지한다.

### Google Apps Script

- 학생 연결, 기기 세션, 완료 제출, 도장, 보상, 관리자 인증을 처리한다.
- `LockService`로 동일 학생·날짜에 대한 동시 제출을 직렬화한다.
- 요청별 `idempotencyKey`로 네트워크 재시도 중 중복 쓰기를 방지한다.
- Sheets 읽기·쓰기는 저장소 모듈을 통해 수행한다.
- 스킨 업로드 파일은 전용 Drive 폴더에 저장한다.

### Google Sheets와 Drive

- Sheets는 챌린지, 학생, 참여, 스킨 메타데이터, 보상, 소감을 저장한다.
- Drive는 관리자 업로드 PNG/WebP 원본과 생성된 썸네일을 저장한다.
- 삭제 대신 비활성화를 기본으로 하여 기존 학생의 획득 기록을 보존한다.

## 4. 학생 사용자 흐름

1. 학생이 `/?challenge=ABC123` 형태의 QR을 연다.
2. 브라우저가 `challengeId`와 기기 토큰을 확인한다.
3. 유효한 토큰이 있으면 `2학년 3반 12번 김○○ 학생으로 계속하기`를 표시한다.
4. 토큰이 없거나 다른 학생을 선택하면 학년, 반, 번호, 이름을 입력한다.
5. 서버는 기존 학생을 연결하거나 새 `studentId`를 만들고 기기 토큰을 발급한다.
6. 학생 홈은 전체 도장판, 성공 일수, 다음 보상, 현재 스킨을 보여준다.
7. 시간 선택형 챌린지는 1분 또는 3분을 고르게 한다.
8. 카메라 미저장 안내를 보여준 뒤 카메라 권한을 요청한다.
9. `brushing.start`가 발급한 서명된 시도 토큰으로 타이머를 시작한다.
10. 타이머가 끝날 때까지 제출 버튼은 비활성화한다.
11. 완료 제출 성공 후 오늘 칸에 원형 캐릭터 도장 이미지가 위에서 내려와 찍힌다.
12. 보상일이면 보물상자 연출 후 새 스킨을 지급한다.
13. 목표 일수를 채우면 왕관을 지급하고 최종 소감을 한 번만 받는다.

브라우저 데이터가 삭제되거나 휴대폰이 바뀌면 학생 정보를 다시 입력해 기존 기록을 연결한다. 번호와 이름이 같은 기존 기록이 둘 이상이면 자동 병합하지 않고 관리자 확인 대상으로 처리한다.

## 5. 관리자 사용자 흐름

1. 관리자가 별도 `/admin` 주소에서 비밀번호로 로그인한다.
2. 대시보드에서 전체 참여 학생, 오늘 참여, 완주 학생 수를 확인한다.
3. 챌린지 이름, 기간, 목표 일수, 양치 시간, 하루 인정 횟수를 설정한다.
4. 보상 일수와 지급 스킨을 연결한다.
5. 생성된 학생 참여 링크와 QR 이미지를 내려받아 배포한다.
6. 학생별 도장 수, 최근 참여일, 완주 상태와 소감을 조회한다.
7. 투명 배경 PNG/WebP 스킨을 업로드한다.
8. 얼굴 미리보기에서 기준점, 크기, 회전 보정값을 조절하고 활성화한다.

학교 Google 계정 로그인은 사용하지 않는다. 관리자 비밀번호의 솔트와 해시는 Apps Script Script Properties에 보관한다. 로그인 성공 시 충분히 긴 임의 토큰을 발급하고, 토큰 해시만 CacheService에 약 4시간 보관한다. 원본 비밀번호와 원본 세션 토큰은 Sheets에 저장하지 않는다.

## 6. 화면 목록

### 학생 화면

| ID | 화면 | 핵심 내용 |
|---|---|---|
| S1 | QR 진입·학생 확인 | 자동 로그인, 최초 정보 입력, 다른 학생으로 참여 |
| S2 | 학생 홈 | 전체 도장판, 성공 일수, 다음 보상, 오늘 도전 |
| S3 | 시간 선택·카메라 안내 | 1분/3분, 미저장 안내, 권한 요청 |
| S4 | AR 양치 | 전면 카메라, 스킨, 타이머, 얼굴 이탈 안내 |
| S5 | 완료·도장 | 제출 상태, 원형 도장 이미지 애니메이션 |
| S6 | 보상·컬렉션 | 보물상자, 획득/잠금 스킨, 착용 선택 |
| S7 | 완주·소감 | 왕관, 최종 통계, 1회 소감 |

### 관리자 화면

| ID | 화면 | 핵심 내용 |
|---|---|---|
| A1 | 관리자 로그인 | 비밀번호, 오류, 세션 만료 안내 |
| A2 | 운영 대시보드 | 참여·오늘 참여·완주 요약 |
| A3 | 챌린지 생성·편집 | 기간, 목표, 시간, 일일 한도, 보상 규칙 |
| A4 | QR 배포 | 참여 링크, QR 미리보기, 이미지 저장 |
| A5 | 참여 현황 | 학생별 도장, 최근 참여일, 완주, 소감 |
| A6 | 스킨 관리 | 업로드, 보정, 보상 연결, 활성·비활성 |

### 공통 상태 화면

- 네트워크 오류와 재시도
- 카메라 권한 거부
- MediaPipe 로딩 실패
- 이미 인정된 참여
- 챌린지 시작 전 또는 종료 후
- 유효하지 않은 QR
- 관리자 세션 만료

## 7. 스탬프와 보상 UX

도장판은 목표 일수만큼 같은 크기의 원형 빈 칸을 만든다. 좁은 화면에서는 줄바꿈해 원의 크기와 터치 가독성을 유지한다. 완료된 칸에는 사용자가 제공한 캐릭터의 얼굴과 V 손동작이 포함된 원형 도장 이미지를 표시한다.

오늘의 제출이 서버에서 성공하면 손잡이가 달린 물리적 도장 이미지를 보여주지 않는다. 완성된 원형 도장 PNG/WebP 자체가 화면 위에서 오늘 칸으로 내려오고, 짧은 압축·반동·잉크 번짐 효과와 함께 자리에 남는다. `prefers-reduced-motion` 사용자는 이동 애니메이션 없이 도장이 즉시 나타난다.

챌린지는 `stampAssetId`를 가진다. 기본 캐릭터 도장은 프로젝트의 초기 에셋으로 제공하며, 향후 관리자가 별도의 원형 도장 PNG/WebP를 업로드해 챌린지별로 교체할 수 있다. 5일과 10일은 동일 컴포넌트가 목표 일수에 맞춰 칸 수만 변경한다.

보상은 서버 응답이 `newRewards`를 반환할 때만 연다. 상자를 누른 뒤 스킨 이름과 이미지를 공개하고, 즉시 착용 또는 컬렉션 저장을 선택한다. 최종 목표일에는 일반 보상 대신 양치왕 왕관과 완주 화면을 우선 표시한다.

## 8. Google Sheets 구조

### Challenges

- `challengeId`, `name`, `startDate`, `endDate`, `targetDays`, `timeZone`
- `durationMode`: `60`, `180`, `choice`
- `dailyLimit`, `stampAssetId`, `status`, `createdAt`, `updatedAt`

### Students

- `studentId`, `challengeId`, `grade`, `classNo`, `studentNo`, `name`
- `createdAt`, `updatedAt`, `status`

초기 조회 키는 `challengeId + grade + classNo + studentNo + normalizedName`이며, 외부 인터페이스는 항상 `studentId`를 사용한다.

### DeviceSessions

- `tokenHash`, `studentId`, `challengeId`
- `createdAt`, `expiresAt`, `lastUsedAt`, `revokedAt`

휴대폰 `localStorage`에는 원본 임의 토큰과 challengeId만 저장한다. 이름과 참여 기록 전체는 저장하지 않는다.

### Completions

- `completionId`, `idempotencyKey`, `challengeId`, `studentId`
- `participationDate`, `attemptId`, `attemptIndex`, `selectedDurationSec`, `elapsedSec`
- `faceDetectedSec`, `cameraMode`, `completed`, `stampGranted`, `createdAt`

`participationDate`는 클라이언트가 보내는 날짜를 신뢰하지 않고 챌린지 `timeZone`과 서버 수신 시각으로 계산한다. `faceDetectedSec`는 MediaPipe를 사용하지 못한 경우 빈 값이며, 참여 실패로 간주하지 않는다.

### Assets

- `assetId`, `assetType`: `skin` 또는 `stamp`
- `name`, `driveFileId`, `mimeType`, `version`, `enabled`, `createdAt`

스킨과 도장은 학생에게 공개되는 일반 그래픽 에셋이므로 전용 Drive 폴더에서 링크 공개 읽기 권한으로 제공한다. 학생 개인정보가 포함된 파일은 이 폴더에 넣지 않는다. 계정 정책상 링크 공개가 불가능하면 빌드 시 정적 에셋으로 복사하는 대체 방식을 사용한다.

### Skins

- `skinId`, `assetId`, `anchorX`, `anchorY`, `scale`, `rotationOffset`
- `rarity`, `enabled`, `sortOrder`

### RewardRules

- `challengeId`, `milestoneDay`, `skinId`, `rewardType`, `sortOrder`

### StudentSkins

- `studentId`, `skinId`, `sourceChallengeId`, `unlockedAt`, `isEquipped`

### Feedback

- `challengeId`, `studentId`, `text`, `submittedAt`

`challengeId + studentId` 조합에 하나만 허용한다.

## 9. Google Apps Script API

Apps Script Web App의 `doGet`과 `doPost`는 `action` 값을 라우터로 전달한다. 브라우저는 Apps Script에 직접 접근하되 CORS 사전 요청을 피하도록 단순 요청 형식과 `text/plain` JSON 본문을 사용한다. 응답은 항상 `{ ok, data, error }` 형태다.

### 학생 API

| Action | 목적 | 인증 |
|---|---|---|
| `challenge.get` | 공개 챌린지 설정과 활성 에셋 조회 | 없음 |
| `student.join` | 기존 학생 연결 또는 신규 생성과 기기 세션 발급 | 없음 + 입력 제한 |
| `session.resume` | 기기 토큰으로 학생과 진행상황 복구 | 학생 토큰 |
| `progress.get` | 도장, 보상, 보유·착용 스킨 조회 | 학생 토큰 |
| `brushing.start` | 선택 시간을 검증하고 시작 시각이 서명된 시도 토큰 발급 | 학생 토큰 |
| `completion.submit` | 완료 검증, 중복 방지, 도장·보상 지급 | 학생 토큰 |
| `skin.equip` | 보유한 스킨 착용 | 학생 토큰 |
| `feedback.submit` | 완주 후 소감 1회 저장 | 학생 토큰 |

### 관리자 API

| Action | 목적 | 인증 |
|---|---|---|
| `admin.login` | 비밀번호 검증과 관리자 세션 발급 | 비밀번호 |
| `admin.challenge.save` | 챌린지와 보상 규칙 생성·수정 | 관리자 토큰 |
| `admin.dashboard.get` | 참여 요약과 학생별 현황 조회 | 관리자 토큰 |
| `admin.asset.upload` | 크기 제한된 PNG/WebP를 Drive에 저장 | 관리자 토큰 |
| `admin.skin.save` | 스킨 보정값과 활성 상태 저장 | 관리자 토큰 |
| `admin.qr.get` | 챌린지 참여 URL 반환 | 관리자 토큰 |

### 완료 제출 트랜잭션

1. 학생 토큰, challengeId, 학생 소속을 검증한다.
2. 서명된 시도 토큰, 챌린지 기간, 선택 시간과 최소 경과시간을 검증한다.
3. 챌린지 시간대와 서버 시각으로 참여 날짜를 계산한다.
4. `idempotencyKey`가 이미 처리됐으면 이전 성공 응답을 반환한다.
5. 학생·날짜 잠금을 획득하고 오늘 인정 횟수를 다시 계산한다.
6. Completions 행을 기록하고 도장 인정 여부를 확정한다.
7. 누적 성공 일수로 새 보상을 계산하고 StudentSkins를 갱신한다.
8. 도장판, 누적 일수, 새 보상, 완주 여부를 한 응답으로 반환한다.

## 10. Next.js 프로젝트 구조

```text
src/
  app/
    (student)/
      page.tsx
      brush/page.tsx
      collection/page.tsx
      completion/page.tsx
    admin/
      login/page.tsx
      page.tsx
      challenges/page.tsx
      skins/page.tsx
    layout.tsx
    error.tsx
  features/
    student-session/
    challenges/
    brushing-session/
    stamp-board/
    rewards/
    skins/
    feedback/
    admin/
  components/ui/
  lib/
    api/
    camera/
    mediapipe/
    device-session/
    retry/
    validation/
    dates/
  types/
  test/
apps-script/
  router/
  handlers/
  services/
  repositories/
  security/
  sheets-schema/
public/
  assets/
```

각 feature는 필요한 컴포넌트, 상태 훅, 순수 규칙 함수, 테스트를 함께 가진다. `lib/api`는 `ChallengeRepository`, `StudentSessionRepository`, `CompletionRepository`, `SkinRepository` 인터페이스를 제공하며 Apps Script 세부 형식을 feature에서 숨긴다.

## 11. MediaPipe와 AR 스킨 구현

1. `getUserMedia({ video: { facingMode: "user" }, audio: false })`로 전면 카메라를 연다.
2. video 요소는 `playsInline`을 사용하고 화면에 좌우 반전해 표시한다.
3. Face Landmarker는 클라이언트에서 한 번만 지연 로딩하고 얼굴 하나만 처리한다.
4. 매 화면 프레임을 모두 분석하지 않고 최대 약 15fps로 제한한다.
5. 양쪽 눈 기준점으로 눈 사이 거리와 기울기를 계산한다.
6. 이마 기준점, 눈 사이 거리, 기울기로 스킨의 위치·크기·회전을 계산한다.
7. 지수 이동평균으로 각 값을 보간해 떨림을 줄인다.
8. 영상과 동일 크기의 Canvas에 관리자 보정값을 적용한 PNG/WebP를 그린다.
9. `performance.now()` 차이로 얼굴 감지 누적시간을 계산한다.
10. 랜드마크 배열은 현재 프레임 계산 후 폐기하고 로깅·저장하지 않는다.

얼굴이 사라져도 타이머는 계속된다. 일정 시간 얼굴이 없으면 안내 문구만 표시한다. 카메라 권한 거부나 MediaPipe 실패 시 `cameraMode`를 `timer-only`로 기록하고 AR과 얼굴 감지시간 없이 완료할 수 있다.

## 12. 개인정보 최소수집과 보안

### 저장하는 값

- challengeId, 학년, 반, 번호, 이름
- 참여일, 선택 시간, 실제 진행시간, 얼굴 감지 누적시간
- 완료와 도장 인정 여부
- 보유·착용 스킨, 누적 성공 일수
- 완주 후 한 번 작성한 소감

### 저장하지 않는 값

- 카메라 영상과 음성
- 얼굴 사진과 캡처 이미지
- 얼굴 랜드마크 좌표
- 얼굴 특징값과 생체 템플릿
- 기기에 저장된 원본 세션 토큰의 서버 사본

학생 이름은 대시보드에서 기본적으로 성만 남기고 마스킹해 보여주며, 관리자 상세 화면에서만 전체 이름을 확인한다. API 오류 로그에는 이름, 토큰, 소감 본문을 기록하지 않는다. 스킨 파일은 MIME 형식, 확장자, 최대 용량을 검증한다. HTML이나 SVG 업로드는 초기 버전에서 허용하지 않는다.

## 13. 오류 처리와 복구

- 제출 버튼은 첫 클릭 즉시 잠그고 처리 중 상태를 표시한다.
- 네트워크 실패 시 완료 요청과 idempotencyKey를 기기에 임시 보관한다.
- 다시 연결되면 같은 키로 재시도하며 서버는 한 번만 처리한다.
- 완료 성공 응답을 받기 전에는 도장과 보상을 확정 표시하지 않는다.
- 진행 중 새로고침 시 시작 시각과 선택 시간을 복구하되, 백그라운드 체류를 무조건 양치시간으로 인정하지 않는다.
- 카메라 스트림은 완료, 취소, 페이지 이탈 때 모든 트랙을 중지한다.
- 챌린지 종료 후에는 기존 기록을 읽을 수 있지만 새 참여는 막는다.
- Apps Script 또는 Sheets 장애 시 학생에게 기록 보류 상태와 재시도 버튼을 제공한다.
- 관리자 세션이 만료되면 저장하지 않은 입력을 브라우저에 보존한 채 다시 로그인시킨다.

## 14. 단계별 개발 계획

### Phase 1 — 배포 가능한 기본 MVP

- Next.js와 TypeScript 프로젝트 기반
- 학생 입력, 학생 연결, 기기 자동 로그인
- 챌린지 설정 조회와 1분/3분 선택
- 카메라 실행, 미저장 안내, 타이머
- 완료 제출, idempotency, 중복 방지
- Sheets 기록과 진행 복구

완료 기준: QR로 최초 참여한 학생이 양치를 완료하고, 같은 휴대폰으로 재접속해 기존 참여 기록을 자동 복구한다.

### Phase 2 — 챌린지와 관리자 운영

- 5일, 10일, 직접 설정
- 목표 일수별 원형 도장판
- 원형 캐릭터 도장 이미지 애니메이션
- 관리자 로그인, 챌린지 생성, QR
- 학생별·반별 참여 현황

완료 기준: 관리자가 챌린지를 만들고 여러 학생의 일별 참여와 완주 상태를 조회한다.

### Phase 3 — MediaPipe AR

- Face Landmarker 로딩과 얼굴 감지
- 프로젝트에 포함된 기본 테스트 스킨
- 스킨 위치, 크기, 회전과 흔들림 보정
- Canvas 2D 렌더링
- 얼굴 감지시간 누적
- 권한 거부와 모델 실패 대체 모드

완료 기준: iPhone Safari와 Android Chrome에서 스킨이 안정적으로 머리를 따라가며, 실패 시 타이머 전용 모드로 전환된다.

### Phase 4 — 게임화와 완주

- 관리자 스킨 업로드와 보정 미리보기
- 보상 규칙과 보물상자 애니메이션
- 스킨 컬렉션과 착용
- 왕관 최종 보상
- 완주 후 한 번만 작성하는 소감

완료 기준: 관리자가 재배포 없이 새 스킨을 추가하고 학생이 획득, 착용, 완주, 소감 제출까지 완료한다.

## 15. 테스트 전략

- 단위 테스트: 날짜 경계, 하루 인정 횟수, 누적 성공 일수, 보상 해금, 시간 계산
- API 테스트: 중복 제출 키, 만료·변조 토큰, 관리자 세션, 시트 쓰기 실패
- 컴포넌트 테스트: 자동 로그인, 타이머 상태, 도장·보상 상태 전환
- 브라우저 테스트: 최초 참여부터 기록 복구까지 핵심 흐름
- 실기기 테스트: iPhone Safari, Android Chrome, 카메라 거부, 저속 네트워크
- 개인정보 테스트: 요청 본문, 로그, localStorage에 금지 데이터가 없는지 확인

## 16. 배포 구조

1. 사용자의 Google 계정에 전용 Spreadsheet와 Drive 폴더를 생성한다.
2. Apps Script를 사용자 권한으로 실행하고 학생 접근이 가능한 Web App으로 배포한다.
3. Script Properties에 시트 ID, Drive 폴더 ID, 관리자 비밀번호 솔트·해시를 저장한다.
4. Next.js를 HTTPS 호스팅에 배포하고 Apps Script URL을 환경변수로 설정한다.
5. 관리자에서 첫 챌린지를 생성하고 QR을 내려받는다.
6. 실제 iOS와 Android 기기에서 카메라 권한, 완료 제출, 자동 로그인을 점검한다.

## 17. 구현 시 지켜야 할 결정

- 첫 구현 범위는 Phase 1이며, 이후 Phase는 기존 기록과 스키마를 깨뜨리지 않는 추가 방식으로 개발한다.
- 학생은 개인 휴대폰 사용을 전제로 하되 `다른 학생으로 참여하기`를 항상 제공한다.
- 소감은 목표 일수를 모두 채운 뒤 한 번만 작성한다.
- 관리자 인증은 Google 로그인이 아닌 별도 비밀번호와 만료 세션을 사용한다.
- 스킨과 도장 이미지는 관리자가 업로드 가능한 에셋 구조를 사용한다.
- 카메라와 MediaPipe 실패는 참여 실패가 아니며 타이머 전용 모드를 허용한다.
- 도장·보상 애니메이션은 서버 성공 응답 이후에만 실행한다.

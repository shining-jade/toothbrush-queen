# 양치왕 Phase 1 배포 안내

## 1. Google Sheets 준비

하나의 스프레드시트에 아래 네 탭을 만들고, 각 탭의 첫 행에 헤더를 순서대로 입력한다. 이름과 순서가 다르면 서버가 `SHEET_SCHEMA_MISMATCH`로 중단된다.

- `Challenges`: `challengeId`, `name`, `startDate`, `endDate`, `targetDays`, `timeZone`, `durationMode`, `dailyLimit`, `status`, `createdAt`, `updatedAt`
- `Students`: `studentId`, `challengeId`, `grade`, `classNo`, `studentNo`, `name`, `createdAt`, `updatedAt`, `status`
- `DeviceSessions`: `tokenHash`, `studentId`, `challengeId`, `createdAt`, `expiresAt`, `lastUsedAt`, `revokedAt`
- `Completions`: `completionId`, `idempotencyKey`, `challengeId`, `studentId`, `participationDate`, `attemptId`, `attemptIndex`, `selectedDurationSec`, `elapsedSec`, `faceDetectedSec`, `cameraMode`, `completed`, `stampGranted`, `createdAt`

`Challenges`에는 최소 한 행을 넣는다. `challengeId`는 영문 대문자와 숫자 6~24자이며 QR 주소는 `https://웹주소/?challenge=ABC123` 형식이다. 날짜는 `YYYY-MM-DD`, `timeZone`은 `Asia/Seoul`, `status`는 운영 중일 때 `active`로 입력한다.

## 2. Apps Script 배포

1. Apps Script 프로젝트 설정의 스크립트 속성에 `SPREADSHEET_ID`와 충분히 긴 무작위 `ATTEMPT_SIGNING_SECRET`을 저장한다.
2. `pnpm install` 후 `pnpm gas:build`를 실행한다.
3. 생성된 `apps-script/dist/Code.js` 내용을 Apps Script 프로젝트의 `Code.js`에 업로드한다.
4. 웹 앱으로 새 배포한다. 실행 사용자는 소유자, 접근 권한은 QR을 사용할 학생이 로그인 없이 접근 가능한 범위로 설정한다.
5. 배포 URL을 복사한다. 새 버전을 올릴 때마다 웹 앱 배포를 업데이트한다.

원본 기기 토큰은 Sheets에 저장하지 않는다. `DeviceSessions`에는 해시만 기록되어야 한다.

## 3. Next.js 배포

1. `.env.example`을 참고해 `NEXT_PUBLIC_APPS_SCRIPT_URL`에 Apps Script `/exec` URL을 설정한다.
2. `pnpm verify`를 실행한다.
3. Next.js 앱을 HTTPS 환경에 배포한다. 카메라는 HTTPS 또는 로컬호스트에서만 정상 요청된다.
4. 배포된 주소에 챌린지 코드를 붙여 QR을 만든다: `https://웹주소/?challenge=ABC123`.

## 4. 출시 전 점검

- iPhone Safari에서 카메라 허용 후 60초 양치와 완료 기록을 확인한다.
- Android Chrome에서 카메라 허용 후 같은 흐름을 확인한다.
- 두 기기에서 카메라를 거부해도 타이머 전용으로 완료되는지 확인한다.
- 전송 중 네트워크를 끊었다가 `다시 전송하기`를 눌러 `Completions`에 한 행만 생기는지 확인한다.
- 같은 휴대폰에서 QR을 다시 열어 학생 정보 재입력 없이 진행 일수가 복원되는지 확인한다.
- 브라우저 네트워크 기록과 애플리케이션 로그에 학생 이름, 원본 기기 토큰, 이미지, 영상, 얼굴 좌표가 없는지 확인한다.
- Sheets 열에 이미지·영상·얼굴 랜드마크용 필드가 없는지 확인한다.

실제 iPhone과 Android의 카메라 허용 검사는 자동 테스트로 대체할 수 없으므로 매 배포마다 수동으로 수행한다.

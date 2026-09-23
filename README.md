# 양치왕

학생이 QR로 참여하고, 같은 개인 휴대폰에서 자동으로 참여 정보를 복원하며, 카메라 또는 타이머 전용 모드로 양치 기록을 남기는 모바일 중심 웹앱이다.

Phase 1에는 다음 기능이 포함된다.

- 학년·반·번호·이름으로 최초 참여
- 챌린지별 기기 자동로그인
- 카메라 개인정보 안내와 권한 거부 시 타이머 전용 전환
- 60초·180초·자유 양치 타이머
- 고양이·토끼·곰 AR 스킨 선택과 마지막 날 양치왕 왕관
- 관리자 비밀번호 로그인과 PNG·WebP AR 스킨 업로드·위치 보정·활성화
- 활성화한 관리자 스킨을 학생 선택 화면에 재배포 없이 자동 반영
- 기기 내 MediaPipe 얼굴 추적(영상·사진·얼굴 좌표 저장 없음)
- 서명된 시도 토큰과 중복 방지 완료 기록
- 네트워크 장애 시 로컬 보관과 동일 키 재전송
- Google Sheets 기반 Apps Script API

## 로컬 실행

```bash
pnpm install
copy .env.example .env.local
pnpm dev
```

`.env.local`의 `NEXT_PUBLIC_APPS_SCRIPT_URL`을 실제 Apps Script 웹 앱 URL로 바꾼 뒤 `http://localhost:3000/?challenge=ABC123`을 연다.

관리자는 `http://localhost:3000/admin`에서 로그인한다. 학교·구글 계정 로그인은 사용하지 않으며, 스크립트 속성에 설정한 단일 관리자 비밀번호만 사용한다.

## 검증

```bash
pnpm verify
```

단위·컴포넌트 테스트, 정적 검사, Apps Script 번들, Next.js 프로덕션 빌드, 모바일 Chromium 브라우저 여정을 모두 실행한다.

배포 절차와 실기기 점검표는 [Phase 1 배포 안내](docs/deployment/phase-1.md)를 따른다. 완주 소감은 다음 단계 범위다.

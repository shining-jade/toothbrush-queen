# 양치의 여왕

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

## 다른 학교에 배포하기

다른 학교가 자기 계정으로 독립된 복사본을 운영하도록 넘겨줄 수 있다. 구글시트 쪽은 [설치 마법사 메뉴](docs/deployment/new-school-quickstart.md)가 탭 생성·비밀번호·보안키·Drive 폴더·첫 챌린지 추가를 클릭 몇 번으로 끝내준다. 화면(Next.js) 쪽은 아래 버튼으로 그 학교의 Vercel 계정에 바로 배포한다.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fshining-jade%2Ftoothbrush-queen&env=NEXT_PUBLIC_APPS_SCRIPT_URL&envDescription=%EC%95%B1%EC%8A%A4%20%EC%8A%A4%ED%81%AC%EB%A6%BD%ED%8A%B8%20%EC%9B%B9%20%EC%95%B1%20%EB%B0%B0%ED%8F%AC%20URL%20(.../exec)&project-name=brush-king&repository-name=brush-king)

전체 절차는 [새 학교 빠른 시작 안내](docs/deployment/new-school-quickstart.md)를 참고한다.

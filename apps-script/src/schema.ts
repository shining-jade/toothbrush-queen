export const SHEET_TITLES = {
  Challenges: "챌린지",
  Students: "학생",
  DeviceSessions: "기기세션",
  Completions: "완료기록",
  Assets: "자산",
  Skins: "스킨",
} as const;

export const SHEET_SCHEMAS = {
  Challenges: [
    "챌린지ID", "챌린지명", "시작일", "종료일", "목표일수", "시간대",
    "시간모드", "일일제한", "상태", "생성일시", "수정일시",
  ],
  Students: [
    "학생ID", "챌린지ID", "학년", "반", "번호", "이름", "생성일시", "수정일시", "상태",
  ],
  DeviceSessions: [
    "토큰해시", "학생ID", "챌린지ID", "생성일시", "만료일시", "최종사용일시", "폐기일시",
  ],
  Completions: [
    "완료ID", "중복방지키", "챌린지ID", "학생ID", "참여일", "시도ID", "시도회차",
    "선택시간초", "실제시간초", "얼굴인식시간초", "카메라모드", "완료여부",
    "도장지급여부", "소감", "생성일시",
  ],
  Assets: [
    "자산ID", "자산유형", "이름", "Drive파일ID", "공개URL", "파일형식",
    "파일크기", "버전", "생성일시",
  ],
  Skins: [
    "스킨ID", "자산ID", "기준점X", "기준점Y", "크기", "회전보정",
    "사용여부", "정렬순서", "수정일시",
  ],
} as const;

export type SheetTab = keyof typeof SHEET_SCHEMAS;

export function assertSheetHeaders(tab: SheetTab, actualHeaders: unknown[]) {
  const expected = SHEET_SCHEMAS[tab];
  const matches =
    actualHeaders.length === expected.length &&
    expected.every((header, index) => actualHeaders[index] === header);
  if (!matches) throw new Error(`SHEET_SCHEMA_MISMATCH:${tab}`);
}

// Menu-driven setup wizard for non-technical admins. Opening the spreadsheet adds a
// "🦷 양치왕 설치" menu; each item does by click what docs/deployment/phase-1.md otherwise
// asks a teacher to do by hand (create sheet tabs, pick a password, make a Drive folder,
// add the first challenge row). It never touches PropertiesService values it already holds
// without asking, so re-running a step is safe.
import { SHEET_SCHEMAS, SHEET_TITLES, type SheetTab } from "../schema";

const SHEET_TABS = Object.keys(SHEET_TITLES) as SheetTab[];
const CHALLENGE_ID_LENGTH = 8;
const CHALLENGE_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function bytesToHex(bytes: number[]) {
  return bytes.map((byte) => ((byte + 256) % 256).toString(16).padStart(2, "0")).join("");
}

function sha256Hex(value: string) {
  return bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value));
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateChallengeId() {
  let id = "";
  for (let index = 0; index < CHALLENGE_ID_LENGTH; index += 1) {
    id += CHALLENGE_ID_ALPHABET[Math.floor(Math.random() * CHALLENGE_ID_ALPHABET.length)];
  }
  return id;
}

function ensureSheets(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet) {
  const created: string[] = [];
  const fixed: string[] = [];
  for (const tab of SHEET_TABS) {
    const title = SHEET_TITLES[tab];
    const headers = SHEET_SCHEMAS[tab];
    let sheet = spreadsheet.getSheetByName(title);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(title);
      created.push(title);
    }
    const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const matches = existingHeaders.length === headers.length
      && headers.every((header, index) => existingHeaders[index] === header);
    if (matches) continue;
    sheet.getRange(1, 1, 1, headers.length).setValues([[...headers]]);
    sheet.setFrozenRows(1);
    if (!created.includes(title)) fixed.push(title);
  }
  // Every new Google Sheet starts with one empty default tab; drop it once real tabs exist.
  const defaultSheet = spreadsheet.getSheetByName("Sheet1") ?? spreadsheet.getSheetByName("시트1");
  if (defaultSheet && spreadsheet.getSheets().length > SHEET_TABS.length && defaultSheet.getLastRow() === 0) {
    spreadsheet.deleteSheet(defaultSheet);
  }
  return { created, fixed };
}

function setupSheets() {
  const ui = SpreadsheetApp.getUi();
  const { created, fixed } = ensureSheets(SpreadsheetApp.getActiveSpreadsheet());
  const parts: string[] = [];
  if (created.length) parts.push(`새로 만든 탭: ${created.join(", ")}`);
  if (fixed.length) parts.push(`헤더를 맞춘 탭: ${fixed.join(", ")}`);
  ui.alert(
    "1단계 완료",
    parts.length ? parts.join("\n") : "모든 탭이 이미 올바르게 준비되어 있어요.",
    ui.ButtonSet.OK,
  );
}

function setupSecurity() {
  const ui = SpreadsheetApp.getUi();
  const properties = PropertiesService.getScriptProperties();

  properties.setProperty("SPREADSHEET_ID", SpreadsheetApp.getActiveSpreadsheet().getId());

  const passwordResponse = ui.prompt(
    "2단계: 관리자 비밀번호",
    "관리자 화면(/admin)에 로그인할 비밀번호를 입력하세요. 4자 이상, 다른 학교와 다르게 설정하세요.",
    ui.ButtonSet.OK_CANCEL,
  );
  if (passwordResponse.getSelectedButton() !== ui.Button.OK) return;
  const password = passwordResponse.getResponseText().trim();
  if (password.length < 4) {
    ui.alert("비밀번호가 너무 짧아요. 메뉴를 다시 눌러 시도해주세요.");
    return;
  }

  const salt = Utilities.getUuid();
  properties.setProperty("ADMIN_PASSWORD_SALT", salt);
  properties.setProperty("ADMIN_PASSWORD_HASH", sha256Hex(`${salt}:${password}`));
  properties.setProperty(
    "ATTEMPT_SIGNING_SECRET",
    `${Utilities.getUuid()}${Utilities.getUuid()}`.replaceAll("-", ""),
  );

  ui.alert(
    "2단계 완료",
    "이 시트 ID와 관리자 비밀번호, 보안키가 저장됐어요.\n비밀번호는 다시 보여줄 수 없으니 따로 적어두세요.",
    ui.ButtonSet.OK,
  );
}

function setupSkinFolder() {
  const ui = SpreadsheetApp.getUi();
  const properties = PropertiesService.getScriptProperties();
  const existingFolderId = properties.getProperty("SKIN_ASSET_FOLDER_ID");
  if (existingFolderId) {
    try {
      const folder = DriveApp.getFolderById(existingFolderId);
      ui.alert("이미 설정됨", `스킨 이미지 폴더가 이미 연결되어 있어요: ${folder.getName()}`, ui.ButtonSet.OK);
      return;
    } catch {
      // Stored folder is no longer reachable (deleted, wrong account) — make a fresh one below.
    }
  }
  const folder = DriveApp.createFolder(`${SpreadsheetApp.getActiveSpreadsheet().getName()} - 양치왕 스킨 이미지`);
  properties.setProperty("SKIN_ASSET_FOLDER_ID", folder.getId());
  ui.alert("3단계 완료", `전용 Drive 폴더를 만들었어요.\n${folder.getUrl()}`, ui.ButtonSet.OK);
}

function addChallenge() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TITLES.Challenges);
  if (!sheet) {
    ui.alert("먼저 1단계(시트 초기화)를 실행해주세요.");
    return;
  }

  const nameResponse = ui.prompt("4단계: 챌린지 이름", "예: 2026년 1학기 양치왕 챌린지", ui.ButtonSet.OK_CANCEL);
  if (nameResponse.getSelectedButton() !== ui.Button.OK) return;
  const name = nameResponse.getResponseText().trim();
  if (!name) return;

  const daysResponse = ui.prompt("목표 일수", "며칠 동안 진행할까요? 숫자만 입력하세요 (예: 5)", ui.ButtonSet.OK_CANCEL);
  if (daysResponse.getSelectedButton() !== ui.Button.OK) return;
  const targetDays = Number(daysResponse.getResponseText().trim());
  if (!Number.isInteger(targetDays) || targetDays < 1 || targetDays > 365) {
    ui.alert("목표 일수는 1~365 사이의 숫자여야 해요. 메뉴를 다시 눌러 시도해주세요.");
    return;
  }

  const challengeId = generateChallengeId();
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + (targetDays - 1) * 24 * 60 * 60 * 1000);
  const timestamp = new Date().toISOString();

  sheet.appendRow([
    challengeId, name, formatDate(startDate), formatDate(endDate), targetDays,
    "Asia/Seoul", "choice", 1, "active", timestamp, timestamp,
  ]);

  ui.alert(
    "4단계 완료",
    [
      "챌린지가 추가됐어요.",
      "",
      `챌린지 코드: ${challengeId}`,
      "",
      `배포된 웹 주소 뒤에 ?challenge=${challengeId} 를 붙이면 학생용 QR 주소가 돼요.`,
    ].join("\n"),
    ui.ButtonSet.OK,
  );
}

function showStatus() {
  const ui = SpreadsheetApp.getUi();
  const properties = PropertiesService.getScriptProperties();
  const mark = (value: string | null, hint: string) => (value ? "✅ 설정됨" : `❌ 미설정 (${hint})`);
  ui.alert(
    "설정 상태",
    [
      `이 시트 연결: ${mark(properties.getProperty("SPREADSHEET_ID"), "2단계 실행")}`,
      `관리자 비밀번호: ${mark(properties.getProperty("ADMIN_PASSWORD_HASH"), "2단계 실행")}`,
      `보안키: ${mark(properties.getProperty("ATTEMPT_SIGNING_SECRET"), "2단계 실행")}`,
      `스킨 이미지 폴더: ${mark(properties.getProperty("SKIN_ASSET_FOLDER_ID"), "3단계 실행")}`,
      "",
      "마지막으로 남은 수동 단계:",
      "상단 메뉴 [배포] > [새 배포] > 유형에서 '웹 앱' 선택 > 배포.",
      "실행 사용자: 나, 액세스 권한: 모든 사용자(익명 포함 가능).",
      "배포 후 나오는 주소(.../exec)를 복사해 화면 배포(Vercel) 설정에 붙여넣으세요.",
    ].join("\n"),
    ui.ButtonSet.OK,
  );
}

function buildInstallerMenu(ui: GoogleAppsScript.Base.Ui) {
  ui.createMenu("🦷 양치왕 설치")
    .addItem("1단계: 시트 초기화", "bkSetupSheets")
    .addItem("2단계: 보안 설정 (비밀번호)", "bkSetupSecurity")
    .addItem("3단계: 스킨 이미지 폴더 만들기", "bkSetupSkinFolder")
    .addSeparator()
    .addItem("4단계: 챌린지 추가", "bkAddChallenge")
    .addSeparator()
    .addItem("설정 상태 확인 / 남은 단계 안내", "bkShowStatus")
    .addToUi();
}

export const installWizard = {
  onOpen: () => buildInstallerMenu(SpreadsheetApp.getUi()),
  setupSheets,
  setupSecurity,
  setupSkinFolder,
  addChallenge,
  showStatus,
};

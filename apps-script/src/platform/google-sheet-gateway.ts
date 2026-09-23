import { assertSheetHeaders, SHEET_SCHEMAS, SHEET_TITLES, type SheetTab } from "../schema";
import type { SheetGateway } from "./sheet-gateway";

export class GoogleSheetGateway implements SheetGateway {
  private spreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
    const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (!id) throw new Error("SPREADSHEET_ID_MISSING");
    return SpreadsheetApp.openById(id);
  }

  private sheet(tab: SheetTab) {
    const sheet = this.spreadsheet().getSheetByName(SHEET_TITLES[tab]);
    if (!sheet) throw new Error(`SHEET_MISSING:${SHEET_TITLES[tab]}`);
    const width = SHEET_SCHEMAS[tab].length;
    const headers = sheet.getRange(1, 1, 1, width).getValues()[0];
    assertSheetHeaders(tab, headers);
    return sheet;
  }

  readAll(tab: SheetTab) {
    const sheet = this.sheet(tab);
    const rowCount = sheet.getLastRow() - 1;
    if (rowCount <= 0) return [];
    return sheet.getRange(2, 1, rowCount, SHEET_SCHEMAS[tab].length).getValues();
  }

  append(tab: SheetTab, row: unknown[]) {
    if (row.length !== SHEET_SCHEMAS[tab].length) {
      throw new Error(`ROW_SCHEMA_MISMATCH:${tab}`);
    }
    const sheet = this.sheet(tab);
    sheet.appendRow(row);
    return sheet.getLastRow();
  }

  update(tab: SheetTab, rowIndex: number, row: unknown[]) {
    if (row.length !== SHEET_SCHEMAS[tab].length) {
      throw new Error(`ROW_SCHEMA_MISMATCH:${tab}`);
    }
    this.sheet(tab).getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }

  deleteWhere(tab: SheetTab, predicate: (row: unknown[]) => boolean) {
    const sheet = this.sheet(tab);
    const rowCount = sheet.getLastRow() - 1;
    if (rowCount <= 0) return 0;
    const rows = sheet.getRange(2, 1, rowCount, SHEET_SCHEMAS[tab].length).getValues();
    const sheetRows = rows
      .map((row, index) => predicate(row) ? index + 2 : null)
      .filter((row): row is number => row !== null)
      .reverse();
    sheetRows.forEach((row) => sheet.deleteRow(row));
    return sheetRows.length;
  }
}

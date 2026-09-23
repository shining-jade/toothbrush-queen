import type { SheetGateway, SheetTab } from "../../apps-script/src/platform/sheet-gateway";

export class InMemorySheetGateway implements SheetGateway {
  private readonly tables = new Map<SheetTab, unknown[][]>();
  private readonly appendFailures = new Map<SheetTab, Error>();

  failNextAppend(tab: SheetTab, error: Error) {
    this.appendFailures.set(tab, error);
  }

  readAll(tab: SheetTab) {
    return (this.tables.get(tab) ?? []).map((row) => [...row]);
  }

  append(tab: SheetTab, row: unknown[]) {
    const failure = this.appendFailures.get(tab);
    if (failure) {
      this.appendFailures.delete(tab);
      throw failure;
    }
    const rows = this.tables.get(tab) ?? [];
    rows.push([...row]);
    this.tables.set(tab, rows);
    return rows.length + 1;
  }

  update(tab: SheetTab, rowIndex: number, row: unknown[]) {
    const rows = this.tables.get(tab) ?? [];
    const dataIndex = rowIndex - 2;
    if (dataIndex < 0 || dataIndex >= rows.length) throw new Error("ROW_NOT_FOUND");
    rows[dataIndex] = [...row];
    this.tables.set(tab, rows);
  }

  deleteWhere(tab: SheetTab, predicate: (row: unknown[]) => boolean) {
    const rows = this.tables.get(tab) ?? [];
    const remaining = rows.filter((row) => !predicate([...row]));
    this.tables.set(tab, remaining);
    return rows.length - remaining.length;
  }
}

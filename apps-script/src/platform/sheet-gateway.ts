import type { SheetTab } from "../schema";

export type { SheetTab } from "../schema";

export interface SheetGateway {
  readAll(tab: SheetTab): unknown[][];
  append(tab: SheetTab, row: unknown[]): number;
  update(tab: SheetTab, rowIndex: number, row: unknown[]): void;
  deleteWhere(tab: SheetTab, predicate: (row: unknown[]) => boolean): number;
}

/**
 * Excel 各 sheet 列 → 系统学期的统一映射
 *
 * 功课班/补习/写作：从 29-Dec 列开始
 * 国中/英文/交通/膳食：从 JAN 列开始
 *   第1期 = 2025 第13期（Dec 29 起），之后每列顺序递增
 */

export type TermCol = { col: number; year: number; termIndex: number };

export const DEC_START_SHEET_COLS: TermCol[] = [
  { col: 4, year: 2025, termIndex: 13 },
  { col: 5, year: 2026, termIndex: 1 },
  { col: 6, year: 2026, termIndex: 2 },
  { col: 7, year: 2026, termIndex: 3 },
  { col: 8, year: 2026, termIndex: 4 },
  { col: 9, year: 2026, termIndex: 5 },
  { col: 10, year: 2026, termIndex: 6 },
  { col: 11, year: 2026, termIndex: 7 },
  { col: 12, year: 2026, termIndex: 8 },
  { col: 13, year: 2026, termIndex: 9 },
  { col: 14, year: 2026, termIndex: 10 },
  { col: 15, year: 2026, termIndex: 11 },
  { col: 16, year: 2026, termIndex: 12 },
];

/** JAN=第1期(T13), FEB=第2期(T1), MAR=第3期(T2), APR=第4期(T3), MAY=第5期(T4) ... */
export const JAN_START_SHEET_COLS: TermCol[] = [
  { col: 3, year: 2025, termIndex: 13 },
  { col: 4, year: 2026, termIndex: 1 },
  { col: 5, year: 2026, termIndex: 2 },
  { col: 6, year: 2026, termIndex: 3 },
  { col: 7, year: 2026, termIndex: 4 },
  { col: 8, year: 2026, termIndex: 5 },
  { col: 9, year: 2026, termIndex: 6 },
  { col: 10, year: 2026, termIndex: 7 },
  { col: 11, year: 2026, termIndex: 8 },
  { col: 12, year: 2026, termIndex: 9 },
  { col: 13, year: 2026, termIndex: 10 },
  { col: 14, year: 2026, termIndex: 11 },
  { col: 15, year: 2026, termIndex: 12 },
];

export function termKey(year: number, termIndex: number) {
  return `${year}_${termIndex}`;
}

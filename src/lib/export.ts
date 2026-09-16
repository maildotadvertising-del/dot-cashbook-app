import * as XLSX from "xlsx";

type Row = Record<string, string | number>;

export function exportRows(filename: string, rows: Row[], sheetName = "Sheet1") {
  if (!rows.length) return;
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(book, `${filename.replace(/[\\/:*?"<>|]/g, "-")}.xlsx`);
}

export function exportSheets(filename: string, sheets: { name: string; rows: Row[] }[]) {
  const book = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(rows),
      name.slice(0, 31),
    );
  }
  XLSX.writeFile(book, `${filename.replace(/[\\/:*?"<>|]/g, "-")}.xlsx`);
}

// Exportar una tabla generica (Contabilidad, Sanidad, Lluvia) a Excel, con
// el mismo estilo (header verde) que ya usaba "Planilla de animales".
// Import dinamico: exceljs pesa ~930kb y el boton se usa de vez en cuando.
export type ExcelExportColumn = {
  header: string;
  width?: number;
  numFmt?: string;
};

export type ExcelExportOptions = {
  sheetName: string;
  columns: ExcelExportColumn[];
  rows: Array<Array<string | number | Date | null>>;
  fileName: string;
};

export async function exportRowsToExcel({ sheetName, columns, rows, fileName }: ExcelExportOptions) {
  const ExcelJS = (await import("exceljs")).default;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SaasPro Agro";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });

  const headerRow = sheet.getRow(1);
  headerRow.values = columns.map((column) => column.header);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFDF7" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF217346" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  for (const rowValues of rows) {
    const row = sheet.addRow(rowValues);
    columns.forEach((column, index) => {
      if (column.numFmt) {
        row.getCell(index + 1).numFmt = column.numFmt;
      }
    });
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: "FFE1DCC8" } } };
    });
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  sheet.columns = columns.map((column) => ({ width: column.width ?? 16 }));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

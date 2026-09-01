// Exportar cualquier tabla (Contabilidad, Sanidad, Lluvia, Animales) a PDF.
// Import dinamico igual que exceljs: jspdf + jspdf-autotable pesan y el
// boton se usa de vez en cuando, no tiene sentido sumarlas a la carga
// inicial de toda la app.
export type PdfExportOptions = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  fileName: string;
};

export async function exportRowsToPdf({ title, subtitle, columns, rows, fileName }: PdfExportOptions) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(title, 40, 40);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text(subtitle, 40, 58);
  }

  autoTable(doc, {
    startY: subtitle ? 72 : 56,
    head: [columns],
    body: rows,
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [33, 115, 70], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 244, 236] },
    margin: { left: 40, right: 40 }
  });

  doc.save(fileName);
}

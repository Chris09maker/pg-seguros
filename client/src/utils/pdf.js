// client/src/utils/pdf.js
import jsPDF from "jspdf";
import "jspdf-autotable";

/** ---------------- Bloques auxiliares ---------------- **/

/**
 * Dibuja encabezado superior opcional (logo/título secundario).
 * header = { lines?: string[], draw?: (doc) => void }
 */
function drawOptionalHeader(doc, header) {
  if (!header) return;
  if (typeof header.draw === "function") {
    header.draw(doc);
    return;
  }
  if (Array.isArray(header.lines) && header.lines.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    let y = 30;
    header.lines.forEach((ln) => {
      doc.text(String(ln), 40, y);
      y += 14;
    });
  }
}

/**
 * Dibuja bloque de filtros aplicado (si viene).
 * filters: { [clave]: valor }
 * Devuelve el Y donde terminó de dibujar.
 */
function drawFiltersBlock(doc, filters) {
  const keys = Object.keys(filters || {});
  if (!keys.length) return 90;

  let y = 90;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Filtros:", 40, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  keys.forEach((k) => {
    const v = filters[k];
    doc.text(`• ${k}: ${v ?? ""}`, 46, y);
    y += 12;
  });

  return y + 4;
}

/** ---------------- Exportadores ---------------- **/

/**
 * Exporta una tabla genérica a PDF.
 *
 * Formato A (objetos):
 *   exportTable({ title, columns: [{ header, dataKey }...], rows: [{...}], filters, header, columnStyles })
 *
 * Formato B (matrices):
 *   exportTable({ title, headers: ["Col A","Col B"], rows: [ ["a","b"], ... ], filters, header })
 *
 * Ambos formatos son válidos y se detectan automáticamente.
 */
export function exportTable({
  title,
  columns,       // <-- opcional (formato A)
  headers,       // <-- opcional (formato B)
  rows = [],
  filters = {},
  header,        // bloque opcional arriba
  columnStyles,  // estilos por columna (opcional)
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Título + fecha
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title || "Reporte", 40, 40);

  const today = new Date().toLocaleString();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generado: ${today}`, pageWidth - 40, 40, { align: "right" });

  // Encabezado opcional y filtros
  drawOptionalHeader(doc, header);
  const startY = Math.max(drawFiltersBlock(doc, filters), 110);

  // Detección de formato y render
  const isColumnsMode = Array.isArray(columns) && columns.length > 0;

  if (isColumnsMode) {
    // Formato A: columnas + filas como objetos
    doc.autoTable({
      startY,
      columns,          // [{ header, dataKey }]
      body: rows,       // [{...}]
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [241, 245, 249], textColor: 20 },
      margin: { left: 40, right: 40 },
      theme: "grid",
      columnStyles,     // opcional
      didDrawPage: () => {
        const pageStr = `Página ${doc.getNumberOfPages()}`;
        doc.setFontSize(9);
        doc.text(pageStr, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
      },
    });
  } else {
    // Formato B: headers + body como arreglos
    const safeHeaders = Array.isArray(headers) ? headers : [];
    const safeBody =
      Array.isArray(rows) && rows.length && Array.isArray(rows[0])
        ? rows
        : [];

    doc.autoTable({
      startY,
      head: [safeHeaders],
      body: safeBody,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [241, 245, 249], textColor: 20 },
      margin: { left: 40, right: 40 },
      theme: "grid",
      columnStyles, // puede ignorarse si usas formato B
      didDrawPage: () => {
        const pageStr = `Página ${doc.getNumberOfPages()}`;
        doc.setFontSize(9);
        doc.text(pageStr, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
      },
    });
  }

  // Guardar
  const safeTitle = (title || "reporte").toLowerCase().replace(/\s+/g, "_");
  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`${safeTitle}_${dateTag}.pdf`);
}

/**
 * Exporta un “recibo” de pagos (tabla + total al pie).
 * Úsalo para Reporte de Pagos.
 */
export function exportPagosReceipt({
  title,
  rows,
  totalMonto,
  filters = {},
  header,
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title || "Reporte de pagos", 40, 40);

  // Fecha
  const today = new Date().toLocaleString();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generado: ${today}`, pageWidth - 40, 40, { align: "right" });

  // Encabezado opcional
  drawOptionalHeader(doc, header);

  // Filtros
  const startY = drawFiltersBlock(doc, filters);

  // Definir columnas estándar del recibo
  const columns = [
    { header: "Fecha", dataKey: "fecha" },
    { header: "Póliza", dataKey: "poliza" },
    { header: "Cliente", dataKey: "cliente" },
    { header: "Recibo", dataKey: "recibo" },
    { header: "Método", dataKey: "metodo" },
    { header: "Moneda", dataKey: "moneda" },
    { header: "Monto", dataKey: "monto" },
    { header: "Estado", dataKey: "estado" },
  ];

  // Tabla de pagos
  doc.autoTable({
    startY: Math.max(startY, 110),
    columns,                         // usamos formato A
    body: rows || [],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [241, 245, 249], textColor: 20 },
    margin: { left: 40, right: 40 },
    theme: "grid",
    columnStyles: {
      fecha:       { cellWidth: 70 },
      poliza:      { cellWidth: 70 },
      cliente:     { cellWidth: 160 },
      recibo:      { cellWidth: 70 },
      metodo:      { cellWidth: 90 },
      moneda:      { cellWidth: 60 },
      monto:       { cellWidth: 80, halign: "right" },
      estado:      { cellWidth: 70 },
    },
    didDrawPage: () => {
      const pageStr = `Página ${doc.getNumberOfPages()}`;
      doc.setFontSize(9);
      doc.text(pageStr, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
    },
  });

  // Totales al pie
  const y = (doc.lastAutoTable?.finalY || 110) + 16;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Total: Q ${(Number(totalMonto) || 0).toFixed(2)}`, 40, y);

  doc.save("reporte_pagos.pdf");
}

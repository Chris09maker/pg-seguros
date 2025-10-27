// client/src/pages/reportes/Clientes.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

// PDF directo desde aquí
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Exportación simple a CSV (sin librerías) */
function exportCSV(filename, rows, cols) {
  if (!rows?.length) return alert("No hay datos");
  const headers = cols.map((c) => c.label);
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = c.render ? c.render(r) : r[c.key] ?? "";
          const s = String(v).replace(/\r?\n/g, " ");
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");

  const csv = headers.join(",") + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReporteClientes() {
  const navigate = useNavigate();

  // Filtros
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // Datos
  const [rows, setRows] = useState([]);

  // Columnas disponibles
  const allCols = useMemo(
    () => [
      { key: "nombre", label: "Nombre" },
      { key: "nit", label: "NIT" },
      { key: "email", label: "Email" },
      { key: "telefono", label: "Teléfono" },
      { key: "dpi", label: "DPI" },
      {
        key: "fechaNacimiento",
        label: "Fecha nacimiento",
        render: (r) => r.fechaNacimiento?.slice?.(0, 10) || "-",
      },
      { key: "estado", label: "Estado cartera" },   // AL_DIA | CON_DEUDA | EN_REVISION
      { key: "estadoActivo", label: "Registro" },   // ACTIVO | INACTIVO
    ],
    []
  );

  // Columnas por defecto
  const [selectedKeys, setSelectedKeys] = useState([
    "nombre",
    "nit",
    "email",
    "telefono",
    "dpi",
  ]);

  const selCols = useMemo(
    () => allCols.filter((c) => selectedKeys.includes(c.key)),
    [allCols, selectedKeys]
  );

  const toggleCol = (key) =>
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  // Carga de datos
  const fetchData = useCallback(async () => {
    try {
      const { data } = await api.get("/reportes/clientes", {
        params: {
          desde: desde || undefined,
          hasta: hasta || undefined,
        },
      });

      const items = Array.isArray(data) ? data : data?.items ?? [];
      setRows(items);
    } catch (err) {
      console.error(err);
      alert("No se pudo cargar el reporte de clientes.");
    }
  }, [desde, hasta]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** ==== ANCHOS sugeridos (HTML y PDF) ==== */
  const widthMap = {
    nombre: 220,
    nit: 80,
    email: 220,
    telefono: 120,
    dpi: 160,
    fechaNacimiento: 140,
    estado: 140,
    estadoActivo: 100,
  };

  /** Exportar a PDF usando jsPDF + autoTable (en horizontal) */
  const handleExportPDF = () => {
    if (!rows.length) return alert("No hay datos para exportar.");

    // Cabeceras (AutoTable en modo columnas)
    const columns = selCols.map((c) => ({
      header: c.label,
      dataKey: c.key,
    }));

    // Filas como objetos con valores "renderizados"
    const bodyObjects = rows.map((r) => {
      const obj = {};
      selCols.forEach((c) => {
        obj[c.key] = c.render ? c.render(r) : r[c.key] ?? "";
      });
      return obj;
    });

    // Filtros a mostrar
    const filtersLines = [];
    if (desde) filtersLines.push(`Desde: ${desde}`);
    if (hasta) filtersLines.push(`Hasta: ${hasta}`);
    const filtersText = filtersLines.join("    ");

    try {
      // Horizontal (landscape)
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const marginX = 40;
      let cursorY = 40;

      // Medidas útiles
      const pageSize = doc.internal.pageSize;
      const pageWidth = pageSize.getWidth();
      const pageHeight = pageSize.getHeight();

      // Título
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42); // #0f172a
      doc.text("Reporte — Total de clientes", marginX, cursorY);

      // Subtítulo / filtros (envuelve si es largo)
      cursorY += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100);
      const filtersWrapped = doc.splitTextToSize(
        filtersText || "Sin filtros",
        pageWidth - marginX * 2
      );
      doc.text(filtersWrapped, marginX, cursorY);

      // Tabla
      cursorY += 10;
      autoTable(doc, {
        startY: cursorY + 8,
        headStyles: { fillColor: [11, 107, 87], textColor: 255 }, // #0b6b57
        styles: {
          fontSize: 9,
          cellPadding: 6,
          overflow: "linebreak",      // no cortar palabras
        },
        columns,
        body: bodyObjects,             // en modo columnas, body = array de objetos
        columnStyles: selCols.reduce((acc, c) => {
          acc[c.key] = { cellWidth: widthMap[c.key] || 120 };
          return acc;
        }, {}),
        theme: "grid",
        margin: { left: marginX, right: marginX },
        didDrawPage: () => {
          // Footer con paginación
          doc.setFontSize(9);
          doc.setTextColor(120);
          const str = `Página ${doc.internal.getNumberOfPages()}`;
          doc.text(str, pageWidth - marginX, pageHeight - 20, { align: "right" });
        },
      });

      // Guardar
      doc.save("reporte_clientes.pdf");
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el PDF.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado y acciones */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reporte — Total de clientes</h2>
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV("reporte_clientes.csv", rows, selCols)}
            className="px-3 py-2 rounded border bg-white hover:bg-slate-50"
          >
            Exportar CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3 py-2 rounded border bg-white hover:bg-slate-50"
          >
            Exportar PDF
          </button>
          <button
            onClick={() => navigate("/app/reportes")}
            className="px-3 py-2 rounded border bg-white hover:bg-slate-50"
          >
            Volver
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2">
        <input
          type="date"
          className="border rounded px-3 py-2"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <input
          type="date"
          className="border rounded px-3 py-2"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
        <button onClick={fetchData} className="px-3 py-2 rounded bg-slate-900 text-white">
          Aplicar
        </button>
        <button
          onClick={() => {
            setDesde("");
            setHasta("");
          }}
          className="px-3 py-2 rounded border bg-white hover:bg-slate-50"
        >
          Limpiar
        </button>
      </div>

      {/* Selección de columnas */}
      <div className="border rounded p-3 bg-slate-50">
        <div className="text-sm font-medium mb-2">Columnas</div>
        <div className="flex flex-wrap gap-3">
          {allCols.map((c) => (
            <label key={c.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedKeys.includes(c.key)}
                onChange={() => toggleCol(c.key)}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      {/* Tabla (preview) */}
      <div className="border rounded overflow-x-auto">
        {/* Tabla header fija con colgroup para anchos */}
        <table className="min-w-full table-fixed text-sm">
          <colgroup>
            {selCols.map((c) => (
              <col key={c.key} style={{ width: `${widthMap[c.key] || 120}px` }} />
            ))}
          </colgroup>
          <thead className="bg-slate-100">
            <tr>
              {selCols.map((c) => (
                <th
                  key={c.key}
                  className="text-left px-3 py-2 align-top"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-3 text-center" colSpan={selCols.length}>
                  Sin datos
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {selCols.map((c) => (
                  <td
                    key={c.key}
                    className="px-3 py-2 align-top whitespace-normal break-words"
                  >
                    {c.render ? c.render(r) : r[c.key] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

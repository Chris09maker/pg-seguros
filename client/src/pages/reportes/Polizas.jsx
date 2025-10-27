// client/src/pages/reportes/Polizas.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Exportación simple a CSV */
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

export default function ReportePolizas() {
  const navigate = useNavigate();

  // Filtros
  const [estado, setEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // Datos
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    activas: 0,
    enRevision: 0,
    anuladas: 0,
    vencidas: 0,
    prima: 0,
  });

  const allCols = useMemo(
    () => [
      { key: "codigo", label: "Código" },
      { key: "cliente", label: "Cliente" },
      { key: "aseguradora", label: "Aseguradora" },
      { key: "ramo", label: "Ramo" },
      { key: "estado", label: "Estado" },
      {
        key: "primaTotal",
        label: "Prima",
        render: (r) =>
          r.primaTotal != null
            ? `${r.moneda || "Q"} ${Number(r.primaTotal).toFixed(2)}`
            : "-",
      },
      {
        key: "fechaEmision",
        label: "Emisión",
        render: (r) => r.fechaEmision?.slice?.(0, 10) || "-",
      },
      {
        key: "inicioVigencia",
        label: "Inicio",
        render: (r) => r.inicioVigencia?.slice?.(0, 10) || "-",
      },
      {
        key: "finVigencia",
        label: "Fin",
        render: (r) => r.finVigencia?.slice?.(0, 10) || "-",
      },
    ],
    []
  );

  const [selectedKeys, setSelectedKeys] = useState(allCols.map((c) => c.key));
  const selCols = allCols.filter((c) => selectedKeys.includes(c.key));
  const toggleCol = (key) =>
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/polizas", {
        params: {
          estado: estado || undefined,
          page: 1,
          limit: 5000,
        },
      });

      const items = data?.items || [];
      const inRange = (d) => {
        if (!d) return true;
        const dd = d.slice(0, 10);
        if (desde && dd < desde) return false;
        if (hasta && dd > hasta) return false;
        return true;
      };
      const filtered = items.filter(
        (p) => inRange(p.inicioVigencia) || inRange(p.finVigencia)
      );

      const k = {
        total: filtered.length,
        activas: filtered.filter((x) => x.estado === "ACTIVA").length,
        enRevision: filtered.filter((x) => x.estado === "EN_REVISION").length,
        anuladas: filtered.filter((x) => x.estado === "ANULADA").length,
        vencidas: filtered.filter((x) => x.estado === "VENCIDA").length,
        prima: filtered.reduce((a, b) => a + Number(b.primaTotal || 0), 0),
      };

      setRows(filtered);
      setStats(k);
    } catch (err) {
      console.error(err);
      alert("No se pudo cargar el reporte de pólizas.");
    }
  }, [estado, desde, hasta]);

  useEffect(() => {
    load();
  }, [load]);

  /** Anchuras para tabla y PDF */
  const widthMap = {
    codigo: 90,
    cliente: 180,
    aseguradora: 160,
    ramo: 150,
    estado: 110,
    primaTotal: 120,
    fechaEmision: 100,
    inicioVigencia: 100,
    finVigencia: 100,
  };

  /** Exportar PDF horizontal */
  const handleExportPDF = () => {
    if (!rows.length) return alert("No hay datos para exportar.");

    const columns = selCols.map((c) => ({
      header: c.label,
      dataKey: c.key,
    }));

    const bodyObjects = rows.map((r) => {
      const obj = {};
      selCols.forEach((c) => {
        obj[c.key] = c.render ? c.render(r) : r[c.key] ?? "";
      });
      return obj;
    });

    const resumen = [
      `Total: ${stats.total}`,
      `Activas: ${stats.activas}`,
      `En revisión: ${stats.enRevision}`,
      `Anuladas: ${stats.anuladas}`,
      `Vencidas: ${stats.vencidas}`,
      `Prima total: ${Number(stats.prima || 0).toFixed(2)}`,
    ].join(" • ");

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const marginX = 40;
      let cursorY = 40;
      const pageSize = doc.internal.pageSize;
      const pageWidth = pageSize.getWidth();
      const pageHeight = pageSize.getHeight();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("Reporte — Total de pólizas", marginX, cursorY);

      cursorY += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100);
      const filtersWrapped = doc.splitTextToSize(
        resumen || "Sin filtros",
        pageWidth - marginX * 2
      );
      doc.text(filtersWrapped, marginX, cursorY);

      cursorY += 10;
      autoTable(doc, {
        startY: cursorY + 8,
        headStyles: { fillColor: [11, 107, 87], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
        columns,
        body: bodyObjects,
        columnStyles: selCols.reduce((acc, c) => {
          acc[c.key] = { cellWidth: widthMap[c.key] || 120 };
          return acc;
        }, {}),
        theme: "grid",
        margin: { left: marginX, right: marginX },
        didDrawPage: () => {
          doc.setFontSize(9);
          doc.setTextColor(120);
          const str = `Página ${doc.internal.getNumberOfPages()}`;
          doc.text(str, pageWidth - marginX, pageHeight - 20, { align: "right" });
        },
      });

      doc.save("reporte_polizas.pdf");
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el PDF.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reporte — Total de pólizas</h2>
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV("reporte_polizas.csv", rows, selCols)}
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
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_1fr_auto_auto] gap-2">
        <select
          className="border rounded px-3 py-2"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="">Estado — Todos</option>
          <option value="ACTIVA">ACTIVA</option>
          <option value="EN_REVISION">EN_REVISION</option>
          <option value="ANULADA">ANULADA</option>
          <option value="VENCIDA">VENCIDA</option>
        </select>
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
        <button onClick={load} className="px-3 py-2 rounded bg-slate-900 text-white">
          Aplicar
        </button>
        <button
          onClick={() => {
            setEstado("");
            setDesde("");
            setHasta("");
          }}
          className="px-3 py-2 rounded border bg-white hover:bg-slate-50"
        >
          Limpiar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <Kpi k="Total" v={stats.total} />
        <Kpi k="Activas" v={stats.activas} />
        <Kpi k="En revisión" v={stats.enRevision} />
        <Kpi k="Anuladas" v={stats.anuladas} />
        <Kpi k="Vencidas" v={stats.vencidas} />
        <Kpi k="Prima total" v={Number(stats.prima || 0).toFixed(2)} />
      </div>

      {/* Columnas */}
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

      {/* Tabla */}
      <div className="border rounded overflow-x-auto">
        <table className="min-w-full table-fixed text-sm">
          <colgroup>
            {selCols.map((c) => (
              <col key={c.key} style={{ width: `${widthMap[c.key] || 120}px` }} />
            ))}
          </colgroup>
          <thead className="bg-slate-100">
            <tr>
              {selCols.map((c) => (
                <th key={c.key} className="text-left px-3 py-2 align-top">
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

function Kpi({ k, v }) {
  return (
    <div className="rounded-xl bg-white shadow p-4">
      <div className="text-slate-500 text-sm">{k}</div>
      <div className="text-2xl font-semibold">{v}</div>
    </div>
  );
}

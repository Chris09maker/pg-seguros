// client/src/pages/reportes/Pagos.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";
import api from "../../services/api";

const ESTADOS = [
  { value: "", label: "Estado — Todos" },
  { value: "REGISTRADO", label: "Registrado" },
  { value: "CONCILIADO", label: "Conciliado" },
];

const METODOS = [
  { value: "", label: "Método — Todos" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
];

export default function ReportePagos() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState(""); // cliente
  const [recibo, setRecibo] = useState("");
  const [polizaCodigo, setPolizaCodigo] = useState("");
  const [dpi, setDpi] = useState("");

  const [estado, setEstado] = useState("");
  const [metodo, setMetodo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(false);

  // ---------- Carga inicial ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/reportes/pagos");
        setRows(Array.isArray(data?.items) ? data.items : data);
      } catch (err) {
            // Útil para depurar y elimina el warning de ESLint
            console.error("[Pagos:init] error:", err);
           alert("No se pudo cargar el reporte de pagos.");
         } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q.trim());
      if (recibo) p.set("recibo", recibo.trim());
      if (polizaCodigo) p.set("polizaCodigo", polizaCodigo.trim());
      if (dpi) p.set("dpi", dpi.trim());
      if (estado) p.set("estado", estado);
      if (metodo) p.set("metodo", metodo);
      if (desde) p.set("desde", desde);
      if (hasta) p.set("hasta", hasta);

      const { data } = await api.get(`/reportes/pagos?${p.toString()}`);
      setRows(Array.isArray(data?.items) ? data.items : data);
          } catch (err) {
          console.error("[Pagos:fetchData] error:", err);
          alert("No se pudo cargar el reporte de pagos.");
        } finally {
      setLoading(false);
    }
  };

  // ---------- Totales ----------
  const totals = useMemo(() => {
    let total = 0;
    for (const r of rows) total += Number(r.monto || 0);
    return { total };
  }, [rows]);

  // ---------- Helpers PDF ----------
  const ensureAutoTable = async (doc) => {
    if (typeof doc.autoTable === "function") return;
    // Import on-demand si el bundler eliminó el plugin
    await import("jspdf-autotable");
  };

  const drawHeader = (doc, title) => {
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFontSize(9);
    doc.text(new Date().toLocaleString(), pageW - 40, 40, { align: "right" });
  };

  const drawFooter = (doc) => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.text(
      `Página ${doc.internal.getNumberOfPages?.() ?? doc.getNumberOfPages()}`,
      pageW - 40,
      pageH - 16,
      { align: "right" }
    );
  };

  // ---------- Exportar PDF (mismo patrón que otros reportes) ----------
  const handleExportPDF = async () => {
    if (!rows?.length) {
      alert("No hay datos para exportar.");
      return;
    }

    // Horizontal para que no se corten columnas
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
    await ensureAutoTable(doc);

    drawHeader(doc, "Reporte — Pagos");

    const head = [
      [
        "Fecha",
        "Recibo",
        "Póliza",
        "Cliente",
        "Método",
        "Moneda",
        "Monto",
        "Estado",
      ],
    ];

    const body = rows.map((r) => [
      r.fecha || "",
      r.recibo || "",
      r.poliza || r.polizaCodigo || "",
      r.cliente || "",
      r.metodo || "",
      r.moneda || "",
      Number(r.monto || 0).toFixed(2),
      r.estado || "",
    ]);

    doc.autoTable({
      head,
      body,
      startY: 60,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [11, 107, 87] }, // verde corporativo
      margin: { left: 40, right: 40 },
      columnStyles: {
        0: { cellWidth: 90 },   // Fecha
        1: { cellWidth: 80 },   // Recibo
        2: { cellWidth: 100 },  // Póliza
        3: { cellWidth: 180 },  // Cliente
        4: { cellWidth: 100 },  // Método
        5: { cellWidth: 70 },   // Moneda
        6: { cellWidth: 90, halign: "right" }, // Monto
        7: { cellWidth: 90 },   // Estado
      },
      didDrawPage: () => {
        drawHeader(doc, "Reporte — Pagos");
        drawFooter(doc);
      },
    });

    // Resumen
    const y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 18 : 80;
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text(`Total pagado: Q ${Number(totals.total || 0).toFixed(2)}`, 40, y);
    doc.setFont(undefined, "normal");

    drawFooter(doc);
    doc.save("reporte_pagos.pdf");
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Reporte — Pagos</h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Exportar PDF
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 rounded border">
            Volver
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
        <input
          className="border rounded px-3 py-2"
          placeholder="Cliente (contiene)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="N° Recibo"
          value={recibo}
          onChange={(e) => setRecibo(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Póliza (código)"
          value={polizaCodigo}
          onChange={(e) => setPolizaCodigo(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="DPI cliente"
          value={dpi}
          onChange={(e) => setDpi(e.target.value)}
        />

        <select
          className="border rounded px-3 py-2"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          {ESTADOS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          className="border rounded px-3 py-2"
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
        >
          {METODOS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          className="border rounded px-3 py-2 md:col-span-3"
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2 md:col-span-3"
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
      </div>

      <div className="flex gap-3 mb-6">
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Aplicar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setQ("");
            setRecibo("");
            setPolizaCodigo("");
            setDpi("");
            setEstado("");
            setMetodo("");
            setDesde("");
            setHasta("");
            fetchData();
          }}
          className="px-4 py-2 rounded border"
        >
          Limpiar
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="border rounded p-3">
          <div className="text-sm text-gray-500">Registros</div>
          <div className="text-xl font-semibold">{rows.length}</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-sm text-gray-500">Total pagado</div>
          <div className="text-xl font-semibold">Q {totals.total.toFixed(2)}</div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Recibo</th>
              <th className="px-3 py-2 text-left">Póliza</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Método</th>
              <th className="px-3 py-2 text-left">Moneda</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                  Sin resultados
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2">{r.fecha || "-"}</td>
                <td className="px-3 py-2">{r.recibo || "-"}</td>
                <td className="px-3 py-2">{r.poliza || r.polizaCodigo || "-"}</td>
                <td className="px-3 py-2">{r.cliente || "-"}</td>
                <td className="px-3 py-2">{r.metodo || "-"}</td>
                <td className="px-3 py-2">{r.moneda || "-"}</td>
                <td className="px-3 py-2 text-right">
                  {Number(r.monto || 0).toFixed(2)}
                </td>
                <td className="px-3 py-2">{r.estado || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

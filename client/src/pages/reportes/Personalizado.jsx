// client/src/pages/reportes/Personalizado.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* Utilidad simple CSV */
function exportCSV(filename, rows, cols) {
  if (!rows?.length) return alert("No hay datos para exportar.");
  const headers = cols.map((c) => c.label);
  const csv =
    headers.join(",") +
    "\n" +
    rows
      .map((r) =>
        cols
          .map((c) => {
            const v = c.map ? c.map(r) : r[c.key] ?? "";
            const s = String(v).replace(/\r?\n/g, " ");
            return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportePersonalizado() {
  const nav = useNavigate();

  const [polizaInput, setPolizaInput] = useState("");

  // Datos cargados desde /reportes/personalizado
  const [poliza, setPoliza] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [aseguradora, setAseguradora] = useState(null);
  const [ramo, setRamo] = useState(null);
  const [plan, setPlan] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [totales, setTotales] = useState({
    totalPagado: 0,
    saldo: 0,
    pagada: false,
  });

  const monedaFmt = (m, v) =>
    v == null ? "-" : `${m || "Q"} ${Number(v || 0).toFixed(2)}`;

  /* Columnas seleccionables */
  const [cliCols, setCliCols] = useState([
    { key: "nombre", label: "Nombre", checked: true },
    { key: "dpi", label: "DPI", checked: true },
    { key: "nit", label: "NIT", checked: true },
    { key: "email", label: "Email", checked: true },
    { key: "telefono", label: "Teléfono", checked: true },
  ]);

  const [polCols, setPolCols] = useState([
    { key: "codigo", label: "Código", checked: true },
    { key: "aseguradora", label: "Aseguradora", checked: true, map: () => aseguradora?.nombre ?? "-" },
    { key: "ramo", label: "Ramo", checked: true, map: () => ramo?.nombre ?? "-" },
    { key: "plan", label: "Plan", checked: true, map: () => plan?.nombre ?? "-" },
    { key: "primaTotal", label: "Prima", checked: true, map: (r) => monedaFmt(r.moneda, r.primaTotal) },
    { key: "fechaEmision", label: "Emisión", checked: true },
    { key: "inicioVigencia", label: "Inicio", checked: true },
    { key: "finVigencia", label: "Fin", checked: true },
    { key: "estado", label: "Estado", checked: true },
  ]);

  // IMPORTANTÍSIMO: estas dos columnas se obtienen del contexto (una póliza/cliente)
  const [pagCols, setPagCols] = useState([
    { key: "fecha", label: "Fecha", checked: true },
    { key: "poliza", label: "Póliza", checked: true, map: () => poliza?.codigo ?? "-" },
    { key: "cliente", label: "Cliente", checked: true, map: () => cliente?.nombre ?? "-" },
    { key: "recibo", label: "Recibo", checked: true },
    { key: "metodo", label: "Método", checked: true },
    { key: "moneda", label: "Moneda", checked: true },
    { key: "monto", label: "Monto", checked: true, map: (r) => monedaFmt(r.moneda, r.monto) },
    { key: "estado", label: "Estado", checked: true },
  ]);

  const toggle = (cols, setCols, key) => {
    setCols((prev) =>
      prev.map((c) => (c.key === key ? { ...c, checked: !c.checked } : c))
    );
  };

  /* Cargar desde API */
  async function generar() {
    try {
      const v = (polizaInput || "").trim();
      if (!v) return alert("Ingresa el ID o código de la póliza.");
      const { data } = await api.get("/reportes/personalizado", { params: { poliza: v } });

      setPoliza({
        codigo: data.poliza?.codigo ?? "-",
        moneda: data.poliza?.moneda ?? "Q",
        primaTotal: data.poliza?.primaTotal ?? 0,
        fechaEmision: data.poliza?.fechaEmision ?? "-",
        inicioVigencia: data.poliza?.inicioVigencia ?? "-",
        finVigencia: data.poliza?.finVigencia ?? "-",
        estado: data.poliza?.estado ?? "-",
      });

      setCliente({
        nombre: data.cliente?.Nombre ?? data.cliente?.nombre ?? "-",
        dpi: data.cliente?.dpi ?? "-",
        nit: data.cliente?.nit ?? "-",
        email: data.cliente?.email ?? "-",
        telefono: data.cliente?.telefono ?? "-",
      });

      setAseguradora(data.aseguradora || null);
      setRamo(data.ramo || null);
      setPlan(data.plan || null);
      setPagos(Array.isArray(data.pagos?.items) ? data.pagos.items : []);
      setTotales({
        totalPagado: Number(data.pagos?.totalMonto || 0),
        saldo: Number(data.saldos?.saldo || 0),
        pagada: !!data.saldos?.pagada,
      });
    } catch (err) {
      console.error(err);
      alert("No se encontró la póliza indicada.");
      setPoliza(null);
      setCliente(null);
      setAseguradora(null);
      setRamo(null);
      setPlan(null);
      setPagos([]);
      setTotales({ totalPagado: 0, saldo: 0, pagada: false });
    }
  }

  /* Exportar PDF (aplica selección de columnas) */
  const onExportPDF = () => {
    if (!poliza && !cliente && !pagos.length)
      return alert("No hay datos para exportar.");

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const marginX = 40;
    let y = 40;

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Reporte — Personalizado", marginX, y);
    y += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Póliza: ${polizaInput || "-"}`, marginX, y);
    y += 20;

    const section = (title, cols, rows) => {
      const colsSel = (cols || []).filter((c) => c.checked);
      if (!rows?.length || !colsSel.length) return;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(title, marginX, y);
      y += 10;

      autoTable(doc, {
        startY: y,
        head: [colsSel.map((c) => c.label)],
        body: rows.map((r) =>
          colsSel.map((c) => (c.map ? c.map(r) : r[c.key] ?? ""))
        ),
        styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [11, 107, 87], textColor: 255 },
        margin: { left: marginX, right: marginX },
        theme: "grid",
        columnStyles: colsSel.reduce((a, c, i) => {
          a[i] = { cellWidth: 140 }; // ancho cómodo en horizontal
          return a;
        }, {}),
        didDrawPage: () => {
          const str = `Página ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text(str, pageWidth - marginX, pageHeight - 20, { align: "right" });
        },
      });
      y = doc.lastAutoTable.finalY + 20;
    };

    if (cliente) section("Datos del cliente", cliCols, [cliente]);

    if (poliza)
      section("Detalle de la póliza", polCols, [
        {
          ...poliza,
          // Estos tres pueden venir de objetos aparte; igual c.map los cubre, pero
          // los dejamos por claridad (no estorban si el col usa map)
          aseguradora: aseguradora?.nombre ?? "-",
          ramo: ramo?.nombre ?? "-",
          plan: plan?.nombre ?? "-",
        },
      ]);

    if (pagos.length) section("Pagos", pagCols, pagos);

    // Totales
    if (poliza) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Totales", marginX, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `Total pagado: ${monedaFmt(poliza.moneda, totales.totalPagado)}   |   ` +
          `Saldo: ${monedaFmt(poliza.moneda, totales.saldo)}   |   ` +
          `Pagada: ${totales.pagada ? "Sí" : "No"}`,
        marginX,
        y
      );
    }

    doc.save("reporte_personalizado.pdf");
  };

  /* Exportar CSV por sección */
  const onExportCSV = () => {
    if (!poliza && !cliente && !pagos.length)
      return alert("No hay datos para exportar.");

    const cliSel = cliCols.filter((c) => c.checked);
    const polSel = polCols.filter((c) => c.checked);
    const pagSel = pagCols.filter((c) => c.checked);

    if (cliente) exportCSV("cliente.csv", [cliente], cliSel);
    if (poliza) exportCSV("poliza.csv", [poliza], polSel);
    if (pagos.length) exportCSV("pagos.csv", pagos, pagSel);
  };

  /* UI */
  const Box = ({ title, children }) => (
    <section className="border rounded p-3">
      <h3 className="font-medium mb-2">{title}</h3>
      {children}
    </section>
  );

  const CheckboxGrid = ({ title, cols, onToggle }) => (
    <Box title={title}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {cols.map((c) => (
          <label key={c.key} className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={c.checked}
              onChange={() => onToggle(c.key)}
            />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </Box>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reporte — Personalizado</h2>
        <div className="flex gap-2">
          <button onClick={onExportCSV} className="px-3 py-2 rounded border bg-white hover:bg-slate-50">
            Exportar CSV
          </button>
          <button onClick={onExportPDF} className="px-3 py-2 rounded border bg-white hover:bg-slate-50">
            Exportar PDF
          </button>
          <button onClick={() => nav("/app/reportes")} className="px-3 py-2 rounded border bg-white hover:bg-slate-50">
            Volver
          </button>
        </div>
      </div>

      {/* Filtro */}
      <div className="grid gap-2 grid-cols-1 md:grid-cols-[1fr_auto] items-end">
        <input
          className="border rounded px-3 py-2"
          placeholder="ID o código de póliza (ej. 1 o POL-001)"
          value={polizaInput}
          onChange={(e) => setPolizaInput(e.target.value)}
        />
        <button onClick={generar} className="px-3 py-2 rounded bg-slate-900 text-white">
          Generar
        </button>
      </div>

      {/* Selección de columnas */}
      {cliente && (
        <CheckboxGrid
          title="Campos — Cliente"
          cols={cliCols}
          onToggle={(k) => toggle(cliCols, setCliCols, k)}
        />
      )}
      {poliza && (
        <CheckboxGrid
          title="Campos — Póliza"
          cols={polCols}
          onToggle={(k) => toggle(polCols, setPolCols, k)}
        />
      )}
      {!!pagos.length && (
        <CheckboxGrid
          title="Campos — Pagos"
          cols={pagCols}
          onToggle={(k) => toggle(pagCols, setPagCols, k)}
        />
      )}

      {/* Vista previa */}
      {cliente && (
        <Box title="Datos del cliente">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {cliCols
              .filter((c) => c.checked)
              .map((c) => (
                <div key={c.key} className="border p-2 rounded break-words">
                  <div className="text-slate-500">{c.label}</div>
                  <div className="font-medium">{c.map ? c.map(cliente) : cliente[c.key] ?? "-"}</div>
                </div>
              ))}
          </div>
        </Box>
      )}

      {poliza && (
        <Box title="Detalle de la póliza">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {polCols
              .filter((c) => c.checked)
              .map((c) => (
                <div key={c.key} className="border p-2 rounded break-words">
                  <div className="text-slate-500">{c.label}</div>
                  <div className="font-medium">
                    {c.map
                      ? c.map(poliza)
                      : poliza[c.key] ?? "-"}
                  </div>
                </div>
              ))}
          </div>
        </Box>
      )}

      {!!pagos.length && (
        <Box title="Pagos">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {pagCols
                    .filter((c) => c.checked)
                    .map((c) => (
                      <th key={c.key} className="text-left p-2">
                        {c.label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {pagos.map((r) => (
                  <tr key={r.id} className="border-t">
                    {pagCols
                      .filter((c) => c.checked)
                      .map((c) => (
                        <td key={c.key} className="p-2 break-words">
                          {c.map ? c.map(r) : r[c.key] ?? "-"}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-sm">
            <strong>Total pagado:</strong> {monedaFmt(poliza?.moneda, totales.totalPagado)} ·{" "}
            <strong>Saldo:</strong> {monedaFmt(poliza?.moneda, totales.saldo)} ·{" "}
            <strong>Pagada:</strong> {totales.pagada ? "Sí" : "No"}
          </div>
        </Box>
      )}
    </div>
  );
}

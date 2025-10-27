import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

function fmtMoney(n, m = "Q") {
  const v = Number(n || 0);
  return `${m} ${v.toFixed(2)}`;
}
function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

export default function PagosHistorial() {
  const nav = useNavigate();

  // tabla
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [qCliente, setQCliente] = useState(""); // si son 13 dígitos, se usa como DPI
  const [qPoliza, setQPoliza] = useState("");  // código
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const total = useMemo(
    () => items.reduce((acc, it) => acc + Number(it.monto || 0), 0),
    [items]
  );

  async function fetchPagos(params = {}) {
    setLoading(true);
    try {
      const { data } = await api.get("/reportes/pagos", { params });
      const arr = data?.items || [];
      // Normalizamos por si el backend devuelve tipos numéricos/strings variados
      setItems(
        arr.map((r) => ({
          id: r.id,
          cliente: r.cliente,
          clienteDpi: r.clienteDpi,
          polizaCodigo: r.polizaCodigo,
          fecha: r.fecha,
          monto: Number(r.monto || 0),
          moneda: r.moneda || "Q",
          recibo: r.recibo,
          metodo: r.metodo,
          estado: r.estado,
          polizaId: r.polizaId, // si el API lo agrega a futuro
        }))
      );
    } catch (e) {
      console.error(e);
      alert("Error cargando historial de pagos");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPagos();
  }, []);

  const onBuscar = () => {
    const dpi = onlyDigits(qCliente);
    fetchPagos({
      desde: desde || undefined,
      hasta: hasta || undefined,
      polizaCodigo: qPoliza || undefined,
      dpi: dpi.length === 13 ? dpi : undefined,
    });
  };

  const onLimpiar = () => {
    setQCliente("");
    setQPoliza("");
    setDesde("");
    setHasta("");
    fetchPagos();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Pagos — Historial</h2>
        <button
          onClick={() => nav("/app/pagos/registrar")}
          className="px-3 py-2 rounded bg-emerald-600 text-white"
        >
          Registrar cobro
        </button>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-4 mb-3">
        <input
          className="border rounded px-3 py-2"
          placeholder="Cliente (DPI opcional)"
          value={qCliente}
          onChange={(e) => setQCliente(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Póliza (código)"
          value={qPoliza}
          onChange={(e) => setQPoliza(e.target.value)}
        />
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
      </div>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onLimpiar} className="px-3 py-2 rounded border">
          Limpiar
        </button>
        <button onClick={onBuscar} className="px-3 py-2 rounded bg-slate-900 text-white">
          Buscar
        </button>
      </div>

      {/* Tabla */}
      <div className="border rounded">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-2">Cliente</th>
                <th className="text-left p-2">DPI</th>
                <th className="text-left p-2">Póliza (código)</th>
                <th className="text-left p-2">Fecha</th>
                <th className="text-right p-2">Monto</th>
                <th className="text-left p-2">No. Recibo</th>
                <th className="text-left p-2">Método</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="p-3 text-center">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-3 text-center">
                    Sin resultados
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.cliente || "-"}</td>
                    <td className="p-2">{r.clienteDpi || "-"}</td>
                    <td className="p-2">{r.polizaCodigo || "-"}</td>
                    <td className="p-2">{fmtDate(r.fecha)}</td>
                    <td className="p-2 text-right">{fmtMoney(r.monto, r.moneda)}</td>
                    <td className="p-2">{r.recibo || "-"}</td>
                    <td className="p-2">{r.metodo || "-"}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-slate-50 font-semibold">
                <td className="p-2" colSpan={4}>
                  Total
                </td>
                <td className="p-2 text-right">{fmtMoney(total)}</td>
                <td className="p-2" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

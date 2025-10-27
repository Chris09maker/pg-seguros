import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const ESTADOS = ["ACTIVA", "EN_REVISION", "ANULADA", "VENCIDA"];

export default function PolizasList() {
  const nav = useNavigate();
  


  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [pagada, setPagada] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      console.log("[POLIZAS LIST] fetching /polizas", { q, estado, pagada, page });
      const res = await api.get("/polizas", { params: { q, estado, pagada, page, limit: 20 } });
      console.log("[POLIZAS LIST] items:", res.data?.items?.length);
      setItems(res.data.items || []);
    } catch (err) {
      console.error("[POLIZAS LIST] error fetching:", err);
      alert("Error al cargar pólizas");
    } finally {
      setLoading(false);
    }
  }, [q, estado, pagada, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleNew = () => {
    console.log("[POLIZAS LIST] nav -> new (relative)");
    nav("new");
  };
  const handleView = (id) => {
    console.log("[POLIZAS LIST] nav ->", String(id), "(relative)");
    nav(String(id));
  };

  return (
    <div className="p-4 space-y-4">
      
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Pólizas</h1>
        <button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
          Nueva póliza
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Buscar por código, cliente o aseguradora..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border rounded-md px-3 py-2 w-64"
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="border rounded-md px-3 py-2">
          <option value="">Todos los estados</option>
          {ESTADOS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={pagada} onChange={(e) => setPagada(e.target.value)} className="border rounded-md px-3 py-2">
          <option value="">Todas</option>
          <option value="1">Pagadas</option>
          <option value="0">Pendientes</option>
        </select>
        <button onClick={() => { setPage(1); fetchData(); }} className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg">
          Filtrar
        </button>
      </div>

      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="min-w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 border-b">Código</th>
              <th className="px-4 py-2 border-b">Cliente</th>
              <th className="px-4 py-2 border-b">Aseguradora</th>
              <th className="px-4 py-2 border-b">Ramo</th>
              <th className="px-4 py-2 border-b text-right">Prima total</th>
              <th className="px-4 py-2 border-b text-right">Pagado</th>
              <th className="px-4 py-2 border-b text-right">Saldo</th>
              <th className="px-4 py-2 border-b text-center">Estado</th>
              <th className="px-4 py-2 border-b text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr><td colSpan="9" className="text-center text-gray-500 py-6 italic">No hay pólizas registradas.</td></tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors border-b">
                <td className="px-4 py-2">{p.codigo}</td>
                <td className="px-4 py-2">{p.cliente}</td>
                <td className="px-4 py-2">{p.aseguradora}</td>
                <td className="px-4 py-2">{p.ramo}</td>
                <td className="px-4 py-2 text-right">{Number(p.primaTotal || 0).toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-green-600">{Number(p.totalPagado || 0).toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-red-600">{Number(p.saldo || 0).toFixed(2)}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    p.estado === "ACTIVA" ? "bg-green-100 text-green-700" :
                    p.estado === "EN_REVISION" ? "bg-yellow-100 text-yellow-700" :
                    p.estado === "ANULADA" ? "bg-gray-200 text-gray-600" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {p.estado}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => handleView(p.id)} className="text-blue-600 hover:text-blue-800 font-medium">
                    Ver / Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && <div className="text-center text-gray-500 italic py-4">Cargando pólizas...</div>}
    </div>
  );
}

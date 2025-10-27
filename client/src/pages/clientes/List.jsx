import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const ACTIVOS = ["ACTIVO", "INACTIVO"];

export default function ClientesList() {
  const nav = useNavigate();

  // Filtros
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(""); // ACTIVO/INACTIVO

  // Tabla
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Paginación (server-side)
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(false);

  const loadClientes = useCallback(
    async (opts = {}) => {
      const params = {
        q: q || undefined,
        estado: activo || undefined, // <- el back usa "estado" para estado_activo
        page,
        limit,
        ...opts,
      };
      setLoading(true);
      try {
        const { data } = await api.get("/clientes", { params });
        const items = data?.items ?? [];
        setRows(items);
        setHasMore(items.length === limit);
      } catch (e) {
        console.error(e);
        alert("Error cargando clientes");
        setRows([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [q, activo, page, limit]
  );

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  const onBuscar = () => {
    setPage(1);
    loadClientes({ page: 1 });
  };

  const onLimpiar = () => {
    setQ("");
    setActivo("");
    setPage(1);
    loadClientes({ q: undefined, estado: undefined, page: 1 });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Clientes — Listado</h2>
        <button
          onClick={() => nav("/app/clientes/nuevo")}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          + Nuevo cliente
        </button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px_220px] gap-3">
        <input
          className="border rounded px-3 py-2"
          placeholder="Buscar (Nombre, NIT, Email, Teléfono, DPI)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2"
          value={activo}
          onChange={(e) => setActivo(e.target.value)}
        >
          <option value="">Estado activo — Todos</option>
          {ACTIVOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button onClick={onBuscar} className="px-3 py-2 rounded bg-slate-900 text-white">
            Buscar
          </button>
          <button onClick={onLimpiar} className="px-3 py-2 rounded border">
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">NIT</th>
              <th className="text-left p-2">Teléfono</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">DPI</th>
              <th className="text-left p-2">Activo</th>
              <th className="text-left p-2">Cartera</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="p-3 text-center">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-3 text-center">
                  Sin resultados
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.nombre}</td>
                  <td className="p-2">{r.nit || "-"}</td>
                  <td className="p-2">{r.telefono || "-"}</td>
                  <td className="p-2">{r.email || "-"}</td>
                  <td className="p-2">{r.dpi || "-"}</td>
                  <td className="p-2">
                    <span
                      className={
                        "px-2 py-1 rounded text-xs " +
                        ((r.estado || "").toUpperCase() === "ACTIVO"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700")
                      }
                    >
                      {r.estado || "-"}
                    </span>
                  </td>
                  <td className="p-2">
                    <span
                      className={
                        "px-2 py-1 rounded text-xs " +
                        (r.cartera === "AL_DIA"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-amber-100 text-amber-700")
                      }
                    >
                      {r.cartera === "AL_DIA" ? "Al día" : "Con deuda"}
                    </span>
                  </td>
                  <td className="p-2">
                    <button
                      className="px-2 py-1 border rounded"
                      onClick={() => nav(`/app/clientes/${r.id}`)}
                    >
                      Ver / Editar
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-end gap-2">
        <button
          className="px-3 py-2 border rounded disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => {
            const p = Math.max(1, page - 1);
            setPage(p);
            loadClientes({ page: p });
          }}
        >
          Anterior
        </button>
        <span className="text-sm px-2">Página {page}</span>
        <button
          className="px-3 py-2 border rounded disabled:opacity-50"
          disabled={!hasMore}
          onClick={() => {
            const p = page + 1;
            setPage(p);
            loadClientes({ page: p });
          }}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

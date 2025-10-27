import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";

/* Util */
const money = (n) =>
  n === null || n === undefined || n === ""
    ? "-"
    : new Intl.NumberFormat("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        Number(n)
      );

export default function PlanesIndex() {
  const nav = useNavigate();

  // catálogos
  const [aseguradoras, setAseguradoras] = useState([]);
  const [ramos, setRamos] = useState([]);

  // filtros
  const [q, setQ] = useState("");
  const [aseguradoraId, setAseguradoraId] = useState("");
  const [ramoId, setRamoId] = useState("");
  const [estado, setEstado] = useState("");

  // tabla
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [hasMore, setHasMore] = useState(false);

  // formulario
  const empty = useMemo(
    () => ({
      id: null,
      aseguradoraId: "",
      ramoId: "",
      nombre: "",
      descripcion: "",
      primaBase: "",
      estado: "ACTIVO",
    }),
    []
  );
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // cargar catálogos
    (async () => {
      try {
        const [a1, r1] = await Promise.all([
          api.get("/aseguradoras", { params: { page: 1, limit: 200 } }),
          api.get("/ramos", { params: { page: 1, limit: 200 } }),
        ]);
        setAseguradoras(a1.data.items || a1.data || []);
        setRamos(r1.data.items || r1.data || []);
      } catch (e) {
        console.error(e);
        alert("No se pudieron cargar catálogos.");
      }
    })();
  }, []);

  const load = async (opts = {}) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        q: q || undefined,
        aseguradoraId: aseguradoraId || undefined,
        ramoId: ramoId || undefined,
        estado: estado || undefined,
        ...opts,
      };
      const { data } = await api.get("/planes", { params });
      const items = data?.items ?? [];
      setRows(items);
      setHasMore(items.length === limit);
    } catch (e) {
      console.error(e);
      alert("Error cargando planes.");
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, estado, aseguradoraId, ramoId]);

  const onBuscar = () => {
    setPage(1);
    load({ page: 1 });
  };

  const onLimpiar = () => {
    setQ("");
    setAseguradoraId("");
    setRamoId("");
    setEstado("");
    setPage(1);
    load({ q: undefined, aseguradoraId: undefined, ramoId: undefined, estado: undefined, page: 1 });
  };

  const startNew = () => {
    setForm(empty);
    setEditing(true);
  };

  const startEdit = (row) => {
    setForm({
      id: row.id,
      aseguradoraId: row.aseguradoraId,
      ramoId: row.ramoId,
      nombre: row.nombre || "",
      descripcion: row.descripcion || "",
      primaBase: row.primaBase ?? "",
      estado: row.estado || "ACTIVO",
    });
    setEditing(true);
  };

  const onChange = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const onSave = async (e) => {
    e.preventDefault();
    if (!form.aseguradoraId || !form.ramoId || !form.nombre) {
      alert("Complete aseguradora, ramo y nombre.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        aseguradoraId: Number(form.aseguradoraId),
        ramoId: Number(form.ramoId),
        nombre: String(form.nombre || "").trim(),
        descripcion: String(form.descripcion || "").trim(),
        primaBase:
          form.primaBase === "" || form.primaBase === null ? "" : Number(form.primaBase),
        estado: form.estado || "ACTIVO",
      };
      if (form.id) {
        await api.put(`/planes/${form.id}`, payload);
      } else {
        await api.post("/planes", payload);
      }
      setEditing(false);
      setForm(empty);
      load();
    } catch (e) {
      console.error(e);
      if (e?.response?.status === 409) alert("Ya existe un plan con ese nombre en ese ramo/aseguradora.");
      else alert("No se pudo guardar el plan.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row) => {
    if (!window.confirm(`¿Eliminar el plan "${row.nombre}"?`)) return;
    try {
      await api.delete(`/planes/${row.id}`);
      load();
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar el plan.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Planes — Mantenimiento</h2>
        <div className="flex gap-2">
          <button onClick={() => nav(-1)} className="px-3 py-2 rounded border">
            Volver
          </button>
          <button onClick={startNew} className="px-3 py-2 rounded bg-emerald-600 text-white">
            + Nuevo plan
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px_240px_200px_220px] gap-3">
        <input
          className="border rounded px-3 py-2"
          placeholder="Buscar (nombre o descripción)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2"
          value={aseguradoraId}
          onChange={(e) => setAseguradoraId(e.target.value)}
        >
          <option value="">Aseguradora — Todas</option>
          {aseguradoras.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <select
          className="border rounded px-3 py-2"
          value={ramoId}
          onChange={(e) => setRamoId(e.target.value)}
        >
          <option value="">Ramo — Todos</option>
          {ramos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
        <select className="border rounded px-3 py-2" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Estado — Todos</option>
          <option value="ACTIVO">ACTIVO</option>
          <option value="INACTIVO">INACTIVO</option>
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
              <th className="text-left p-2">Aseguradora</th>
              <th className="text-left p-2">Ramo</th>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Prima base</th>
              <th className="text-left p-2">Estado</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-center" colSpan={6}>
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-3 text-center" colSpan={6}>
                  Sin resultados
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.aseguradora}</td>
                  <td className="p-2">{r.ramo}</td>
                  <td className="p-2">{r.nombre}</td>
                  <td className="p-2">Q {money(r.primaBase)}</td>
                  <td className="p-2">
                    <span
                      className={
                        "px-2 py-1 rounded text-xs " +
                        ((r.estado || "").toUpperCase() === "ACTIVO"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700")
                      }
                    >
                      {r.estado}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 border rounded" onClick={() => startEdit(r)}>
                        Editar
                      </button>
                      <button className="px-2 py-1 border rounded" onClick={() => onDelete(r)}>
                        Eliminar
                      </button>
                    </div>
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
            load({ page: p });
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
            load({ page: p });
          }}
        >
          Siguiente
        </button>
      </div>

      {/* Panel crear/editar */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {form.id ? "Editar plan" : "Nuevo plan"}
              </h3>
              <button className="px-3 py-1 border rounded" onClick={() => setEditing(false)}>
                Cerrar
              </button>
            </div>

            <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm block mb-1">Aseguradora*</label>
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={form.aseguradoraId}
                  onChange={onChange("aseguradoraId")}
                >
                  <option value="">Seleccione…</option>
                  {aseguradoras.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm block mb-1">Ramo*</label>
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={form.ramoId}
                  onChange={onChange("ramoId")}
                >
                  <option value="">Seleccione…</option>
                  {ramos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm block mb-1">Nombre*</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={form.nombre}
                  onChange={onChange("nombre")}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm block mb-1">Descripción</label>
                <textarea
                  rows={3}
                  className="border rounded px-3 py-2 w-full"
                  value={form.descripcion}
                  onChange={onChange("descripcion")}
                />
              </div>

              <div>
                <label className="text-sm block mb-1">Prima base</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="border rounded px-3 py-2 w-full"
                  value={form.primaBase}
                  onChange={onChange("primaBase")}
                />
              </div>

              <div>
                <label className="text-sm block mb-1">Estado</label>
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={form.estado}
                  onChange={onChange("estado")}
                >
                  <option value="ACTIVO">ACTIVO</option>
                  <option value="INACTIVO">INACTIVO</option>
                </select>
              </div>

              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-2 rounded border"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

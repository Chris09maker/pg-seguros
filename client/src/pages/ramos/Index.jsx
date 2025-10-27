import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../services/api";

export default function RamosIndex() {
  // Filtros
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(""); // "", "ACTIVO", "INACTIVO"

  // Tabla
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Formulario
  const [form, setForm] = useState({ id: null, nombre: "", descripcion: "" });
  const [saving, setSaving] = useState(false);

  const firstLoad = useRef(true);

  /* -------------------- Cargar ramos -------------------- */
  const load = useCallback(async () => {
    if (loading) return; // evita solapes
    setLoading(true);
    try {
      const { data } = await api.get("/ramos", {
        params: {
          q: q || undefined,
          estado: estado || undefined,
        },
      });
      const items = Array.isArray(data) ? data : (data?.items ?? data ?? []);
      setRows(items);
    } catch (e) {
      console.error(e);
      alert("Error cargando ramos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, estado, loading]);

  // Carga inicial
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      load().catch(() => {});
    }
  }, [load]);

  /* -------------------- Edición / Cancelar -------------------- */
  const onEdit = (r) =>
    setForm({ id: r.id, nombre: r.nombre, descripcion: r.descripcion || "" });

  const onCancel = () => setForm({ id: null, nombre: "", descripcion: "" });

  /* -------------------- Guardar (crear/actualizar) ------------- */
  async function onSubmit(e) {
    e.preventDefault();
    const nombre = (form.nombre || "").trim();
    if (!nombre) return alert("Nombre es requerido");

    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/ramos/${form.id}`, {
          nombre,
          descripcion: form.descripcion || "",
        });
      } else {
        await api.post("/ramos", {
          nombre,
          descripcion: form.descripcion || "",
        });
      }
      onCancel();
      await load();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        (form.id ? "No se pudo actualizar el ramo" : "No se pudo crear el ramo");
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  /* -------------------- Activar / Dar de baja ------------------ */
  async function onToggleEstado(r) {
    const next = r.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    if (!confirm(`¿Confirmas cambiar el estado a ${next}?`)) return;
    try {
      // El back acepta actualizar solo el estado vía PUT parcial
      await api.put(`/ramos/${r.id}`, { estado: next });
      // Optimista: actualizamos localmente para que se sienta fluido
      setRows((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, estado: next } : x))
      );
    } catch (err) {
      console.error(err);
      alert("No se pudo cambiar el estado");
    }
  }

  /* -------------------- Buscar / Limpiar ----------------------- */
  const onAplicar = () => load();
  const onLimpiarFiltros = () => {
    setQ("");
    setEstado("");
    // tras limpiar, recarga
    setTimeout(() => load(), 0);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Ramos — Mantenimiento</h2>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          className="border rounded px-3 py-2"
          placeholder="Buscar por nombre"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAplicar()}
        />
        <select
          className="border rounded px-3 py-2"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="">Estado — Todos</option>
          <option value="ACTIVO">Activo</option>
          <option value="INACTIVO">Dado de baja</option>
        </select>
        <div className="flex gap-2">
          <button onClick={onAplicar} className="px-3 py-2 border rounded">
            Aplicar
          </button>
          <button onClick={onLimpiarFiltros} className="px-3 py-2 border rounded">
            Limpiar
          </button>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={onSubmit} className="bg-slate-50 rounded-xl p-4 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <label className="text-sm block mb-1">Nombre*</label>
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.nombre}
            onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm block mb-1">Descripción</label>
          <input
            className="border rounded px-3 py-2 w-full"
            value={form.descripcion}
            onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
          />
        </div>
        <div className="md:col-span-3 flex gap-2">
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : form.id ? "Actualizar" : "Guardar ramo"}
          </button>
          {form.id && (
            <button type="button" onClick={onCancel} className="px-4 py-2 border rounded">
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      {/* Tabla */}
      <div className="border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Descripción</th>
              <th className="text-left p-2">Estado</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="p-3 text-center">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-3 text-center">
                  Sin datos
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.nombre}</td>
                  <td className="p-2">{r.descripcion || "-"}</td>
                  <td className="p-2">{r.estado || "-"}</td>
                  <td className="p-2 flex gap-2">
                    <button
                      className="px-2 py-1 border rounded"
                      onClick={() => onEdit(r)}
                    >
                      Editar
                    </button>
                    <button
                      className="px-2 py-1 border rounded"
                      onClick={() => onToggleEstado(r)}
                    >
                      {r.estado === "ACTIVO" ? "Dar de baja" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

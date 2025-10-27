import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../services/api";

export default function AseguradorasIndex() {
  // Filtros
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(""); // "", "ACTIVO", "INACTIVO"

  // Listado
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Opciones de ramos activos
  const [ramosOpts, setRamosOpts] = useState([]);

  // Formulario
  const emptyForm = {
    id: null,
    nombre: "",
    telefono: "",
    email: "",
    contacto: "",
    contacto_cargo: "",
    direccion: "",
    ramosIds: [],
    estado: "ACTIVO",
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const firstLoad = useRef(true);

  /* -------------------- Carga de aseguradoras -------------------- */
  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await api.get("/aseguradoras", {
        params: { q: q || undefined, estado: estado || undefined },
      });
      const items = Array.isArray(data) ? data : (data?.items ?? data ?? []);
      setRows(items);
    } catch (e) {
      console.error(e);
      alert("Error cargando aseguradoras");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, estado, loading]);

  /* -------------------- Carga de ramos activos ------------------- */
  const loadRamos = useCallback(async () => {
    try {
      const { data } = await api.get("/ramos", { params: { estado: "ACTIVO", page: 1, limit: 1000 } });
      const items = Array.isArray(data) ? data : (data?.items ?? data ?? []);
      setRamosOpts(items);
    } catch (e) {
      console.error(e);
      setRamosOpts([]);
    }
  }, []);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      load().catch(() => {});
      loadRamos().catch(() => {});
    }
  }, [load, loadRamos]);

  /* -------------------- Utilidades formulario -------------------- */
  const toggleRamo = (id) =>
    setForm((s) => ({
      ...s,
      ramosIds: s.ramosIds.includes(id) ? s.ramosIds.filter((x) => x !== id) : [...s.ramosIds, id],
    }));

  const onEdit = async (row) => {
    try {
      const { data } = await api.get(`/aseguradoras/${row.id}`);
      const ramosIds =
        Array.isArray(data?.ramosIds)
          ? data.ramosIds
          : Array.isArray(data?.ramos)
          ? data.ramos.map((r) => r.id)
          : [];
      setForm({
        id: data.id,
        nombre: data.nombre || "",
        telefono: data.telefono || "",
        email: data.email || "",
        contacto: data.contacto || "",
        contacto_cargo: data.contacto_cargo || "",
        direccion: data.direccion || "",
        ramosIds,
        estado: data.estado || "ACTIVO",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      alert("No se pudo cargar la aseguradora");
    }
  };

  const onCancel = () => setForm(emptyForm);

  /* -------------------- Guardar (crear/actualizar) --------------- */
  async function onSubmit(e) {
    e.preventDefault();
    const nombre = (form.nombre || "").trim();
    if (!nombre) return alert("Nombre es requerido");

    setSaving(true);
    try {
      const payload = {
        nombre,
        telefono: form.telefono || "",
        email: form.email || "",
        contacto: form.contacto || "",
        contacto_cargo: form.contacto_cargo || "",
        direccion: form.direccion || "",
        ramosIds: form.ramosIds || [],
        estado: form.estado || "ACTIVO",
      };
      if (form.id) {
        await api.put(`/aseguradoras/${form.id}`, payload);
      } else {
        await api.post("/aseguradoras", payload);
      }
      onCancel();
      await load();
    } catch (err) {
      console.error(err);
      alert(form.id ? "No se pudo actualizar la aseguradora" : "No se pudo crear la aseguradora");
    } finally {
      setSaving(false);
    }
  }

  /* -------------------- Activar / Dar de baja (tabla) ------------ */
  async function onToggleEstadoRow(r) {
    const next = r.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    if (!confirm(`¿Confirmas cambiar el estado a ${next}?`)) return;
    try {
      await api.put(`/aseguradoras/${r.id}`, { estado: next });
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, estado: next } : x)));
      if (form.id === r.id) setForm((s) => ({ ...s, estado: next }));
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado");
    }
  }

  /* -------------------- Filtros ------------------------------- */
  const onAplicar = () => load();
  const onLimpiarFiltros = () => {
    setQ("");
    setEstado("");
    setTimeout(() => load(), 0);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Aseguradoras — Mantenimiento</h2>

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
      <form onSubmit={onSubmit} className="bg-slate-50 rounded-xl p-4 grid gap-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm block mb-1">Nombre*</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.nombre}
              onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Teléfono</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.telefono}
              onChange={(e) => setForm((s) => ({ ...s, telefono: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Email</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Contacto (Nombre)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.contacto}
              onChange={(e) => setForm((s) => ({ ...s, contacto: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Contacto (Cargo)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.contacto_cargo}
              onChange={(e) => setForm((s) => ({ ...s, contacto_cargo: e.target.value }))}
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-sm block mb-1">Dirección</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.direccion}
              onChange={(e) => setForm((s) => ({ ...s, direccion: e.target.value }))}
            />
          </div>

          {/* Estado del registro (visible cuando hay edición) */}
          {form.id && (
            <div className="md:col-span-3 flex items-center gap-3 pt-2">
              <span
                className={
                  "px-3 py-1 rounded-full text-sm " +
                  (form.estado === "ACTIVO" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")
                }
                title="Estado del registro"
              >
                {form.estado === "ACTIVO" ? "Activo" : "Dado de baja"}
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm((s) => ({ ...s, estado: s.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO" }))
                }
                className="px-3 py-2 border rounded"
              >
                {form.estado === "ACTIVO" ? "Dar de baja" : "Reactivar"}
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm block mb-1">Ramos que ofrece</label>
          <div className="flex flex-wrap gap-3">
            {ramosOpts.map((r) => (
              <label key={r.id} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.ramosIds.includes(r.id)}
                  onChange={() => toggleRamo(r.id)}
                />
                <span>{r.nombre}</span>
              </label>
            ))}
            {ramosOpts.length === 0 && (
              <span className="text-sm text-slate-500">No hay ramos activos</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : form.id ? "Actualizar" : "Guardar aseguradora"}
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
              <th className="text-left p-2">Teléfono</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Estado</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="p-3 text-center">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-center">
                  Sin datos
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.nombre}</td>
                  <td className="p-2">{r.telefono || "-"}</td>
                  <td className="p-2">{r.email || "-"}</td>
                  <td className="p-2">{r.estado}</td>
                  <td className="p-2 flex gap-2">
                    <button className="px-2 py-1 border rounded" onClick={() => onEdit(r)}>
                      Editar
                    </button>
                    <button className="px-2 py-1 border rounded" onClick={() => onToggleEstadoRow(r)}>
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

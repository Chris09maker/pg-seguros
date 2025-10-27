// client/src/pages/coberturas/Index.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";

function BadgeEstado({ estado }) {
  const ok = String(estado).toUpperCase() === "ACTIVO";
  return (
    <span
      className={
        "px-2 py-1 text-xs rounded-full " +
        (ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")
      }
    >
      {ok ? "Activo" : "Inactivo"}
    </span>
  );
}

export default function CoberturasIndex() {
  // ----------- selección de póliza (ID) -----------
  const [polizaId, setPolizaId] = useState("");
  const [polizaResumen, setPolizaResumen] = useState(null);

  // ----------- catálogo de coberturas (combo) -----------
  const [catCoberturas, setCatCoberturas] = useState([]);
  const [loadingCat, setLoadingCat] = useState(false);

  // ----------- tabla poliza_coberturas -----------
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);

  // ----------- form para agregar cobertura a la póliza -----------
  const emptyForm = useMemo(
    () => ({ cobertura_id: "", suma_asegurada: "", deducible: "" }),
    []
  );
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const firstLoad = useRef(true);

  /* ===================== Cargar catálogo ===================== */
  const loadCatalog = useCallback(async () => {
    if (loadingCat) return;
    setLoadingCat(true);
    try {
      const { data } = await api.get("/coberturas", {
        params: { estado: "ACTIVO", limit: 100 },
      });
      const items = Array.isArray(data) ? data : data?.items ?? [];
      setCatCoberturas(items);
    } catch (e) {
      console.error(e);
      alert("No se pudo cargar el catálogo de coberturas.");
      setCatCoberturas([]);
    } finally {
      setLoadingCat(false);
    }
  }, [loadingCat]);

  /* ===================== Cargar coberturas de la póliza ===================== */
  const loadPolizaCoberturas = useCallback(async () => {
    if (!polizaId) {
      setRows([]);
      setPolizaResumen(null);
      return;
    }
    setLoadingRows(true);
    try {
      // Trae listado de coberturas de la póliza
      const { data } = await api.get(`/polizas/${polizaId}/coberturas`);
      const items = Array.isArray(data) ? data : data?.items ?? [];

      // Encabezado/resumen (opcional)
      setPolizaResumen(items.length ? { id: polizaId } : { id: polizaId });

      setRows(items);
    } catch (e) {
      console.error(e);
      alert("No se pudieron cargar las coberturas de la póliza.");
      setRows([]);
      setPolizaResumen(null);
    } finally {
      setLoadingRows(false);
    }
  }, [polizaId]);

  /* ===================== Primer render ===================== */
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      loadCatalog().catch(() => {});
    }
  }, [loadCatalog]);

  /* ===================== Acciones ===================== */
  async function onAgregar(e) {
    e.preventDefault();
    if (!polizaId) return alert("Primero selecciona el ID de la póliza.");
    const coberturaId = Number(form.cobertura_id || 0);
    if (!coberturaId) return alert("Selecciona una cobertura.");

    setSaving(true);
    try {
      await api.post(`/polizas/${polizaId}/coberturas`, {
        cobertura_id: coberturaId,
        ...(form.suma_asegurada ? { suma_asegurada: form.suma_asegurada } : {}),
        ...(form.deducible ? { deducible: form.deducible } : {}),
      });
      setForm(emptyForm);
      await loadPolizaCoberturas();
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 409) {
        alert("Esa cobertura ya está asignada a la póliza.");
      } else {
        alert("No se pudo agregar la cobertura.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onEliminar(row) {
    if (!polizaId) return;
    if (!confirm(`¿Eliminar la cobertura "${row.cobertura}" de la póliza?`)) return;
    try {
      await api.delete(`/polizas/${polizaId}/coberturas/${row.id}`);
      setRows((prev) => prev.filter((x) => x.id !== row.id));
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar la cobertura.");
    }
  }

  // Si más adelante habilitas un endpoint para cambiar estado, aquí queda listo:
  async function onToggleEstado(row) {
    const next = row.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    if (!confirm(`¿Cambiar estado a ${next}?`)) return;
    try {
      await api.put(`/polizas/${polizaId}/coberturas/${row.id}`, { estado: next });
      setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, estado: next } : x)));
    } catch (err) {
      console.error(err);
      alert("No se pudo cambiar el estado (endpoint no disponible).");
    }
  }

  /* ===================== Render ===================== */
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Coberturas — Mantenimiento (por póliza)</h2>

      {/* Selector de póliza */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_auto] gap-2 items-center">
        <div className="text-sm text-slate-600">
          <div className="font-medium mb-1">Póliza (ID numérico)</div>
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Ej. 1"
            value={polizaId}
            onChange={(e) => setPolizaId(e.target.value.replace(/\D+/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && loadPolizaCoberturas()}
          />
        </div>
        <div className="flex gap-2 pt-6 md:pt-0">
          <button onClick={loadPolizaCoberturas} className="px-3 py-2 rounded border">
            Cargar coberturas de póliza
          </button>
          <button
            onClick={() => {
              setPolizaId("");
              setPolizaResumen(null);
              setRows([]);
            }}
            className="px-3 py-2 rounded border"
          >
            Limpiar
          </button>
        </div>
      </div>

      {polizaResumen && (
        <div className="text-sm text-slate-700">
          <span className="font-medium">Póliza seleccionada:</span> #{polizaResumen.id}
        </div>
      )}

      {/* Formulario: agregar cobertura a la póliza */}
      <form onSubmit={onAgregar} className="bg-slate-50 rounded-xl p-4 grid md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="text-sm block mb-1">Cobertura</label>
          <select
            className="border rounded px-3 py-2 w-full"
            value={form.cobertura_id}
            onChange={(e) => setForm((s) => ({ ...s, cobertura_id: e.target.value }))}
            disabled={!polizaId || loadingCat}
          >
            <option value="">{loadingCat ? "Cargando…" : "Seleccione…"}</option>
            {catCoberturas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm block mb-1">Suma asegurada</label>
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Opcional"
            value={form.suma_asegurada}
            onChange={(e) => setForm((s) => ({ ...s, suma_asegurada: e.target.value }))}
            disabled={!polizaId}
          />
        </div>
        <div>
          <label className="text-sm block mb-1">Deducible</label>
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Opcional"
            value={form.deducible}
            onChange={(e) => setForm((s) => ({ ...s, deducible: e.target.value }))}
            disabled={!polizaId}
          />
        </div>
        <div className="md:col-span-4 flex gap-2">
          <button
            disabled={!polizaId || saving}
            className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
          >
            {saving ? "Agregando…" : "Agregar cobertura"}
          </button>
        </div>
      </form>

      {/* Tabla de poliza_coberturas */}
      <div className="border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-2">Cobertura</th>
              <th className="text-left p-2">Descripción</th>
              <th className="text-left p-2">Suma asegurada</th>
              <th className="text-left p-2">Deducible</th>
              <th className="text-left p-2">Estado</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadingRows && (
              <tr>
                <td colSpan={6} className="p-3 text-center">
                  Cargando…
                </td>
              </tr>
            )}
            {!loadingRows && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-center">
                  {polizaId ? "Sin coberturas asignadas" : "Selecciona una póliza"}
                </td>
              </tr>
            )}
            {!loadingRows &&
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.cobertura}</td>
                  <td className="p-2">{r.descripcion || "-"}</td>
                  <td className="p-2">{r.suma_asegurada ?? "-"}</td>
                  <td className="p-2">{r.deducible ?? "-"}</td>
                  <td className="p-2">{r.estado ? <BadgeEstado estado={r.estado} /> : "-"}</td>
                  <td className="p-2 flex gap-2">
                    {/* Botón oculto hasta que exista endpoint PUT para cambiar estado */}
                    <button
                      className="px-2 py-1 border rounded hidden"
                      onClick={() => onToggleEstado(r)}
                      title="Cambiar estado (requiere endpoint)"
                    >
                      Cambiar estado
                    </button>
                    <button className="px-2 py-1 border rounded" onClick={() => onEliminar(r)}>
                      Eliminar
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

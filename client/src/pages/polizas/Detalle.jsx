import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

const ESTADOS = ["ACTIVA", "EN_REVISION", "ANULADA", "VENCIDA"];
// Toggle para mostrar/ocultar la UI de coberturas (mantenimiento futuro).
const SHOW_COBERTURAS = false;

function BadgePago({ pagada }) {
  const ok = Number(pagada) === 1;
  const cls = ok
    ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
    : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800";
  return <span className={cls}>{ok ? "Pagada" : "Con saldo"}</span>;
}

export default function PolizaDetalle() {
  const params = useParams();
  const nav = useNavigate();

  const rawId = params.id ?? "";
  const isNew = !rawId || ["new", "nueva", "crear", "create"].includes(rawId);

  const empty = useMemo(
    () => ({
      id: null,
      codigo: "",
      clienteId: null,
      clienteDpi: "",
      cliente: "",
      aseguradoraId: "",
      ramoId: "",
      planId: "",
      tipo: "",
      moneda: "Q",
      primaTotal: "",
      fechaEmision: "",
      inicioVigencia: "",
      finVigencia: "",
      estado: "ACTIVA",
      observaciones: "",
    }),
    []
  );

  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const [payInfo, setPayInfo] = useState({ totalPagado: 0, saldo: 0, pagada: 0 });

  // Catálogos
  const [ramos, setRamos] = useState([]);
  const [aseguradoras, setAseguradoras] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [coberturas, setCoberturas] = useState([]);

  // Coberturas por póliza
  const [cobRows, setCobRows] = useState([]);
  const [coberturaId, setCoberturaId] = useState("");
  const [savingCob, setSavingCob] = useState(false);

  const fmt = (n) => Number(n || 0).toFixed(2);

  // Catálogos base
  useEffect(() => {
    (async () => {
      try {
        const [r1, r2, r3] = await Promise.all([
          api.get("/ramos", { params: { estado: "ACTIVO", limit: 1000 } }),
          api.get("/aseguradoras", { params: { estado: "ACTIVO", limit: 1000 } }),
          api.get("/coberturas", { params: { estado: "ACTIVO", limit: 1000 } }),
        ]);
        setRamos(Array.isArray(r1.data) ? r1.data : r1.data.items || []);
        setAseguradoras(Array.isArray(r2.data) ? r2.data : r2.data.items || []);
        setCoberturas(Array.isArray(r3.data) ? r3.data : r3.data.items || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Planes dependientes de aseguradora (y opcionalmente de ramo)
  useEffect(() => {
    (async () => {
      if (!form.aseguradoraId) {
        setPlanes([]);
        setForm((s) => ({ ...s, planId: "" }));
        return;
      }
      try {
        const { data } = await api.get(
          `/planes/by-aseguradora/${form.aseguradoraId}`,
          { params: form.ramoId ? { ramoId: form.ramoId } : {} }
        );
        setPlanes(Array.isArray(data) ? data : []);
        if (
          form.planId &&
          !(Array.isArray(data) && data.some((p) => String(p.id) === String(form.planId)))
        ) {
          setForm((s) => ({ ...s, planId: "" }));
        }
      } catch (e) {
        console.error(e);
        setPlanes([]);
        setForm((s) => ({ ...s, planId: "" }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.aseguradoraId, form.ramoId]);

  // Cargar detalle
  useEffect(() => {
    if (isNew) {
      setForm(empty);
      setPayInfo({ totalPagado: 0, saldo: 0, pagada: 0 });
      setCobRows([]);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get(`/polizas/${rawId}`);
        setForm({
          id: data.id,
          codigo: data.codigo || "",
          clienteId: data.clienteId || null,
          clienteDpi: data.clienteDpi || "",
          cliente: data.cliente || "",
          aseguradoraId: data.aseguradoraId ? String(data.aseguradoraId) : "",
          ramoId: data.ramoId ? String(data.ramoId) : "",
          planId: data.planId ? String(data.planId) : "",
          tipo: data.tipo || "",
          moneda: data.moneda || "Q",
          primaTotal: data.primaTotal ?? "",
          fechaEmision: data.fechaEmision || "",
          inicioVigencia: data.inicioVigencia || "",
          finVigencia: data.finVigencia || "",
          estado: data.estado || "ACTIVA",
          observaciones: data.observaciones || "",
        });
        setPayInfo({
          totalPagado: Number(data.totalPagado || 0),
          saldo: Number(data.saldo || 0),
          pagada: Number(data.pagada || 0),
        });
        await loadCoberturas(data.id);
      } catch (e) {
        console.error(e);
        alert("No se pudo cargar la póliza");
      }
    })();
  }, [isNew, rawId, empty]);

  async function loadCoberturas(polizaId) {
    try {
      const { data } = await api.get(`/polizas/${polizaId}/coberturas`);
      setCobRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setCobRows([]);
    }
  }

  // Buscar cliente por DPI
  const [dpiBuscar, setDpiBuscar] = useState("");
  async function buscarPorDpi() {
    const raw = (dpiBuscar || "").replace(/\D/g, "");
    if (!raw || raw.length !== 13) return alert("Ingrese DPI válido (13 dígitos).");
    try {
      const { data } = await api.get("/polizas/cliente-por-dpi/search", { params: { dpi: raw } });
      if (!data?.id) return alert("No se encontró cliente con ese DPI.");
      setForm((s) => ({ ...s, clienteId: data.id, clienteDpi: raw, cliente: data.nombre || "" }));
    } catch (e) {
      console.error(e);
      alert("No se pudo buscar por DPI.");
    }
  }

  // Guardar
  async function onSubmit(e) {
    e.preventDefault();

    if (!form.codigo) return alert("El código es obligatorio.");
    if (!form.clienteId && !form.clienteDpi) return alert("Debe seleccionar un cliente.");
    if (!form.aseguradoraId) return alert("Debe seleccionar la aseguradora.");
    if (!form.ramoId) return alert("Debe seleccionar el ramo.");
    if (!form.planId) return alert("Debe seleccionar el plan.");

    const payload = {
      codigo: String(form.codigo).trim(),
      clienteId: form.clienteId || undefined,
      clienteDpi: form.clienteDpi || undefined,
      aseguradoraId: Number(form.aseguradoraId),
      ramoId: Number(form.ramoId),
      planId: Number(form.planId),
      tipo: form.tipo || undefined,
      moneda: (form.moneda || "Q").toUpperCase(),
      primaTotal: Number(form.primaTotal || 0),
      fechaEmision: form.fechaEmision || undefined,
      inicioVigencia: form.inicioVigencia || undefined,
      finVigencia: form.finVigencia || undefined,
      estado: form.estado || "ACTIVA",
      observaciones: form.observaciones || undefined,
    };

    setSaving(true);
    try {
      if (isNew) {
        const { data } = await api.post("/polizas", payload);
        nav(`/app/polizas/${data.id}`);
      } else {
        await api.put(`/polizas/${form.id}`, payload);
        alert("Póliza actualizada.");
      }
    } catch (err) {
      console.error(err);
      const s = err?.response?.status;
      if (s === 409) alert("El código de póliza ya existe.");
      else alert(isNew ? "No se pudo crear la póliza." : "No se pudo actualizar la póliza.");
    } finally {
      setSaving(false);
    }
  }

  // Coberturas (subtabla)
  async function addCobertura() {
    if (!form.id) return;
    if (!coberturaId) return alert("Seleccione una cobertura.");
    setSavingCob(true);
    try {
      await api.post(`/polizas/${form.id}/coberturas`, { coberturaId: Number(coberturaId) });
      setCoberturaId("");
      await loadCoberturas(form.id);
    } catch (e) {
      console.error(e);
      const s = e?.response?.status;
      if (s === 409) alert("La póliza ya tiene esta cobertura.");
      else alert("No se pudo agregar la cobertura.");
    } finally {
      setSavingCob(false);
    }
  }

  async function delCobertura(cid) {
    if (!form.id) return;
    if (!confirm("¿Eliminar cobertura?")) return;
    try {
      await api.delete(`/polizas/${form.id}/coberturas/${cid}`);
      await loadCoberturas(form.id);
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar la cobertura.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isNew ? "Nueva póliza" : `Póliza #${form.id || ""}`}</h2>
        <div className="flex gap-2 items-center">
          {!isNew && <BadgePago pagada={payInfo.pagada} />}
          <button onClick={() => nav("/app/polizas")} className="px-3 py-2 rounded border">
            Volver
          </button>
        </div>
      </div>

      {/* Formulario principal */}
      <form onSubmit={onSubmit} className="bg-slate-50 rounded-xl p-4 grid gap-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm block mb-1">Código*</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.codigo}
              onChange={(e) => setForm((s) => ({ ...s, codigo: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Cliente (DPI)</label>
            <div className="flex gap-2">
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="DPI (13 dígitos)"
                value={dpiBuscar}
                onChange={(e) => setDpiBuscar(e.target.value)}
              />
              <button type="button" onClick={buscarPorDpi} className="px-3 py-2 border rounded">
                Buscar
              </button>
            </div>
            {form.cliente && (
              <div className="text-xs text-slate-500 mt-1">
                Seleccionado: {form.cliente} — DPI {form.clienteDpi || "-"}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm block mb-1">Aseguradora*</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.aseguradoraId}
              onChange={(e) => setForm((s) => ({ ...s, aseguradoraId: e.target.value }))}
            >
              <option value="">Seleccione…</option>
              {aseguradoras.map((a) => (
                <option key={a.id} value={String(a.id)}>
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
              onChange={(e) => setForm((s) => ({ ...s, ramoId: e.target.value }))}
            >
              <option value="">Seleccione…</option>
              {ramos.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Plan*</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.planId}
              onChange={(e) => setForm((s) => ({ ...s, planId: e.target.value }))}
            >
              <option value="">Seleccione…</option>
              {planes.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Tipo</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.tipo}
              onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Moneda</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.moneda}
              onChange={(e) => setForm((s) => ({ ...s, moneda: e.target.value.toUpperCase() }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Prima total</label>
            <input
              type="number"
              step="0.01"
              className="border rounded px-3 py-2 w-full"
              value={form.primaTotal}
              onChange={(e) => setForm((s) => ({ ...s, primaTotal: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Fecha de emisión</label>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={form.fechaEmision}
              onChange={(e) => setForm((s) => ({ ...s, fechaEmision: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Inicio de vigencia</label>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={form.inicioVigencia}
              onChange={(e) => setForm((s) => ({ ...s, inicioVigencia: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Fin de vigencia</label>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={form.finVigencia}
              onChange={(e) => setForm((s) => ({ ...s, finVigencia: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Estado</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.estado}
              onChange={(e) => setForm((s) => ({ ...s, estado: e.target.value }))}
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-sm block mb-1">Observaciones</label>
            <textarea
              className="border rounded px-3 py-2 w-full"
              rows={3}
              value={form.observaciones}
              onChange={(e) => setForm((s) => ({ ...s, observaciones: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : isNew ? "Crear póliza" : "Actualizar póliza"}
          </button>
        </div>
      </form>

      {/* Estado de pago */}
      {!isNew && (
        <div className="rounded border p-4">
          <div className="text-sm text-slate-500 mb-2">Estado de pago</div>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Prima total</span>
              <span className="font-semibold">
                {form.moneda} {fmt(form.primaTotal)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Total pagado</span>
              <span className="font-semibold">
                {form.moneda} {fmt(payInfo.totalPagado)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Saldo</span>
              <span className="font-semibold">
                {form.moneda} {fmt(payInfo.saldo)}
              </span>
            </li>
          </ul>
          <div className="mt-3">
            <BadgePago pagada={payInfo.pagada} />
          </div>
        </div>
      )}

      {/* Coberturas por póliza — oculto temporalmente */}
      {SHOW_COBERTURAS && (
        <section className="border rounded p-4 space-y-3">
          <h3 className="font-medium">Coberturas</h3>

          {!form.id && (
            <div className="text-sm text-slate-500">
              Para gestionar coberturas primero debe guardar la póliza.
            </div>
          )}

          {form.id && (
            <>
              <div className="grid md:grid-cols-3 gap-2">
                <div className="md:col-span-2">
                  <label className="text-sm block mb-1">Cobertura</label>
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={coberturaId}
                    onChange={(e) => setCoberturaId(e.target.value)}
                  >
                    <option value="">Seleccione…</option>
                    {coberturas.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    disabled={savingCob}
                    onClick={addCobertura}
                    className="px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
                  >
                    {savingCob ? "Agregando…" : "Agregar cobertura"}
                  </button>
                </div>
              </div>

              <div className="border rounded overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-2">Cobertura</th>
                      <th className="text-left p-2">Descripción</th>
                      <th className="text-left p-2">Estado</th>
                      <th className="text-left p-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobRows.length === 0 && (
                      <tr>
                        <td className="p-3 text-center" colSpan={4}>
                          Sin coberturas registradas
                        </td>
                      </tr>
                    )}
                    {cobRows.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="p-2">{c.cobertura}</td>
                        <td className="p-2">{c.descripcion || "-"}</td>
                        <td className="p-2">{c.estado || "-"}</td>
                        <td className="p-2">
                          <button
                            className="px-2 py-1 border rounded"
                            onClick={() => delCobertura(c.coberturaId)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

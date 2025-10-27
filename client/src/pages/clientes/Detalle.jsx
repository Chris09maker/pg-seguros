import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

/* -------------------- UI helpers -------------------- */
function BadgeEstado({ estado }) {
  const act = String(estado || "").toUpperCase() === "ACTIVO";
  const cls = act
    ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
    : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800";
  return <span className={cls}>{act ? "Activo" : "Dado de baja"}</span>;
}

const CONTACTO_PREF = ["Email", "WhatsApp", "Llamada"];
const GENEROS = ["Masculino", "Femenino", "Otro"];
const ESTADO_CIVIL = ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a"];
const ACTIVO = ["ACTIVO", "INACTIVO"];

/* -------------------- Component -------------------- */
export default function ClienteDetalle() {
  const { id: rawId } = useParams();
  const nav = useNavigate();

  const isNew =
    !rawId ||
    rawId === "nuevo" ||
    rawId === "new" ||
    rawId === "crear" ||
    rawId === "create";

  const empty = useMemo(
    () => ({
      id: null,
      nombre: "",
      dpi: "",
      nit: "",
      telefono: "",
      celular: "",
      email: "",
      direccion: "",
      municipio: "",
      departamento: "",
      contactoPreferido: "",
      fechaNacimiento: "",
      genero: "",
      estadoCivil: "",
      ocupacion: "",
      edad: "",
      canal: "",
      observaciones: "",
      estado: "ACTIVO", // ACTIVO/INACTIVO
      cartera: "AL_DIA", // viene de la vista
      estadoCarteraDb: "", // por si quieres mostrarlo en UI más adelante
    }),
    []
  );

  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      setForm(empty);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get(`/clientes/${rawId}`);
        setForm({
          id: data.id,
          nombre: data.nombre || "",
          dpi: data.dpi || "",
          nit: data.nit || "",
          telefono: data.telefono || "",
          celular: data.celular || "",
          email: data.email || "",
          direccion: data.direccion || "",
          municipio: data.municipio || "",
          departamento: data.departamento || "",
          contactoPreferido: data.contactoPreferido || "",
          fechaNacimiento: data.fechaNacimiento || "",
          genero: data.genero || "",
          estadoCivil: data.estadoCivil || "",
          ocupacion: data.ocupacion || "",
          edad: data.edad ?? "",
          canal: data.canal || "",
          observaciones: data.observaciones || "",
          estado: data.estado || "ACTIVO",
          cartera: data.cartera || "AL_DIA",
          estadoCarteraDb: data.estadoCarteraDb || "",
        });
      } catch (err) {
        console.error(err);
        alert("No se pudo cargar el cliente.");
      }
    })();
  }, [isNew, rawId, empty]);

  const onChange = (k) => (e) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const cleanDpi = (v) => String(v || "").replace(/\D/g, "");

  async function onSubmit(e) {
    e.preventDefault();

    const dpiRaw = cleanDpi(form.dpi);
    if (!form.nombre || dpiRaw.length !== 13) {
      alert("Revise los datos obligatorios.");
      return;
    }

    const payload = {
      nombre: String(form.nombre || "").trim(),
      dpi: dpiRaw,
      nit: String(form.nit ?? "").trim(),
      telefono: String(form.telefono ?? "").trim(),
      celular: String(form.celular ?? "").trim(),
      email: String(form.email ?? "").trim(),
      direccion: String(form.direccion ?? "").trim(),
      municipio: String(form.municipio ?? "").trim(),
      departamento: String(form.departamento ?? "").trim(),
      contactoPreferido: form.contactoPreferido || "",
      fechaNacimiento: form.fechaNacimiento || "",
      genero: form.genero || "",
      estadoCivil: form.estadoCivil || "",
      ocupacion: String(form.ocupacion ?? "").trim(),
      edad: form.edad === "" ? "" : Number(form.edad),
      canal: String(form.canal ?? "").trim(),
      observaciones: String(form.observaciones ?? "").trim(),
      estado: form.estado || "ACTIVO",
    };

    setSaving(true);
    try {
      if (isNew) {
        const { data } = await api.post("/clientes", payload);
        nav(`/app/clientes/${data.id}`);
      } else {
        await api.put(`/clientes/${form.id}`, payload);
        alert("Cliente actualizado.");
      }
    } catch (err) {
      console.error(err);
      const s = err?.response?.status;
      if (s === 409) alert("El DPI ya existe.");
      else alert(isNew ? "No se pudo crear el cliente." : "No se pudo actualizar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstado(nuevo) {
    if (!form.id) return;
    const dpiRaw = cleanDpi(form.dpi);
    try {
      setSaving(true);
      await api.put(`/clientes/${form.id}`, {
        estado: nuevo,
        // re-enviamos campos clave para evitar sobreescrituras con vacíos
        nombre: String(form.nombre || "").trim(),
        dpi: dpiRaw,
        nit: String(form.nit ?? "").trim(),
        telefono: String(form.telefono ?? "").trim(),
        celular: String(form.celular ?? "").trim(),
        email: String(form.email ?? "").trim(),
        direccion: String(form.direccion ?? "").trim(),
      });
      setForm((s) => ({ ...s, estado: nuevo }));
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar el estado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cliente — Detalle / Formulario</h2>
        <div className="flex items-center gap-2">
          <BadgeEstado estado={form.estado} />
          {!isNew && form.estado === "ACTIVO" && (
            <button
              onClick={() => cambiarEstado("INACTIVO")}
              className="px-3 py-2 rounded bg-slate-800 text-white"
            >
              Dar de baja
            </button>
          )}
          {!isNew && form.estado === "INACTIVO" && (
            <button
              onClick={() => cambiarEstado("ACTIVO")}
              className="px-3 py-2 rounded bg-indigo-700 text-white"
            >
              Reactivar
            </button>
          )}
          <button onClick={() => nav("/app/clientes")} className="px-3 py-2 rounded border">
            Volver
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cliente"}
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="bg-slate-50 rounded-xl p-4 grid gap-4">
        {/* 1a fila */}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm block mb-1">Nombre*</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.nombre}
              onChange={onChange("nombre")}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">NIT</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.nit}
              onChange={onChange("nit")}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">DPI (13 dígitos)</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.dpi}
              onChange={onChange("dpi")}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Fecha de nacimiento</label>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full"
              value={form.fechaNacimiento}
              onChange={onChange("fechaNacimiento")}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Teléfono</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.telefono}
              onChange={onChange("telefono")}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Celular</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.celular}
              onChange={onChange("celular")}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Email</label>
            <input
              type="email"
              className="border rounded px-3 py-2 w-full"
              value={form.email}
              onChange={onChange("email")}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Género</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.genero}
              onChange={onChange("genero")}
            >
              <option value="">Seleccione…</option>
              {GENEROS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Estado civil</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.estadoCivil}
              onChange={onChange("estadoCivil")}
            >
              <option value="">Seleccione…</option>
              {ESTADO_CIVIL.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm block mb-1">Ocupación</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.ocupacion}
              onChange={onChange("ocupacion")}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Edad</label>
            <input
              type="number"
              min="0"
              className="border rounded px-3 py-2 w-full"
              value={form.edad}
              onChange={onChange("edad")}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Canal</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.canal}
              onChange={onChange("canal")}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm block mb-1">Dirección</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.direccion}
              onChange={onChange("direccion")}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Municipio</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.municipio}
              onChange={onChange("municipio")}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Departamento</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.departamento}
              onChange={onChange("departamento")}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Contacto preferido</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.contactoPreferido}
              onChange={onChange("contactoPreferido")}
            >
              <option value="">Seleccione…</option>
              {CONTACTO_PREF.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Estado activo</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.estado}
              onChange={onChange("estado")}
            >
              {ACTIVO.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm block mb-1">Observaciones</label>
            <textarea
              rows={3}
              className="border rounded px-3 py-2 w-full"
              value={form.observaciones}
              onChange={onChange("observaciones")}
            />
          </div>

          {/* Info de cartera (solo lectura) */}
          <div>
            <label className="text-sm block mb-1">Estado cartera</label>
            <select className="border rounded px-3 py-2 w-full" value={form.cartera} disabled>
              <option value="AL_DIA">Al día</option>
              <option value="CON_DEUDA">Con deuda</option>
            </select>
          </div>
          <div className="text-sm text-slate-500 self-end">
            <span className="block">
              {/* Muestra opcional del estado de la columna `estado` (cobranza) si te sirve */}
              {form.estadoCarteraDb ? `Detalle cartera: ${form.estadoCarteraDb}` : ""}
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}

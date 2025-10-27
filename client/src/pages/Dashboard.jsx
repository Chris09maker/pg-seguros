// client/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import dayjs from "dayjs";
import api from "../services/api";

// utilidades de fecha
const fmt = (d) => dayjs(d).format("YYYY-MM-DD");
const today = dayjs();

// clases utilitarias por prioridad (estética)
const prioCls = (p) => {
  const v = String(p || "").toLowerCase();
  if (v === "alta") {
    return {
      bar: "border-l-4 border-red-600",
      pill: "bg-red-100 text-red-700",
      itemBg: "bg-red-50/40",
      dot: "#b91c1c",
    };
  }
  if (v === "media") {
    return {
      bar: "border-l-4 border-amber-500",
      pill: "bg-amber-100 text-amber-700",
      itemBg: "bg-amber-50/40",
      dot: "#b45309",
    };
  }
  return {
    bar: "border-l-4 border-emerald-600",
    pill: "bg-emerald-100 text-emerald-700",
    itemBg: "bg-emerald-50/40",
    dot: "#0b6b57",
  };
};

export default function Dashboard() {
  // ===== Calendario =====
  const [month, setMonth] = useState(dayjs().startOf("month").toDate()); // mes visible
  const [selected, setSelected] = useState(undefined);
  const [itemsByDay, setItemsByDay] = useState({}); // { 'YYYY-MM-DD': [items] }

  // ===== Modal / edición =====
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // ===== Form =====
  const [form, setForm] = useState({
    fecha: fmt(today),
    hora: dayjs().format("HH:mm"),
    titulo: "",
    tipo: "otro",        // pago | poliza | cliente | otro
    prioridad: "media",  // alta | media | baja
    detalle: "",
  });

  // ---------- Cargar recordatorios del mes visible ----------
  const reloadMonth = async (refMonth = month) => {
    try {
      const start = dayjs(refMonth).startOf("month").format("YYYY-MM-DD");
      const end = dayjs(refMonth).endOf("month").format("YYYY-MM-DD");

      const { data } = await api.get(`/recordatorios?desde=${start}&hasta=${end}`);

      // Normalizar fecha (el back puede devolver ISO con T...Z)
      const byDay = {};
      for (const it of data.items ?? []) {
        const key = dayjs(it.fecha).format("YYYY-MM-DD");
        const normalized = { ...it, fecha: key };
        if (!byDay[key]) byDay[key] = [];
        byDay[key].push(normalized);
      }
      setItemsByDay(byDay);
    } catch {
      alert("No se pudo cargar recordatorios del mes.");
    }
  };

  // Cargar al entrar y cuando cambie el mes visible
  useEffect(() => {
    reloadMonth(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // ---------- Derivados para panel derecho ----------
  const { vencidos48h, proximos } = useMemo(() => {
    const now = dayjs();
    const h48 = now.subtract(48, "hour");

    const all = Object.values(itemsByDay).flat();
    const list = Array.isArray(all) ? all : [];

    const vencidos = [];
    const ups = [];

    for (const r of list) {
      const baseDate = dayjs(r.fecha).format("YYYY-MM-DD");
      const fh = dayjs(`${baseDate} ${r.hora}`, "YYYY-MM-DD HH:mm");
      if (!fh.isValid()) continue;

      const isVencidoUlt48 = fh.isAfter(h48) && fh.isBefore(now) && r.estado !== "ANULADO";
      const isProximo = fh.isAfter(now) && r.estado !== "ANULADO";

      if (isVencidoUlt48) vencidos.push(r);
      if (isProximo) ups.push(r);
    }

    const sortByFH = (a, b) => {
      const aa = dayjs(`${dayjs(a.fecha).format("YYYY-MM-DD")} ${a.hora}`, "YYYY-MM-DD HH:mm").valueOf();
      const bb = dayjs(`${dayjs(b.fecha).format("YYYY-MM-DD")} ${b.hora}`, "YYYY-MM-DD HH:mm").valueOf();
      return aa - bb;
    };

    return {
      vencidos48h: vencidos.sort(sortByFH),
      proximos: ups.sort(sortByFH).slice(0, 10),
    };
  }, [itemsByDay]);

  // ---------- Abrir modal para crear en una fecha ----------
  const openForDate = (date) => {
    const k = fmt(date);
    setSelected(date);
    setEditing(null);
    setForm((f) => ({
      ...f,
      fecha: k,
      hora: dayjs().format("HH:mm"),
      titulo: "",
      tipo: "otro",
      prioridad: "media",
      detalle: "",
    }));
    setOpenModal(true);
  };

  // ---------- Editar un item existente ----------
  const editItem = (it) => {
    setEditing(it);
    setSelected(dayjs(it.fecha).toDate());
    setForm({
      fecha: dayjs(it.fecha).format("YYYY-MM-DD"),
      hora: it.hora,
      titulo: it.titulo,
      tipo: it.tipo,
      prioridad: it.prioridad ?? "media",
      detalle: it.detalle ?? "",
    });
    setOpenModal(true);
  };

  // ---------- Guardar (crear / actualizar) ----------
  const save = async () => {
    try {
      setSaving(true);

      const payload = {
        fecha: form.fecha,
        hora: form.hora,
        titulo: form.titulo,
        tipo: String(form.tipo || "otro").toLowerCase(),
        prioridad: String(form.prioridad || "media").toLowerCase(),
        detalle: form.detalle || "",
      };

      if (editing?.id) {
        const { data } = await api.put(`/recordatorios/${editing.id}`, { ...payload });
        const itemUpd = { ...data.item, fecha: dayjs(data.item.fecha).format("YYYY-MM-DD") };

        setItemsByDay((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            next[k] = (next[k] || []).filter((x) => x.id !== itemUpd.id);
            if (!next[k].length) delete next[k];
          }
          const arr = next[itemUpd.fecha] ?? [];
          next[itemUpd.fecha] = [...arr, itemUpd];
          return next;
        });

        await reloadMonth(dayjs(itemUpd.fecha).startOf("month").toDate());
      } else {
        const { data } = await api.post(`/recordatorios`, payload);
        const created = { ...data.item, fecha: dayjs(data.item.fecha).format("YYYY-MM-DD") };

        setItemsByDay((prev) => {
          const copy = { ...prev };
          const arr = copy[created.fecha] ?? [];
          copy[created.fecha] = [...arr, created];
          return copy;
        });

        await reloadMonth(dayjs(created.fecha).startOf("month").toDate());
      }

      setEditing(null);
      setOpenModal(false);
      setForm((f) => ({ ...f, titulo: "", detalle: "" }));
    } catch {
      alert("No se pudo guardar el recordatorio.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Eliminar ----------
  const removeItem = async (it) => {
    if (!window.confirm("¿Eliminar este recordatorio?")) return;
    try {
      await api.delete(`/recordatorios/${it.id}`);

      setItemsByDay((prev) => {
        const copy = { ...prev };
        copy[it.fecha] = (copy[it.fecha] || []).filter((x) => x.id !== it.id);
        if (!copy[it.fecha]?.length) delete copy[it.fecha];
        return copy;
      });

      await reloadMonth(dayjs(it.fecha).startOf("month").toDate());
    } catch {
      alert("No se pudo eliminar.");
    }
  };

  // ---------- Render ----------
  const modifiers = {
    hasItems: (date) => {
      const k = fmt(date);
      return !!(itemsByDay[k] && itemsByDay[k].length);
    },
  };

  return (
    <div className="p-6 space-y-6">
      {/* Estilos puntuales para el indicador del calendario */}
      <style>{`
        /* Indicador por día con items (un puntito, no un cuadro) */
        .rdp-day.dp-has-items {
          position: relative;
        }
        .rdp-day.dp-has-items .rdp-day_button::after {
          content: "";
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: 6px;
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #0b6b57; /* color corporativo */
        }
      `}</style>

      <h1 className="text-2xl font-semibold">Inicio / Dashboard</h1>
      <p className="text-sm meta">Resumen y calendario con recordatorios.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario */}
        <div className="rounded-xl border p-4">
          <div className="text-sm mb-2 meta">
            Clic en un día para agregar/editar recordatorios.
          </div>

          <DayPicker
            mode="single"
            month={month}
            onMonthChange={(m) => setMonth(m)}
            selected={selected}
            onSelect={(d) => d && openForDate(d)}
            modifiers={modifiers}
            modifiersClassNames={{ hasItems: "dp-has-items" }}
          />
        </div>

        {/* Panel derecho */}
        <div className="lg:col-span-2 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Selecciona una fecha</h2>
            <button
              className="px-4 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
              onClick={() => openForDate(selected || new Date())}
            >
              Nuevo recordatorio
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {/* Vencidos */}
            <div className="rounded-xl border p-4">
              <h3 className="text-base font-semibold mb-2">Vencidos (últimas 48h)</h3>
              {!vencidos48h.length ? (
                <div className="text-sm meta">Sin vencidos recientes</div>
              ) : (
                <ul className="space-y-3">
                  {vencidos48h.map((it) => {
                    const cls = prioCls(it.prioridad);
                    return (
                      <li
                        key={`v-${it.id}`}
                        className={`flex items-start justify-between rounded-lg border ${cls.bar} ${cls.itemBg} p-3`}
                      >
                        <div>
                          <div className="font-medium leading-6">
                            <span className="text-slate-500 mr-1">
                              {dayjs(it.fecha).format("YYYY-MM-DD")} {it.hora} —
                            </span>{" "}
                            {it.titulo}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${cls.pill}`}>
                              {String(it.prioridad || "").toUpperCase()}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                              {it.tipo}
                            </span>
                            {it.detalle ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-50 text-slate-500">
                                {it.detalle}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => editItem(it)}
                            className="px-3 py-1 rounded border btn-outline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => removeItem(it)}
                            className="px-3 py-1 rounded border btn-danger"
                          >
                            Eliminar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Próximos */}
            <div className="rounded-xl border p-4">
              <h3 className="text-base font-semibold mb-2">Próximos</h3>
              {!proximos.length ? (
                <div className="text-sm meta">Sin próximos</div>
              ) : (
                <ul className="space-y-3">
                  {proximos.map((it) => {
                    const cls = prioCls(it.prioridad);
                    return (
                      <li
                        key={`p-${it.id}`}
                        className={`flex items-start justify-between rounded-lg border ${cls.bar} ${cls.itemBg} p-3`}
                      >
                        <div>
                          <div className="font-medium leading-6">
                            <span className="text-slate-500 mr-1">
                              {dayjs(it.fecha).format("YYYY-MM-DD")} {it.hora} —
                            </span>{" "}
                            {it.titulo}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${cls.pill}`}>
                              {String(it.prioridad || "").toUpperCase()}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                              {it.tipo}
                            </span>
                            {it.detalle ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-50 text-slate-500">
                                {it.detalle}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => editItem(it)}
                            className="px-3 py-1 rounded border btn-outline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => removeItem(it)}
                            className="px-3 py-1 rounded border btn-danger"
                          >
                            Eliminar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {openModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                {editing ? "Editar recordatorio" : "Nuevo recordatorio"}
              </h3>
              <button
                className="px-3 py-1 rounded border btn-outline"
                onClick={() => setOpenModal(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm meta">Fecha</label>
                <input
                  type="date"
                  className="w-full mt-1 rounded-md border p-2"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm meta">Hora</label>
                <input
                  type="time"
                  className="w-full mt-1 rounded-md border p-2"
                  value={form.hora}
                  onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm meta">Título</label>
                <input
                  type="text"
                  placeholder="Ej. Pago de póliza"
                  className="w-full mt-1 rounded-md border p-2"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm meta">Tipo</label>
                <select
                  className="w-full mt-1 rounded-md border p-2"
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                >
                  <option value="pago">pago</option>
                  <option value="poliza">poliza</option>
                  <option value="cliente">cliente</option>
                  <option value="otro">otro</option>
                </select>
              </div>

              <div>
                <label className="text-sm meta">Prioridad</label>
                <select
                  className="w-full mt-1 rounded-md border p-2"
                  value={form.prioridad}
                  onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}
                >
                  <option value="alta">alta</option>
                  <option value="media">media</option>
                  <option value="baja">baja</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm meta">Detalle</label>
                <input
                  type="text"
                  placeholder="Información adicional"
                  className="w-full mt-1 rounded-md border p-2"
                  value={form.detalle}
                  onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 rounded-lg btn-outline"
                onClick={() => setOpenModal(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

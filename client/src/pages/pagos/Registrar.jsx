import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../../services/api";

/* Validaciones del formulario. */
const schema = z.object({
  clienteId: z.string().min(1, "Debes seleccionar una póliza (autollenará el cliente)"),
  polizaId: z.string().min(1, "Selecciona/busca una póliza"),
  fechaPago: z.string().min(1, "La fecha es obligatoria"),
  monto: z.coerce.number().positive("Ingresa un monto válido (> 0)"),
  nroRecibo: z.string().min(1, "El número de recibo es obligatorio"),
  metodo: z.enum(["EFECTIVO", "TARJETA", "TRANSFERENCIA"], {
    required_error: "Selecciona un método de pago",
  }),
  observaciones: z.string().optional(),
});

export default function PagosRegistrar() {
  const nav = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clienteId: "",
      polizaId: "",
      fechaPago: "",
      monto: "",
      nroRecibo: "",
      metodo: "EFECTIVO",
      observaciones: "",
    },
  });

  /* Búsqueda de póliza por código o id. */
  const [polizaQuery, setPolizaQuery] = useState("");
  const [polizaPreview, setPolizaPreview] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");

  async function buscarPoliza() {
    const q = (polizaQuery || "").trim();
    if (!q) return alert("Ingresa código de póliza o ID.");

    try {
      let poliza = null;
      if (/^\d+$/.test(q)) {
        const { data } = await api.get(`/polizas/${q}`);
        poliza = data;
      } else {
        const { data } = await api.get("/polizas", { params: { q } });
        const list = data?.items || [];
        poliza =
          list.find((p) => (p?.codigo || "").toLowerCase() === q.toLowerCase()) ||
          list[0];
      }
      if (!poliza?.id) throw new Error("NO_ENCONTRADA");

      setValue("polizaId", String(poliza.id), { shouldValidate: true });
      setValue("clienteId", String(poliza.clienteId), { shouldValidate: true });
      setPolizaPreview(
        `${poliza.codigo} • ${poliza.aseguradora || ""} • ${poliza.ramo || ""}`.replace(/\s•\s$/,"")
      );
      setClienteNombre(poliza.cliente || "");
    } catch {
      setValue("polizaId", "", { shouldValidate: true });
      setValue("clienteId", "", { shouldValidate: true });
      setPolizaPreview("");
      setClienteNombre("");
      alert("No se encontró la póliza.");
    }
  }

  /* Fecha máxima: hoy. */
  const hoyISO = new Date().toISOString().slice(0, 10);
  const fechaSeleccionada = watch("fechaPago");
  const fechaInvalida = fechaSeleccionada && fechaSeleccionada > hoyISO;

  /* Normalizar el monto a dos decimales (ej. 10.00). */
  const montoVal = watch("monto");
  useEffect(() => {
    // No forzar mientras escribe; solo al perder foco abajo.
  }, [montoVal]);
  const onBlurMonto = (e) => {
    const raw = String(e.target.value || "").replace(/,/g, "");
    if (!raw) return;
    const n = Number(raw);
    if (Number.isFinite(n)) setValue("monto", Number(n.toFixed(2)), { shouldValidate: true });
  };

  /* Prevenir salida con cambios sin guardar. */
  useEffect(() => {
    const handler = (ev) => {
      if (!isDirty) return;
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const onVolver = () => {
    if (isDirty && !confirm("Hay cambios sin guardar. ¿Deseas salir?")) return;
    nav("/app/pagos/historial");
  };

  const onSubmit = async (data) => {
    try {
      await api.post("/pagos", {
        polizaId: data.polizaId,
        fechaPago: data.fechaPago,
        // Enviar como número con dos decimales
        monto: Number(Number(data.monto).toFixed(2)),
        // Enviar con la clave que el back ahora acepta: nroRecibo
        nroRecibo: data.nroRecibo.trim(),
        metodo: data.metodo, // EFECTIVO | TARJETA | TRANSFERENCIA
        observaciones: data.observaciones?.trim() || undefined,
      });
      alert("✅ Pago registrado correctamente");
      nav("/app/pagos/historial");
    } catch (err) {
      const s = err?.response?.status;
      alert(
        s === 409
          ? (err?.response?.data?.message || "⚠️ Conflicto al registrar el pago")
          : err?.response?.data?.message || "❌ Error registrando el pago"
      );
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Pagos — Registrar cobro</h2>
        <button onClick={onVolver} className="px-3 py-2 rounded border">Volver</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 max-w-2xl">
        {/* Póliza */}
        <div>
          <label className="block text-sm mb-1">Póliza (código o ID)</label>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              className="border rounded px-3 py-2"
              placeholder="Ej. POL-000351 o 351"
              value={polizaQuery}
              onChange={(e) => setPolizaQuery(e.target.value)}
              onBlur={buscarPoliza}
            />
            <button type="button" onClick={buscarPoliza} className="px-3 py-2 rounded border">
              Buscar
            </button>
          </div>
          <input className="border rounded px-3 py-2 mt-2 bg-slate-50" value={polizaPreview} readOnly />
          <input type="hidden" {...register("polizaId")} />
          {errors.polizaId && <p className="text-red-600 text-sm">{errors.polizaId.message}</p>}
        </div>

        {/* Cliente (solo display) */}
        <div>
          <label className="block text-sm mb-1">Cliente</label>
          <input className="border rounded px-3 py-2 bg-slate-50" value={clienteNombre} readOnly />
        </div>
        <input type="hidden" {...register("clienteId")} />
        {errors.clienteId && <p className="text-red-600 text-sm">{errors.clienteId.message}</p>}

        {/* Fecha */}
        <div>
          <label className="block text-sm mb-1">Fecha de pago</label>
          <input type="date" max={hoyISO} {...register("fechaPago")} className="w-full border rounded px-3 py-2" />
        </div>
        {(errors.fechaPago || fechaInvalida) && (
          <p className="text-red-600 text-sm">
            {fechaInvalida ? "La fecha no puede ser futura" : errors.fechaPago?.message}
          </p>
        )}

        {/* Monto */}
        <div>
          <label className="block text-sm mb-1">Monto pagado</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register("monto")}
            onBlur={onBlurMonto}
            className="w-full border rounded px-3 py-2"
            placeholder="0.00"
          />
          {errors.monto && <p className="text-red-600 text-sm">{errors.monto.message}</p>}
        </div>

        {/* No. de recibo */}
        <div>
          <label className="block text-sm mb-1">No. de recibo</label>
          <input type="text" {...register("nroRecibo")} className="w-full border rounded px-3 py-2" placeholder="REC-0001" />
          {errors.nroRecibo && <p className="text-red-600 text-sm">{errors.nroRecibo.message}</p>}
        </div>

        {/* Método */}
        <div>
          <label className="block text-sm mb-1">Método de pago</label>
          <select {...register("metodo")} className="w-full border rounded px-3 py-2">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
          {errors.metodo && <p className="text-red-600 text-sm">{errors.metodo.message}</p>}
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm mb-1">Observaciones</label>
          <textarea rows={3} {...register("observaciones")} className="w-full border rounded px-3 py-2" placeholder="Opcional" />
        </div>

        {/* Acciones */}
        <div className="flex gap-2">
          <button disabled={isSubmitting} className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-50">
            {isSubmitting ? "Guardando..." : "Registrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setPolizaQuery("");
              setPolizaPreview("");
              setClienteNombre("");
            }}
            className="px-4 py-2 rounded border"
          >
            Limpiar
          </button>
        </div>
      </form>
    </div>
  );
}

// client/src/pages/usuarios/Index.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";

export default function UsuariosIndex() {
  /* --------------------------- Filtros --------------------------- */
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState(""); // "", "ACTIVO", "INACTIVO"

  /* --------------------------- Tabla ----------------------------- */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  /* --------------------------- Roles ----------------------------- */
  const fallbackRoles = useMemo(() => ["ADMIN", "OPERADOR"], []);
  const [roles, setRoles] = useState(fallbackRoles);

  /* ------------------------- Formulario -------------------------- */
  const makeEmpty = useCallback(
    () => ({
      id: null,
      username: "",
      email: "",
      rol: roles[0] || "OPERADOR",
      estado: "ACTIVO",
      nombres: "",
      apellidos: "",
      password: "",
      password2: "",
    }),
    [roles]
  );

  const [form, setForm] = useState(makeEmpty());
  const [saving, setSaving] = useState(false);

  const firstLoad = useRef(true);

  /* -------------------- Cargar roles (si existen) ---------------- */
    const loadRoles = useCallback(async () => {
    try {
      // El endpoint correcto es /roles (no /usuarios/roles)
      const { data } = await api.get("/roles", { params: { limit: 100 } });
      const items = Array.isArray(data) ? data : data?.items ?? [];
      const nombres = items.map(r => String(r.nombre).toUpperCase()).filter(Boolean);
      if (nombres.length) setRoles(nombres);
    } catch {
      // fallback si falla
    }
  }, []);

  /* ---------------------- Cargar usuarios ------------------------ */
  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await api.get("/usuarios", {
        params: { q: q || undefined, estado: estado || undefined },
      });
      const items = Array.isArray(data) ? data : data?.items ?? data ?? [];
      setRows(items);
    } catch (e) {
      console.error(e);
      alert("Error cargando usuarios");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, estado, loading]);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      loadRoles().finally(() =>
        setForm((s) => ({ ...s, rol: roles[0] || "OPERADOR" }))
      );
      load().catch(() => {});
    }
  }, [load, loadRoles, roles]);

  /* ---------------------- Acciones de fila ----------------------- */
  const onEdit = async (r) => {
    try {
      const { data } = await api.get(`/usuarios/${r.id}`);
      setForm({
        id: data.id,
        username: data.username || "",
        email: data.email || "",
        rol: data.rol || (roles[0] || "OPERADOR"),
        estado: data.estado || "ACTIVO",
        nombres: data.nombres ?? (typeof data.nombre === "string" ? data.nombre.trim() : ""),
        apellidos: data.apellidos ?? "",
        password: "",
        password2: "",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      alert("No se pudo cargar el usuario");
    }
  };

  const onCancel = () => setForm(makeEmpty());

  /* ------------------------- Guardar ------------------------------ */
  const onSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      username: (form.username || "").trim(),
      email: (form.email || "").trim(),
      rol: form.rol,
      estado: form.estado,
      nombres: (form.nombres || "").trim(),
      apellidos: (form.apellidos || "").trim(),
    };

    if (!payload.username) return alert("El usuario (username) es obligatorio.");
    if (!payload.nombres) return alert("El/los nombre(s) son obligatorios.");
    if (!payload.apellidos) return alert("El/los apellido(s) son obligatorios.");
    if (!payload.rol) return alert("Debe seleccionar un rol.");

    const pwd = (form.password || "").trim();
    const pwd2 = (form.password2 || "").trim();

    if (form.id) {
      // Edición: contraseña opcional
      if (pwd || pwd2) {
        if (pwd.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");
        if (pwd !== pwd2) return alert("Las contraseñas no coinciden.");
        payload.password = pwd;
      }
    } else {
      // Creación: contraseña obligatoria
      if (pwd.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");
      if (pwd !== pwd2) return alert("Las contraseñas no coinciden.");
      payload.password = pwd;
    }

    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/usuarios/${form.id}`, payload);
      } else {
        await api.post("/usuarios", payload);
      }
      onCancel();
      await load();
    } catch (err) {
      console.error(err);
      const s = err?.response?.status;
      if (s === 409) alert("El username ya existe.");
      else alert(form.id ? "No se pudo actualizar el usuario" : "No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- Cambiar estado desde la tabla ---------------- */
  const onToggleEstado = async (r) => {
    const next = r.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    if (!confirm(`¿Cambiar estado a ${next}?`)) return;
    try {
      await api.put(`/usuarios/${r.id}`, { estado: next });
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, estado: next } : x)));
      if (form.id === r.id) setForm((s) => ({ ...s, estado: next }));
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado");
    }
  };

  /* --------------------------- Filtros UI ------------------------ */
  const onAplicar = () => load();
  const onLimpiar = () => {
    setQ("");
    setEstado("");
    setTimeout(() => load(), 0);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Usuarios — Administración</h2>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          className="border rounded px-3 py-2"
          placeholder="Buscar (usuario, nombre, email)"
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
          <button onClick={onLimpiar} className="px-3 py-2 border rounded">
            Limpiar
          </button>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={onSubmit} className="bg-slate-50 rounded-xl p-4 grid gap-4">
        {/* Fila 1 */}
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm block mb-1">Usuario (username)*</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.username}
              onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Nombre(s)*</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.nombres}
              onChange={(e) => setForm((s) => ({ ...s, nombres: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Apellido(s)*</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={form.apellidos}
              onChange={(e) => setForm((s) => ({ ...s, apellidos: e.target.value }))}
            />
          </div>
        </div>

        {/* Fila 2 */}
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm block mb-1">Email</label>
            <input
              type="email"
              className="border rounded px-3 py-2 w-full"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm block mb-1">Rol*</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={form.rol}
              onChange={(e) => setForm((s) => ({ ...s, rol: e.target.value }))}
            >
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            {form.id && (
              <span
                className={
                  "px-3 py-1 rounded-full text-sm " +
                  (form.estado === "ACTIVO"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700")
                }
              >
                {form.estado === "ACTIVO" ? "Activo" : "Dado de baja"}
              </span>
            )}
          </div>
        </div>

        {/* Fila 3 - Contraseña */}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm block mb-1">
              {form.id ? "Nueva contraseña (opcional)" : "Contraseña*"}
            </label>
            <input
              type="password"
              className="border rounded px-3 py-2 w-full"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              placeholder={form.id ? "Dejar vacío para no cambiar" : "Mínimo 6 caracteres"}
            />
          </div>
          <div>
            <label className="text-sm block mb-1">
              {form.id ? "Confirmar nueva contraseña" : "Confirmar contraseña*"}
            </label>
            <input
              type="password"
              className="border rounded px-3 py-2 w-full"
              value={form.password2}
              onChange={(e) => setForm((s) => ({ ...s, password2: e.target.value }))}
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-2">
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : form.id ? "Actualizar usuario" : "Crear usuario"}
          </button>
          {form.id && (
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded border">
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
              <th className="text-left p-2">Usuario</th>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Rol</th>
              <th className="text-left p-2">Estado</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-3 text-center">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-3 text-center">
                  Sin datos
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((u) => {
                const nombreCompleto =
                  [u.nombres, u.apellidos].filter(Boolean).join(" ").trim() ||
                  u.nombre || "-";
                return (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.username}</td>
                    <td className="p-2">{nombreCompleto}</td>
                    <td className="p-2">{u.email || "-"}</td>
                    <td className="p-2">{u.rol}</td>
                    <td className="p-2">{u.estado}</td>
                    <td className="p-2 flex gap-2">
                      <button className="px-2 py-1 border rounded" onClick={() => onEdit(u)}>
                        Editar
                      </button>
                      <button className="px-2 py-1 border rounded" onClick={() => onToggleEstado(u)}>
                        {u.estado === "ACTIVO" ? "Dar de baja" : "Activar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/*import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="bg-white border rounded-2xl p-6 w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4">Ingreso al sistema</h1>

        {/* Campos “de adorno” (sin lógica de auth por ahora) }*/ 
        /*
        <div className="grid gap-3 mb-4">
          <input className="border rounded px-3 py-2" placeholder="Usuario" />
          <input className="border rounded px-3 py-2" type="password" placeholder="Contraseña" />
        </div>

        <button
          className="w-full bg-slate-900 text-white rounded-lg py-2"
          onClick={() => navigate("/app")}
        >
          Entrar (mock)
        </button>
      </div>
    </div>
  );
}

*/

// client/src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return alert("Ingrese usuario y contraseña.");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("pg_user", JSON.stringify(data.user));
      navigate("/app");
    } catch (err) {
      const msg = err?.response?.data?.message || "Credenciales inválidas";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="bg-white border rounded-2xl p-6 w-full max-w-md shadow-sm">
        {/* Encabezado solicitado */}
        <div className="mb-2 text-center">
          <h1 className="text-xl font-semibold">Sistema Enlace en Seguros</h1>
          <p className="text-sm text-gray-500">Login</p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-3 mt-4">
          <input
            className="border rounded px-3 py-2"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <input
            className="border rounded px-3 py-2"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white rounded-lg py-2 disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="text-xs text-gray-400 text-center mt-3">
          Acceso restringido — usuarios activos.
        </div>
      </div>
    </div>
  );
}

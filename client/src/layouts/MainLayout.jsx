import { NavLink, Outlet, useNavigate } from "react-router-dom";

export default function MainLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    const keys = [
      "token",
      "auth_token",
      "pg_token",
      "accessToken",
      "jwt",
      "session",
      "pg_user",
    ];
    keys.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen">
      {/* Header sin colores forzados; hereda del sistema */}
      <header className="border-b">
        <nav className="container mx-auto flex items-center justify-between py-4 px-6">
          {/* Navegación (izquierda) */}
          <div className="flex gap-6 text-sm font-medium">
            <NavLink
              to="/app/dashboard"
              className={({ isActive }) =>
                isActive ? "underline font-semibold" : "hover:underline"
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/app/clientes"
              className={({ isActive }) =>
                isActive ? "underline font-semibold" : "hover:underline"
              }
            >
              Clientes
            </NavLink>
            <NavLink
              to="/app/polizas"
              className={({ isActive }) =>
                isActive ? "underline font-semibold" : "hover:underline"
              }
            >
              Pólizas
            </NavLink>
            <NavLink
              to="/app/pagos"
              className={({ isActive }) =>
                isActive ? "underline font-semibold" : "hover:underline"
              }
            >
              Pagos
            </NavLink>
            <NavLink
              to="/app/aseguradoras"
              className={({ isActive }) =>
                isActive ? "underline font-semibold" : "hover:underline"
              }
            >
              Aseguradoras
            </NavLink>
            <NavLink
              to="/app/ramos"
              className={({ isActive }) =>
                isActive ? "underline font-semibold" : "hover:underline"
              }
            >
              Ramos
            </NavLink>
            <NavLink
              to="/app/planes"
              className={({ isActive }) =>
                isActive ? "underline font-semibold" : "hover:underline"
              }
            >
              Planes
            </NavLink>
            <NavLink
              to="/app/reportes"
              className={({ isActive }) =>
                isActive ? "underline font-semibold" : "hover:underline"
              }
            >
              Reportes
            </NavLink>
            <NavLink
              to="/app/usuarios"
              className={({ isActive }) =>
                isActive ? "underline font-semibold" : "hover:underline"
              }
            >
              Usuarios
            </NavLink>
          </div>

          {/* Botón Cerrar sesión (derecha) */}
          <div className="flex items-center">
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-md border transition"
              title="Cerrar sesión"
            >
              Cerrar sesión
            </button>
          </div>
        </nav>
      </header>

      {/* Contenido */}
      <main className="container mx-auto py-6 px-4">
        <Outlet />
      </main>
    </div>
  );
}

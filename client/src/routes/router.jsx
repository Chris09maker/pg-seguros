// client/src/routes/router.jsx
import { createBrowserRouter, Navigate } from "react-router-dom";

/* Layout */
import MainLayout from "../layouts/MainLayout";

/* Páginas base */
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";

/* Clientes */
import ClientesList from "../pages/clientes/List";
import ClientesDetalle from "../pages/clientes/Detalle";

/* Pólizas */
import PolizasList from "../pages/polizas/List";
import PolizasDetalle from "../pages/polizas/Detalle";

/* Pagos */
import PagosRegistrar from "../pages/pagos/Registrar";
import PagosHistorial from "../pages/pagos/Historial";

/* Mantenimientos */
import Aseguradoras from "../pages/aseguradoras/Index";
import Ramos from "../pages/ramos/Index";
// import Coberturas from "../pages/coberturas/Index"; // habilítalo cuando lo tengas
import Planes from "../pages/planes/Index";

/* Reportes */
import ReportesIndex from "../pages/reportes/Index";
import ReporteClientes from "../pages/reportes/Clientes";
import ReportePolizas from "../pages/reportes/Polizas";
import ReportePersonalizado from "../pages/reportes/Personalizado";
import ReportePagos from "../pages/reportes/Pagos";

/* Usuarios */
import Usuarios from "../pages/usuarios/Index";

/* 404 simple */
const notFoundElement = (
  <div style={{ padding: 24 }}>
    <h2>404 — No encontrado</h2>
    <p>La ruta solicitada no existe.</p>
    <a href="/login">Ir al login</a>
  </div>
);

const router = createBrowserRouter([
  /* Raíz y login */
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <Login /> },

  /* Área autenticada */
  {
    path: "/app",
    element: <MainLayout />,
    errorElement: notFoundElement,
    children: [
      /* MUY IMPORTANTE: esto hace que /app cargue Dashboard */
      { index: true, element: <Dashboard /> },

      /* Soporte explícito para /app/dashboard (menú/enlaces) */
      { path: "dashboard", element: <Dashboard /> },

      /* Clientes */
      { path: "clientes", element: <ClientesList /> },
      { path: "clientes/:id", element: <ClientesDetalle /> }, // :id | "new"

      /* Pólizas */
      { path: "polizas", element: <PolizasList /> },
      { path: "polizas/:id", element: <PolizasDetalle /> }, // :id | "new"

      /* Pagos */
      { path: "pagos", element: <Navigate to="historial" replace /> },
      { path: "pagos/historial", element: <PagosHistorial /> },
      { path: "pagos/registrar", element: <PagosRegistrar /> },

      /* Mantenimientos */
      { path: "aseguradoras", element: <Aseguradoras /> },
      { path: "ramos", element: <Ramos /> },
      // { path: "coberturas", element: <Coberturas /> },
      { path: "planes", element: <Planes /> },

      /* Reportes */
      { path: "reportes", element: <ReportesIndex /> },
      { path: "reportes/clientes", element: <ReporteClientes /> },
      { path: "reportes/polizas", element: <ReportePolizas /> },
      { path: "reportes/pagos", element: <ReportePagos /> },
      { path: "reportes/personalizado", element: <ReportePersonalizado /> },

      /* Usuarios */
      { path: "usuarios", element: <Usuarios /> },

      /* 404 interno de /app */
      { path: "*", element: notFoundElement },
    ],
  },

  /* 404 global */
  { path: "*", element: notFoundElement },
]);

export default router;

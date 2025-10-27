// client/src/pages/reportes/Index.jsx
import { Link } from "react-router-dom";

export default function ReportesIndex() {
  const cards = [
    {
      to: "/app/reportes/clientes",
      title: "Clientes",
      desc: "Resumen y listado de clientes con estado de cartera.",
      emoji: "👤",
    },
    {
      to: "/app/reportes/polizas",
      title: "Pólizas",
      desc: "Totales, activas, anuladas, vigencias y primas.",
      emoji: "📄",
    },
    {
      to: "/app/reportes/personalizado",
      title: "Personalizado",
      desc: "Arma un reporte a la medida por cliente o póliza.",
      emoji: "🧩",
    },
    {
      to: "/app/reportes/pagos",           // 🚀 Nuevo botón hacia Reporte de pagos
      title: "Pagos",
      desc: "Pagos registrados, filtros por fechas, método y totales.",
      emoji: "💳",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-6">Reportes</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group block rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition p-4 bg-white"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{c.emoji}</span>
              <h2 className="text-lg font-medium group-hover:text-indigo-600">
                {c.title}
              </h2>
            </div>
            <p className="text-sm text-gray-600">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

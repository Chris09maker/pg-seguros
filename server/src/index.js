// server/src/index.js
import express from "express";
import cors from "cors";
import "dotenv/config.js";

/* ---------- Routers ---------- */
import clientesRouter from "./routes/clientes.js";
import aseguradorasRouter from "./routes/aseguradoras.js";
import ramosRouter from "./routes/ramos.js";
import aseguradoraRamosRouter from "./routes/aseguradora_ramos.js";
import planesRouter from "./routes/planes.js";
import coberturasRouter from "./routes/coberturas.js";
import pagosRouter from "./routes/pagos.js";
import polizasRouter from "./routes/polizas.js";
import reportesRouter from "./routes/reportes.js";
import rolesRouter from "./routes/roles.js";
import usuariosRouter from "./routes/usuarios.js";
import recordatoriosRouter from "./routes/recordatorios.js";
// import polizaBeneficiariosRouter from "./routes/poliza_beneficiarios.js"; // ← (No se usa para la API en Azure)

/*  Router de autenticación (sin JWT, solo bcryptjs) */
import authRouter from "./routes/auth.js";

const app = express();

/* ---------- Middlewares ---------- */
//  CORS con allowlist: usar CORS_ORIGIN="http://localhost:5173,https://<tu-swa>.azurestaticapps.net"
const allowlist = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // Permitir herramientas sin origin (Postman/Thunder) y healthchecks
      if (!origin) return cb(null, true);
      // Validar contra allowlist
      if (allowlist.includes(origin)) return cb(null, true);
      return cb(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));

/* ---------- Healthcheck ---------- */
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "pg-seguros-api",
    node: process.version,
    time: new Date().toISOString(),
  });
});

/* ---------- Helper para montar rutas con y sin prefijo ---------- */
function mount(base = "") {
  app.use(`${base}/clientes`, clientesRouter);
  app.use(`${base}/aseguradoras`, aseguradorasRouter);
  app.use(`${base}/ramos`, ramosRouter);
  app.use(`${base}/aseguradora-ramos`, aseguradoraRamosRouter);
  app.use(`${base}/planes`, planesRouter);
  app.use(`${base}/coberturas`, coberturasRouter);
  app.use(`${base}/pagos`, pagosRouter);
  app.use(`${base}/polizas`, polizasRouter);
  app.use(`${base}/reportes`, reportesRouter);
  app.use(`${base}/roles`, rolesRouter);
  app.use(`${base}/usuarios`, usuariosRouter);
  app.use(`${base}/recordatorios`, recordatoriosRouter);
  // app.use(`${base}/poliza-beneficiarios`, polizaBeneficiariosRouter); // ← (No se usa para la API en Azure)

  /* Login */
  app.use(`${base}/auth`, authRouter);
}
mount("");      // SIN /api (compatibilidad)
mount("/api");  // CON /api  (lo que usará el front en Azure)

/* ---------- 404 ---------- */
app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND", path: req.originalUrl });
});

/* ---------- Errores ---------- */
app.use((err, _req, res, _next) => {
  console.error("[API ERROR]", err);
  const status =
    err?.status ??
    (err?.code === "ER_DUP_ENTRY" ? 409 :
     err?.name === "ZodError" ? 400 : 500);

  res.status(status).json({
    error: err?.name || "INTERNAL_ERROR",
    message: err?.message || "Unexpected error",
    details: err?.issues || undefined,
  });
});

/* ---------- Start ---------- */
// En Azure, PORT lo inyecta la plataforma (no fijar un puerto en Configuración)
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
});

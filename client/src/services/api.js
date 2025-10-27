// client/src/services/api.js
// -------------------------------------------------------------
// Base URL de la API:
// - En producción: se toma de VITE_API_URL (inyectada en build o desde SWA).
// - En desarrollo local: fallback a http://localhost:3000/api
//   => si quieres forzar localhost, comenta la línea con import.meta.env y deja solo el fallback.
//
//   const base = "http://localhost:3000/api"; // ← forzar localhost
// -------------------------------------------------------------

import axios from "axios";

const base = (
  import.meta?.env?.VITE_API_URL || "http://localhost:3000/api"
).replace(/\/+$/, ""); // quita "/" finales por seguridad

const api = axios.create({
  baseURL: base,
  timeout: 15000,
});

// Puedes agregar interceptores aquí si los necesitas más adelante
// api.interceptors.request.use((config) => { ...; return config; });

export default api;

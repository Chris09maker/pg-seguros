// client/src/services/api.js
// -------------------------------------------------------------
// Base URL de la API:
// - En producción: se toma de VITE_API_URL (inyectada en build o desde SWA).
// - En desarrollo local: fallback a http://localhost:3000/api
//   => si quieres forzar localhost, comenta la línea con import.meta.env y deja solo el fallback.
//
//   const base = "http://localhost:3000/api"; // ← forzar localhost
// -------------------------------------------------------------

// client/src/services/api.js
import axios from "axios";

const base = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, "");

const api = axios.create({
  baseURL: base,
  timeout: 15000,
  withCredentials: true, // ✅ necesario para login en Azure
});

export default api;

// server/src/routes/roles.js
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";

const r = Router();

/* -------------------------------- Utilidades -------------------------------- */
const like = (s) => `%${String(s || "").trim()}%`;
const ESTADOS = ["ACTIVO", "INACTIVO"];

/* -------------------------------- Esquemas ---------------------------------- */
const upsertSchema = z.object({
  nombre: z.string().min(2).max(40).transform((v) => v.trim().toUpperCase()),
  descripcion: z.string().max(180).optional().nullable(),
  estado: z.enum(ESTADOS).default("ACTIVO"),
});

const updateSchema = upsertSchema.partial();
const estadoSchema = z.object({ estado: z.enum(ESTADOS) });

/* --------------------------------- Listado ---------------------------------- */
/** GET /api/roles?q=&estado=&page=&limit= */
r.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const estado = String(req.query.estado || "").trim().toUpperCase();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (q) { where.push("(r.nombre LIKE ? OR r.descripcion LIKE ?)"); params.push(like(q), like(q)); }
    if (estado && ESTADOS.includes(estado)) { where.push("r.estado=?"); params.push(estado); }

    const sql = `
      SELECT r.id, r.nombre, r.descripcion, r.estado
      FROM roles r
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY r.nombre ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(sql, [...params, limit, offset]);
    res.json({ items: rows, page, limit });
  } catch (e) {
    console.error("GET /roles:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* --------------------------------- Detalle ---------------------------------- */
/** GET /api/roles/:id */
r.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[row]] = await pool.query(
      "SELECT id, nombre, descripcion, estado FROM roles WHERE id=?",
      [id]
    );
    if (!row) return res.status(404).json({ error: "ROL_NO_ENCONTRADO" });
    res.json(row);
  } catch (e) {
    console.error("GET /roles/:id:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* ---------------------------------- Crear ----------------------------------- */
/** POST /api/roles */
r.post("/", async (req, res) => {
  try {
    const data = upsertSchema.parse(req.body || {});
    const [ins] = await pool.query(
      "INSERT INTO roles (nombre, descripcion, estado) VALUES (?,?,?)",
      [data.nombre, data.descripcion ?? null, data.estado]
    );
    res.status(201).json({ ok: true, id: ins.insertId });
  } catch (e) {
    if (e?.issues) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: e.issues.map((i) => i.message) });
    }
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "NOMBRE_DUPLICADO" });
    }
    console.error("POST /roles:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* --------------------------------- Actualizar -------------------------------- */
/** PUT /api/roles/:id */
r.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = updateSchema.parse(req.body || {});

    const sets = [], params = [];
    if (typeof data.nombre === "string") { sets.push("nombre=?"); params.push(data.nombre.trim().toUpperCase()); }
    if ("descripcion" in data) { sets.push("descripcion=?"); params.push(data.descripcion ?? null); }
    if (data.estado && ESTADOS.includes(data.estado)) { sets.push("estado=?"); params.push(data.estado); }

    if (!sets.length) return res.json({ ok: true, id });

    const [upd] = await pool.query(`UPDATE roles SET ${sets.join(", ")} WHERE id=?`, [...params, id]);
    if (!upd.affectedRows) return res.status(404).json({ error: "ROL_NO_ENCONTRADO" });

    res.json({ ok: true, id });
  } catch (e) {
    if (e?.issues) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: e.issues.map((i) => i.message) });
    }
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "NOMBRE_DUPLICADO" });
    }
    console.error("PUT /roles/:id:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* ------------------------------- Cambiar estado ----------------------------- */
/** PATCH /api/roles/:id/estado { estado } */
r.patch("/:id/estado", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { estado } = estadoSchema.parse(req.body || {});
    const [{ affectedRows }] = await pool.query("UPDATE roles SET estado=? WHERE id=?", [estado, id]);
    if (!affectedRows) return res.status(404).json({ error: "ROL_NO_ENCONTRADO" });
    res.json({ ok: true, id, estado });
  } catch (e) {
    if (e?.issues) return res.status(400).json({ error: "VALIDATION_ERROR", details: e.issues.map(i=>i.message) });
    console.error("PATCH /roles/:id/estado:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

export default r;

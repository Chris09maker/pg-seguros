// server/src/routes/aseguradoras.js
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";

const r = Router();

/* -------------------------------- Utiles -------------------------------- */
const like = (s) => `%${String(s || "").trim()}%`;
const ESTADOS = ["ACTIVO", "INACTIVO"];

/* ------------------------------- Esquemas -------------------------------- */
const upsertSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  contacto: z.string().trim().optional().nullable(),
  contactoCargo: z.string().trim().optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
  estado: z.enum(ESTADOS).default("ACTIVO"),
});

const updateSchema = upsertSchema.partial();

const estadoSchema = z.object({
  estado: z.enum(ESTADOS),
});

/* --------------------------- Listado y filtros --------------------------- */
/**
 * GET /api/aseguradoras?q=&estado=&page=&limit=
 */
r.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const estado = String(req.query.estado || "").trim().toUpperCase();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (q) {
      where.push("(a.nombre LIKE ? OR a.email LIKE ? OR a.telefono LIKE ? OR a.contacto LIKE ?)");
      params.push(like(q), like(q), like(q), like(q));
    }
    if (estado && ESTADOS.includes(estado)) {
      where.push("a.estado = ?");
      params.push(estado);
    }

    const sql = `
      SELECT
        a.id, a.nombre, a.telefono, a.email, a.contacto,
        a.contacto_cargo AS contactoCargo, a.direccion, a.estado
      FROM aseguradoras a
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY a.nombre ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(sql, [...params, limit, offset]);
    res.json({ items: rows, page, limit });
  } catch (e) {
    console.error("GET /aseguradoras:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* -------------------------------- Detalle -------------------------------- */
/**
 * GET /api/aseguradoras/:id
 * Devuelve datos de la aseguradora + ramos asignados (ids).
 */
r.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[row]] = await pool.query(
      `SELECT
         id, nombre, telefono, email, contacto,
         contacto_cargo AS contactoCargo, direccion, estado
       FROM aseguradoras WHERE id=?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: "ASEGURADORA_NO_ENCONTRADA" });

    const [ramos] = await pool.query(
      `SELECT ramo_id AS id FROM aseguradora_ramos WHERE aseguradora_id=? ORDER BY ramo_id ASC`,
      [id]
    );
    res.json({ ...row, ramosIds: ramos.map((x) => x.id) });
  } catch (e) {
    console.error("GET /aseguradoras/:id:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* -------------------------------- Crear ---------------------------------- */
/**
 * POST /api/aseguradoras
 * Body: { nombre, telefono?, email?, contacto?, contactoCargo?, direccion?, estado?, ramosIds?[] }
 */
r.post("/", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const data = upsertSchema.extend({ ramosIds: z.array(z.coerce.number().int().positive()).default([]) }).parse(req.body || {});
    await conn.beginTransaction();

    const [ins] = await conn.query(
      `INSERT INTO aseguradoras (nombre, telefono, email, contacto, contacto_cargo, direccion, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.nombre,
        data.telefono ?? null,
        data.email ?? null,
        data.contacto ?? null,
        data.contactoCargo ?? null,
        data.direccion ?? null,
        data.estado,
      ]
    );
    const asegId = ins.insertId;

    if (data.ramosIds.length) {
      const values = [...new Set(data.ramosIds)].map((rid) => [asegId, rid, "ACTIVO"]);
      await conn.query(
        `INSERT INTO aseguradora_ramos (aseguradora_id, ramo_id, estado) VALUES ?`,
        [values]
      );
    }

    await conn.commit();
    res.status(201).json({ ok: true, id: asegId });
  } catch (e) {
    await conn.rollback();
    if (e?.issues) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: e.issues.map((i) => i.message) });
    }
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "NOMBRE_DUPLICADO" });
    }
    console.error("POST /aseguradoras:", e);
    res.status(500).json({ error: "DB_ERROR" });
  } finally {
    try { conn.release(); } catch {}
  }
});

/* ------------------------------- Actualizar ------------------------------- */
/**
 * PUT /api/aseguradoras/:id
 * Body parcial (campos de upsert) + opcional ramosIds[] para sincronizar asignaciones.
 */
r.put("/:id", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    const data = updateSchema.extend({ ramosIds: z.array(z.coerce.number().int().positive()).optional() }).parse(req.body || {});

    await conn.beginTransaction();

    const sets = [];
    const params = [];
    if (typeof data.nombre === "string") { sets.push("nombre=?"); params.push(data.nombre); }
    if ("telefono" in data) { sets.push("telefono=?"); params.push(data.telefono ?? null); }
    if ("email" in data) { sets.push("email=?"); params.push(data.email ?? null); }
    if ("contacto" in data) { sets.push("contacto=?"); params.push(data.contacto ?? null); }
    if ("contactoCargo" in data) { sets.push("contacto_cargo=?"); params.push(data.contactoCargo ?? null); }
    if ("direccion" in data) { sets.push("direccion=?"); params.push(data.direccion ?? null); }
    if (data.estado && ESTADOS.includes(data.estado)) { sets.push("estado=?"); params.push(data.estado); }

    if (sets.length) {
      const [upd] = await conn.query(`UPDATE aseguradoras SET ${sets.join(", ")} WHERE id=?`, [...params, id]);
      if (!upd.affectedRows) {
        await conn.rollback();
        return res.status(404).json({ error: "ASEGURADORA_NO_ENCONTRADA" });
      }
    }

    if (Array.isArray(data.ramosIds)) {
      const nuevos = [...new Set(data.ramosIds.map((n) => Number(n)).filter(Boolean))];

      const [act] = await conn.query(
        "SELECT ramo_id FROM aseguradora_ramos WHERE aseguradora_id=?",
        [id]
      );
      const actuales = new Set(act.map((x) => Number(x.ramo_id)));
      const aInsertar = nuevos.filter((rid) => !actuales.has(rid));
      const aEliminar = [...actuales].filter((rid) => !nuevos.includes(rid));

      if (aEliminar.length) {
        await conn.query(
          `DELETE FROM aseguradora_ramos
           WHERE aseguradora_id=? AND ramo_id IN (${aEliminar.map(() => "?").join(",")})`,
          [id, ...aEliminar]
        );
      }
      if (aInsertar.length) {
        const values = aInsertar.map((rid) => [id, rid, "ACTIVO"]);
        await conn.query(
          "INSERT INTO aseguradora_ramos (aseguradora_id, ramo_id, estado) VALUES ?",
          [values]
        );
      }
    }

    await conn.commit();
    res.json({ ok: true, id });
  } catch (e) {
    await pool.query("ROLLBACK");
    if (e?.issues) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: e.issues.map((i) => i.message) });
    }
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "NOMBRE_DUPLICADO" });
    }
    console.error("PUT /aseguradoras/:id:", e);
    res.status(500).json({ error: "DB_ERROR" });
  } finally {
    try { r.release?.(); } catch {}
    try { conn.release(); } catch {}
  }
});

/* ---------------------------- Cambiar estado ----------------------------- */
/**
 * PATCH /api/aseguradoras/:id/estado
 * Body: { estado: 'ACTIVO'|'INACTIVO' }
 */
r.patch("/:id/estado", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { estado } = estadoSchema.parse(req.body || {});
    const [{ affectedRows }] = await pool.query(
      "UPDATE aseguradoras SET estado=? WHERE id=?",
      [estado, id]
    );
    if (!affectedRows) return res.status(404).json({ error: "ASEGURADORA_NO_ENCONTRADA" });
    res.json({ ok: true, id, estado });
  } catch (e) {
    if (e?.issues) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: e.issues.map((i) => i.message) });
    }
    console.error("PATCH /aseguradoras/:id/estado:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

export default r;

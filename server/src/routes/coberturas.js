// server/src/routes/coberturas.js
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";

const r = Router();

/* ------------------------------ Utilidades ------------------------------ */
const ESTADOS = ["ACTIVO", "INACTIVO"];
const like = (s) => `%${String(s || "").trim()}%`;

/* ------------------------------- Schemas ------------------------------- */
const upsertSchema = z.object({
  poliza_id: z.number().int().positive(),
  cobertura_id: z.number().int().positive(),
  suma_asegurada: z.number().optional().nullable(),
  deducible: z.number().optional().nullable(),
  estado: z.enum(ESTADOS).default("ACTIVO"),
});

const updateSchema = upsertSchema.partial();
const estadoSchema = z.object({ estado: z.enum(ESTADOS) });

/* --------------------------- Listar coberturas --------------------------- */
/**
 * GET /api/coberturas?q=&poliza_id=&estado=
 * Lista las coberturas asignadas a una póliza (poliza_coberturas)
 */
r.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const estado = String(req.query.estado || "").toUpperCase();
    const polizaId = Number(req.query.poliza_id || 0);

    const where = [];
    const params = [];

    if (polizaId) {
      where.push("pc.poliza_id=?");
      params.push(polizaId);
    }
    if (q) {
      where.push("c.nombre LIKE ?");
      params.push(like(q));
    }
    if (estado && ESTADOS.includes(estado)) {
      where.push("pc.estado=?");
      params.push(estado);
    }

    const sql = `
      SELECT 
        pc.id,
        pc.poliza_id,
        pc.cobertura_id,
        c.nombre AS cobertura,
        c.descripcion,
        pc.suma_asegurada,
        pc.deducible,
        pc.estado,
        pc.creado_en
      FROM poliza_coberturas pc
      INNER JOIN coberturas c ON c.id = pc.cobertura_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY c.nombre ASC
    `;

    const [rows] = await pool.query(sql, params);
    res.json({ items: rows });
  } catch (e) {
    console.error("GET /coberturas:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* --------------------------- Detalle de registro --------------------------- */
/**
 * GET /api/coberturas/:id
 * Obtiene detalle de una cobertura asignada a una póliza
 */
r.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[row]] = await pool.query(
      `
      SELECT 
        pc.id,
        pc.poliza_id,
        pc.cobertura_id,
        c.nombre AS cobertura,
        c.descripcion,
        pc.suma_asegurada,
        pc.deducible,
        pc.estado,
        pc.creado_en
      FROM poliza_coberturas pc
      INNER JOIN coberturas c ON c.id = pc.cobertura_id
      WHERE pc.id=?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: "REGISTRO_NO_ENCONTRADO" });
    res.json(row);
  } catch (e) {
    console.error("GET /coberturas/:id:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* ------------------------------- Crear ------------------------------- */
/**
 * POST /api/coberturas
 * Asigna una cobertura existente (tabla coberturas) a una póliza
 */
r.post("/", async (req, res) => {
  try {
    const data = upsertSchema.parse(req.body || {});

    // Verificar duplicado
    const [[dup]] = await pool.query(
      "SELECT id FROM poliza_coberturas WHERE poliza_id=? AND cobertura_id=?",
      [data.poliza_id, data.cobertura_id]
    );
    if (dup) {
      return res.status(409).json({ error: "COBERTURA_YA_ASIGNADA" });
    }

    const [ins] = await pool.query(
      `
      INSERT INTO poliza_coberturas
      (poliza_id, cobertura_id, suma_asegurada, deducible, estado, creado_en)
      VALUES (?, ?, ?, ?, ?, NOW())
      `,
      [
        data.poliza_id,
        data.cobertura_id,
        data.suma_asegurada ?? null,
        data.deducible ?? null,
        data.estado,
      ]
    );

    res.status(201).json({ ok: true, id: ins.insertId });
  } catch (e) {
    if (e?.issues) {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", details: e.issues.map((i) => i.message) });
    }
    console.error("POST /coberturas:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* ----------------------------- Actualizar ----------------------------- */
/**
 * PUT /api/coberturas/:id
 * Actualiza datos de una cobertura asignada a póliza
 */
r.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = updateSchema.parse(req.body || {});
    const sets = [];
    const params = [];

    if (data.suma_asegurada != null) {
      sets.push("suma_asegurada=?");
      params.push(data.suma_asegurada);
    }
    if (data.deducible != null) {
      sets.push("deducible=?");
      params.push(data.deducible);
    }
    if (data.estado && ESTADOS.includes(data.estado)) {
      sets.push("estado=?");
      params.push(data.estado);
    }

    if (!sets.length) return res.json({ ok: true, id });

    const [upd] = await pool.query(
      `UPDATE poliza_coberturas SET ${sets.join(", ")} WHERE id=?`,
      [...params, id]
    );
    if (!upd.affectedRows)
      return res.status(404).json({ error: "REGISTRO_NO_ENCONTRADO" });

    res.json({ ok: true, id });
  } catch (e) {
    if (e?.issues) {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", details: e.issues.map((i) => i.message) });
    }
    console.error("PUT /coberturas/:id:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* --------------------------- Cambiar estado --------------------------- */
/**
 * PATCH /api/coberturas/:id/estado
 */
r.patch("/:id/estado", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { estado } = estadoSchema.parse(req.body || {});
    const [{ affectedRows }] = await pool.query(
      "UPDATE poliza_coberturas SET estado=? WHERE id=?",
      [estado, id]
    );
    if (!affectedRows)
      return res.status(404).json({ error: "REGISTRO_NO_ENCONTRADO" });
    res.json({ ok: true, id, estado });
  } catch (e) {
    if (e?.issues) {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", details: e.issues.map((i) => i.message) });
    }
    console.error("PATCH /coberturas/:id/estado:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* ------------------------------ Eliminar ------------------------------ */
/**
 * DELETE /api/coberturas/:id
 * Elimina la asignación de cobertura en la póliza
 */
r.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [del] = await pool.query("DELETE FROM poliza_coberturas WHERE id=?", [id]);
    if (!del.affectedRows)
      return res.status(404).json({ error: "REGISTRO_NO_ENCONTRADO" });
    res.json({ ok: true, id });
  } catch (e) {
    console.error("DELETE /coberturas/:id:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

export default r;

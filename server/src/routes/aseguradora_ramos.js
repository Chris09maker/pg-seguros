import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";

const r = Router();

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                 */
/* -------------------------------------------------------------------------- */
const like = (s) => `%${String(s || "").trim()}%`;
const ESTADOS = ["ACTIVO", "INACTIVO"];

/* -------------------------------------------------------------------------- */
/* Esquemas de validación                                                     */
/* -------------------------------------------------------------------------- */
const baseSchema = z.object({
  aseguradoraId: z.coerce.number().int().positive(),
  ramoId: z.coerce.number().int().positive(),
  estado: z.enum(ESTADOS).default("ACTIVO"),
});

const changeEstadoSchema = z.object({
  estado: z.enum(ESTADOS),
});

const syncSchema = z.object({
  ramoIds: z.array(z.coerce.number().int().positive()).default([]),
  estado: z.enum(ESTADOS).default("ACTIVO"),
});

/* -------------------------------------------------------------------------- */
/* Listado general                                                             */
/* GET /api/aseguradora-ramos?q=&aseguradoraId=&ramoId=&estado=&page=&limit=  */
/* -------------------------------------------------------------------------- */
r.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const estado = String(req.query.estado || "").trim().toUpperCase();
    const aseguradoraId = req.query.aseguradoraId ? Number(req.query.aseguradoraId) : null;
    const ramoId = req.query.ramoId ? Number(req.query.ramoId) : null;

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (q) {
      where.push("(a.nombre LIKE ? OR r.nombre LIKE ?)");
      params.push(like(q), like(q));
    }
    if (aseguradoraId) {
      where.push("ar.aseguradora_id = ?");
      params.push(aseguradoraId);
    }
    if (ramoId) {
      where.push("ar.ramo_id = ?");
      params.push(ramoId);
    }
    if (estado && ESTADOS.includes(estado)) {
      where.push("ar.estado = ?");
      params.push(estado);
    }

    const sql = `
      SELECT
        ar.aseguradora_id AS aseguradoraId,
        a.nombre          AS aseguradora,
        ar.ramo_id        AS ramoId,
        r.nombre          AS ramo,
        ar.estado
      FROM aseguradora_ramos ar
      JOIN aseguradoras a ON a.id = ar.aseguradora_id
      JOIN ramos        r ON r.id = ar.ramo_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY a.nombre ASC, r.nombre ASC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(sql, [...params, limit, offset]);

    res.json({ items: rows, page, limit });
  } catch (e) {
    console.error("GET /aseguradora-ramos:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* -------------------------------------------------------------------------- */
/* Ramos asignados a una aseguradora                                           */
/* GET /api/aseguradora-ramos/:aseguradoraId/ramos?estado=                    */
/* -------------------------------------------------------------------------- */
r.get("/:aseguradoraId/ramos", async (req, res) => {
  try {
    const aseguradoraId = Number(req.params.aseguradoraId);
    const estado = String(req.query.estado || "").trim().toUpperCase();

    const where = ["ar.aseguradora_id = ?"];
    const params = [aseguradoraId];

    if (estado && ESTADOS.includes(estado)) {
      where.push("ar.estado = ?");
      params.push(estado);
    }

    const [rows] = await pool.query(
      `
      SELECT
        ar.ramo_id AS id,
        r.nombre   AS nombre,
        ar.estado  AS estado
      FROM aseguradora_ramos ar
      JOIN ramos r ON r.id = ar.ramo_id
      WHERE ${where.join(" AND ")}
      ORDER BY r.nombre ASC
      `,
      params
    );

    res.json(rows);
  } catch (e) {
    console.error("GET /aseguradora-ramos/:aseguradoraId/ramos:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* -------------------------------------------------------------------------- */
/* Ramos disponibles (no asignados) para una aseguradora                       */
/* GET /api/aseguradora-ramos/:aseguradoraId/ramos-disponibles                */
/* -------------------------------------------------------------------------- */
r.get("/:aseguradoraId/ramos-disponibles", async (req, res) => {
  try {
    const aseguradoraId = Number(req.params.aseguradoraId);
    const [rows] = await pool.query(
      `
      SELECT
        r.id,
        r.nombre
      FROM ramos r
      WHERE NOT EXISTS (
        SELECT 1
        FROM aseguradora_ramos ar
        WHERE ar.aseguradora_id = ? AND ar.ramo_id = r.id
      )
      ORDER BY r.nombre ASC
      `,
      [aseguradoraId]
    );

    res.json(rows);
  } catch (e) {
    console.error("GET /aseguradora-ramos/:aseguradoraId/ramos-disponibles:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* -------------------------------------------------------------------------- */
/* Alta (upsert defensivo)                                                     */
/* POST /api/aseguradora-ramos                                                 */
/* Body: { aseguradoraId, ramoId, estado }                                     */
/* -------------------------------------------------------------------------- */
r.post("/", async (req, res) => {
  try {
    const data = baseSchema.parse(req.body || {});

    // Verificaciones referenciales
    const [[a]] = await pool.query("SELECT id FROM aseguradoras WHERE id=? LIMIT 1", [
      data.aseguradoraId,
    ]);
    if (!a) return res.status(404).json({ error: "ASEGURADORA_NO_ENCONTRADA" });

    const [[rm]] = await pool.query("SELECT id FROM ramos WHERE id=? LIMIT 1", [data.ramoId]);
    if (!rm) return res.status(404).json({ error: "RAMO_NO_ENCONTRADO" });

    // Upsert por PK compuesta
    const [ins] = await pool.query(
      `
      INSERT INTO aseguradora_ramos (aseguradora_id, ramo_id, estado)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE estado = VALUES(estado)
      `,
      [data.aseguradoraId, data.ramoId, data.estado]
    );

    res.status(201).json({ ok: true, affected: ins.affectedRows });
  } catch (e) {
    if (e?.issues) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        details: e.issues.map((i) => i.message),
      });
    }
    console.error("POST /aseguradora-ramos:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* -------------------------------------------------------------------------- */
/* Cambiar estado                                                              */
/* PATCH /api/aseguradora-ramos/:aseguradoraId/:ramoId/estado                  */
/* Body: { estado }                                                            */
/* -------------------------------------------------------------------------- */
r.patch("/:aseguradoraId/:ramoId/estado", async (req, res) => {
  try {
    const aseguradoraId = Number(req.params.aseguradoraId);
    const ramoId = Number(req.params.ramoId);
    const { estado } = changeEstadoSchema.parse(req.body || {});

    const [{ affectedRows }] = await pool.query(
      "UPDATE aseguradora_ramos SET estado=? WHERE aseguradora_id=? AND ramo_id=?",
      [estado, aseguradoraId, ramoId]
    );
    if (!affectedRows) {
      return res.status(404).json({ error: "ASIGNACION_NO_ENCONTRADA" });
    }
    res.json({ ok: true, aseguradoraId, ramoId, estado });
  } catch (e) {
    if (e?.issues) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        details: e.issues.map((i) => i.message),
      });
    }
    console.error("PATCH /aseguradora-ramos/:aseguradoraId/:ramoId/estado:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* -------------------------------------------------------------------------- */
/* Eliminar asignación                                                         */
/* DELETE /api/aseguradora-ramos/:aseguradoraId/:ramoId                        */
/* -------------------------------------------------------------------------- */
r.delete("/:aseguradoraId/:ramoId", async (req, res) => {
  try {
    const aseguradoraId = Number(req.params.aseguradoraId);
    const ramoId = Number(req.params.ramoId);

    const [{ affectedRows }] = await pool.query(
      "DELETE FROM aseguradora_ramos WHERE aseguradora_id=? AND ramo_id=?",
      [aseguradoraId, ramoId]
    );
    if (!affectedRows) {
      return res.status(404).json({ error: "ASIGNACION_NO_ENCONTRADA" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /aseguradora-ramos/:aseguradoraId/:ramoId:", e);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* -------------------------------------------------------------------------- */
/* Sincronizar en bloque                                                       */
/* PUT /api/aseguradora-ramos/:aseguradoraId/sync                              */
/* Body: { ramoIds: number[], estado?: 'ACTIVO'|'INACTIVO' }                   */
/* -------------------------------------------------------------------------- */
r.put("/:aseguradoraId/sync", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const aseguradoraId = Number(req.params.aseguradoraId);
    const { ramoIds, estado } = syncSchema.parse(req.body || {});

    await conn.beginTransaction();

    // Validar existencia de aseguradora
    const [[a]] = await conn.query("SELECT id FROM aseguradoras WHERE id=? LIMIT 1", [
      aseguradoraId,
    ]);
    if (!a) {
      await conn.rollback();
      return res.status(404).json({ error: "ASEGURADORA_NO_ENCONTRADA" });
    }

    // Normalizar y deduplicar conjunto
    const setIn = [...new Set(ramoIds.map((n) => Number(n)).filter(Boolean))];

    // Ramos existentes para validar referencial
    if (setIn.length) {
      const [val] = await conn.query(
        `SELECT id FROM ramos WHERE id IN (${setIn.map(() => "?").join(",")})`,
        setIn
      );
      const existentes = new Set(val.map((x) => Number(x.id)));
      const faltantes = setIn.filter((id) => !existentes.has(id));
      if (faltantes.length) {
        await conn.rollback();
        return res.status(400).json({ error: "RAMO_INEXISTENTE", detalle: faltantes });
      }
    }

    // Leer asignaciones actuales
    const [act] = await conn.query(
      "SELECT ramo_id FROM aseguradora_ramos WHERE aseguradora_id=?",
      [aseguradoraId]
    );
    const actuales = new Set(act.map((x) => Number(x.ramo_id)));

    const aInsertar = setIn.filter((id) => !actuales.has(id));
    const aEliminar = [...actuales].filter((id) => !setIn.includes(id));
    const aMantener = setIn.filter((id) => actuales.has(id));

    // Eliminar no incluidos
    if (aEliminar.length) {
      await conn.query(
        `DELETE FROM aseguradora_ramos
         WHERE aseguradora_id = ?
           AND ramo_id IN (${aEliminar.map(() => "?").join(",")})`,
        [aseguradoraId, ...aEliminar]
      );
    }

    // Insertar nuevos
    if (aInsertar.length) {
      const values = aInsertar.map((rid) => [aseguradoraId, rid, estado]);
      await conn.query(
        "INSERT INTO aseguradora_ramos (aseguradora_id, ramo_id, estado) VALUES ?",
        [values]
      );
    }

    // Actualizar estado de los que permanecen (opcional)
    if (aMantener.length) {
      await conn.query(
        `UPDATE aseguradora_ramos
           SET estado = ?
         WHERE aseguradora_id = ?
           AND ramo_id IN (${aMantener.map(() => "?").join(",")})`,
        [estado, aseguradoraId, ...aMantener]
      );
    }

    await conn.commit();
    res.json({
      ok: true,
      added: aInsertar.length,
      updated: aMantener.length,
      removed: aEliminar.length,
      estadoAplicado: estado,
    });
  } catch (e) {
    await pool.query("ROLLBACK");
    if (e?.issues) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        details: e.issues.map((i) => i.message),
      });
    }
    console.error("PUT /aseguradora-ramos/:aseguradoraId/sync:", e);
    res.status(500).json({ error: "DB_ERROR" });
  } finally {
    try {
      r.release?.(); // no-op
    } catch {}
    try {
      conn.release();
    } catch {}
  }
});

export default r;

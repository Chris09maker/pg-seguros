// server/src/routes/recordatorios.js
import { Router } from "express";
import { pool } from "../db/pool.js";

const router = Router();

/* ============================================================
   OBTENER recordatorios (rango opcional: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD)
   ============================================================ */
router.get("/", async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;
    const where = [];
    const params = [];

    if (desde) {
      where.push("fecha >= ?");
      params.push(desde);
    }
    if (hasta) {
      where.push("fecha <= ?");
      params.push(hasta);
    }

    const sql = `
      SELECT 
        id, fecha, hora, titulo, tipo, prioridad, detalle, estado
      FROM recordatorios
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY fecha ASC, hora ASC
    `;

    const [rows] = await pool.query(sql, params);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

/* ============================================================
   CREAR nuevo recordatorio
   ============================================================ */
router.post("/", async (req, res, next) => {
  try {
    const { fecha, hora, titulo, tipo, prioridad, detalle } = req.body;
    if (!fecha || !hora || !titulo) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    const [result] = await pool.query(
      `INSERT INTO recordatorios (fecha, hora, titulo, tipo, prioridad, detalle, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
      [fecha, hora, titulo, tipo, prioridad, detalle]
    );

    const [rows] = await pool.query(
      `SELECT id, fecha, hora, titulo, tipo, prioridad, detalle, estado 
         FROM recordatorios 
        WHERE id = ?`,
      [result.insertId]
    );

    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

/* ============================================================
   ACTUALIZAR recordatorio existente
   ============================================================ */
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha, hora, titulo, tipo, prioridad, detalle, estado } = req.body;

    const [result] = await pool.query(
      `UPDATE recordatorios 
          SET fecha = ?, hora = ?, titulo = ?, tipo = ?, prioridad = ?, detalle = ?, 
              estado = COALESCE(?, estado)
        WHERE id = ?`,
      [fecha, hora, titulo, tipo, prioridad, detalle, estado, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Recordatorio no encontrado" });
    }

    const [rows] = await pool.query(
      `SELECT id, fecha, hora, titulo, tipo, prioridad, detalle, estado 
         FROM recordatorios 
        WHERE id = ?`,
      [id]
    );

    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
});

/* ============================================================
   ELIMINAR recordatorio
   ============================================================ */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      "DELETE FROM recordatorios WHERE id = ?",
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Recordatorio no encontrado" });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;


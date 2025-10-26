import { Router } from "express";
import { pool } from "../db/pool.js";

const r = Router();

/* 
  Listado de beneficiarios por póliza.
  La estructura de la base no incluye la columna `actualizado_en`.
  Para mantener la compatibilidad de la respuesta, el campo `actualizadoEn`
  se entrega reutilizando el valor de `creado_en`.
*/
r.get("/polizas/:polizaId/beneficiarios", async (req, res, next) => {
  try {
    const polizaId = Number(req.params.polizaId);
    const [rows] = await pool.query(
      `
      SELECT
        b.id,
        b.nombre,
        b.parentesco,
        b.porcentaje,
        b.estado,
        DATE_FORMAT(b.creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn,
        DATE_FORMAT(b.creado_en, '%Y-%m-%d %H:%i:%s') AS actualizadoEn
      FROM poliza_beneficiarios b
      WHERE b.poliza_id = ?
      ORDER BY b.id ASC
      `,
      [polizaId]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error("listar beneficiarios:", err);
    next(err);
  }
});

/* 
  Creación de beneficiario.
  Se registra la fecha de creación en `creado_en`. 
  La columna `actualizado_en` no está disponible en la tabla.
*/
r.post("/polizas/:polizaId/beneficiarios", async (req, res, next) => {
  try {
    const polizaId = Number(req.params.polizaId);
    const b = req.body || {};

    if (!b.nombre) {
      return res
        .status(400)
        .json({ error: "VALIDATION_ERROR", message: "El nombre es obligatorio." });
    }

    await pool.query(
      `
      INSERT INTO poliza_beneficiarios
        (poliza_id, nombre, parentesco, porcentaje, estado, creado_en)
      VALUES
        (?, ?, ?, ?, ?, NOW())
      `,
      [polizaId, b.nombre, b.parentesco || "", Number(b.porcentaje || 0), b.estado || "ACTIVO"]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("crear beneficiario:", err);
    next(err);
  }
});

/* 
  Actualización de beneficiario.
  La tabla no dispone de `actualizado_en`; en caso de requerirse,
  se deberá ajustar el esquema para registrar dicha marca temporal.
*/
r.put("/polizas/:polizaId/beneficiarios/:benefId", async (req, res, next) => {
  try {
    const polizaId = Number(req.params.polizaId);
    const benefId = Number(req.params.benefId);
    const b = req.body || {};

    const sets = [];
    const vals = [];
    const add = (clause, val) => {
      sets.push(clause);
      vals.push(val);
    };

    if (b.nombre != null)      add("nombre = ?", b.nombre);
    if (b.parentesco != null)  add("parentesco = ?", b.parentesco || "");
    if (b.porcentaje != null)  add("porcentaje = ?", Number(b.porcentaje || 0));
    if (b.estado != null)      add("estado = ?", b.estado || "ACTIVO");

    if (!sets.length) return res.json({ ok: true });

    const sql = `UPDATE poliza_beneficiarios SET ${sets.join(", ")} WHERE id = ? AND poliza_id = ?`;
    await pool.query(sql, [...vals, benefId, polizaId]);

    res.json({ ok: true });
  } catch (err) {
    console.error("actualizar beneficiario:", err);
    next(err);
  }
});

/* 
  Eliminación de beneficiario.
  Se restringe por identificador del beneficiario y de la póliza.
*/
r.delete("/polizas/:polizaId/beneficiarios/:benefId", async (req, res, next) => {
  try {
    const polizaId = Number(req.params.polizaId);
    const benefId = Number(req.params.benefId);

    await pool.query(
      `DELETE FROM poliza_beneficiarios WHERE id = ? AND poliza_id = ?`,
      [benefId, polizaId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("eliminar beneficiario:", err);
    next(err);
  }
});

export default r;

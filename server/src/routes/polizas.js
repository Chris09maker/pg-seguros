// server/src/routes/polizas.js
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";

const r = Router();

/* Utilidades */
const asInt = (v, def = 0) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};
const asDec = (v, def = 0) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : def;
};

/* =======================================================================
   BÚSQUEDA DE CLIENTE POR DPI (para crear/editar póliza)
   ======================================================================= */
r.get("/cliente-por-dpi/search", async (req, res, next) => {
  try {
    // Permitimos sólo dígitos; longitud flexible para pruebas
    const dpi = String(req.query.dpi || "").replace(/\D/g, "");
    if (!dpi) return res.status(400).json({ error: "BAD_DPI" });

    const [[row]] = await pool.query(
      `SELECT id, nombre, CAST(dpi AS CHAR) AS dpi
         FROM clientes
        WHERE dpi = ?`,
      [dpi]
    );

    res.json(row || {}); // {} si no existe
  } catch (e) {
    next(e);
  }
});

/* =======================================================================
   LISTADO DE PÓLIZAS (con filtros y paginación)
   ======================================================================= */
r.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const estadoPago = (req.query.pago || "").toUpperCase(); // "PAGADA" | "CON_SALDO" | ""
    const estado = (req.query.estado || "").toUpperCase();   // "ACTIVA" | "EN_REVISION" | "ANULADA" | "VENCIDA" | ""
    const page = Math.max(asInt(req.query.page, 1), 1);
    const limit = Math.min(Math.max(asInt(req.query.limit, 20), 1), 100);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `
      SELECT
        p.id,
        p.codigo,
        p.moneda,
        p.prima_total                          AS primaTotal,
        p.estado,
        c.id     AS clienteId,
        c.nombre AS cliente,
        a.id     AS aseguradoraId,
        a.nombre AS aseguradora,
        r.id     AS ramoId,
        r.nombre AS ramo,
        IFNULL(vps.total_pagado, 0)            AS totalPagado,
        IFNULL(vps.saldo, 0)                   AS saldo,
        IFNULL(vps.pagada, 0)                  AS pagada
      FROM polizas p
      JOIN clientes     c ON c.id = p.cliente_id
      JOIN aseguradoras a ON a.id = p.aseguradora_id
      JOIN ramos        r ON r.id = p.ramo_id
      LEFT JOIN vw_poliza_saldos vps ON vps.poliza_id = p.id
      WHERE 1=1
        ${q ? "AND (p.codigo LIKE ? OR c.nombre LIKE ? OR a.nombre LIKE ?)" : ""}
        ${estado ? "AND p.estado = ?" : ""}
        ${
          estadoPago === "PAGADA"
            ? "AND IFNULL(vps.pagada,0) = 1"
            : estadoPago === "CON_SALDO"
            ? "AND IFNULL(vps.pagada,0) = 0"
            : ""
        }
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
      `,
      [
        ...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []),
        ...(estado ? [estado] : []),
        limit,
        offset,
      ]
    );

    res.json({ page, limit, items: rows });
  } catch (e) {
    next(e);
  }
});

/* =======================================================================
   DETALLE DE PÓLIZA
   ======================================================================= */
r.get("/:id", async (req, res, next) => {
  try {
    const id = asInt(req.params.id);
    if (!id) return res.status(400).json({ error: "BAD_ID" });

    const [[p]] = await pool.query(
      `
      SELECT
        p.id, p.codigo, p.moneda,
        p.prima_total                     AS primaTotal,
        DATE_FORMAT(p.fecha_emision,   '%Y-%m-%d') AS fechaEmision,
        DATE_FORMAT(p.inicio_vigencia, '%Y-%m-%d') AS inicioVigencia,
        DATE_FORMAT(p.fin_vigencia,    '%Y-%m-%d') AS finVigencia,
        p.estado, p.tipo, p.plan, p.plan_id,
        p.cliente_id     AS clienteId,
        c.nombre         AS cliente,
        c.dpi            AS clienteDpi,
        p.aseguradora_id AS aseguradoraId,
        a.nombre         AS aseguradora,
        p.ramo_id        AS ramoId,
        r.nombre         AS ramo,
        p.observaciones,
        IFNULL(vps.total_pagado, 0) AS totalPagado,
        IFNULL(vps.saldo, 0)       AS saldo,
        IFNULL(vps.pagada, 0)      AS pagada
      FROM polizas p
      JOIN clientes     c ON c.id = p.cliente_id
      JOIN aseguradoras a ON a.id = p.aseguradora_id
      JOIN ramos        r ON r.id = p.ramo_id
      LEFT JOIN vw_poliza_saldos vps ON vps.poliza_id = p.id
      WHERE p.id = ?
      `,
      [id]
    );

    if (!p) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(p);
  } catch (e) {
    next(e);
  }
});

/* =======================================================================
   CREAR / ACTUALIZAR PÓLIZA (sin beneficiarios)
   ======================================================================= */
const createSchema = z.object({
  codigo: z.string().min(1),
  clienteId: z.number().int().positive(),
  aseguradoraId: z.number().int().positive(),
  ramoId: z.number().int().positive(),
  planId: z.number().int().positive().nullable().optional(),
  tipo: z.string().max(40).optional().nullable(),
  plan: z.string().max(120).optional().nullable(),
  moneda: z.string().max(3),
  primaTotal: z.number().nonnegative(),
  fechaEmision: z.string().min(10),
  inicioVigencia: z.string().min(10),
  finVigencia: z.string().min(10).nullable().optional(),
  estado: z.enum(["ACTIVA", "EN_REVISION", "ANULADA", "VENCIDA"]).default("ACTIVA"),
  observaciones: z.string().optional().nullable(),
});

r.post("/", async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);

    const [result] = await pool.query(
      `
      INSERT INTO polizas
        (codigo, cliente_id, aseguradora_id, ramo_id, plan_id, tipo, plan,
         moneda, prima_total, fecha_emision, inicio_vigencia, fin_vigencia,
         estado, observaciones, creado_en)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())
      `,
      [
        data.codigo,
        data.clienteId,
        data.aseguradoraId,
        data.ramoId,
        data.planId ?? null,
        data.tipo ?? null,
        data.plan ?? null,
        data.moneda,
        data.primaTotal,
        data.fechaEmision,
        data.inicioVigencia,
        data.finVigencia ?? null,
        data.estado,
        data.observaciones ?? null,
      ]
    );

    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
});

const updateSchema = createSchema.partial().extend({
  id: z.number().int().positive(),
});

r.put("/:id", async (req, res, next) => {
  try {
    const id = asInt(req.params.id);
    if (!id) return res.status(400).json({ error: "BAD_ID" });

    const data = updateSchema.parse({ ...req.body, id });

    const [result] = await pool.query(
      `
      UPDATE polizas SET
        codigo = COALESCE(?, codigo),
        cliente_id = COALESCE(?, cliente_id),
        aseguradora_id = COALESCE(?, aseguradora_id),
        ramo_id = COALESCE(?, ramo_id),
        plan_id = ?,
        tipo = ?,
        plan = ?,
        moneda = COALESCE(?, moneda),
        prima_total = COALESCE(?, prima_total),
        fecha_emision = COALESCE(?, fecha_emision),
        inicio_vigencia = COALESCE(?, inicio_vigencia),
        fin_vigencia = ?,
        estado = COALESCE(?, estado),
        observaciones = ?,
        actualizado_en = NOW()
      WHERE id = ?
      `,
      [
        data.codigo ?? null,
        data.clienteId ?? null,
        data.aseguradoraId ?? null,
        data.ramoId ?? null,
        data.planId ?? null,
        data.tipo ?? null,
        data.plan ?? null,
        data.moneda ?? null,
        data.primaTotal ?? null,
        data.fechaEmision ?? null,
        data.inicioVigencia ?? null,
        data.finVigencia ?? null,
        data.estado ?? null,
        data.observaciones ?? null,
        id,
      ]
    );

    res.json({ ok: result.affectedRows > 0 });
  } catch (e) {
    next(e);
  }
});

/* =======================================================================
   COBERTURAS DE LA PÓLIZA (tabla poliza_coberturas)
   -----------------------------------------------------------------------
   ⚠️ De momento el front no muestra esta sección, así que
   dejamos los endpoints comentados para no perderlos.
   Para reactivarlos, descomenta este bloque completo.
   ======================================================================= */

/*
 // Listar coberturas de una póliza
 r.get("/:polizaId/coberturas", async (req, res, next) => {
   try {
     const polizaId = asInt(req.params.polizaId);
     if (!polizaId) return res.status(400).json({ error: "BAD_ID" });

     const [rows] = await pool.query(
       `
       SELECT
         pc.id,
         pc.poliza_id     AS polizaId,
         pc.cobertura_id  AS coberturaId,
         c.nombre,
         c.descripcion,
         pc.estado,
         DATE_FORMAT(pc.creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn
       FROM poliza_coberturas pc
       JOIN coberturas c ON c.id = pc.cobertura_id
       WHERE pc.poliza_id = ?
       ORDER BY c.nombre ASC
       `,
       [polizaId]
     );

     res.json(rows);
   } catch (e) {
     next(e);
   }
 });

 // Agregar cobertura (controla duplicado por la UQ poliza_id+cobertura_id)
 r.post("/:polizaId/coberturas", async (req, res, next) => {
   try {
     const polizaId = asInt(req.params.polizaId);
     if (!polizaId) return res.status(400).json({ error: "BAD_ID" });

     const schema = z.object({
       coberturaId: z.number().int().positive(),
     });
     const { coberturaId } = schema.parse(req.body);

     try {
       const [result] = await pool.query(
         `
         INSERT INTO poliza_coberturas
           (poliza_id, cobertura_id, creado_en)
         VALUES (?, ?, NOW())
         `,
         [polizaId, coberturaId]
       );
       res.status(201).json({ id: result.insertId });
     } catch (err) {
       if (err && err.code === "ER_DUP_ENTRY") {
         return res
           .status(409)
           .json({ error: "DUPLICATE", message: "La cobertura ya está asociada a la póliza." });
       }
       throw err;
     }
   } catch (e) {
     next(e);
   }
 });

 // Eliminar cobertura
 r.delete("/:polizaId/coberturas/:id", async (req, res, next) => {
   try {
     const polizaId = asInt(req.params.polizaId);
     const id = asInt(req.params.id);
     if (!polizaId || !id) return res.status(400).json({ error: "BAD_ID" });

     const [result] = await pool.query(
       "DELETE FROM poliza_coberturas WHERE id = ? AND poliza_id = ?",
       [id, polizaId]
     );
     res.json({ ok: result.affectedRows > 0 });
   } catch (e) {
     next(e);
   }
 });
*/

export default r;

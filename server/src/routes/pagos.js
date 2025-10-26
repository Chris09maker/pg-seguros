import { Router } from "express";
import { pool } from "../db/pool.js";

const r = Router();

/* Utilidades de normalización. */
const toMoney = (v) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const mapMetodo = (m) => {
  const s = String(m || "").trim().toUpperCase();
  return ["EFECTIVO", "TARJETA", "TRANSFERENCIA"].includes(s) ? s : "EFECTIVO";
};

/* ======================= LISTAR (historial) ======================= */
r.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const polizaId = Number(req.query.polizaId || 0);
    const polizaCodigo = (req.query.polizaCodigo || "").trim();
    const clienteDpi = Number(String(req.query.clienteDpi || "").replace(/\D/g, ""));
    const f1 = (req.query.desde || "").trim();
    const f2 = (req.query.hasta || "").trim();

    const where = [];
    const vals = [];

    if (polizaId) { where.push("p.poliza_id = ?"); vals.push(polizaId); }
    if (!polizaId && polizaCodigo) { where.push("po.codigo = ?"); vals.push(polizaCodigo); }
    if (clienteDpi) { where.push("p.cliente_dpi = ?"); vals.push(clienteDpi); }
    if (f1) { where.push("p.fecha_pago >= ?"); vals.push(f1); }
    if (f2) { where.push("p.fecha_pago <= ?"); vals.push(f2); }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const sql = `
      SELECT
        p.id,
        p.poliza_id                           AS polizaId,
        po.codigo                             AS polizaCodigo,
        c.nombre                              AS cliente,
        CAST(p.cliente_dpi AS CHAR)           AS clienteDpi,
        DATE_FORMAT(p.fecha_pago,'%Y-%m-%d')   AS fechaPago,
        p.monto                               AS montoPagado,
        p.moneda                              AS moneda,
        p.metodo                              AS metodoPago,
        p.nro_recibo                          AS numeroRecibo,
        p.estado                              AS estado,
        p.observaciones                       AS observaciones,
        DATE_FORMAT(p.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
      FROM pagos p
      JOIN polizas  po ON po.id = p.poliza_id
      JOIN clientes c  ON c.dpi = p.cliente_dpi
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(sql, [...vals, limit, offset]);
    res.json({ items: rows, page, limit });
  } catch (err) {
    console.error("listar pagos:", err);
    next(err);
  }
});

/* ========================= REGISTRAR PAGO ========================= */
r.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};

    /* Resolver póliza por id o código. */
    let polizaId = Number(b.polizaId || 0);
    if (!polizaId && b.polizaCodigo) {
      const [[pol]] = await pool.query(`SELECT id FROM polizas WHERE codigo = ?`, [
        String(b.polizaCodigo).trim(),
      ]);
      if (!pol) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "Póliza no encontrada (código)." });
      }
      polizaId = pol.id;
    }
    if (!polizaId) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Debe indicar la póliza." });
    }

    /* Datos de póliza + cliente. */
    const [[polrow]] = await pool.query(
      `SELECT po.prima_total, c.dpi AS clienteDpi
       FROM polizas po
       JOIN clientes c ON c.id = po.cliente_id
       WHERE po.id = ?`,
      [polizaId]
    );
    if (!polrow) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Cliente de la póliza no encontrado." });
    }

    /* Payload normalizado (acepta múltiples alias). */
    const fechaPago  = b.fechaPago || null;
    const monto      = toMoney(b.montoPagado ?? b.monto ?? b.monto_pago);
    const nroRecibo  = String(b.nroRecibo ?? b.numeroRecibo ?? b.nro_recibo ?? "").trim();
    const metodo     = mapMetodo(b.metodoPago ?? b.metodo);
    const moneda     = (b.moneda || "Q").toUpperCase();
    const obs        = (b.observaciones || "").trim() || null;

    if (!fechaPago) return res.status(400).json({ error: "VALIDATION_ERROR", message: "La fecha de pago es obligatoria." });
    if (monto <= 0)  return res.status(400).json({ error: "VALIDATION_ERROR", message: "El monto pagado debe ser mayor a 0." });
    if (!nroRecibo)  return res.status(400).json({ error: "VALIDATION_ERROR", message: "El número de recibo es obligatorio." });

    /* Verificar beneficiarios. */
    const [[hasBenef]] = await pool.query(
      `SELECT 1 AS ok FROM poliza_beneficiarios WHERE poliza_id = ? LIMIT 1`,
      [polizaId]
    );
    if (!hasBenef) {
      return res.status(409).json({
        error: "NO_BENEFICIARIOS",
        message: "La póliza no tiene beneficiarios. Debe registrar al menos uno antes de cargar pagos.",
      });
    }

    /* Validación de pago parcial (no exceder prima_total). */
    const [[acum]] = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS totalPagado FROM pagos WHERE poliza_id = ?`,
      [polizaId]
    );
    const totalPagado = Number(acum?.totalPagado || 0);
    const primaTotal  = Number(polrow.prima_total || 0);
    const nuevoTotal  = totalPagado + monto;

    if (primaTotal > 0 && nuevoTotal - primaTotal > 0.00001) {
      const saldo = Math.max(0, primaTotal - totalPagado);
      return res.status(409).json({
        error: "PAGO_EXCEDE_SALDO",
        message: `El pago excede el saldo pendiente. Saldo actual: ${saldo.toFixed(2)}`,
        saldoPendiente: saldo,
      });
    }

    /* Insert conforme a tu esquema real. */
    try {
      const [ins] = await pool.query(
        `INSERT INTO pagos
           (poliza_id, cliente_dpi, fecha_pago, monto, moneda, metodo, nro_recibo, estado, observaciones, created_at)
         VALUES
           (?, ?, ?, ?, ?, ?, ?, 'REGISTRADO', ?, NOW())`,
        [
          polizaId,
          Number(polrow.clienteDpi),
          fechaPago,
          monto,
          moneda,
          metodo,
          nroRecibo,
          obs,
        ]
      );

      const saldoRestante = Math.max(0, primaTotal - nuevoTotal);
      return res.status(201).json({
        id: ins.insertId,
        saldoRestante,
        totalPagado: nuevoTotal,
        primaTotal,
        parcial: saldoRestante > 0,
      });
    } catch (e) {
      if (e?.errno === 1062) {
        return res.status(409).json({ error: "RECIBO_DUPLICADO", message: "El número de recibo ya existe." });
      }
      throw e;
    }
  } catch (err) {
    console.error("registrar pago:", err);
    const msg = err?.sqlMessage || err?.message || "No se pudo registrar el pago.";
    res.status(500).json({ error: "INTERNAL_ERROR", message: msg });
  }
});

/* ============================ DETALLE ============================ */
r.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[row]] = await pool.query(
      `SELECT
         p.id,
         p.poliza_id                           AS polizaId,
         po.codigo                             AS polizaCodigo,
         c.nombre                              AS cliente,
         CAST(p.cliente_dpi AS CHAR)           AS clienteDpi,
         DATE_FORMAT(p.fecha_pago,'%Y-%m-%d')  AS fechaPago,
         p.monto                               AS montoPagado,
         p.moneda                              AS moneda,
         p.metodo                              AS metodoPago,
         p.nro_recibo                          AS numeroRecibo,
         p.estado                              AS estado,
         p.observaciones                       AS observaciones,
         DATE_FORMAT(p.created_at,'%Y-%m-%d %H:%i:%s') AS createdAt
       FROM pagos p
       JOIN polizas  po ON po.id  = p.poliza_id
       JOIN clientes c  ON c.dpi  = p.cliente_dpi
       WHERE p.id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(row);
  } catch (err) {
    console.error("detalle pago:", err);
    next(err);
  }
});

export default r;

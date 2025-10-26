// server/src/routes/reportes.js
import { Router } from "express";
import { pool } from "../db/pool.js";

const r = Router();

/* ============================================================================
   CLIENTES
============================================================================ */
r.get("/clientes", async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;

    const where = [];
    const params = [];

    if (desde) { where.push("c.creado_en >= ?"); params.push(desde); }
    if (hasta) { where.push("c.creado_en <= ?"); params.push(hasta); }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [items] = await pool.query(
      `
      SELECT
        c.id,
        c.nombre,
        c.nit,
        c.email,
        c.telefono,
        CAST(c.dpi AS CHAR) AS dpi,
        DATE_FORMAT(c.fecha_nacimiento,'%Y-%m-%d') AS fechaNacimiento,
        c.estado        AS estadoCartera,
        c.estado_activo AS activo,
        DATE_FORMAT(c.creado_en,'%Y-%m-%d %H:%i:%s')     AS creadoEn,
        DATE_FORMAT(c.actualizado_en,'%Y-%m-%d %H:%i:%s') AS actualizadoEn
      FROM clientes c
      ${whereSQL}
      ORDER BY c.nombre ASC, c.id ASC
      `,
      params
    );

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/* ============================================================================
   PÓLIZAS
============================================================================ */
r.get("/polizas", async (req, res, next) => {
  try {
    const { desde, hasta, estado } = req.query;

    const where = [];
    const params = [];

    if (desde) { where.push("p.fecha_emision >= ?"); params.push(desde); }
    if (hasta) { where.push("p.fecha_emision <= ?"); params.push(hasta); }
    if (estado) { where.push("p.estado = ?"); params.push(estado); }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [items] = await pool.query(
      `
      SELECT
        p.id, p.codigo, p.moneda, p.prima_total, p.estado,
        DATE_FORMAT(p.fecha_emision,'%Y-%m-%d')  AS fechaEmision,
        DATE_FORMAT(p.inicio_vigencia,'%Y-%m-%d') AS inicioVigencia,
        DATE_FORMAT(p.fin_vigencia,'%Y-%m-%d')    AS finVigencia,
        c.nombre        AS cliente,
        a.nombre        AS aseguradora,
        r.nombre        AS ramo
      FROM polizas p
      JOIN clientes     c ON c.id = p.cliente_id
      JOIN aseguradoras a ON a.id = p.aseguradora_id
      JOIN ramos        r ON r.id = p.ramo_id
      ${whereSQL}
      ORDER BY p.fecha_emision DESC, p.id DESC
      `,
      params
    );

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/* ============================================================================
   PERSONALIZADO — helpers y rutas (igual que antes)
============================================================================ */
async function fetchPolizaFull(whereSQL, params) {
  const [coreRows] = await pool.query(
    `
    SELECT
      p.id, p.codigo, p.moneda, p.prima_total, p.fecha_emision, p.inicio_vigencia, p.fin_vigencia,
      p.tipo, p.plan, p.estado,
      c.id AS clienteId, c.nombre AS cliente, CAST(c.dpi AS CHAR) AS clienteDpi, c.nit AS clienteNit,
      c.email AS clienteEmail, c.telefono AS clienteTelefono,
      a.id AS aseguradoraId, a.nombre AS aseguradora,
      r.id AS ramoId, r.nombre AS ramo,
      pl.id AS planId, pl.nombre AS planNombre, pl.descripcion AS planDescripcion, pl.prima_base AS planPrimaBase
    FROM polizas p
    JOIN clientes     c  ON c.id = p.cliente_id
    JOIN aseguradoras a  ON a.id = p.aseguradora_id
    JOIN ramos        r  ON r.id = p.ramo_id
    LEFT JOIN planes  pl ON pl.id = p.plan_id
    ${whereSQL}
    LIMIT 1
    `,
    params
  );
  if (coreRows.length === 0) return null;
  const core = coreRows[0];

  const [coberturas] = await pool.query(
    `
    SELECT
      pc.id, pc.estado, pc.suma_asegurada, pc.deducible,
      c.id AS coberturaId, c.nombre AS cobertura, c.descripcion
    FROM poliza_coberturas pc
    JOIN coberturas c ON c.id = pc.cobertura_id
    WHERE pc.poliza_id = ?
    ORDER BY c.nombre
    `,
    [core.id]
  );

  const [pagosItems] = await pool.query(
    `
    SELECT
      pg.id,
      DATE_FORMAT(pg.fecha_pago,'%Y-%m-%d') AS fecha,
      pg.monto, pg.moneda, pg.metodo,
      pg.nro_recibo  AS recibo,
      pg.estado,
      p.codigo       AS polizaCodigo,
      c.nombre       AS cliente,
      CAST(c.dpi AS CHAR) AS clienteDpi
    FROM pagos pg
    JOIN polizas p  ON p.id = pg.poliza_id
    JOIN clientes c ON c.id = p.cliente_id
    WHERE pg.poliza_id = ?
    ORDER BY pg.fecha_pago ASC, pg.id ASC
    `,
    [core.id]
  );

  const totalPagado = pagosItems.reduce((s, x) => s + Number(x.monto || 0), 0);
  const primaTotal = Number(core.prima_total || 0);
  const saldo = Math.max(primaTotal - totalPagado, 0);
  const pagada = saldo <= 0.00001;

  return {
    poliza: {
      id: core.id,
      codigo: core.codigo,
      moneda: core.moneda,
      primaTotal,
      fechaEmision: core.fecha_emision,
      inicioVigencia: core.inicio_vigencia,
      finVigencia: core.fin_vigencia,
      tipo: core.tipo,
      planTexto: core.plan,
      estado: core.estado,
    },
    cliente: {
      id: core.clienteId,
      nombre: core.cliente,
      dpi: core.clienteDpi,
      nit: core.clienteNit,
      email: core.clienteEmail,
      telefono: core.clienteTelefono,
    },
    aseguradora: { id: core.aseguradoraId, nombre: core.aseguradora },
    ramo: { id: core.ramoId, nombre: core.ramo },
    plan: {
      id: core.planId,
      nombre: core.planNombre,
      descripcion: core.planDescripcion,
      primaBase: core.planPrimaBase,
    },
    coberturas,
    pagos: { items: pagosItems, totalMonto: totalPagado },
    saldos: { totalPagado, saldo, pagada },
  };
}

r.get("/personalizado", async (req, res, next) => {
  try {
    const { poliza } = req.query;
    if (!poliza) return res.status(400).json({ error: "Falta parámetro 'poliza'." });

    let payload = null;
    const n = Number(poliza);
    if (Number.isFinite(n)) {
      payload = await fetchPolizaFull("WHERE p.id = ?", [n]);
    } else {
      payload = await fetchPolizaFull("WHERE p.codigo = ?", [poliza]);
    }
    if (!payload) return res.status(404).json({ error: "Póliza no encontrada" });

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

r.get("/personalizado/poliza/:idOrCodigo", async (req, res, next) => {
  try {
    const raw = req.params.idOrCodigo;
    let payload = null;

    const n = Number(raw);
    if (Number.isFinite(n)) {
      payload = await fetchPolizaFull("WHERE p.id = ?", [n]);
    } else {
      payload = await fetchPolizaFull("WHERE p.codigo = ?", [raw]);
    }
    if (!payload) return res.status(404).json({ error: "Póliza no encontrada" });

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

/* ============================================================================
   PAGOS — listado con filtros (ahora con q, recibo, polizaCodigo, dpi, etc.)
   GET /api/reportes/pagos?desde&hasta&metodo&estado&polizaCodigo&dpi&aseguradoraId&recibo&q
============================================================================ */
r.get("/pagos", async (req, res, next) => {
  try {
    const {
      desde,
      hasta,
      metodo,
      estado,
      polizaCodigo,
      dpi,
      aseguradoraId,
      recibo,
      q, // nombre cliente LIKE
    } = req.query;

    const where = [];
    const params = [];

    if (desde)         { where.push("pg.fecha_pago >= ?"); params.push(desde); }
    if (hasta)         { where.push("pg.fecha_pago <= ?"); params.push(hasta); }
    if (metodo)        { where.push("pg.metodo = ?"); params.push(metodo); }
    if (estado)        { where.push("pg.estado = ?"); params.push(estado); }
    if (polizaCodigo)  { where.push("p.codigo = ?"); params.push(polizaCodigo); }
    if (dpi)           { where.push("c.dpi = ?"); params.push(dpi); }
    if (aseguradoraId) { where.push("p.aseguradora_id = ?"); params.push(aseguradoraId); }
    if (recibo)        { where.push("pg.nro_recibo = ?"); params.push(recibo); }
    if (q)             { where.push("c.nombre LIKE ?"); params.push(`%${q}%`); }

    const whereSQL = where.length ? "WHERE " + where.join(" AND ") : "";

    const [items] = await pool.query(
      `
      SELECT
        pg.id,
        DATE_FORMAT(pg.fecha_pago,'%Y-%m-%d')  AS fecha,
        pg.monto,
        pg.moneda,
        pg.metodo,
        pg.nro_recibo AS recibo,
        pg.estado,
        p.id     AS polizaId,
        p.codigo AS polizaCodigo,
        c.id     AS clienteId,
        c.nombre AS cliente,
        CAST(c.dpi AS CHAR) AS clienteDpi
      FROM pagos pg
      JOIN polizas p  ON p.id  = pg.poliza_id
      JOIN clientes c ON c.id  = p.cliente_id
      ${whereSQL}
      ORDER BY pg.fecha_pago ASC, pg.id ASC
      `,
      params
    );

    const totalMonto = items.reduce((s, x) => s + Number(x.monto || 0), 0);
    res.json({ items, totalMonto });
  } catch (err) {
    next(err);
  }
});

export default r;

import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";

const r = Router();

/* --------------------------- Helpers --------------------------- */
const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");

// normaliza fecha: '' -> null, 'YYYY-MM-DD' -> 'YYYY-MM-DD'
const normDate = (v) => {
  const s = str(v);
  if (!s) return null;
  // aceptamos YYYY-MM-DD; si el front manda otro formato, que lo limpie antes
  return s;
};

// normaliza entero: '' -> null, '12' -> 12
const normInt = (v) => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
};

/* ------------------------- Schemas Zod ------------------------- */
const PaginacionSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  q: z.string().trim().optional().default(""),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(), // se aplica a estado_activo
});

// catálogos según tu imagen
const ContactoPreferidoEnum = z.enum(["Email", "WhatsApp", "Llamada"]);
const GeneroEnum = z.enum(["Masculino", "Femenino", "Otro"]);
const EstadoCivilEnum = z.enum(["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a"]);
const EstadoActivoEnum = z.enum(["ACTIVO", "INACTIVO"]);

const CrearClienteSchema = z.object({
  dpi: z
    .string()
    .or(z.number())
    .transform((v) => onlyDigits(v))
    .refine((v) => v.length === 13, "DPI inválido, deben ser 13 dígitos."),
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),

  // Strings opcionales (permiten "")
  nit: z.string().optional(),
  telefono: z.string().optional(),
  celular: z.string().optional(),
  email: z.string().optional(),
  direccion: z.string().optional(),
  municipio: z.string().optional(),
  departamento: z.string().optional(),
  ocupacion: z.string().optional(),
  canal: z.string().optional(),
  observaciones: z.string().optional(),

  // Enums opcionales
  contactoPreferido: ContactoPreferidoEnum.optional(),
  genero: GeneroEnum.optional(),
  estadoCivil: EstadoCivilEnum.optional(),

  // Fechas / números opcionales
  fechaNacimiento: z.string().optional(),
  edad: z.union([z.coerce.number().int(), z.string()]).optional(),

  // Activo / inactivo
  estado: EstadoActivoEnum.optional().default("ACTIVO"),
});

const ActualizarClienteSchema = CrearClienteSchema.partial();

/* -------------------- Validador de parámetro :id ------------------- */
r.param("id", (req, res, next, id) => {
  const n = Number.parseInt(id, 10);
  if (!Number.isInteger(n) || n <= 0) {
    return res
      .status(400)
      .json({ error: "INVALID_ID", message: "El id de cliente debe ser un entero positivo." });
  }
  req.clienteId = n;
  next();
});

/* --------------------------- Listado --------------------------- */
r.get("/", async (req, res, next) => {
  try {
    const { page, limit, q, estado } = PaginacionSchema.parse(req.query);
    const offset = (page - 1) * limit;

    const where = [];
    const vals = [];

    if (q) {
      where.push("(c.nombre LIKE ? OR c.nit LIKE ? OR CAST(c.dpi AS CHAR) LIKE ? OR c.email LIKE ? OR c.telefono LIKE ?)");
      vals.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (estado) {
      where.push("c.estado_activo = ?");
      vals.push(estado);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const sql = `
      SELECT
        c.id,
        CAST(c.dpi AS CHAR)        AS dpi,
        c.nombre,
        c.nit,
        c.telefono,
        c.celular,
        c.email,
        c.direccion,
        c.municipio,
        c.departamento,
        c.contacto_preferido       AS contactoPreferido,
        DATE_FORMAT(c.fecha_nacimiento, '%Y-%m-%d') AS fechaNacimiento,
        c.genero,
        c.estado_civil             AS estadoCivil,
        c.ocupacion,
        c.edad,
        c.canal,
        c.observaciones,
        c.estado_activo            AS estado,             -- ACTIVO/INACTIVO para el front
        c.estado                   AS estadoCarteraDb,    -- enum de la tabla (Al día/Con deuda/…)
        v.total_primas  AS totalPrimas,
        v.total_pagado  AS totalPagado,
        v.saldo_total   AS saldoTotal,
        CASE WHEN v.al_dia = 1 THEN 'AL_DIA' ELSE 'CON_DEUDA' END AS cartera,
        DATE_FORMAT(c.creado_en,    '%Y-%m-%d %H:%i:%s') AS creadoEn,
        DATE_FORMAT(c.actualizado_en,'%Y-%m-%d %H:%i:%s') AS actualizadoEn
      FROM clientes c
      LEFT JOIN vw_cliente_saldos v ON v.cliente_id = c.id
      ${whereSql}
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(sql, [...vals, limit, offset]);
    res.json({ items: rows, page, limit });
  } catch (err) {
    console.error("listar clientes:", err);
    next(err);
  }
});

/* ---------------------------- Detalle -------------------------- */
r.get("/:id", async (req, res, next) => {
  try {
    const id = req.clienteId;

    const [[row]] = await pool.query(
      `
      SELECT
        c.id,
        CAST(c.dpi AS CHAR) AS dpi,
        c.nombre,
        c.nit,
        c.telefono,
        c.celular,
        c.email,
        c.direccion,
        c.municipio,
        c.departamento,
        c.contacto_preferido       AS contactoPreferido,
        DATE_FORMAT(c.fecha_nacimiento, '%Y-%m-%d') AS fechaNacimiento,
        c.genero,
        c.estado_civil             AS estadoCivil,
        c.ocupacion,
        c.edad,
        c.canal,
        c.observaciones,
        c.estado_activo            AS estado,
        c.estado                   AS estadoCarteraDb,
        v.total_primas  AS totalPrimas,
        v.total_pagado  AS totalPagado,
        v.saldo_total   AS saldoTotal,
        CASE WHEN v.al_dia = 1 THEN 'AL_DIA' ELSE 'CON_DEUDA' END AS cartera,
        DATE_FORMAT(c.creado_en,    '%Y-%m-%d %H:%i:%s') AS creadoEn,
        DATE_FORMAT(c.actualizado_en,'%Y-%m-%d %H:%i:%s') AS actualizadoEn
      FROM clientes c
      LEFT JOIN vw_cliente_saldos v ON v.cliente_id = c.id
      WHERE c.id = ?
      `,
      [id]
    );
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(row);
  } catch (err) {
    console.error("detalle cliente:", err);
    next(err);
  }
});

/* ----------------------------- Crear --------------------------- */
r.post("/", async (req, res, next) => {
  try {
    const p = CrearClienteSchema.parse(req.body);

    const dpiNum = Number(onlyDigits(p.dpi));

    const [[dup]] = await pool.query(`SELECT id FROM clientes WHERE dpi = ?`, [dpiNum]);
    if (dup) return res.status(409).json({ error: "DPI_DUPLICADO" });

    const [ins] = await pool.query(
      `INSERT INTO clientes
        (dpi, nombre, nit, telefono, celular, email, direccion, municipio, departamento,
         contacto_preferido, fecha_nacimiento, genero, estado_civil, ocupacion, edad,
         canal, observaciones, estado_activo, creado_en, actualizado_en)
       VALUES (?,?,?,?,?,?,?,?,?,
               ?,?,?,?,?,?,
               ?,?,?, NOW(), NOW())`,
      [
        dpiNum,
        str(p.nombre),
        str(p.nit),
        str(p.telefono),
        str(p.celular),
        str(p.email),
        str(p.direccion),
        str(p.municipio),
        str(p.departamento),
        p.contactoPreferido ?? null,
        normDate(p.fechaNacimiento),
        p.genero ?? null,
        p.estadoCivil ?? null,
        str(p.ocupacion),
        normInt(p.edad),
        str(p.canal),
        str(p.observaciones),
        p.estado || "ACTIVO",
      ]
    );

    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: err.flatten() });
    }
    console.error("crear cliente:", err);
    next(err);
  }
});

/* ---------------------------- Actualizar ----------------------- */
r.put("/:id", async (req, res, next) => {
  try {
    const id = req.clienteId;
    const p = ActualizarClienteSchema.parse(req.body);

    // Validación simple de DPI si viene
    if (p.dpi !== undefined) {
      const dpiRaw = onlyDigits(p.dpi);
      if (dpiRaw && dpiRaw.length !== 13) {
        return res
          .status(400)
          .json({ error: "VALIDATION_ERROR", message: "DPI debe tener 13 dígitos." });
      }
      if (dpiRaw) {
        const [[dup]] = await pool.query(
          `SELECT id FROM clientes WHERE dpi = ? AND id <> ?`,
          [Number(dpiRaw), id]
        );
        if (dup) return res.status(409).json({ error: "DPI_DUPLICADO" });
      }
    }

    const sets = [];
    const vals = [];
    const set = (sql, v) => { sets.push(sql); vals.push(v); };

    if (p.dpi !== undefined)               set("dpi = ?", Number(onlyDigits(p.dpi)) || null);
    if (p.nombre !== undefined)            set("nombre = ?", str(p.nombre));
    if (p.nit !== undefined)               set("nit = ?", str(p.nit));
    if (p.telefono !== undefined)          set("telefono = ?", str(p.telefono));
    if (p.celular !== undefined)           set("celular = ?", str(p.celular));
    if (p.email !== undefined)             set("email = ?", str(p.email));
    if (p.direccion !== undefined)         set("direccion = ?", str(p.direccion));
    if (p.municipio !== undefined)         set("municipio = ?", str(p.municipio));
    if (p.departamento !== undefined)      set("departamento = ?", str(p.departamento));
    if (p.contactoPreferido !== undefined) set("contacto_preferido = ?", p.contactoPreferido ?? null);
    if (p.fechaNacimiento !== undefined)   set("fecha_nacimiento = ?", normDate(p.fechaNacimiento));
    if (p.genero !== undefined)            set("genero = ?", p.genero ?? null);
    if (p.estadoCivil !== undefined)       set("estado_civil = ?", p.estadoCivil ?? null);
    if (p.ocupacion !== undefined)         set("ocupacion = ?", str(p.ocupacion));
    if (p.edad !== undefined)              set("edad = ?", normInt(p.edad));
    if (p.canal !== undefined)             set("canal = ?", str(p.canal));
    if (p.observaciones !== undefined)     set("observaciones = ?", str(p.observaciones));
    if (p.estado !== undefined)            set("estado_activo = ?", p.estado || "ACTIVO");

    if (sets.length === 0) return res.json({ ok: true });

    sets.push("actualizado_en = NOW()");
    await pool.query(`UPDATE clientes SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: err.flatten() });
    }
    console.error("actualizar cliente:", err);
    next(err);
  }
});

/* ------------------------------ Borrar -------------------------- */
r.delete("/:id", async (req, res, next) => {
  try {
    const id = req.clienteId;
    await pool.query(`DELETE FROM clientes WHERE id = ?`, [id]);
  } catch (err) {
    console.error("eliminar cliente:", err);
    return next(err);
  }
  res.json({ ok: true });
});

/* --------- Búsqueda por DPI para ayudar al front (opcional) ----- */
r.get("/search-by-dpi/:dpi?", async (req, res, next) => {
  try {
    const dpi = onlyDigits(req.query.dpi ?? req.params.dpi ?? "");
    if (dpi.length !== 13) return res.json(null);
    const [[row]] = await pool.query(
      `SELECT id, nombre, CAST(dpi AS CHAR) AS dpi FROM clientes WHERE dpi = ?`,
      [Number(dpi)]
    );
    res.json(row || null);
  } catch (err) {
    console.error("search-by-dpi:", err);
    next(err);
  }
});

export default r;

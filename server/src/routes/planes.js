import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";

const r = Router();

/* Utilidades */
const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const toId = (v) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const toMoney = (v) => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* Validaciones */
const EstadoEnum = z.enum(["ACTIVO", "INACTIVO"]);

const PaginacionSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  q: z.string().trim().optional().default(""),
  aseguradoraId: z.coerce.number().int().positive().optional(),
  ramoId: z.coerce.number().int().positive().optional(),
  estado: EstadoEnum.optional(),
});

const CrearSchema = z.object({
  aseguradoraId: z.coerce.number().int().positive({ message: "Aseguradora obligatoria." }),
  ramoId: z.coerce.number().int().positive({ message: "Ramo obligatorio." }),
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  descripcion: z.string().optional(),
  primaBase: z.union([z.coerce.number().nonnegative(), z.string().trim().length(0)]).transform((v) =>
    v === "" ? null : Number(v)
  ),
  estado: EstadoEnum.default("ACTIVO"),
});

const ActualizarSchema = CrearSchema.partial();

/* Param id */
r.param("id", (req, res, next, id) => {
  const n = Number.parseInt(id, 10);
  if (!Number.isInteger(n) || n <= 0) {
    return res.status(400).json({ error: "INVALID_ID" });
  }
  req.planId = n;
  next();
});

/* Listado con filtros y paginación */
r.get("/", async (req, res, next) => {
  try {
    const { page, limit, q, aseguradoraId, ramoId, estado } = PaginacionSchema.parse(req.query);
    const offset = (page - 1) * limit;

    const where = [];
    const vals = [];

    if (aseguradoraId) {
      where.push("p.aseguradora_id = ?");
      vals.push(aseguradoraId);
    }
    if (ramoId) {
      where.push("p.ramo_id = ?");
      vals.push(ramoId);
    }
    if (estado) {
      where.push("p.estado = ?");
      vals.push(estado);
    }
    if (q) {
      where.push("(p.nombre LIKE ? OR p.descripcion LIKE ?)");
      vals.push(`%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const sql = `
      SELECT
        p.id,
        p.aseguradora_id AS aseguradoraId,
        a.nombre          AS aseguradora,
        p.ramo_id        AS ramoId,
        r.nombre          AS ramo,
        p.nombre,
        p.descripcion,
        p.prima_base     AS primaBase,
        p.estado,
        DATE_FORMAT(p.creado_en,     '%Y-%m-%d %H:%i:%s') AS creadoEn,
        DATE_FORMAT(p.actualizado_en,'%Y-%m-%d %H:%i:%s') AS actualizadoEn
      FROM planes p
      JOIN aseguradoras a ON a.id = p.aseguradora_id
      JOIN ramos        r ON r.id = p.ramo_id
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(sql, [...vals, limit, offset]);

    res.json({ items: rows, page, limit });
  } catch (err) {
    console.error("listar planes:", err);
    next(err);
  }
});

/* Detalle */
r.get("/:id", async (req, res, next) => {
  try {
    const id = req.planId;
    const [[row]] = await pool.query(
      `
      SELECT
        p.id,
        p.aseguradora_id AS aseguradoraId,
        a.nombre          AS aseguradora,
        p.ramo_id        AS ramoId,
        r.nombre          AS ramo,
        p.nombre,
        p.descripcion,
        p.prima_base     AS primaBase,
        p.estado,
        DATE_FORMAT(p.creado_en,     '%Y-%m-%d %H:%i:%s') AS creadoEn,
        DATE_FORMAT(p.actualizado_en,'%Y-%m-%d %H:%i:%s') AS actualizadoEn
      FROM planes p
      JOIN aseguradoras a ON a.id = p.aseguradora_id
      JOIN ramos        r ON r.id = p.ramo_id
      WHERE p.id = ?
      `,
      [id]
    );
    if (!row) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(row);
  } catch (err) {
    console.error("detalle plan:", err);
    next(err);
  }
});

/* Crear */
r.post("/", async (req, res, next) => {
  try {
    const p = CrearSchema.parse(req.body);

    // Regla de unicidad opcional: (aseguradora, ramo, nombre) únicos
    const [[dup]] = await pool.query(
      `SELECT id FROM planes WHERE aseguradora_id = ? AND ramo_id = ? AND nombre = ? LIMIT 1`,
      [p.aseguradoraId, p.ramoId, str(p.nombre)]
    );
    if (dup) return res.status(409).json({ error: "NOMBRE_DUPLICADO" });

    const [ins] = await pool.query(
      `INSERT INTO planes
        (aseguradora_id, ramo_id, nombre, descripcion, prima_base, estado, creado_en, actualizado_en)
       VALUES (?,?,?,?,?,?, NOW(), NOW())`,
      [
        p.aseguradoraId,
        p.ramoId,
        str(p.nombre),
        str(p.descripcion),
        toMoney(p.primaBase),
        p.estado || "ACTIVO",
      ]
    );

    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: err.flatten() });
    }
    console.error("crear plan:", err);
    next(err);
  }
});

/* Actualizar */
r.put("/:id", async (req, res, next) => {
  try {
    const id = req.planId;
    const p = ActualizarSchema.parse(req.body);

    const sets = [];
    const vals = [];
    const set = (sql, v) => {
      sets.push(sql);
      vals.push(v);
    };

    if (p.aseguradoraId !== undefined) set("aseguradora_id = ?", toId(p.aseguradoraId));
    if (p.ramoId !== undefined) set("ramo_id = ?", toId(p.ramoId));
    if (p.nombre !== undefined) set("nombre = ?", str(p.nombre));
    if (p.descripcion !== undefined) set("descripcion = ?", str(p.descripcion));
    if (p.primaBase !== undefined) set("prima_base = ?", toMoney(p.primaBase));
    if (p.estado !== undefined) set("estado = ?", p.estado || "ACTIVO");

    if (sets.length === 0) return res.json({ ok: true });

    // Si vienen aseguradora/ramo/nombre, validamos duplicidad
    const ag = p.aseguradoraId !== undefined ? toId(p.aseguradoraId) : undefined;
    const rm = p.ramoId !== undefined ? toId(p.ramoId) : undefined;
    const nm = p.nombre !== undefined ? str(p.nombre) : undefined;

    if (ag !== undefined || rm !== undefined || nm !== undefined) {
      const [[curr]] = await pool.query(`SELECT aseguradora_id, ramo_id, nombre FROM planes WHERE id = ?`, [id]);
      if (!curr) return res.status(404).json({ error: "NOT_FOUND" });
      const aseguradoraV = ag ?? curr.aseguradora_id;
      const ramoV = rm ?? curr.ramo_id;
      const nombreV = str(nm ?? curr.nombre);
      const [[dup]] = await pool.query(
        `SELECT id FROM planes WHERE aseguradora_id = ? AND ramo_id = ? AND nombre = ? AND id <> ? LIMIT 1`,
        [aseguradoraV, ramoV, nombreV, id]
      );
      if (dup) return res.status(409).json({ error: "NOMBRE_DUPLICADO" });
    }

    sets.push("actualizado_en = NOW()");
    await pool.query(`UPDATE planes SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: err.flatten() });
    }
    console.error("actualizar plan:", err);
    next(err);
  }
});

/* Eliminar (blando o duro; aquí duro por simplicidad) */
r.delete("/:id", async (req, res, next) => {
  try {
    const id = req.planId;
    await pool.query(`DELETE FROM planes WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("eliminar plan:", err);
    next(err);
  }
});

/* Endpoint para combos en póliza:
   - Solo planes ACTIVOS
   - Filtra por aseguradora obligatoria
   - Ramo opcional
*/
r.get("/by-aseguradora/:aseguradoraId", async (req, res, next) => {
  try {
    const aseguradoraId = toId(req.params.aseguradoraId);
    if (!aseguradoraId) return res.status(400).json({ error: "INVALID_ASEGURADORA" });

    const ramoId = toId(req.query.ramoId);
    const vals = [aseguradoraId];
    const where = ["p.aseguradora_id = ?", "p.estado = 'ACTIVO'"];

    if (ramoId) {
      where.push("p.ramo_id = ?");
      vals.push(ramoId);
    }

    const [rows] = await pool.query(
      `
      SELECT p.id, p.nombre, p.prima_base AS primaBase, p.ramo_id AS ramoId
      FROM planes p
      WHERE ${where.join(" AND ")}
      ORDER BY p.nombre ASC
      `,
      vals
    );

    res.json(rows);
  } catch (err) {
    console.error("by-aseguradora planes:", err);
    next(err);
  }
});

export default r;

// server/src/routes/usuarios.js
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import bcrypt from "bcryptjs";

const r = Router();

/* ------------------------- Validaciones ------------------------- */
const EmailRelax = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  // Permitir vacío o un email "simple"
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+$/.test(v), "Invalid email address");

const Estado = z.enum(["ACTIVO", "INACTIVO"]);

const baseUsuarioShape = {
  username: z.string().trim().min(1),
  email: EmailRelax.optional().default(""),
  nombres: z.string().trim().min(1),
  apellidos: z.string().trim().min(1),
  // Aceptar roleId numérico o rol string (nombre del rol)
  roleIdOrRol: z
    .union([
      z.object({ roleId: z.number().int().positive() }),
      z.object({ rol: z.string().trim().min(1) }),
      z.object({}), // nada -> conservar en update
    ])
    .optional()
    .default({}),
  estado: Estado.optional(),
};

const createSchema = z.object({
  ...baseUsuarioShape,
  password: z.string().min(6), // obligatoria al crear
});

const updateSchema = z.object({
  ...baseUsuarioShape,
  password: z.string().min(6).optional(), // opcional al editar
});

/* --------------------------- Helpers --------------------------- */
async function resolveRoleId(conn, roleIdOrRol, currentRoleId = null) {
  if (!roleIdOrRol) return currentRoleId;
  if ("roleId" in roleIdOrRol && typeof roleIdOrRol.roleId === "number") {
    return roleIdOrRol.roleId;
  }
  if ("rol" in roleIdOrRol && roleIdOrRol.rol) {
    const [rows] = await conn.query(
      "SELECT id FROM roles WHERE UPPER(nombre) = UPPER(?) LIMIT 1",
      [roleIdOrRol.rol]
    );
    if (rows.length) return rows[0].id;
    return currentRoleId;
  }
  return currentRoleId;
}

/* --------------------------- Listado --------------------------- */
r.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const estado = (req.query.estado || "").toString().trim();

    const params = [];
    let where = " WHERE 1=1 ";
    if (q) {
      where +=
        " AND (u.username LIKE ? OR u.email LIKE ? OR u.nombres LIKE ? OR u.apellidos LIKE ?)";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (estado === "ACTIVO" || estado === "INACTIVO") {
      where += " AND u.estado = ? ";
      params.push(estado);
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email, u.nombres, u.apellidos,
              u.role_id AS roleId, r.nombre AS rol,
              u.estado, u.ultimo_acceso AS ultimoAcceso
       FROM usuarios u
       JOIN roles r ON r.id = u.role_id
       ${where}
       ORDER BY u.id DESC`,
      params
    );

    res.json(rows);
  } catch (e) {
    console.error("[GET /usuarios]", e);
    res.status(500).json({ message: "Error al listar usuarios" });
  }
});

/* ------------------------ Obtener por id ----------------------- */
r.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Id inválido" });

    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email, u.nombres, u.apellidos,
              u.role_id AS roleId, r.nombre AS rol,
              u.estado, u.ultimo_acceso AS ultimoAcceso
       FROM usuarios u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "No encontrado" });
    res.json(rows[0]);
  } catch (e) {
    console.error("[GET /usuarios/:id]", e);
    res.status(500).json({ message: "Error al obtener usuario" });
  }
});

/* ---------------------------- Crear ---------------------------- */
r.post("/", async (req, res) => {
  try {
    const parsed = createSchema.parse(req.body);

    // Usar conexión del pool para transacción
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const roleId = await resolveRoleId(conn, parsed.roleIdOrRol, null);
      if (!roleId) {
        await conn.rollback();
        return res.status(400).json({ message: "Rol inválido" });
      }

      const hash = await bcrypt.hash(parsed.password, 10);

      await conn.query(
        `INSERT INTO usuarios (username, email, password_hash, nombres, apellidos, role_id, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          parsed.username,
          parsed.email || "",
          hash,
          parsed.nombres,
          parsed.apellidos,
          roleId,
          parsed.estado || "ACTIVO",
        ]
      );

      await conn.commit();
      res.status(201).json({ ok: true });
    } catch (err) {
      try { await conn.rollback(); } catch {}
      console.error("[POST /usuarios]", err);
      if (err?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "Username o email ya existe" });
      }
      res.status(500).json({ message: "Error al crear usuario" });
    } finally {
      conn.release();
    }
  } catch (zerr) {
    console.error("[API ERROR] ZodError:", zerr);
    res.status(400).json({ message: "Datos inválidos" });
  }
});

/* --------------------------- Actualizar ------------------------ */
r.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Id inválido" });

    const parsed = updateSchema.parse(req.body);

    const [curRows] = await pool.query("SELECT role_id FROM usuarios WHERE id = ?", [id]);
    if (!curRows.length) return res.status(404).json({ message: "No encontrado" });

    const currentRoleId = curRows[0].role_id;

    // Resolver roleId usando el pool (no requiere transacción para update)
    const roleId = await resolveRoleId(pool, parsed.roleIdOrRol, currentRoleId);

    const fields = [];
    const params = [];

    if (parsed.username != null) {
      fields.push("username = ?");
      params.push(parsed.username);
    }
    if (parsed.email != null) {
      fields.push("email = ?");
      params.push(parsed.email);
    }
    if (parsed.nombres != null) {
      fields.push("nombres = ?");
      params.push(parsed.nombres);
    }
    if (parsed.apellidos != null) {
      fields.push("apellidos = ?");
      params.push(parsed.apellidos);
    }
    if (roleId != null) {
      fields.push("role_id = ?");
      params.push(roleId);
    }
    if (parsed.estado != null) {
      fields.push("estado = ?");
      params.push(parsed.estado);
    }
    if (parsed.password) {
      const hash = await bcrypt.hash(parsed.password, 10);
      fields.push("password_hash = ?");
      params.push(hash);
    }

    if (!fields.length) return res.json({ ok: true }); // nada que actualizar

    params.push(id);
    await pool.query(
      `UPDATE usuarios SET ${fields.join(", ")}, actualizado_en = NOW() WHERE id = ?`,
      params
    );

    res.json({ ok: true });
  } catch (zerr) {
    console.error("[PUT /usuarios/:id]", zerr);
    res.status(400).json({ message: "Datos inválidos" });
  }
});

export default r;

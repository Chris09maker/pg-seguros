// server/src/routes/auth.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import bcrypt from "bcryptjs";

const router = Router();

/**
 * POST /auth/login
 * body: { username, password }
 *
 * - Sin JWT ni sesiones.
 * - Valida con bcryptjs si el campo es hash; permite fallback temporal si hay texto plano.
 * - Devuelve { user } con datos básicos (sin contraseña ni hash).
 */
router.post("/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({ message: "Usuario y contraseña requeridos" });
    }

    // Ajusta nombres de columnas/tabla si fuera necesario
    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.username,
        u.email,
        u.nombres,
        u.apellidos,
        u.estado,
        u.role_id AS roleId,
        u.password_hash AS passwordHash,   -- <== ajusta si tu campo se llama distinto
        r.nombre AS rol
      FROM usuarios u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.username = ?
      LIMIT 1
      `,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const u = rows[0];

    if (u.estado && u.estado !== "ACTIVO") {
      return res.status(401).json({ message: "Usuario inactivo" });
    }

    // --- Validación de contraseña ---
    let ok = false;

    if (typeof u.passwordHash === "string" && /^\$2[aby]\$/.test(u.passwordHash)) {
      // Caso normal: hash bcrypt
      ok = await bcrypt.compare(password, u.passwordHash);
    } else {
      // Fallback: DB con texto plano (mientras migras). Puedes removerlo cuando todo sea hash.
      ok = password === u.passwordHash;

      // (Opcional) migración automática a bcrypt si coincide en texto plano:
      if (ok && password && !/^\$2[aby]\$/.test(u.passwordHash || "")) {
        const newHash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE usuarios SET password_hash = ? WHERE id = ?", [
          newHash,
          u.id,
        ]);
      }
    }

    if (!ok) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Último acceso (opcional)
    try {
      await pool.query("UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?", [u.id]);
    } catch (_) {}

    const user = {
      id: u.id,
      username: u.username,
      email: u.email || "",
      nombres: u.nombres || "",
      apellidos: u.apellidos || "",
      rol: u.rol || "",
      estado: u.estado || "ACTIVO",
    };

    return res.json({ user });
  } catch (err) {
    console.error("[POST /auth/login]", err);
    return res.status(500).json({ message: "Error de autenticación" });
  }
});

export default router;

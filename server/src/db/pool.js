// server/src/db/pool.js
import mysql from "mysql2/promise";
import "dotenv/config";

/**
 * Nota:
 * - En Azure MySQL Flexible, SSL es obligatorio. Usamos rejectUnauthorized:true
 *   para validar el certificado CA público de Azure.
 * - Si en LOCAL te falla por SSL, puedes condicionar con NODE_ENV o una env
 *   propia (por ejemplo DB_SSL=false). Aquí lo dejamos siempre on para Azure.
 */
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  charset: "utf8mb4",
  ssl: { rejectUnauthorized: true },
});

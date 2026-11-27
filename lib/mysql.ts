import mysql, { type Pool, type PoolOptions } from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var focusMysqlPool: Pool | undefined;
}

function createPool() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;

  if (!host || !user || !database) {
    throw new Error("MySQL is not configured. Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME.");
  }

  const common: PoolOptions = {
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
    decimalNumbers: true,
    host,
    port: Number(process.env.DB_PORT || 3306),
    user,
    password: process.env.DB_PASSWORD || "",
    database,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  };

  return mysql.createPool(common);
}

export const db = globalThis.focusMysqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.focusMysqlPool = db;
}

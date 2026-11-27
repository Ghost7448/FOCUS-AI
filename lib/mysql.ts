import mysql, { type Pool, type PoolOptions } from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var focusMysqlPool: Pool | undefined;
}

function createPool() {
  const uri = process.env.DATABASE_URL;
  const common: PoolOptions = {
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
    decimalNumbers: true
  };

  if (uri) return mysql.createPool({ uri, ...common });

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  if (!host || !user || !database) {
    throw new Error("MySQL is not configured. Set DATABASE_URL or DB_HOST, DB_USER and DB_NAME.");
  }

  return mysql.createPool({
    ...common,
    host,
    port: Number(process.env.DB_PORT || 3306),
    user,
    password: process.env.DB_PASSWORD || "",
    database,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });
}

export const db = globalThis.focusMysqlPool ?? createPool();
if ( process.env.NODE_ENV !== "production" ) globalThis.focusMysqlPool = db;

export async function query<T>(sql: string, values: unknown[] = []) {
  const [rows] = await db.execute(sql, values);
  return rows as T;
}

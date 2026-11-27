import mysql, { type Pool, type PoolOptions } from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var focusMysqlPool: Pool | undefined;
}

function readMysqlUrl() {
  const value = process.env.MYSQL_URL;
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("MYSQL_URL must be a valid MySQL connection URL.");
  }

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}

function createPool() {
  const fromUrl = readMysqlUrl();
  const host = process.env.MYSQLHOST || fromUrl?.host;
  const user = process.env.MYSQLUSER || fromUrl?.user;
  const database = process.env.MYSQL_DATABASE || fromUrl?.database;

  if (!host || !user || !database) {
    throw new Error("MySQL is not configured. Set MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD and MYSQL_DATABASE, or provide MYSQL_URL.");
  }

  const common: PoolOptions = {
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
    decimalNumbers: true,
    host,
    port: Number(process.env.MYSQLPORT || fromUrl?.port || 3306),
    user,
    password: process.env.MYSQLPASSWORD ?? fromUrl?.password ?? "",
    database,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  };

  return mysql.createPool(common);
}

export const db = globalThis.focusMysqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis.focusMysqlPool = db;
}

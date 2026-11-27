import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

function getMysqlConfig() {
  let fromUrl = null;
  if (process.env.MYSQL_URL) {
    let url;
    try {
      url = new URL(process.env.MYSQL_URL);
    } catch {
      throw new Error("MYSQL_URL must be a valid MySQL connection URL.");
    }
    fromUrl = {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    };
  }

  const config = {
    host: process.env.MYSQLHOST || fromUrl?.host,
    port: Number(process.env.MYSQLPORT || fromUrl?.port || 3306),
    user: process.env.MYSQLUSER || fromUrl?.user,
    password: process.env.MYSQLPASSWORD ?? fromUrl?.password ?? "",
    database: process.env.MYSQL_DATABASE || fromUrl?.database,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  };

  if (!config.host || !config.user || !config.database) {
    throw new Error("Set MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD and MYSQL_DATABASE, or provide MYSQL_URL.");
  }
  return config;
}

async function main() {
  const {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    ADMIN_NAME,
  } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_NAME) {
    throw new Error("Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME before running this script.");
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const connection = await mysql.createConnection(getMysqlConfig());

  try {
    const email = ADMIN_EMAIL.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await connection.execute(
      `INSERT INTO users(email,password_hash,full_name,role,status,email_verified)
       VALUES(?,?,?,'admin','active',1)
       ON DUPLICATE KEY UPDATE
       password_hash=VALUES(password_hash),
       full_name=VALUES(full_name),
       role='admin',
       status='active',
       email_verified=1`,
      [email, passwordHash, ADMIN_NAME.trim()],
    );
    process.stdout.write("Administrator account created or updated. Clear ADMIN_PASSWORD from the shell environment now.\\n");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

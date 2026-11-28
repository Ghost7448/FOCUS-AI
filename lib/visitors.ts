import { db } from "@/lib/mysql";

let visitorTableReady: Promise<void> | null = null;

export async function ensureVisitorTable() {
  if (visitorTableReady) return visitorTableReady;
  visitorTableReady = db.execute(`
    CREATE TABLE IF NOT EXISTS visitor_sessions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      session_key CHAR(64) NOT NULL UNIQUE,
      user_id BIGINT UNSIGNED NULL,
      ip_address VARCHAR(64) NULL,
      user_agent TEXT NULL,
      browser VARCHAR(120) NULL,
      operating_system VARCHAR(120) NULL,
      device_type VARCHAR(80) NULL,
      device_info VARCHAR(255) NULL,
      screen_resolution VARCHAR(80) NULL,
      language VARCHAR(160) NULL,
      timezone VARCHAR(100) NULL,
      referrer TEXT NULL,
      cookies_enabled TINYINT(1) NOT NULL DEFAULT 0,
      platform VARCHAR(120) NULL,
      hardware_concurrency SMALLINT UNSIGNED NULL,
      device_memory DECIMAL(6,2) NULL,
      touch_points SMALLINT UNSIGNED NULL,
      last_path VARCHAR(500) NULL,
      page_views INT UNSIGNED NOT NULL DEFAULT 0,
      first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX visitor_last_seen_idx(last_seen),
      INDEX visitor_user_idx(user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `).then(() => undefined).catch(error => {
    visitorTableReady = null;
    throw error;
  });
  return visitorTableReady;
}

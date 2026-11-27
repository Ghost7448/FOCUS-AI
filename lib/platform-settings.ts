import { db } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";

export const DEFAULT_PLATFORM_SETTINGS = {
  allow_student_registration: "true",
  allow_teacher_registration: "true",
  require_email_verification: "true",
  maintenance_mode: "false",
} as const;

export type PlatformSettingKey = keyof typeof DEFAULT_PLATFORM_SETTINGS;

export async function ensurePlatformSettingsTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      setting_key VARCHAR(80) NOT NULL PRIMARY KEY,
      setting_value VARCHAR(255) NOT NULL,
      updated_by BIGINT UNSIGNED NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT platform_settings_user_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
  for (const [key, value] of Object.entries(DEFAULT_PLATFORM_SETTINGS)) {
    await db.execute("INSERT IGNORE INTO platform_settings(setting_key,setting_value) VALUES(?,?)", [key,value]);
  }
}

export async function getPlatformSettings() {
  await ensurePlatformSettingsTable();
  const [rows] = await db.execute<RowDataPacket[]>("SELECT setting_key,setting_value FROM platform_settings");
  const settings: Record<string,string> = { ...DEFAULT_PLATFORM_SETTINGS };
  for (const row of rows) settings[String(row.setting_key)] = String(row.setting_value);
  return settings as Record<PlatformSettingKey,string>;
}

import { gunzipSync } from "node:zlib";
import { db } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";

export const MAX_STUDY_FILE_SIZE = 30 * 1024 * 1024;

let tableReady: Promise<void> | null = null;

export function restoreStudyFile(data: Buffer, compression: string | null | undefined) {
  return compression === "gzip"
    ? gunzipSync(data, { maxOutputLength: MAX_STUDY_FILE_SIZE })
    : data;
}

export function ensureStudyFilesTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await db.execute(
        "CREATE TABLE IF NOT EXISTS study_files (" +
        "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY," +
        "user_id BIGINT UNSIGNED NOT NULL," +
        "tool_type ENUM('lecture','book') NOT NULL," +
        "original_name VARCHAR(255) NOT NULL," +
        "mime_type VARCHAR(127) NOT NULL," +
        "file_size INT UNSIGNED NOT NULL," +
        "file_data LONGBLOB NOT NULL," +
        "compression_method ENUM('none','gzip') NOT NULL DEFAULT 'none'," +
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "CONSTRAINT study_files_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE," +
        "INDEX study_files_owner_idx (user_id, tool_type, created_at)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
      );
      const [columns] = await db.execute<RowDataPacket[]>(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'study_files' AND COLUMN_NAME = 'compression_method'"
      );
      if (!columns.length) {
        await db.execute("ALTER TABLE study_files ADD COLUMN compression_method ENUM('none','gzip') NOT NULL DEFAULT 'none' AFTER file_data");
      }
      await db.execute(
        "CREATE TABLE IF NOT EXISTS study_file_analyses (" +
        "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY," +
        "file_id BIGINT UNSIGNED NOT NULL," +
        "analysis LONGTEXT NOT NULL," +
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "CONSTRAINT study_file_analysis_fk FOREIGN KEY (file_id) REFERENCES study_files(id) ON DELETE CASCADE," +
        "INDEX study_file_analysis_latest_idx (file_id, created_at)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
      );
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

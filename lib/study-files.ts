import { db } from "@/lib/mysql";

let tableReady: Promise<void> | null = null;

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
        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "CONSTRAINT study_files_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE," +
        "INDEX study_files_owner_idx (user_id, tool_type, created_at)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
      );
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

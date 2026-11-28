import { db } from "@/lib/mysql";

type AuditInput = {
  actorUserId?: number | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: unknown;
  ipAddress?: string | null;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    const metadata = input.metadata == null ? null : JSON.stringify(input.metadata).slice(0, 12000);
    await db.execute(
      "INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata,ip_address) VALUES(?,?,?,?,?,?)",
      [input.actorUserId || null, input.action.slice(0, 100), input.entityType?.slice(0, 80) || null,
       input.entityId || null, metadata, input.ipAddress?.slice(0, 64) || null]
    );
  } catch (error) {
    console.error("Audit event could not be stored:", error);
  }
}

export function requestIp(headers: Headers) {
  return (headers.get("x-forwarded-for") || headers.get("x-real-ip") || "").split(",")[0].trim().slice(0, 64) || null;
}

import { requireRole } from "@/lib/auth";
import Workspace from "@/components/Workspace";

export default async function AdminPage() {
  const user = await requireRole(["admin"]);
  return <Workspace role="admin" name={user.full_name || user.email} />;
}

import { requireRole } from "@/lib/auth";
import Workspace from "@/components/Workspace";

export default async function StudentPage() {
  const user = await requireRole(["student"]);
  return <Workspace role="student" name={user.full_name || user.email} />;
}

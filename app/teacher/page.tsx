import { requireRole } from "@/lib/auth";
import Workspace from "@/components/Workspace";

export default async function TeacherPage() {
  const user = await requireRole(["teacher"]);
  return <Workspace role="teacher" name={user.full_name || user.email} />;
}

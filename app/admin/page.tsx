import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Workspace from "@/components/Workspace";
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.app_metadata?.role !== "admin") redirect("/student");
  return <Workspace role="admin" name={user.user_metadata?.full_name || user.email || "Admin"}/>;
}
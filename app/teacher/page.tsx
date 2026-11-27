import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Workspace from "@/components/Workspace";
export default async function TeacherPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,full_name").eq("id", user.id).single();
  if (user.app_metadata?.role === "admin") redirect("/admin");
  if (profile?.role !== "teacher") redirect("/student");
  return <Workspace role="teacher" name={profile.full_name || user.email || "Teacher"}/>;
}
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { hasSameOrigin } from "@/lib/security";
import { ensurePlatformSettingsTable, getPlatformSettings } from "@/lib/platform-settings";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingKeys = ["allow_student_registration","allow_teacher_registration","require_email_verification","maintenance_mode"] as const;
const schema = z.discriminatedUnion("action",[
  z.object({action:z.literal("update_user"),userId:z.number().int().positive(),role:z.enum(["student","teacher","admin"]),status:z.enum(["active","suspended"])}),
  z.object({action:z.literal("update_settings"),settings:z.record(z.enum(settingKeys),z.boolean())})
]);

export async function GET(){
  const admin=await getCurrentUser();
  if(!admin || admin.role!=="admin") return NextResponse.json({error:"Admin access required."},{status:403});
  try{
    const [users]=await db.execute<RowDataPacket[]>(
      "SELECT id,email,full_name,role,status,email_verified,created_at FROM users ORDER BY created_at DESC LIMIT 500"
    );
    const [counts]=await db.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS total_users,SUM(role='student') AS students,SUM(role='teacher') AS teachers,SUM(role='admin') AS admins,SUM(status='suspended') AS suspended FROM users"
    );
    const [classCounts]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS total_classes FROM classes");
    const [examCounts]=await db.execute<RowDataPacket[]>("SELECT COUNT(*) AS total_exams FROM exams");
    const settings=await getPlatformSettings();
    return NextResponse.json({users,stats:{...counts[0],...classCounts[0],...examCounts[0]},settings});
  }catch(error){
    console.error("Admin dashboard load failed:",error);
    return NextResponse.json({error:"Could not load admin dashboard."},{status:500});
  }
}

export async function POST(request:NextRequest){
  if(!hasSameOrigin(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const admin=await getCurrentUser();
  if(!admin || admin.role!=="admin") return NextResponse.json({error:"Admin access required."},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:parsed.error.issues[0]?.message||"Invalid admin action."},{status:400});
  try{
    if(parsed.data.action==="update_settings"){
      await ensurePlatformSettingsTable();
      const settings=parsed.data.settings;
      const connection=await db.getConnection();
      try{
        await connection.beginTransaction();
        for(const key of settingKeys){
          await connection.execute(
            "INSERT INTO platform_settings(setting_key,setting_value,updated_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by)",
            [key,settings[key]?"true":"false",admin.id]
          );
        }
        await connection.execute("INSERT INTO audit_logs(actor_user_id,action,entity_type,metadata) VALUES(?,?,?,?)",
          [admin.id,"platform_settings_updated","platform_settings",JSON.stringify(settings)]);
        await connection.commit();
      }catch(error){await connection.rollback();throw error;}finally{connection.release();}
      return NextResponse.json({message:"Platform settings saved."});
    }

    const {userId,role,status}=parsed.data;
    if(userId===admin.id) return NextResponse.json({error:"You cannot change your own role or account status here."},{status:400});
    const connection=await db.getConnection();
    try{
      await connection.beginTransaction();
      const [targetRows]=await connection.execute<RowDataPacket[]>("SELECT id,role,status FROM users WHERE id=? FOR UPDATE",[userId]);
      if(!targetRows.length){await connection.rollback();return NextResponse.json({error:"User not found."},{status:404});}
      const target=targetRows[0];
      if(target.role==="admin" && (role!=="admin" || status!=="active")){
        const [adminRows]=await connection.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM users WHERE role='admin' AND status='active' FOR UPDATE");
        if(Number(adminRows[0]?.total||0)<=1){await connection.rollback();return NextResponse.json({error:"The platform must keep at least one active administrator."},{status:409});}
      }
      await connection.execute("UPDATE users SET role=?,status=?,updated_at=UTC_TIMESTAMP() WHERE id=?",[role,status,userId]);
      await connection.execute("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES(?,?,?,?,?)",
        [admin.id,"user_updated","user",userId,JSON.stringify({before:{role:target.role,status:target.status},after:{role,status}})]);
      await connection.commit();
    }catch(error){await connection.rollback();throw error;}finally{connection.release();}
    return NextResponse.json({message:"User account updated."});
  }catch(error){
    console.error("Admin action failed:",error);
    return NextResponse.json({error:"Could not complete this admin action."},{status:500});
  }
}

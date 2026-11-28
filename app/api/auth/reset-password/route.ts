import { NextRequest,NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/mysql";
import { hashToken } from "@/lib/auth";
import { hasSameOrigin } from "@/lib/security";
import { writeAuditLog, requestIp } from "@/lib/audit";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 try{
  if(!hasSameOrigin(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
  const parsed=z.object({token:z.string().min(30).max(200),password:z.string().min(10).max(72).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/)}).safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"Invalid token or password. Use at least 10 characters with uppercase, lowercase and a number."},{status:400});
  const [rows]=await db.execute("SELECT user_id FROM password_reset_tokens WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() LIMIT 1",[hashToken(parsed.data.token)]);
  const record=(rows as {user_id:number}[])[0];
  if(!record)return NextResponse.json({error:"This reset link is invalid or has expired."},{status:400});
  const passwordHash=await bcrypt.hash(parsed.data.password,12);
  const connection=await db.getConnection();
  try{
   await connection.beginTransaction();
   await connection.execute("UPDATE users SET password_hash=?,updated_at=UTC_TIMESTAMP() WHERE id=?",[passwordHash,record.user_id]);
   await connection.execute("DELETE FROM sessions WHERE user_id=?",[record.user_id]);
   await connection.execute("DELETE FROM password_reset_tokens WHERE user_id=?",[record.user_id]);
   await connection.commit();
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
  await writeAuditLog({ actorUserId:record.user_id, action:"password_reset_completed", entityType:"user", entityId:record.user_id, ipAddress:requestIp(request.headers) });
  return NextResponse.json({message:"Password updated. You can now log in."});
 }catch(error){console.error("Password reset error:",error);return NextResponse.json({error:"Unable to reset password right now."},{status:500});}
}

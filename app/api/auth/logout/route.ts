import { NextRequest,NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { writeAuditLog, requestIp } from "@/lib/audit";
import { hasSameOrigin } from "@/lib/security";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 if(!hasSameOrigin(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
 try{const user=await getCurrentUser();await writeAuditLog({actorUserId:user?.id||null,action:"logout_success",entityType:"auth",ipAddress:requestIp(request.headers)});await destroySession();return NextResponse.json({message:"Signed out."});}
 catch{return NextResponse.json({error:"Unable to sign out."},{status:500});}
}

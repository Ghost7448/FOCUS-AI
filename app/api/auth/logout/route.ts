import { NextRequest,NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { hasSameOrigin } from "@/lib/security";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 if(!hasSameOrigin(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
 try{await destroySession();return NextResponse.json({message:"Signed out."});}
 catch{return NextResponse.json({error:"Unable to sign out."},{status:500});}
}

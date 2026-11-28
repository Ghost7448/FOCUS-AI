import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/mysql";
import { requestIp } from "@/lib/audit";
import { ensureVisitorTable } from "@/lib/visitors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max) || null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const user = await getCurrentUser();
    const existing = request.cookies.get("focus_visitor")?.value;
    const token = existing && /^[A-Za-z0-9_-]{32,128}$/.test(existing) ? existing : randomBytes(32).toString("base64url");
    const sessionKey = createHash("sha256").update(token).digest("hex");
    const ip = requestIp(request.headers);
    const userAgent = clip(request.headers.get("user-agent"), 2000);
    const path = clip(body.path, 500);
    const cores = Number(body.hardwareConcurrency);
    const memory = Number(body.deviceMemory);
    const touch = Number(body.touchPoints);

    await ensureVisitorTable();
    await db.execute(
      `INSERT INTO visitor_sessions
       (session_key,user_id,ip_address,user_agent,browser,operating_system,device_type,device_info,screen_resolution,language,timezone,referrer,cookies_enabled,platform,hardware_concurrency,device_memory,touch_points,last_path,page_views,first_seen,last_seen)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE user_id=COALESCE(VALUES(user_id),user_id),ip_address=VALUES(ip_address),
       user_agent=VALUES(user_agent),browser=VALUES(browser),operating_system=VALUES(operating_system),
       device_type=VALUES(device_type),device_info=VALUES(device_info),screen_resolution=VALUES(screen_resolution),
       language=VALUES(language),timezone=VALUES(timezone),referrer=VALUES(referrer),cookies_enabled=VALUES(cookies_enabled),
       platform=VALUES(platform),hardware_concurrency=VALUES(hardware_concurrency),device_memory=VALUES(device_memory),
       touch_points=VALUES(touch_points),last_path=VALUES(last_path),page_views=page_views+1,last_seen=UTC_TIMESTAMP()`,
      [sessionKey,user?.id || null,ip,userAgent,clip(body.browser,120),clip(body.operatingSystem,120),
       clip(body.deviceType,80),clip(body.deviceInfo,255),clip(body.screenResolution,80),clip(body.language,160),
       clip(body.timezone,100),clip(body.referrer,1000),body.cookiesEnabled?1:0,clip(body.platform,120),
       Number.isFinite(cores)&&cores>0?Math.min(cores,1024):null,
       Number.isFinite(memory)&&memory>0?Math.min(memory,1024):null,
       Number.isFinite(touch)&&touch>=0?Math.min(touch,1024):null,path]
    );


    const response = NextResponse.json({ ok:true });
    response.cookies.set("focus_visitor",token,{
      httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*24*30
    });
    response.headers.set("Cache-Control","no-store");
    return response;
  } catch (error) {
    console.error("Visitor tracking failed:",error);
    return NextResponse.json({error:"Could not record visit."},{status:500});
  }
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Settings, Users, Eye, RefreshCw, Search } from "lucide-react";
import AdminTools from "@/components/AdminTools";
import CustomSelect from "@/components/CustomSelect";
import DatePicker from "@/components/DatePicker";
import { useLanguage } from "@/components/LanguageProvider";

type Section = "Platform Settings" | "User Management" | "Logs" | "Visitors";
type LogRow = { id:number; actor_user_id:number|null; action:string; entity_type:string|null; entity_id:number|null; metadata:unknown; ip_address:string|null; created_at:string; actor_name:string|null; actor_email:string|null };
type Visitor = { id:number; ip_address:string|null; user_agent:string|null; browser:string|null; operating_system:string|null; device_type:string|null; device_info:string|null; screen_resolution:string|null; language:string|null; timezone:string|null; referrer:string|null; cookies_enabled:number; platform:string|null; hardware_concurrency:number|null; device_memory:number|null; touch_points:number|null; last_path:string|null; page_views:number; first_seen:string; last_seen:string; account_name:string|null; account_email:string|null };
const tabs: {label:Section;icon:typeof Settings}[] = [
  {label:"Platform Settings",icon:Settings},{label:"User Management",icon:Users},{label:"Logs",icon:Activity},{label:"Visitors",icon:Eye}
];

function displayDate(value:string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function metadataText(value:unknown) {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export default function AdminCenter() {
  const { t, language } = useLanguage();
  const [section,setSection] = useState<Section>("Platform Settings");
  const [logs,setLogs] = useState<LogRow[]>([]);
  const [visitors,setVisitors] = useState<Visitor[]>([]);
  const [visitorStats,setVisitorStats] = useState<Record<string,number>>({});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [search,setSearch] = useState("");
  const [category,setCategory] = useState("all");
  const [from,setFrom] = useState("");
  const [to,setTo] = useState("");
  const [device,setDevice] = useState("all");

  async function loadLogs() {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({q:search,category,limit:"50"});
      if(from) params.set("from",from);
      if(to) params.set("to",to);
      const response = await fetch("/api/admin/logs?"+params.toString(),{cache:"no-store"});
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "Could not load logs.");
      setLogs(data.logs || []);
    } catch(e) { setError(e instanceof Error ? e.message : "Could not load logs."); }
    finally { setLoading(false); }
  }

  async function loadVisitors() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/visitors",{cache:"no-store"});
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "Could not load visitors.");
      setVisitors(data.visitors || []);
      setVisitorStats(data.stats || {});
    } catch(e) { setError(e instanceof Error ? e.message : "Could not load visitors."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if(section==="Logs") void loadLogs();
    if(section==="Visitors") void loadVisitors();
  },[section]);

  const filteredVisitors = useMemo(() => visitors.filter(v => {
    const q=search.trim().toLowerCase();
    const matchesText=!q || [v.ip_address,v.account_name,v.account_email,v.browser,v.operating_system,v.device_info,v.last_path].some(x=>String(x||"").toLowerCase().includes(q));
    const matchesDevice=device==="all" || (v.device_type||"Unknown")===device;
    return matchesText && matchesDevice;
  }),[visitors,search,device]);

  return <div className="mt-7 space-y-5" dir={language==="ar"?"rtl":"ltr"}>
    <section className="card p-3 sm:p-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab=>{const Icon=tab.icon;return <button key={tab.label} type="button" onClick={()=>{setSection(tab.label);setError("");}} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${section===tab.label?"bg-brand-900 text-white shadow-lg":"border border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"}`}><span className="inline-flex items-center gap-2"><Icon size={17}/>{t(tab.label)}</span></button>;})}
      </div>
    </section>

    {section==="Platform Settings" || section==="User Management" ? <AdminTools tool={section}/> : null}

    {section==="Logs" && <section className="card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-extrabold">{t("Activity Logs")}</h3><p className="text-sm muted">{t("Site activity, account security and admin changes.")}</p></div><button type="button" onClick={()=>void loadLogs()} className="workspace-back"><RefreshCw size={16}/>{t("Refresh")}</button></div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative"><Search className="absolute left-3 top-3.5 muted" size={16}/><input className="field w-full pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("Search logs...")}/></label>
        <CustomSelect className="w-full" value={category} onChange={setCategory} options={[{value:"all",label:t("All categories")},{value:"auth",label:t("Authentication")},{value:"users",label:t("Users")},{value:"platform",label:t("Platform")},{value:"learning",label:t("Learning")},{value:"content",label:t("Content")}]}/>
        <DatePicker ariaLabel="From date" className="min-w-0 w-full" value={from} onChange={setFrom} locale={language}/>
        <DatePicker ariaLabel="To date" className="min-w-0 w-full" value={to} onChange={setTo} locale={language}/>
      </div>
      <div className="flex justify-end"><button type="button" onClick={()=>void loadLogs()} className="btn btn-primary">{t("Apply filters")}</button></div>
      {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading?<p className="muted">{t("Loading...")}</p>:<div className="space-y-3">
        <p className="text-xs muted">{logs.length.toLocaleString()} {t("events loaded (up to 50)")}</p>
        {logs.map(log=><details key={log.id} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3"><span><b className="block text-sm">{log.action.replace(/_/g," ")}</b><span className="text-xs muted">{log.actor_name||log.actor_email||t("Guest")} · {log.entity_type||t("Event")}{log.entity_id? " #"+log.entity_id:""}</span></span><span className="text-xs muted">{displayDate(log.created_at)}</span></summary>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><p><b>{t("IP Address")}:</b> {log.ip_address||"—"}</p><p><b>{t("Actor ID")}:</b> {log.actor_user_id||"Guest"}</p><p><b>{t("Entity")}:</b> {log.entity_type||"—"} {log.entity_id||""}</p></div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/5 p-3 text-xs dark:bg-white/5">{metadataText(log.metadata)}</pre>
        </details>)}
        {!logs.length&&<p className="muted">{t("No events match these filters.")}</p>}
      </div>}
    </section>}

    {section==="Visitors" && <section className="card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-extrabold">{t("Visitor Analytics")}</h3><p className="text-sm muted">{t("Visitor sessions and technical details, similar to B4-Class.")}</p></div><button type="button" onClick={()=>void loadVisitors()} className="workspace-back"><RefreshCw size={16}/>{t("Refresh")}</button></div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[[t("Sessions"),visitorStats.total_sessions],[t("Unique IPs"),visitorStats.unique_ips],[t("Active in 5 min"),visitorStats.active_now],[t("Guests"),visitorStats.guests]].map(([label,value])=><article key={String(label)} className="rounded-xl border border-black/10 p-4 dark:border-white/10"><p className="text-xs muted">{label}</p><p className="mt-2 text-2xl font-extrabold">{Number(value||0).toLocaleString()}</p></article>)}
      </div>
      <div className="grid gap-2 sm:grid-cols-2"><label className="relative"><Search className="absolute left-3 top-3.5 muted" size={16}/><input className="field w-full pl-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("Search visitors...")}/></label><CustomSelect value={device} onChange={setDevice} options={[{value:"all",label:t("All devices")},{value:"Mobile",label:t("Mobile")},{value:"Desktop",label:t("Desktop")},{value:"Tablet",label:t("Tablet")}]}/></div>
      {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading?<p className="muted">{t("Loading...")}</p>:<div className="space-y-3">
        {filteredVisitors.map(v=><article key={v.id} className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-[11px] font-bold uppercase tracking-wider muted">VISITOR #{v.id}</span><h4 className="mt-1 font-extrabold">{v.account_name||t("Guest visitor")}</h4><p className="text-xs muted">{v.device_type||"Unknown"} · {v.browser||"Unknown browser"} · {v.operating_system||"Unknown OS"}</p></div><span className="rounded-full bg-black/5 px-3 py-1 text-xs dark:bg-white/10">{displayDate(v.last_seen)}</span></div>
          <details className="mt-4 rounded-xl border border-black/10 p-3 dark:border-white/10"><summary className="cursor-pointer text-sm font-bold">{t("View technical details")}</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [t("IP Address"),v.ip_address],[t("Account email"),v.account_email],[t("User-Agent"),v.user_agent],
              [t("Operating system"),v.operating_system],[t("Device"),v.device_type],[t("Device information"),v.device_info],
              [t("Browser"),v.browser],[t("Screen resolution"),v.screen_resolution],[t("Language"),v.language],
              [t("Timezone"),v.timezone],[t("Referrer"),v.referrer],[t("Cookies enabled"),Number(v.cookies_enabled)?"Yes":"No"],
              [t("Platform"),v.platform],[t("CPU cores"),v.hardware_concurrency],[t("Device memory (GB)"),v.device_memory],
              [t("Touch points"),v.touch_points],[t("Last page"),v.last_path],[t("Page views"),v.page_views],
              [t("First visit"),displayDate(v.first_seen)],[t("Last seen"),displayDate(v.last_seen)]
            ].map(([label,value],i)=><div key={i} className="min-w-0"><p className="text-[11px] muted">{label}</p><p className="mt-1 break-all text-sm font-semibold">{value===null||value===undefined||value===""?"—":String(value)}</p></div>)}
          </div></details>
        </article>)}
        {!filteredVisitors.length&&<p className="muted">{t("No visitor sessions match these filters.")}</p>}
      </div>}
      <p className="text-xs muted">{t("Visitor tracking stores technical visit information only. It does not read or store cookie contents, passwords, or form values.")}</p>
    </section>}
  </div>;
}

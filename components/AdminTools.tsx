"use client";

import { useEffect, useState } from "react";
import { Users, Settings, ShieldCheck, GraduationCap, BookOpen, ClipboardList, LoaderCircle, Save, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

type AdminUser={id:number;email:string;full_name:string;role:"student"|"teacher"|"admin";status:"active"|"suspended"|"deleted";email_verified:number;created_at:string};
type SettingKey="allow_student_registration"|"allow_teacher_registration"|"require_email_verification"|"maintenance_mode";
type SettingsState=Record<SettingKey,boolean>;
type Stats={total_users:number;students:number;teachers:number;admins:number;suspended:number;total_classes:number;total_exams:number};
const defaults:SettingsState={allow_student_registration:true,allow_teacher_registration:true,require_email_verification:true,maintenance_mode:false};

export default function AdminTools({tool}:{tool:"User Management"|"Platform Settings"}){
 const {t,language}=useLanguage();
 const [users,setUsers]=useState<AdminUser[]>([]);
 const [settings,setSettings]=useState<SettingsState>(defaults);
 const [stats,setStats]=useState<Stats>({total_users:0,students:0,teachers:0,admins:0,suspended:0,total_classes:0,total_exams:0});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [changes,setChanges]=useState<Record<number,{role:AdminUser["role"];status:"active"|"suspended"}>>({});

 async function load(){
  setLoading(true);setError("");
  try{
   const response=await fetch("/api/admin",{cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Could not load admin data.");
   setUsers(data.users||[]);
   setStats(data.stats||stats);
   setSettings({
    allow_student_registration:data.settings?.allow_student_registration==="true",
    allow_teacher_registration:data.settings?.allow_teacher_registration==="true",
    require_email_verification:data.settings?.require_email_verification==="true",
    maintenance_mode:data.settings?.maintenance_mode==="true"
   });
   setChanges({});
  }catch(e){setError(e instanceof Error?e.message:"Could not load admin data.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);

 async function send(payload:Record<string,unknown>){
  setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Admin action failed.");
   setNotice(data.message||"Saved.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Admin action failed.");}
  finally{setBusy(false);}
 }
 const settingRows:{key:SettingKey;label:string;description:string}[]=[
  {key:"allow_student_registration",label:"Allow student registration",description:"New students can create accounts."},
  {key:"allow_teacher_registration",label:"Allow teacher registration",description:"New teachers can create accounts."},
  {key:"require_email_verification",label:"Require email verification",description:"New accounts must verify their email before signing in."},
  {key:"maintenance_mode",label:"Pause new registrations",description:"Temporarily block new account registrations while maintenance is active."}
 ];
 return <div className="mt-7 space-y-5" dir={language==="ar"?"rtl":"ltr"}>
  {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
  {loading?<div className="flex items-center gap-2 muted"><LoaderCircle className="animate-spin"/>{t("Loading...")}</div>:<>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {[["Total users",stats.total_users,Users],["Students",stats.students,GraduationCap],["Teachers",stats.teachers,BookOpen],["Admins",stats.admins,ShieldCheck],["Suspended",stats.suspended,Users],["Classes",stats.total_classes,BookOpen],["Exams",stats.total_exams,ClipboardList]].map(([label,value,Icon]:any)=><article key={label} className="card p-4"><div className="flex items-center justify-between text-sm muted"><span>{t(label)}</span><Icon size={18}/></div><p className="mt-3 text-2xl font-extrabold text-brand-900">{Number(value||0).toLocaleString()}</p></article>)}
   </div>
   {tool==="User Management"&&<section className="card overflow-hidden">
    <div className="flex items-center justify-between gap-3 border-b p-4"><div><h3 className="font-bold">{t("All user accounts")}</h3><p className="text-xs muted">{t("Change account role or suspend and reactivate accounts.")}</p></div><button type="button" onClick={()=>void load()} className="workspace-back"><RefreshCw size={16}/></button></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs muted"><th className="p-3">{t("User")}</th><th className="p-3">{t("Role")}</th><th className="p-3">{t("Status")}</th><th className="p-3">{t("Email verified")}</th><th className="p-3">{t("Action")}</th></tr></thead><tbody>
     {users.map(user=>{const draft=changes[user.id]||{role:user.role,status:user.status==="suspended"?"suspended" as const:"active" as const};return <tr key={user.id} className="border-b">
      <td className="p-3"><b>{user.full_name}</b><p className="text-xs muted">{user.email}</p></td>
      <td className="p-3"><select className="field min-w-28" value={draft.role} onChange={e=>setChanges(prev=>({...prev,[user.id]:{...draft,role:e.target.value as AdminUser["role"]}}))}><option value="student">{t("Student")}</option><option value="teacher">{t("Teacher")}</option><option value="admin">{t("Admin")}</option></select></td>
      <td className="p-3"><select className="field min-w-28" value={draft.status} onChange={e=>setChanges(prev=>({...prev,[user.id]:{...draft,status:e.target.value as "active"|"suspended"}}))}><option value="active">{t("Active")}</option><option value="suspended">{t("Suspended")}</option></select></td>
      <td className="p-3">{user.email_verified? t("Yes"):t("No")}</td>
      <td className="p-3"><button type="button" disabled={busy|| (draft.role===user.role&&draft.status===user.status)} onClick={()=>void send({action:"update_user",userId:user.id,...draft})} className="btn btn-primary">{t("Save")}</button></td>
     </tr>;})}
    </tbody></table></div>
    {users.length===0&&<p className="p-5 text-sm muted">{t("No user accounts found.")}</p>}
   </section>}
   {tool==="Platform Settings"&&<section className="card space-y-4 p-5">
    <div className="flex items-center gap-2"><Settings size={20}/><h3 className="font-bold">{t("Registration and security settings")}</h3></div>
    {settingRows.map(row=><label key={row.key} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-4"><span><b className="block text-sm">{t(row.label)}</b><span className="mt-1 block text-xs muted">{t(row.description)}</span></span><input type="checkbox" className="mt-1 h-5 w-5 accent-amber-700" checked={settings[row.key]} onChange={e=>setSettings(prev=>({...prev,[row.key]:e.target.checked}))}/></label>)}
    <p className="text-xs muted">{t("These settings affect new registrations. Existing accounts are not changed.")}</p>
    <button type="button" disabled={busy} onClick={()=>void send({action:"update_settings",settings})} className="btn btn-primary w-full"><Save size={17}/>{busy?t("Saving..."):t("Save platform settings")}</button>
   </section>}
  </>}
 </div>;
}

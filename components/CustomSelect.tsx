"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
export type SelectOption = { value: string; label: string; disabled?: boolean };
type Props = { value?: string; defaultValue?: string; onChange?: (value:string)=>void; options:SelectOption[]; placeholder?:string; className?:string; disabled?:boolean; required?:boolean; name?:string; ariaLabel?:string };
export default function CustomSelect({value,onChange,options,placeholder,className="",disabled,name,ariaLabel}:Props) {
 const [open,setOpen]=useState(false); const root=useRef<HTMLDivElement>(null); const selected=options.find(o=>o.value===value);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};document.addEventListener("mousedown",close);document.addEventListener("keydown",key);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",key)}},[]);
 return <div ref={root} className={"focus-select-wrap "+className}>{name&&<input type="hidden" name={name} value={value}/>}
 <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={()=>setOpen(v=>!v)} className={"focus-select-trigger "+(open?"is-open":"")}>
 <span className={value?"focus-select-value":"focus-select-placeholder"}>{selected?.label||placeholder||"Select..."}</span><ChevronDown size={19} className="focus-select-chevron"/></button>
 {open&&<div className="focus-select-menu" role="listbox">{options.map(o=><button type="button" role="option" aria-selected={o.value===value} key={o.value} disabled={o.disabled} onClick={()=>{change(o.value);setOpen(false)}} className={"focus-select-option "+(o.value===value?"selected":"")}><span>{o.label}</span>{o.value===value&&<Check size={17}/>}</button>)}{options.length===0&&<p className="focus-select-empty">No options</p>}</div>}
 </div>;
}

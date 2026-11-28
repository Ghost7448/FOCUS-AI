"use client";
import { useEffect } from "react";

export default function CustomCursor(){
  useEffect(()=>{
    if(!window.matchMedia("(hover:hover) and (pointer:fine)").matches)return;
    const ring=document.createElement("div");
    const dot=document.createElement("div");
    const trail=document.createElement("div");
    ring.className="focus-cursor-ring";
    dot.className="focus-cursor-dot";
    trail.className="focus-cursor-trail";
    document.body.append(ring,trail,dot);
    let x=-100,y=-100,rx=-100,ry=-100,tx=-100,ty=-100,raf=0;
    const move=(e:PointerEvent)=>{
      x=e.clientX;y=e.clientY;
      document.body.classList.add("focus-cursor-ready");
      const target=e.target as Element|null;
      document.body.classList.toggle("focus-cursor-hover",!!target?.closest("button,a,[role=button],input,textarea,select,label,.clickable"));
    };
    const enter=()=>document.body.classList.add("focus-cursor-ready");
    const leave=()=>document.body.classList.remove("focus-cursor-ready","focus-cursor-hover","focus-cursor-click");
    const down=()=>document.body.classList.add("focus-cursor-click");
    const up=()=>document.body.classList.remove("focus-cursor-click");
    const frame=()=>{
      rx+=(x-rx)*.28;ry+=(y-ry)*.28;tx+=(x-tx)*.12;ty+=(y-ty)*.12;
      ring.style.transform=`translate3d(${rx}px,${ry}px,0)`;
      dot.style.transform=`translate3d(${x}px,${y}px,0)`;
      trail.style.transform=`translate3d(${tx}px,${ty}px,0)`;
      raf=requestAnimationFrame(frame);
    };
    document.addEventListener("pointermove",move,{passive:true});
    document.addEventListener("pointerenter",enter,{passive:true});
    document.addEventListener("pointerleave",leave,{passive:true});
    document.addEventListener("pointerdown",down,{passive:true});
    document.addEventListener("pointerup",up,{passive:true});
    frame();
    return ()=>{
      cancelAnimationFrame(raf);
      document.removeEventListener("pointermove",move);
      document.removeEventListener("pointerenter",enter);
      document.removeEventListener("pointerleave",leave);
      document.removeEventListener("pointerdown",down);
      document.removeEventListener("pointerup",up);
      document.body.classList.remove("focus-cursor-ready","focus-cursor-hover","focus-cursor-click");
      ring.remove();dot.remove();trail.remove();
    };
  },[]);
  return null;
}

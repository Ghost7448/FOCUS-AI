import { BrainCircuit } from "lucide-react";
export default function Brand({ light = false }: { light?: boolean }) {
  return <div className="flex items-center gap-2">
    <span className={`grid h-10 w-10 place-items-center rounded-xl ${light ? "bg-white/15 text-white" : "bg-blue-100 text-brand-700"}`}>
      <BrainCircuit size={23}/>
    </span>
    <span className={`text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-brand-900"}`}>FOCUS AI</span>
  </div>;
}
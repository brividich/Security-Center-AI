import type { IconName, Tone } from "../../types/securityCenter";
import { Icon } from "./Icon";

interface StatProps {
  label: string;
  value: string | number;
  detail?: string;
  icon?: IconName;
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  neutral: "bg-slate-50 text-slate-700",
  good: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
  dark: "bg-slate-900 text-white",
};

export function Stat({ label, value, detail, icon, tone = "neutral" }: StatProps) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xl font-bold">{value}</div>
        {icon ? (
          <span className={`grid h-8 w-8 place-items-center rounded-2xl ${toneClasses[tone]}`}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="text-xs text-blue-100">{label}</div>
      {detail ? <div className="mt-1 text-xs text-slate-400">{detail}</div> : null}
    </div>
  );
}

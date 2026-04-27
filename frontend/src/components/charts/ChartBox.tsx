import type { ReactNode } from "react";
import { Card } from "../common/Card";

interface ChartBoxProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function ChartBox({ title, subtitle, children }: ChartBoxProps) {
  return (
    <Card>
      <div className="mb-3">
        <h2 className="font-bold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </Card>
  );
}

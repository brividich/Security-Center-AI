import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}

export function Card({ children, className = "", as: Component = "section" }: CardProps) {
  return <Component className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</Component>;
}

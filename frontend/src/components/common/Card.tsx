import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}

export function Card({ children, className = "", as: Component = "section" }: CardProps) {
  return <Component className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</Component>;
}

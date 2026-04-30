import type { PageKey } from "../types/securityCenter";
import { Card } from "../components/common/Card";

interface FallbackPageProps {
  page: PageKey;
}

export function FallbackPage({ page }: FallbackPageProps) {
  const title = page === "evidence" ? "Evidenze" : page === "rules" ? "Regole" : "Sezione";

  return (
    <Card>
      <h2 className="font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Nessun dato disponibile dalle API backend per questa vista.
      </p>
    </Card>
  );
}

import { Icon } from "../common/Icon";

interface AIAssistButtonProps {
  page: string;
  objectType: string;
  objectId: string | number;
  label?: string;
  prompt?: string;
}

export function AIAssistButton({ page, objectType, objectId, label = "Spiega con AI", prompt }: AIAssistButtonProps) {
  const handleClick = () => {
    const params = new URLSearchParams({
      page,
      object_type: objectType,
      object_id: String(objectId),
    });
    if (prompt) {
      params.set("prompt", prompt);
    }
    window.location.href = `/ai?${params.toString()}`;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
    >
      <Icon name="bot" className="h-4 w-4" />
      {label}
    </button>
  );
}

import { useState } from "react";
import { Icon } from "../common/Icon";

interface AIMessage {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  content: string;
  timestamp: string;
  acknowledged: boolean;
}

interface AIMessagesProps {
  messages?: AIMessage[];
  onDismiss?: (id: string) => void;
  onAcknowledge?: (id: string) => void;
}

export function AIMessages({
  messages: initialMessages = [],
  onDismiss,
  onAcknowledge,
}: AIMessagesProps) {
  const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const [messages, setMessages] = useState<AIMessage[]>(initialMessages);

  const filteredMessages = messages.filter((msg) => {
    if (filter === "all") return true;
    return msg.severity === filter;
  });

  const handleDismiss = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
    onDismiss?.(id);
  };

  const handleAcknowledge = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, acknowledged: true } : msg))
    );
    onAcknowledge?.(id);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-50 text-red-700 border-red-200";
      case "high":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "medium":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return "alert-circle";
      case "high":
        return "alert-triangle";
      case "medium":
        return "info";
      case "low":
        return "check-circle";
      default:
        return "info";
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="bell" className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-slate-950">Messaggi AI</h3>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {filteredMessages.length}
            </span>
          </div>
          <div className="flex gap-2">
            {["all", "critical", "high", "medium", "low"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto p-4">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Icon name="bell-off" className="mb-2 h-12 w-12" />
            <p className="text-sm">Nessun messaggio AI disponibile</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg border p-4 ${
                  message.acknowledged ? "opacity-60" : ""
                } ${getSeverityColor(message.severity)}`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon
                      name={getSeverityIcon(message.severity)}
                      className="h-5 w-5"
                    />
                    <h4 className="font-semibold text-slate-950">{message.title}</h4>
                  </div>
                  <span className="text-xs text-slate-600">
                    {new Date(message.timestamp).toLocaleString("it-IT")}
                  </span>
                </div>
                <p className="mb-3 text-sm text-slate-700">{message.content}</p>
                <div className="flex gap-2">
                  {!message.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(message.id)}
                      className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Conferma
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(message.id)}
                    className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Ignora
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

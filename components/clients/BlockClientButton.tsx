"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { blockClientAction } from "@/app/actions/allClients";
import { ShieldOff, ShieldCheck, Loader2 } from "lucide-react";

type Props = {
  clientId: string;
  isBlocked: boolean;
};

export default function BlockClientButton({ clientId, isBlocked }: Props) {
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(isBlocked);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleToggle = async () => {
    setLoading(true);
    setError("");
    const next = !blocked;
    setBlocked(next);

    const res = await blockClientAction(clientId, next);
    if (!res.ok) {
      setBlocked(!next);
      setError(res.error || "Failed.");
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        title={blocked ? "Unblock this client" : "Block this client"}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          blocked
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
        }`}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : blocked ? (
          <ShieldCheck size={12} />
        ) : (
          <ShieldOff size={12} />
        )}
        {loading ? "Saving…" : blocked ? "Unblock" : "Block"}
      </button>
      {error && (
        <span className="text-[10px] font-medium text-rose-500">{error}</span>
      )}
    </div>
  );
}

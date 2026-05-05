"use client";

import { useState } from "react";
import { deleteClientAction } from "@/app/actions/allClients";
import { Trash2, Loader2 } from "lucide-react";

type Props = {
  clientId: string;
};

export default function DeleteClientButton({ clientId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");

    const res = await deleteClientAction(clientId);
    if (!res.ok) {
      setError(res.error || "Failed to delete.");
      setTimeout(() => setError(""), 5000);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        title="Delete this client"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Trash2 size={12} />
        )}
        {loading ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <span className="text-[10px] font-medium text-rose-500">{error}</span>
      )}
    </div>
  );
}

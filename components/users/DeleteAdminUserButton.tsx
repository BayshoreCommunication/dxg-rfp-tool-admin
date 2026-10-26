"use client";

import { deleteAdminUserAction } from "@/app/actions/adminUser";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  userId: string;
};

export default function DeleteAdminUserButton({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);

    const res = await deleteAdminUserAction(userId);
    if (!res.ok) {
      toast.error(res.error || "Failed to delete admin user.");
      setLoading(false);
      setConfirming(false);
    } else {
      toast.success("Admin user deleted successfully.");
      setConfirming(false);
      router.refresh();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={loading}
        title="Delete this user"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <Trash2 size={11} />
        )}
        {loading ? "Deleting…" : "Delete"}
      </button>
      <ConfirmDialog
        open={confirming}
        title="Delete this admin user?"
        message="They will lose access to the admin immediately. This action cannot be undone."
        confirmLabel="Delete admin"
        busy={loading}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

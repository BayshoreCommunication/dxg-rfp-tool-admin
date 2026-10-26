import { getAdminProposalAction } from "@/app/actions/adminProposals";
import ProposalDetail from "@/components/proposals/ProposalDetail";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

type ProposalPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProposalPage({ params }: ProposalPageProps) {
  const { id } = await params;
  const response = await getAdminProposalAction(id);
  if (!response.ok || !response.data) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-bold text-rose-700">
          {response.notFound ? "Proposal not found" : "Unable to load this proposal"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {response.notFound
            ? "It may have been deleted by the planner."
            : response.error || "Please try again in a moment."}
        </p>
        <Link href="/proposals" className="mt-4 text-sm font-semibold text-[#008f96] hover:underline">
          Back to all proposals
        </Link>
      </div>
    );
  }

  return <ProposalDetail data={response.data} />;
}

import ProposalsDirectory from "@/components/proposals/ProposalsDirectory";
import { isProposalView } from "@/components/proposals/proposalLabels";
import ProposalsHeader from "@/components/proposals/ProposalsHeader";

type ProposalsPageProps = {
  searchParams?: Promise<{
    search?: string;
    page?: string;
    view?: string;
  }>;
};

const page = async ({ searchParams }: ProposalsPageProps) => {
  const params = await searchParams;
  const search = params?.search || "";
  const pageParam = Number.parseInt(params?.page || "1", 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const view = isProposalView(params?.view) ? params.view : "all";

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6 lg:grid lg:h-[calc(100dvh-48px)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-6 lg:space-y-0">
      <ProposalsHeader />
      <ProposalsDirectory search={search} page={currentPage} view={view} />
    </div>
  );
};

export default page;

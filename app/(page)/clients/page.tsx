import ClientDetails from "@/components/clients/ClientDetilas"
import TopHeader from "@/components/clients/TopHeader"

type ClientsPageProps = {
  searchParams?: Promise<{
    search?: string;
    page?: string;
  }>;
};

const page = async ({ searchParams }: ClientsPageProps) => {
  const params = await searchParams;
  const search = params?.search || "";
  const pageParam = Number.parseInt(params?.page || "1", 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6 lg:grid lg:h-[calc(100dvh-48px)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-6 lg:space-y-0">
      <TopHeader />
      <ClientDetails search={search} page={currentPage} />
    </div>
  );
}

export default page;

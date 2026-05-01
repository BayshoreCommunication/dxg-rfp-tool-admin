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
    <div className="space-y-8 px-6">
      <TopHeader />
      <ClientDetails search={search} page={currentPage} />
    </div>
  )
}

export default page

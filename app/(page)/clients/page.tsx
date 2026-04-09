import ClientDetails from "@/components/clients/ClientDetilas"
import TopHeader from "@/components/clients/TopHeader"

type ClientsPageProps = {
  searchParams?: {
    search?: string;
    page?: string;
  };
};

const page = ({ searchParams }: ClientsPageProps) => {
  const search = searchParams?.search || "";
  const pageParam = Number.parseInt(searchParams?.page || "1", 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  return (
    <div className="space-y-8 px-6" >
      <TopHeader />
      <ClientDetails search={search} page={currentPage} />
    </div>

  )
}

export default page

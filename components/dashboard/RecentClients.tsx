import { User } from "lucide-react";

type Client = {
  id: string;
  name: string;
  email: string;
  proposalCount: number;
  joiningDate: string;
  avatarUrl: string;
};

// Mock Data matching the screenshot exactly
const CLIENTS_DATA: Client[] = [
  {
    id: "1",
    name: "Hamid Hasan",
    email: "hamid@gmail.com",
    proposalCount: 1567,
    joiningDate: "7/11/2022",
    avatarUrl: "https://i.pravatar.cc/150?u=hamid1",
  },
  {
    id: "2",
    name: "Nahid khan",
    email: "nahid@gmail.com",
    proposalCount: 1567,
    joiningDate: "1/4/2022",
    avatarUrl: "https://i.pravatar.cc/150?u=nahid",
  },
  {
    id: "3",
    name: "Urmila Hasan",
    email: "urmila@gmail.com",
    proposalCount: 1244,
    joiningDate: "3/1/2022",
    avatarUrl: "https://i.pravatar.cc/150?u=urmila",
  },
  {
    id: "4",
    name: "Husain Rahman",
    email: "husain@gmail.com",
    proposalCount: 3213,
    joiningDate: "17/6/2022",
    avatarUrl: "https://i.pravatar.cc/150?u=husain",
  },
  {
    id: "5",
    name: "Nabila Khan",
    email: "nabila@gmail.com",
    proposalCount: 24244,
    joiningDate: "27/17/2022",
    avatarUrl: "https://i.pravatar.cc/150?u=nabila",
  },
  {
    id: "6",
    name: "Alex Biny",
    email: "hamid@gmail.com",
    proposalCount: 24214,
    joiningDate: "8/8/2022",
    avatarUrl: "https://i.pravatar.cc/150?u=alex",
  },
  {
    id: "7",
    name: "Joly lnn",
    email: "Joly@gmail.com",
    proposalCount: 2141,
    joiningDate: "5/1/2022",
    avatarUrl: "https://i.pravatar.cc/150?u=joly",
  },
  {
    id: "8",
    name: "Hamid Hasan",
    email: "hamid@gmail.com",
    proposalCount: 414,
    joiningDate: "3/11/2022",
    avatarUrl: "https://i.pravatar.cc/150?u=hamid2",
  },
  {
    id: "9",
    name: "Dgaiu Fhgh",
    email: "Dgaiu@gmail.com",
    proposalCount: 241,
    joiningDate: "12/11/2022",
    avatarUrl: "https://i.pravatar.cc/150?u=dgaiu",
  },
];

const RecentClients = () => {
  return (
    <div className="bg-white rounded-md  p-6 shadow-sm overflow-hidden mt-6">
      {/* Header section */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <User className="w-5 h-5 text-red-500 fill-current" />
        <h2 className="text-lg font-bold text-gray-800">Recent Client</h2>
      </div>

      {/* Table section */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-2 py-4 text-xs font-semibold text-gray-400 tracking-wide uppercase">
                Client Name
              </th>
              <th className="px-2 py-4 text-xs font-semibold text-gray-400 tracking-wide uppercase">
                Client Email
              </th>
              <th className="px-2 py-4 text-xs font-semibold text-gray-400 tracking-wide uppercase">
                Proposal Count
              </th>
              <th className="px-2 py-4 text-xs font-semibold text-gray-400 tracking-wide uppercase">
                Joining Date
              </th>
            </tr>
          </thead>
          <tbody>
            {CLIENTS_DATA.map((client, index) => (
              <tr
                key={client.id}
                className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                style={{ height: "60px" }}
              >
                {/* Client Name & Avatar */}
                <td className="px-2 py-2">
                  <div className="flex items-center gap-4">
                    <img
                      src={client.avatarUrl}
                      alt={client.name}
                      className="w-8 h-8 rounded-full object-cover bg-gray-100 ring-1 ring-gray-200"
                    />
                    <span className="text-[13px] font-medium text-gray-700">
                      {client.name}
                    </span>
                  </div>
                </td>
                
                {/* Client Email */}
                <td className="px-2 py-2 text-[13px] font-medium text-gray-700">
                  {client.email}
                </td>
                
                {/* Proposal Count */}
                <td className="px-2 py-2 text-[13px] font-medium text-gray-700">
                  {client.proposalCount}
                </td>
                
                {/* Joining Date */}
                <td className="px-2 py-2 text-[13px] font-medium text-gray-700">
                  {client.joiningDate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentClients;
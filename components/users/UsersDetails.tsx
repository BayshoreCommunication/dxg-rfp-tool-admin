import TopHeader from "./TopHeader";
import UserLists from "./UserLists";

const UsersDetails = () => {
  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <TopHeader />
      <UserLists />
    </div>
  );
};

export default UsersDetails;

import SigninPage from "@/components/auth/SigninPage";
import { Suspense } from "react";

const page = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eef2f7]" />}>
      <SigninPage />
    </Suspense>
  );
};

export default page;

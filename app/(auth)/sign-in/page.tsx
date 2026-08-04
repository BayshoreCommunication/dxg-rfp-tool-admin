import SigninPage from "@/components/auth/SigninPage";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://av-rfpilot.com"),
  title:
    "RFPilot Admin - Proposal Management Workspace",
  description:
    "Securely manage proposal operations, administrative access, governed knowledge, and pricing guidance with RFPilot Admin.",
  alternates: {
    canonical: "/sign-in",
    languages: {
      "en-US": "/en-USA",
    },
  },
  openGraph: {
    title: "RFPilot Admin - Proposal Management Workspace",
    description:
      "Securely manage proposal operations, administrative access, governed knowledge, and pricing guidance.",
    url: "/sign-in",
    images: [{ url: "/opengraph-image.jpg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RFPilot Admin - Proposal Management Workspace",
    description:
      "Securely manage proposal operations, administrative access, governed knowledge, and pricing guidance.",
    images: ["/opengraph-image.jpg"],
  },
};

const page = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eef2f7]" />}>
      <SigninPage />
    </Suspense>
  );
};

export default page;

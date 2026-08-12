import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bayshore.nyc3.digitaloceanspaces.com",
      },
    ],
  },
};

export default nextConfig;

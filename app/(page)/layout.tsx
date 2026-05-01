import LayoutWrapper from "@/components/layout/LayoutWrapper";
import "../globals.css";

export const metadata = {
  metadataBase: new URL("https://dxg-rfp-tool-admin.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased font-sans bg-[#0d0f16] text-gray-100">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}

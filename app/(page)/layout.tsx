import LayoutWrapper from "@/components/layout/LayoutWrapper";
import { ToastContainer } from "@/components/ui/Toast";
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
    <html lang="en">
      <body className="antialiased font-sans">
        <LayoutWrapper>{children}</LayoutWrapper>
        <ToastContainer />
      </body>
    </html>
  );
}

import LayoutWrapper from "@/components/layout/LayoutWrapper";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeScript } from "@/components/theme/ThemeScript";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased font-sans">
        <ThemeProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}

import LayoutWrapper from "@/components/layout/LayoutWrapper";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { ToastContainer } from "@/components/ui/Toast";
import "../globals.css";

export const metadata = {
  metadataBase: new URL("https://av-rfpilot.com"),
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
      <body className="antialiased font-sans" suppressHydrationWarning>
        <ThemeProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}

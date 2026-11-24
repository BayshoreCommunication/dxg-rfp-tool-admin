import { auth } from "@/auth";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { ToastContainer } from "@/components/ui/Toast";
import "../globals.css";

export const metadata = {
  metadataBase: new URL("https://dxg-rfp-tool-admin.vercel.app"),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Name and email for the sidebar's account card.
  const session = await auth();
  const currentUser = { name: session?.user?.name ?? null, email: session?.user?.email ?? null };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <ThemeProvider>
          <LayoutWrapper currentUser={currentUser}>{children}</LayoutWrapper>
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}

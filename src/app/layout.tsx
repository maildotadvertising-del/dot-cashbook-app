import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Apple devices render SF Pro (system); everywhere else gets Inter, the
// closest open face, with tabular figures for money.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DOT Cash Book",
  description: "Cash book and bookkeeping for Zeebas Cluster LLP brands",
};

export const viewport: Viewport = {
  themeColor: "#040408",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div aria-hidden className="aurora">
          <span />
          <span />
          <span />
        </div>
        {children}
        <Toaster
          theme="dark"
          position="bottom-center"
          offset={{ bottom: 104 }}
          mobileOffset={{ bottom: 104 }}
          toastOptions={{
            style: {
              background: "rgba(22,22,34,0.72)",
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
              border: "0.5px solid rgba(255,255,255,0.14)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
              borderRadius: 18,
              color: "#F5F5F7",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}

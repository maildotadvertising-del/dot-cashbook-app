import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
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
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body>
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          offset={{ bottom: 96 }}
          mobileOffset={{ bottom: 96 }}
          toastOptions={{
            style: {
              background: "rgba(10,10,20,0.9)",
              backdropFilter: "blur(20px)",
              border: "0.5px solid rgba(48,209,88,0.3)",
              borderRadius: 12,
              color: "#F5F5F7",
              fontFamily: "var(--font-dm-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}

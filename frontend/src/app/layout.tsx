import type { Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "GST Recon - Intelligent GST Reconciliation",
  description:
    "Knowledge Graph-based GST reconciliation engine for ITC mismatch detection",
  icons: {
    icon: "/gst-recon.png",
    apple: "/gst-recon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen c-bg-main">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

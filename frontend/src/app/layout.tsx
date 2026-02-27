import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GST Recon - Intelligent GST Reconciliation",
  description:
    "Knowledge Graph-based GST reconciliation engine for ITC mismatch detection",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-surface">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "The Clerb — Book Club",
  description:
    "A warm, intimate book club experience. Track reads, rate books, and gather for discussion.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Source+Sans+3:wght@200..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-cream text-charcoal min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

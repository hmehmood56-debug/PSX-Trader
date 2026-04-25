import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import { RouteTransition } from "@/components/RouteTransition";

export const metadata: Metadata = {
  title: "Perch | Perch Capital",
  description:
    "Perch by Perch Capital helps investors paper trade Pakistan equities with live PSX market data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          fontFamily: "'Inter', sans-serif",
          background: "#FFFFFF",
          color: "#1A1A1A",
          minHeight: "100vh",
        }}
      >
        <Providers>
          <Navbar />
          <main className="perch-main">
            <RouteTransition>{children}</RouteTransition>
          </main>
        </Providers>
      </body>
    </html>
  );
}

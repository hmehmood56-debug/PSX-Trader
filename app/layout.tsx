import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Perch | Perch Capital",
  description:
    "Perch by Perch Capital helps investors practice with Pakistan Stock Exchange market simulations.",
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
          <main className="perch-main">{children}</main>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}

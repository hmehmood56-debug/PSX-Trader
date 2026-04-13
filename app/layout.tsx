import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Perch | Perch Capital",
  description:
    "Perch by Perch Capital helps investors practice with Pakistan Stock Exchange market simulations.",
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
          <main style={{ width: "100%" }}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreetAware — Bulgarian Road Safety Intelligence",
  description: "Fatal-crash risk prediction and interactive mapping platform powered by Bulgarian open data",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bg" className="dark">
      <body className="bg-dark-bg text-dark-text antialiased select-none">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Street Aware | Пътни произшествия в България",
  description: "Карта на регистрираните пътни произшествия в България.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="bg"><body>{children}</body></html>;
}

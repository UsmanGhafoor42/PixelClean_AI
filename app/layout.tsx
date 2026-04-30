import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelClean AI | Background Remover & Image Optimizer",
  description:
    "Remove image backgrounds, optimize exports, preview transparent cutouts, and download polished image files.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

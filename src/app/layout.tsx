import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "深海のゼロ",
  description: "暗い氷海を駆ける三人称視点の潜水艦アクション",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

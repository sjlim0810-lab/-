import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "해외법인 시장동향 대시보드",
  description: "신재생에너지 해외법인 주간 시장동향 보고",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";

export const metadata: Metadata = {
  title: "구구단 레벨업",
  description: "구구단 2단~19단 4단계 레벨업 승급 시험",
};

export const viewport: Viewport = {
  themeColor: "#4FC3F7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 앱 아이콘/카드뉴스와 같은 굵고 둥근 브랜드 글씨체 — 큰 타이틀에만 쓴다 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap" />
      </head>
      <body>
        <InAppBrowserBanner />
        {children}
      </body>
    </html>
  );
}

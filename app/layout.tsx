import type { Metadata } from "next";
import "./globals.css";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";

export const metadata: Metadata = {
  title: "구구단 레벨업",
  description: "구구단 2단~19단 4단계 레벨업 승급 시험",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <InAppBrowserBanner />
        {children}
      </body>
    </html>
  );
}

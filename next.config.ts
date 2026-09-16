import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 홈 화면에 추가한 앱(PWA) 아이콘이 예전 화면을 계속 보여주는 문제 방지용.
  // 페이지 문서 자체는 캐시하지 말고 매번 새로 받아오게 강제한다(_next/static 같은
  // 해시가 붙은 정적 자산은 그대로 오래 캐시돼도 안전하니 건드리지 않는다).
  async headers() {
    const noStore = [{ key: "Cache-Control", value: "no-store, must-revalidate" }];
    return [
      { source: "/", headers: noStore },
      { source: "/student", headers: noStore },
      { source: "/board", headers: noStore },
      { source: "/report", headers: noStore },
      { source: "/admin", headers: noStore },
      { source: "/admin/:path*", headers: noStore },
      { source: "/onboarding/:path*", headers: noStore },
    ];
  },
};

export default nextConfig;

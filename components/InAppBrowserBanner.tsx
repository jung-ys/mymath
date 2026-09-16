"use client";

import { useEffect, useState } from "react";
import { detectInAppBrowser, isAndroidUA, androidChromeIntentUrl } from "@/lib/inAppBrowser";

// 카카오톡 등 인앱 브라우저에서 열렸을 때, 사이트 어느 화면에서든(로그인/온보딩/학생 화면 등)
// 항상 뜨는 배너. 안드로이드는 크롬으로 자동 이동을 시도하고, 그게 실패하거나 아이폰인 경우를
// 대비해 주소를 복사해서 직접 붙여넣을 수 있는 방법을 함께 제공한다.
export default function InAppBrowserBanner() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      const ua = navigator.userAgent || "";
      if (!detectInAppBrowser(ua)) return;
      setVisible(true);
      if (isAndroidUA(ua)) {
        try {
          window.location.href = androidChromeIntentUrl(window.location.href);
        } catch {
          // intent 스킴이 막혀있으면 그냥 배너의 복사 버튼으로 안내한다.
        }
      }
    })();
  }, []);

  if (!visible) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("아래 주소를 복사해서 크롬이나 사파리에 붙여넣어 열어주세요.", window.location.href);
    }
  }

  return (
    <div className="callout" style={{ margin: "10px 16px", fontSize: "0.85rem" }}>
      ⚠️ 카카오톡 등 메신저 안의 화면으로 열려 있는 것 같아요. 홈 화면 추가 같은 기능이 제대로 안
      될 수 있으니, 아래 버튼으로 주소를 복사해서 크롬(또는 사파리)에 붙여넣어 열어주세요.
      <div style={{ marginTop: 8 }}>
        <button type="button" className="btn small" onClick={copyLink}>
          {copied ? "복사됨! 브라우저에 붙여넣기 해주세요" : "📋 주소 복사하기"}
        </button>
      </div>
    </div>
  );
}

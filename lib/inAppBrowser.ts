// 카카오톡 등 메신저 인앱 브라우저 안에서 열리면 "홈 화면에 추가" 메뉴 자체가 없거나
// 최신 버전에서는 "다른 브라우저로 열기" 버튼마저 사라진 경우가 많아, 안내 문구만으로는
// 부모님이 빠져나올 방법이 없다. user agent로 감지해서 안드로이드는 자동으로 크롬을 강제
// 실행시키고, 그게 안 되는 경우(주로 아이폰)를 위한 안내에 쓴다.
export function detectInAppBrowser(ua: string): boolean {
  return /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua);
}

export function isAndroidUA(ua: string): boolean {
  return /Android/i.test(ua);
}

// 안드로이드에서 현재 페이지를 크롬으로 강제로 열게 하는 intent 스킴 URL.
// 카카오톡 자체 메뉴 유무와 무관하게 안드로이드 OS가 처리하는 표준 인텐트라 대부분 통한다.
export function androidChromeIntentUrl(currentUrl: string): string {
  const withoutScheme = currentUrl.replace(/^https?:\/\//, "");
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;
}

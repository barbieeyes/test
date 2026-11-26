// 에코쌤즈 서비스 워커: 공기질 환기 알림(웹 푸시)만 다뤄요. 캐시는 하지 않아요.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "에코쌤즈 공기질", {
    body: d.body || "", tag: d.tag || "air", renotify: true, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: "/#air" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { c.navigate && c.navigate("/#air"); return c.focus(); } }
    return self.clients.openWindow("/#air");
  })());
});

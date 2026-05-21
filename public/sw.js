// 优特学院 PWA Service Worker
// 策略：网络优先，离线降级（适合后端驱动的管理系统）

const VERSION = "v1.0.1";
const CACHE_NAME = `youte-academy-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  "/offline.html",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/favicon.svg",
  "/manifest.webmanifest",
];

// 安装：预缓存静态资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("[SW] precache failed:", err);
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("youte-academy-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// 请求：网络优先，失败降级到缓存或离线页
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 只处理 GET
  if (req.method !== "GET") return;

  // 跳过非 http(s) 请求
  const url = new URL(req.url);
  if (!url.protocol.startsWith("http")) return;

  // 跳过 NextAuth 相关、API 路由（不缓存动态数据）
  if (url.pathname.startsWith("/api/") || url.pathname.includes("_next/data")) {
    return;
  }

  // 导航请求：网络优先 → 缓存 → 离线页
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          // 成功响应：克隆并缓存
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(async () => {
          // 网络失败：尝试缓存，否则返回离线页
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || new Response("离线", { status: 503 });
        })
    );
    return;
  }

  // 静态资源：网络优先（避免旧 CSS/JS 缓存导致样式丢失）
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || new Response("", { status: 504 });
        })
    );
  }
});

// 接收来自页面的消息（如手动刷新缓存）
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

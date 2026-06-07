"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "1rem",
              padding: "2rem",
              maxWidth: "28rem",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 4px 24px rgba(0,0,0,.08)",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              系统出错了
            </h1>
            <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
              抱歉，遇到了意外错误。请尝试刷新页面。
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  padding: "0.5rem 1.25rem",
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                重试
              </button>
              <a
                href="/dashboard"
                style={{
                  padding: "0.5rem 1.25rem",
                  background: "#f3f4f6",
                  color: "#374151",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                返回主页
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

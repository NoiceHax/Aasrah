"use client";

/**
 * Catches errors thrown in the root layout itself. It must render its own
 * <html>/<body> because the root layout has failed.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f9fb",
          color: "#191c1e",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <p style={{ fontSize: 32, fontWeight: 700, color: "#ba1a1a", margin: 0 }}>500</p>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>Something went wrong</h1>
        <p style={{ maxWidth: 420, color: "#45474c", marginTop: 12 }}>
          A critical error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            background: "#091426",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px 20px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

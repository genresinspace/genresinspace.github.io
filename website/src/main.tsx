import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { initWasm } from "./views/components/wikipedia";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// Show loading UI while WASM initializes
root.render(
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      color: "var(--ink)",
      background: "var(--graph)",
      fontFamily: "'Source Serif 4 Variable', Georgia, serif",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          display: "inline-block",
          padding: "0 0.75rem",
          fontFamily: "'Fraunces Variable', Georgia, serif",
          fontWeight: 600,
          fontSize: "var(--fs-display)",
          letterSpacing: "-0.021em",
          textTransform: "lowercase",
          color: "white",
          background: "var(--accent-solid)",
        }}
      >
        genres in space
      </div>
      <div
        style={{
          fontSize: "var(--fs-small)",
          marginTop: "0.5rem",
          color: "var(--ink-muted)",
        }}
      >
        polishing the telescope lenses&hellip;
      </div>
    </div>
  </div>
);

// Initialize WASM with timeout and error handling
try {
  await Promise.race([
    initWasm(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("WASM initialization timeout")), 15000)
    ),
  ]);

  // WASM loaded successfully, render the app
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Failed to initialize WASM:", error);

  // Show error UI
  root.render(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "var(--ink)",
        background: "var(--graph)",
        fontFamily: "'Source Serif 4 Variable', Georgia, serif",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "500px",
          padding: "2rem 1.75rem",
          border: "1px solid var(--line-strong)",
          background: "var(--panel)",
        }}
      >
        <div
          style={{ fontSize: "var(--fs-display)", marginBottom: "1rem" }}
          aria-hidden
        >
          ⚠️
        </div>
        <div style={{ marginBottom: "0.5rem" }}>Failed to load application</div>
        <div
          style={{
            fontSize: "var(--fs-small)",
            opacity: 0.7,
            marginBottom: "1rem",
          }}
        >
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "var(--accent-solid)",
            color: "white",
            border: "none",
            borderRadius: "2px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

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
      color: "#e9e3d3",
      background:
        "radial-gradient(ellipse 75% 60% at 50% 42%, rgba(28, 42, 76, 0.35), rgba(4, 6, 15, 0) 70%), #04060f",
      fontFamily: "'Spectral', Georgia, serif",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: "'Cormorant SC', 'Cormorant', serif",
          fontWeight: 600,
          fontSize: "1.5rem",
          letterSpacing: "0.3em",
          marginLeft: "0.3em",
          color: "#d9c08a",
        }}
      >
        genres in space
      </div>
      <div
        style={{
          fontSize: "0.875rem",
          marginTop: "0.5rem",
          fontStyle: "italic",
          color: "#8d97ad",
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
        color: "#e9e3d3",
        background: "#04060f",
        fontFamily: "'Spectral', Georgia, serif",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "500px",
          padding: "2rem 1.75rem",
          border: "1px solid rgba(201, 168, 106, 0.35)",
          background: "rgba(9, 14, 28, 0.9)",
        }}
      >
        <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>⚠️</div>
        <div style={{ marginBottom: "0.5rem" }}>Failed to load application</div>
        <div
          style={{ fontSize: "0.875rem", opacity: 0.7, marginBottom: "1rem" }}
        >
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "rgba(201, 168, 106, 0.15)",
            color: "#d9c08a",
            border: "1px solid rgba(201, 168, 106, 0.5)",
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

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
      backgroundColor: "#000",
      color: "#fff",
      fontFamily: "sans-serif",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div>Loading...</div>
      <div style={{ fontSize: "0.875rem", marginTop: "0.5rem", opacity: 0.7 }}>
        Initializing WebAssembly module
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
        backgroundColor: "#000",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "500px", padding: "1rem" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>⚠️</div>
        <div style={{ marginBottom: "0.5rem" }}>
          Failed to load application
        </div>
        <div style={{ fontSize: "0.875rem", opacity: 0.7, marginBottom: "1rem" }}>
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#333",
            color: "#fff",
            border: "1px solid #666",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

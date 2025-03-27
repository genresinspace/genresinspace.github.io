import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { initWasm } from "./views/components/wikipedia";

await initWasm();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

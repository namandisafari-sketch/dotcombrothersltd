import * as React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { protectFavicon } from "./utils/faviconProtector";

// Protect favicon immediately
protectFavicon();

// Security message
console.clear();
console.log(
  "%c🔒 CODE SECURED BY FRANK 🔒",
  "color: #ff0000; font-size: 30px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);"
);
console.log(
  "%c⚠️ UNAUTHORIZED ACCESS PROHIBITED ⚠️",
  "color: #ffaa00; font-size: 20px; font-weight: bold;"
);
console.log(
  "%cThis application is protected. Any attempt to reverse engineer, modify, or access the source code without authorization is strictly prohibited and may result in legal action.",
  "color: #ffffff; font-size: 14px; background: #ff0000; padding: 10px; margin-top: 10px;"
);
console.log(
  "%c© JAGONIX44 - All Rights Reserved",
  "color: #00aaff; font-size: 16px; font-weight: bold; margin-top: 10px;"
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

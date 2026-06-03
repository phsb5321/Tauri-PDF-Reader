import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { RepositoryProvider } from "./adapters/context/repository-context";
import { createRepositories } from "./adapters/create-repositories";
import { initDatabase } from "./lib/db-init";
import "./styles/index.css";
// PDF.js text layer CSS for selectable text
import "pdfjs-dist/web/pdf_viewer.css";

// Initialize database then render app
async function bootstrap() {
  try {
    await initDatabase();
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }

  const repositories = createRepositories();

  // E2E-only: install the WebDriver bridge (window.__E2E__). Tree-shaken out of
  // normal builds — only present when built with VITE_E2E=true.
  if (import.meta.env.VITE_E2E === "true") {
    const { installE2EBridge } = await import("./e2e-bridge");
    installE2EBridge();
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RepositoryProvider repositories={repositories}>
        <App />
      </RepositoryProvider>
    </React.StrictMode>,
  );

  // E2E native-path: init TTS (e2e-tts-fixture backend) + open the fixture PDF,
  // then expose read-only window.__E2E_READ__. The test drives the REAL play
  // button — no karaoke shim. Tree-shaken out unless VITE_E2E_NATIVE=true.
  if (import.meta.env.VITE_E2E_NATIVE === "true") {
    const { installE2ENativeBootstrap } =
      await import("./e2e-native-bootstrap");
    await installE2ENativeBootstrap();
  }
}

bootstrap();

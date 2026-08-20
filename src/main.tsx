import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { RepositoryProvider } from "./adapters/context/repository-context";
import { createRepositories } from "./adapters/create-repositories";
import { initDatabase } from "./lib/db-init";
import { seedStoresFromConfigFile } from "./lib/config-seed";
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

  // Apply the user config file BEFORE the first render (spec 078): painting
  // with the persisted theme and then snapping to the configured one is a
  // visible flash. A no-op when the user has no config file.
  await seedStoresFromConfigFile();

  const repositories = createRepositories();

  // E2E-only: install the WebDriver bridge (window.__E2E__). Tree-shaken out of
  // normal builds — only present when built with VITE_E2E=true.
  if (import.meta.env.VITE_E2E === "true") {
    const { installE2EBridge } = await import("./e2e-bridge");
    installE2EBridge();
  }

  // E2E native-path: init TTS (e2e-tts-fixture backend) + seed the hermetic
  // library profile + open the fixture PDF, then expose read-only
  // window.__E2E_READ__. Runs BEFORE the first render on purpose: the home
  // lane seeds REAL library rows, and LibraryView's mount query must
  // deterministically see them — a post-render race between the seed IPC and
  // that query would make the home's content flaky. The test drives the REAL
  // play/resume controls — no karaoke shim. Tree-shaken out unless
  // VITE_E2E_NATIVE=true.
  if (import.meta.env.VITE_E2E_NATIVE === "true") {
    const { installE2ENativeBootstrap } =
      await import("./e2e-native-bootstrap");
    await installE2ENativeBootstrap();
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RepositoryProvider repositories={repositories}>
        <App />
      </RepositoryProvider>
    </React.StrictMode>,
  );
}

bootstrap();

import { useEffect } from "react";
import { ReaderView } from "./components/reader/ReaderView";
import { useRenderSettings } from "./hooks/useRenderSettings";
import { useSettingsStore } from "./stores/settings-store";
import "./styles/App.css";

function App() {
  const uiScale = useSettingsStore((state) => state.uiScale);
  useRenderSettings();

  useEffect(() => {
    document.documentElement.style.fontSize = `${uiScale * 100}%`;
  }, [uiScale]);

  return <ReaderView />;
}

export default App;

import { useEffect } from "react";
import { ReaderView } from "./components/reader/ReaderView";
import { useSettingsStore } from "./stores/settings-store";
import "./styles/App.css";

function App() {
  const uiScale = useSettingsStore((state) => state.uiScale);

  useEffect(() => {
    document.documentElement.style.fontSize = `${uiScale * 100}%`;
  }, [uiScale]);

  return <ReaderView />;
}

export default App;

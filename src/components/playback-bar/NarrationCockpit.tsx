import { useCallback, useRef, useState } from "react";
import { AiTtsSettings } from "./AiTtsSettings";
import { AiVoiceSelector } from "./AiVoiceSelector";
import { NarrationDeliverySettings } from "./NarrationDeliverySettings";
import { NarrationSelectionSettings } from "./NarrationSelectionSettings";
import { PerformanceSettings } from "../settings/PerformanceSettings";
import "./NarrationCockpit.css";

const TABS = [
  { id: "voice", label: "Voice & route" },
  { id: "delivery", label: "Delivery" },
  { id: "performance", label: "Performance" },
  { id: "selection", label: "Selection" },
] as const;

type NarrationTab = (typeof TABS)[number]["id"];

interface NarrationCockpitProps {
  onClose: () => void;
  controlsDisabled: boolean;
}

export function NarrationCockpit({
  onClose,
  controlsDisabled,
}: Readonly<NarrationCockpitProps>) {
  const [activeTab, setActiveTab] = useState<NarrationTab>("voice");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activateTab = useCallback((index: number, focus: boolean) => {
    const next = TABS[index];
    if (!next) return;
    setActiveTab(next.id);
    if (focus) tabRefs.current[index]?.focus();
  }, []);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex: number | null = null;
      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % TABS.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + TABS.length) % TABS.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = TABS.length - 1;
      }
      if (nextIndex === null) return;
      event.preventDefault();
      activateTab(nextIndex, true);
    },
    [activateTab],
  );

  return (
    <section
      id="narration-cockpit"
      className="narration-cockpit"
      aria-labelledby="narration-cockpit-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="narration-cockpit-header">
        <div>
          <h2 id="narration-cockpit-title">Narration</h2>
          <p>Voice, delivery, engine facts, and selection in one place.</p>
        </div>
        <button
          type="button"
          className="narration-cockpit-close"
          onClick={onClose}
          aria-label="Close narration settings"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div
        className="narration-cockpit-tabs"
        role="tablist"
        aria-label="Narration settings"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`narration-tab-${tab.id}`}
            type="button"
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            aria-selected={activeTab === tab.id}
            aria-controls={`narration-panel-${tab.id}`}
            onClick={() => activateTab(index, false)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`narration-panel-${activeTab}`}
        className="narration-cockpit-panel"
        role="tabpanel"
        aria-labelledby={`narration-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === "voice" && (
          <div className="narration-voice-route">
            <div className="narration-quick-voice">
              <div>
                <h3>Voice</h3>
                <p>The chosen voice is remembered separately for each route.</p>
              </div>
              <AiVoiceSelector disabled={controlsDisabled} />
            </div>
            <AiTtsSettings />
          </div>
        )}
        {activeTab === "delivery" && (
          <NarrationDeliverySettings disabled={controlsDisabled} />
        )}
        {activeTab === "performance" && <PerformanceSettings />}
        {activeTab === "selection" && <NarrationSelectionSettings />}
      </div>
    </section>
  );
}

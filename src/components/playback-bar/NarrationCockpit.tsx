import { useCallback, useRef, useState } from "react";
import { AiTtsSettings } from "./AiTtsSettings";
import { AiVoiceSelector } from "./AiVoiceSelector";
import { NarrationDeliverySettings } from "./NarrationDeliverySettings";
import { NarrationSelectionSettings } from "./NarrationSelectionSettings";
import { PerformanceSettings } from "../settings/PerformanceSettings";
import "./NarrationCockpit.css";

export const NARRATION_TABS = [
  { id: "voice", label: "Voice & route" },
  { id: "delivery", label: "Delivery" },
  { id: "performance", label: "Performance" },
  { id: "selection", label: "Selection" },
] as const;

type NarrationTab = (typeof NARRATION_TABS)[number]["id"];

export function nextNarrationTabIndex(
  index: number,
  key: string,
): number | null {
  if (key === "ArrowRight") return (index + 1) % NARRATION_TABS.length;
  if (key === "ArrowLeft") {
    return (index - 1 + NARRATION_TABS.length) % NARRATION_TABS.length;
  }
  if (key === "Home") return 0;
  if (key === "End") return NARRATION_TABS.length - 1;
  return null;
}

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
    const next = NARRATION_TABS[index];
    if (!next) return;
    setActiveTab(next.id);
    if (focus) tabRefs.current[index]?.focus();
  }, []);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const nextIndex = nextNarrationTabIndex(index, event.key);
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
        {NARRATION_TABS.map((tab, index) => (
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

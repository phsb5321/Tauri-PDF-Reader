import { HighlightSettings } from "../settings/HighlightSettings";

export function NarrationSelectionSettings() {
  return (
    <div className="narration-selection-settings">
      <div className="narration-selection-intro">
        <h3>Selection & highlights</h3>
        <p>
          Read from here uses the visible PDF selection. Highlight colours never
          change the source text sent for narration.
        </p>
      </div>
      <HighlightSettings />
    </div>
  );
}

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
      <div className="narration-selection-intro">
        <h3>Paragraph actions</h3>
        <p>
          Hover or keyboard-focus a play control in the PDF margin to start at
          that paragraph and continue forward. Drag selection still opens the
          excerpt toolbar for Read from here and highlight colours.
        </p>
      </div>
      <HighlightSettings />
    </div>
  );
}

import { useSettingsStore } from '../../stores/settings-store';

const AVAILABLE_COLORS = [
  { name: 'Yellow', value: '#FFEB3B' },
  { name: 'Green', value: '#4CAF50' },
  { name: 'Blue', value: '#2196F3' },
  { name: 'Red', value: '#F44336' },
  { name: 'Orange', value: '#FF9800' },
  { name: 'Purple', value: '#9C27B0' },
  { name: 'Cyan', value: '#00BCD4' },
  { name: 'Pink', value: '#E91E63' },
];

export function HighlightSettings() {
  const {
    highlightDefaultColor,
    highlightColors,
    setHighlightDefaultColor,
    setHighlightColors
  } = useSettingsStore();

  const handleDefaultColorChange = (color: string) => {
    setHighlightDefaultColor(color);
  };

  const handleColorToggle = (color: string) => {
    if (highlightColors.includes(color)) {
      // Remove color (but keep at least 2)
      if (highlightColors.length > 2) {
        const newColors = highlightColors.filter(c => c !== color);
        setHighlightColors(newColors);
        // If removed color was the default, set new default
        if (highlightDefaultColor === color) {
          setHighlightDefaultColor(newColors[0]);
        }
      }
    } else {
      // Add color
      setHighlightColors([...highlightColors, color]);
    }
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Highlights</h3>
      <p className="settings-section-description">
        Customize highlight colors and default selection behavior.
      </p>

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-label">Default Color</div>
          <div className="setting-description">
            Color used when creating new highlights
          </div>
        </div>
        <div className="setting-control">
          <div className="color-palette">
            {highlightColors.map((color) => (
              <button
                key={color}
                className={`color-swatch ${highlightDefaultColor === color ? 'selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handleDefaultColorChange(color)}
                aria-label={`Select ${color} as default`}
                title={`Set ${color} as default`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-info">
          <div className="setting-label">Available Colors</div>
          <div className="setting-description">
            Colors shown in the highlight toolbar (minimum 2)
          </div>
        </div>
        <div className="setting-control">
          <div className="color-palette">
            {AVAILABLE_COLORS.map((color) => (
              <button
                key={color.value}
                className={`color-swatch ${highlightColors.includes(color.value) ? 'selected' : ''}`}
                style={{
                  backgroundColor: color.value,
                  opacity: highlightColors.includes(color.value) ? 1 : 0.4
                }}
                onClick={() => handleColorToggle(color.value)}
                aria-label={`${highlightColors.includes(color.value) ? 'Remove' : 'Add'} ${color.name}`}
                title={color.name}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

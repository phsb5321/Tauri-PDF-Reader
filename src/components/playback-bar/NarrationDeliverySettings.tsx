import {
  NARRATION_PERFORMANCE_POLICIES,
  narrationPerformancePolicy,
  type NarrationPerformanceProfile,
} from "../../lib/narration-performance";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import { useSettingsStore } from "../../stores/settings-store";
import { AiSpeedSlider } from "./AiSpeedSlider";

const PROFILE_COPY: Record<
  NarrationPerformanceProfile,
  { label: string; description: string }
> = {
  responsive: {
    label: "Responsive",
    description: "Shortest first-audio path and least speculative work",
  },
  balanced: {
    label: "Balanced",
    description: "Source-aligned default for normal reading",
  },
  continuous: {
    label: "Continuous",
    description: "Two sequential units prepared for fewer idle gaps",
  },
};

interface NarrationDeliverySettingsProps {
  disabled?: boolean;
}

export function NarrationDeliverySettings({
  disabled = false,
}: Readonly<NarrationDeliverySettingsProps>) {
  const autoPageEnabled = useAiTtsStore((state) => state.autoPageEnabled);
  const setAutoPageEnabled = useAiTtsStore((state) => state.setAutoPageEnabled);
  const profile = useAiTtsStore((state) => state.performanceProfile);
  const setProfile = useAiTtsStore((state) => state.setPerformanceProfile);
  const maxTextUtf8Bytes = useAiTtsStore((state) => state.maxTextUtf8Bytes);
  const numberNormalizationEnabled = useAiTtsStore(
    (state) => state.numberNormalizationEnabled,
  );
  const setNumberNormalizationEnabled = useAiTtsStore(
    (state) => state.setNumberNormalizationEnabled,
  );
  const narrationLanguage = useAiTtsStore((state) => state.narrationLanguage);
  const setNarrationLanguage = useAiTtsStore(
    (state) => state.setNarrationLanguage,
  );
  const followAlong = useSettingsStore((state) => state.ttsFollowAlong);
  const setFollowAlong = useSettingsStore((state) => state.setTtsFollowAlong);

  return (
    <div className="narration-delivery-settings">
      <div className="narration-setting-row">
        <div>
          <h3>Reading speed</h3>
          <p>Change rate without changing the selected voice or route.</p>
        </div>
        <AiSpeedSlider disabled={disabled} />
      </div>

      <label className="narration-toggle-row">
        <span>
          <strong>Follow read-along</strong>
          <small>Keep the active source range inside the reading band.</small>
        </span>
        <input
          type="checkbox"
          checked={followAlong}
          disabled={disabled}
          onChange={(event) => setFollowAlong(event.target.checked)}
        />
      </label>

      <label className="narration-toggle-row">
        <span>
          <strong>Continue to next page</strong>
          <small>Resume only after the next page text is ready.</small>
        </span>
        <input
          type="checkbox"
          checked={autoPageEnabled}
          disabled={disabled}
          onChange={(event) => setAutoPageEnabled(event.target.checked)}
        />
      </label>

      <label className="narration-toggle-row">
        <span>
          <strong>Speak written numbers</strong>
          <small>
            Pronounce years, grouped numbers, percentages, money, and times
            without changing the PDF.
          </small>
        </span>
        <input
          type="checkbox"
          checked={numberNormalizationEnabled}
          disabled={disabled}
          onChange={(event) =>
            setNumberNormalizationEnabled(event.target.checked)
          }
        />
      </label>

      <div className="narration-setting-row">
        <label htmlFor="narration-language">
          <strong>Narration language</strong>
          <small>
            Auto follows a declared voice language; it never guesses.
          </small>
        </label>
        <select
          id="narration-language"
          value={narrationLanguage}
          disabled={disabled}
          onChange={(event) =>
            setNarrationLanguage(event.target.value as "auto" | "en" | "pt-BR")
          }
        >
          <option value="auto">Auto</option>
          <option value="en">English</option>
          <option value="pt-BR">Português (Brasil)</option>
        </select>
      </div>

      <fieldset className="narration-profile-grid" disabled={disabled}>
        <legend>Delivery profile</legend>
        {(Object.keys(PROFILE_COPY) as NarrationPerformanceProfile[]).map(
          (candidate) => {
            const copy = PROFILE_COPY[candidate];
            const policy = narrationPerformancePolicy(
              candidate,
              maxTextUtf8Bytes ||
                NARRATION_PERFORMANCE_POLICIES[candidate].contextMaxUtf8Bytes,
            );
            return (
              <label key={candidate} className="narration-profile-option">
                <input
                  type="radio"
                  name="narration-performance-profile"
                  value={candidate}
                  checked={profile === candidate}
                  onChange={() => setProfile(candidate)}
                />
                <span>
                  <strong>{copy.label}</strong>
                  <small>{copy.description}</small>
                  <small>
                    {policy.contextMaxUtf8Bytes} bytes · {policy.lookaheadUnits}{" "}
                    ahead
                  </small>
                </span>
              </label>
            );
          },
        )}
      </fieldset>
      {disabled && (
        <p className="narration-control-note" role="status">
          Stop narration before changing speed or queue policy.
        </p>
      )}
    </div>
  );
}

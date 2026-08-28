import { useCallback, useEffect, useState } from "react";
import { commands, type TtsPerformanceSnapshot } from "../../lib/bindings";
import {
  NARRATION_PERFORMANCE_POLICIES,
  narrationPerformancePolicy,
  type NarrationPerformanceProfile,
} from "../../lib/narration-performance";
import { useAiTtsStore } from "../../stores/ai-tts-store";
import "./PerformanceSettings.css";

const PROFILE_COPY: Record<
  NarrationPerformanceProfile,
  { label: string; description: string }
> = {
  responsive: {
    label: "Responsive",
    description: "180-byte context · one unit ahead · least speculative work",
  },
  balanced: {
    label: "Balanced",
    description: "300-byte context · one unit ahead · source-aligned default",
  },
  continuous: {
    label: "Continuous",
    description: "300-byte context · two units generated sequentially",
  },
};

function valueOrUnavailable(value: string | null): string {
  return value?.trim() || "Unavailable";
}

function formatDuration(milliseconds: number): string {
  return milliseconds >= 1_000
    ? `${(milliseconds / 1_000).toFixed(2)} s`
    : `${milliseconds.toFixed(0)} ms`;
}

export function PerformanceSettings() {
  const profile = useAiTtsStore((state) => state.performanceProfile);
  const setProfile = useAiTtsStore((state) => state.setPerformanceProfile);
  const playbackState = useAiTtsStore((state) => state.playbackState);
  const [snapshot, setSnapshot] = useState<TtsPerformanceSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  const refresh = useCallback(async () => {
    const result = await commands.aiTtsGetPerformance();
    if (result.status === "ok") {
      setSnapshot(result.data);
      setStatus("ready");
    } else {
      setSnapshot(null);
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const runtime = snapshot?.runtime;
  const latest = snapshot?.latestUncached;
  const standardRtf = latest?.standardRtf ?? null;
  const profileLocked = playbackState !== "idle" && playbackState !== "error";

  return (
    <div className="settings-section performance-settings">
      <div className="performance-heading-row">
        <div>
          <h3 className="settings-section-title">Narration performance</h3>
          <p className="settings-section-description">
            Facts from the active native engine—not guesses based on its name.
          </p>
        </div>
        <button
          type="button"
          className="performance-refresh"
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>

      <div className="performance-facts" aria-live="polite">
        <div className="performance-fact">
          <span>Connection</span>
          <strong>{snapshot?.provider ?? "Unavailable"}</strong>
        </div>
        <div className="performance-fact">
          <span>Model</span>
          <strong>{valueOrUnavailable(runtime?.model ?? null)}</strong>
          {runtime?.quantization && <small>{runtime.quantization}</small>}
        </div>
        <div className="performance-fact">
          <span>Acceleration</span>
          <strong>{valueOrUnavailable(runtime?.acceleration ?? null)}</strong>
          <small>{valueOrUnavailable(runtime?.backend ?? null)}</small>
        </div>
        <div className="performance-fact">
          <span>Device</span>
          <strong>{valueOrUnavailable(runtime?.device ?? null)}</strong>
        </div>
      </div>

      {status === "loading" && <p role="status">Reading engine status…</p>}
      {status === "unavailable" && (
        <p role="status" className="performance-unavailable">
          Connect a narration provider to inspect its runtime.
        </p>
      )}

      {snapshot && (
        <dl className="performance-limits">
          <div>
            <dt>Provider revision</dt>
            <dd>{runtime?.providerRevision}</dd>
          </div>
          <div>
            <dt>Model revision</dt>
            <dd>{valueOrUnavailable(runtime?.modelRevision ?? null)}</dd>
          </div>
          <div>
            <dt>Spoken-unit ceiling</dt>
            <dd>{snapshot.maxTextUtf8Bytes} UTF-8 bytes</dd>
          </div>
          <div>
            <dt>Engine queue</dt>
            <dd>
              {runtime?.queueCapacity == null
                ? "Unavailable"
                : `${runtime.queueCapacity} synthesis slot${runtime.queueCapacity === 1 ? "" : "s"}`}
            </dd>
          </div>
        </dl>
      )}

      <section aria-labelledby="last-generation-heading">
        <h4 id="last-generation-heading">Latest uncached synthesis</h4>
        {latest ? (
          <div className="performance-measurement">
            <strong>
              {standardRtf === null
                ? "RTF unavailable"
                : `${standardRtf.toFixed(3)} RTF`}
            </strong>
            <span>
              {latest.requestUtf8Bytes} bytes ·{" "}
              {formatDuration(latest.generationMs)}
              {" for "}
              {latest.audioDuration.toFixed(2)} s audio
            </span>
            <span>
              {standardRtf === null
                ? "Generated-audio duration was unavailable"
                : standardRtf <= 0.8
                  ? "Sustains continuous playback on this sample"
                  : "This sample may outrun the playback buffer"}
            </span>
          </div>
        ) : (
          <p className="performance-empty">
            Play an uncached unit to measure the model. Cache hits never replace
            this result.
          </p>
        )}
      </section>

      <fieldset className="performance-profiles" disabled={profileLocked}>
        <legend>Playback policy</legend>
        {(Object.keys(PROFILE_COPY) as NarrationPerformanceProfile[]).map(
          (candidate) => {
            const copy = PROFILE_COPY[candidate];
            const policy = narrationPerformancePolicy(
              candidate,
              snapshot?.maxTextUtf8Bytes ??
                NARRATION_PERFORMANCE_POLICIES[candidate].contextMaxUtf8Bytes,
            );
            return (
              <label key={candidate} className="performance-profile">
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
                    Effective policy: {policy.contextMaxUtf8Bytes} bytes,{" "}
                    {policy.lookaheadUnits} ahead
                  </small>
                </span>
              </label>
            );
          },
        )}
      </fieldset>
      {profileLocked && (
        <p className="setting-hint" role="status">
          Stop narration before changing its queue policy.
        </p>
      )}
    </div>
  );
}

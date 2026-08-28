import { useCallback, useEffect, useState } from "react";
import { commands, type TtsPerformanceSnapshot } from "../../lib/bindings";
import "./PerformanceSettings.css";

function valueOrUnavailable(value: string | null): string {
  return value?.trim() || "Unavailable";
}

function formatDuration(milliseconds: number): string {
  return milliseconds >= 1_000
    ? `${(milliseconds / 1_000).toFixed(2)} s`
    : `${milliseconds.toFixed(0)} ms`;
}

export function PerformanceSettings() {
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

      <p className="performance-policy-location">
        Delivery profiles live in the Delivery tab so this view reports only
        measured engine facts.
      </p>
    </div>
  );
}

# 263 — Settings value log privacy

15/09/2026. Internal privacy prerequisite for252; native cache wiring remains off.

## Outcome

The current native v2 and registered legacy generic settings write paths must persist and return unchanged JSON without copying stored content into application logs. Success and validation failure must retain their existing behavior.

## User Scenarios & Testing

1. Write a synthetic document-like JSON value through the shared settings service/repository; read back the exact value. TRACE-enabled capture must not contain the synthetic content.
2. Batch-create and overwrite synthetic values; both persisted results must match and neither value may appear in captured logs.
3. Reject an invalid known setting while a subscriber is active; preserve the error and do not log the rejected content.
4. A control DEBUG event must appear, proving absence is not caused by disabled capture. Reintroducing any removed value log must make the check fail.
5. The thin v2 handler, registered legacy generic setter section and native repository contain no logging/instrumentation that can reintroduce a handler-only leak outside the exercised service path.

## Boundaries

Only assigned native logging paths plus one synthetic falsifier/spec/report. No real settings/DB, credentials, native factory, provider dispatch, bindings/config/dependency changes, app launch or live225 operation. Coordinator expanded the reservation to the two registered legacy setter emission sites after the caller trace found the same leak. Include those sites in this logging-only fix; do not change render-settings behavior or logging. No packaged IPC or release/privacy acceptance from an unexecuted check.

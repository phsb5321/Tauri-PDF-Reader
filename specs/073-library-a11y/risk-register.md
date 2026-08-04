# Risk register

| Risk                                                                        | Mitigation                                                              | Evidence                                       |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| A test accidentally applies `prefers-contrast: more` to the default theme   | Brace-aware parser retains at-rule ancestry                             | Full independently resolved environment matrix |
| A later override loses to a more-specific earlier theme selector            | Root cascade compares selector specificity before source order          | Adversarial `:root:not(...)` regression        |
| A component-local custom property masks a missing global token              | Count only root/theme declarations as globally available                | Scope-discrimination assertion                 |
| An alpha error surface passes token-only checks but fails after compositing | Bind the banner to an opaque semantic foreground/background pair        | Playback error-surface contract in every theme |
| Explicit and system dark modes drift                                        | Exercise both paths with the same contrast matrix                       | Targeted Vitest contract                       |
| A fill token is reused as foreground text                                   | Reject fill-only roles in CSS `color:` declarations                     | Foreground-role assertion                      |
| A legacy reference silently falls back again                                | Reject every undefined `var()` reference, even with a fallback          | Undefined-token assertion                      |
| Higher minimum text clips dense controls                                    | Increase only values below 12px; preserve all other layout declarations | Targeted component CSS diff                    |
| A relative or tokenized size bypasses the literal-pixel floor               | Resolve shipped size forms and reject unsupported explicit forms        | Planted `0.5rem` and unsupported-form controls |
| Compatibility aliases become permanent debt                                 | Test prevents growth; wholesale renaming remains a mechanical follow-up | Non-goals and token-layer comment              |

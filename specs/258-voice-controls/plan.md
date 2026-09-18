# 258 — Plan

- Research (read-only): existing AiVoiceSelector.tsx/.css, useAiTts hook
  surface, AiVoiceInfo contract, dual-mount usage in AiPlaybackBar +
  NarrationCockpit, token vocabulary (colors/typography/spacing/motion).
- Design constraints: native `<select>`+`<optgroup>` first (COMMON zoom-menu
  precedent); no new primitives/framework; preserve selection semantics and
  option-label format; p16 corrections (setVoice resolves void; store-truth
  rendering; unique ids; strict value binding).
- Author: component (states, grouping, ids, binding) → CSS (tokens, states,
  reduced-motion, narrow width) → scoped synthetic test.
- Freeze: hashes → READY once to 251 via herdr-prompt → STOP (no local run,
  no self-judged acceptance, repairs only on failing receipt).

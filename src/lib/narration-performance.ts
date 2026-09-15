export type NarrationPerformanceProfile =
  | "responsive"
  | "balanced"
  | "continuous";

export interface NarrationPerformancePolicy {
  contextMaxUtf8Bytes: number;
  lookaheadUnits: number;
}

export const DEFAULT_NARRATION_PERFORMANCE_PROFILE: NarrationPerformanceProfile =
  "balanced";

export const NARRATION_PERFORMANCE_POLICIES: Record<
  NarrationPerformanceProfile,
  NarrationPerformancePolicy
> = {
  responsive: { contextMaxUtf8Bytes: 180, lookaheadUnits: 1 },
  balanced: { contextMaxUtf8Bytes: 300, lookaheadUnits: 1 },
  continuous: { contextMaxUtf8Bytes: 300, lookaheadUnits: 2 },
};

export function isNarrationPerformanceProfile(
  value: unknown,
): value is NarrationPerformanceProfile {
  return (
    value === "responsive" || value === "balanced" || value === "continuous"
  );
}

export function narrationPerformancePolicy(
  profile: NarrationPerformanceProfile,
  providerMaxUtf8Bytes: number,
): NarrationPerformancePolicy {
  const selected = NARRATION_PERFORMANCE_POLICIES[profile];
  return {
    contextMaxUtf8Bytes: Math.max(
      1,
      Math.min(providerMaxUtf8Bytes, selected.contextMaxUtf8Bytes),
    ),
    lookaheadUnits: selected.lookaheadUnits,
  };
}

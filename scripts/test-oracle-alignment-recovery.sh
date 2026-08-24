#!/usr/bin/env bash
# One bounded synthetic-repository falsifier for every independent oracle check.
set -euo pipefail

SOURCE_ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
ORACLE="$SOURCE_ROOT/scripts/oracle-alignment-recovery.sh"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TMP_ROOT"' EXIT

pass_count=0
case_count=0
FIXTURE_REPO=
FIXTURE_VAULT=
FIXTURE_PRS=
FIXTURE_GOALS=

expected_goals() {
  cat <<'JSON'
[
  {
    "seat": "fleet-po",
    "goal": "Lectrice product contract: Spec Kit 079 freezes the user outcome and ranks all current work against it"
  },
  {
    "seat": "fleet-eng-2",
    "goal": "Lectrice alignment recovery: one accepted product contract, PRs #147/#152 resolved, exact-head oracle green, board row in review"
  },
  {
    "seat": "fleet-qa",
    "goal": "Lectrice QA: independently refute the alignment recovery and gate only exact merged heads"
  },
  {
    "seat": "fleet-eng",
    "goal": "Lectrice control plane: a deterministic recovery oracle replaces model-authored done state"
  }
]
JSON
}

make_fixture() {
  local name="$1" variant="${2:-clean}"
  local root="$TMP_ROOT/$name"
  local repo="$root/repo" vault="$root/vault"
  local accepted_sha vault_sha spec_sha plan_sha tasks_sha backlog_sha ledger_sha vault_state_sha
  local pr147_sha="1111111111111111111111111111111111111111"
  local pr152_sha="2222222222222222222222222222222222222222"
  local receipt="$root/receipt.json"

  mkdir -p "$repo" "$vault"
  git -C "$repo" init -q -b main
  git -C "$repo" config user.name "Oracle Falsifier"
  git -C "$repo" config user.email "oracle@example.invalid"
  git -C "$repo" config commit.gpgsign false
  git -C "$repo" config core.hooksPath /dev/null

  mkdir -p \
    "$repo/.pi/prompts" \
    "$repo/.specify/memory" \
    "$repo/specs/079-fleet-alignment-recovery" \
    "$repo/docs" \
    "$repo/scripts"

  cp "$SOURCE_ROOT/.specify/memory/constitution.md" "$repo/.specify/memory/constitution.md"
  cp "$SOURCE_ROOT/docs/alignment-recovery-receipt.schema.json" "$repo/docs/"
  cp "$ORACLE" "$repo/scripts/"
  cp "$SOURCE_ROOT/scripts/test-oracle-alignment-recovery.sh" "$repo/scripts/"
  chmod +x "$repo/scripts/"*.sh

  printf 'spec fixture\n' >"$repo/specs/079-fleet-alignment-recovery/spec.md"
  printf 'plan fixture\n' >"$repo/specs/079-fleet-alignment-recovery/plan.md"
  printf 'tasks fixture\n' >"$repo/specs/079-fleet-alignment-recovery/tasks.md"
  printf 'backlog aligned\n' >"$repo/docs/agent-backlog-state.md"
  printf 'branch graph aligned\n' >"$repo/docs/alignment-recovery-branch-ledger.md"

  local prompts=(
    analyze checklist clarify constitution converge implement plan specify tasks taskstoissues
  )
  local prompt
  for prompt in "${prompts[@]}"; do
    if [[ "$variant" == missing-prompt && "$prompt" == taskstoissues ]]; then
      continue
    fi
    printf '%s prompt\n' "$prompt" >"$repo/.pi/prompts/speckit.$prompt.md"
  done

  git -C "$repo" add -A
  git -C "$repo" commit -q -m "fixture: accepted main"
  accepted_sha="$(git -C "$repo" rev-parse HEAD)"

  git -C "$vault" init -q -b main
  git -C "$vault" config user.name "Oracle Falsifier"
  git -C "$vault" config user.email "oracle@example.invalid"
  git -C "$vault" config commit.gpgsign false
  git -C "$vault" config core.hooksPath /dev/null
  mkdir -p "$vault/1. Projects/Lectrice — Tauri PDF Reader"
  printf 'vault aligned\n' >"$vault/1. Projects/Lectrice — Tauri PDF Reader/SAVE-STATE.md"
  git -C "$vault" add -A
  git -C "$vault" commit -q -m "fixture: vault state"
  vault_sha="$(git -C "$vault" rev-parse HEAD)"

  if [[ "$variant" == vault-origin-preferred ]]; then
    local vault_origin="$root/vault-origin.git"
    git init -q --bare "$vault_origin"
    git -C "$vault" remote add origin "$vault_origin"
    git -C "$vault" push -q origin main
    # Local checkout diverges onto an unrelated orphan history that does NOT
    # contain vault_sha at all; only origin/main still does. If the oracle
    # fell back to local HEAD here it would wrongly report E_STATE_STALE.
    git -C "$vault" checkout -q --orphan local-divergent
    git -C "$vault" rm -rf -q . >/dev/null
    printf 'local checkout is stale/unrelated, not the truth\n' >"$vault/local-divergent.txt"
    git -C "$vault" add -A
    git -C "$vault" commit -q -m "fixture: local checkout diverged from origin"
    git -C "$vault" branch -f main local-divergent
    git -C "$vault" checkout -q main
  fi

  spec_sha="$(git -C "$repo" show "$accepted_sha:specs/079-fleet-alignment-recovery/spec.md" | sha256sum | awk '{print $1}')"
  plan_sha="$(git -C "$repo" show "$accepted_sha:specs/079-fleet-alignment-recovery/plan.md" | sha256sum | awk '{print $1}')"
  tasks_sha="$(git -C "$repo" show "$accepted_sha:specs/079-fleet-alignment-recovery/tasks.md" | sha256sum | awk '{print $1}')"
  backlog_sha="$(git -C "$repo" show "$accepted_sha:docs/agent-backlog-state.md" | sha256sum | awk '{print $1}')"
  ledger_sha="$(git -C "$repo" show "$accepted_sha:docs/alignment-recovery-branch-ledger.md" | sha256sum | awk '{print $1}')"
  vault_state_sha="$(git -C "$vault" show "$vault_sha:1. Projects/Lectrice — Tauri PDF Reader/SAVE-STATE.md" | sha256sum | awk '{print $1}')"

  jq -n \
    --arg accepted "$accepted_sha" \
    --arg pr147 "$pr147_sha" \
    --arg pr152 "$pr152_sha" \
    --arg spec_sha "$spec_sha" \
    --arg plan_sha "$plan_sha" \
    --arg tasks_sha "$tasks_sha" \
    --arg backlog_sha "$backlog_sha" \
    --arg ledger_sha "$ledger_sha" \
    --arg vault_sha "$vault_sha" \
    --arg vault_state_sha "$vault_state_sha" '
    def disposition($id; $sha; $terminal): {
      item_id: $id,
      observed_sha: $sha,
      category: "worthwhile-post-release-polish",
      immutable_evidence: ["fixture://evidence"],
      owner: "fixture-owner",
      next_action: "no action",
      falsifier: "fixture changes",
      preservation_state: "merged-content-preserved",
      terminal_state: $terminal
    };
    def step($name): {
      name: $name,
      actor_action: "public fixture action",
      oracle_observation: "deterministic fixture observation",
      elapsed_ms: 1,
      failure_reason: null,
      result: "pass"
    };
    {
      schema_version: 1,
      program_id: "lectrice-alignment-recovery",
      accepted_main_sha: $accepted,
      receipt_commit_parent: $accepted,
      receipt_envelope: ["docs/alignment-recovery-receipt.json"],
      spec_artifacts: [
        {path: "specs/079-fleet-alignment-recovery/spec.md", sha256: $spec_sha},
        {path: "specs/079-fleet-alignment-recovery/plan.md", sha256: $plan_sha},
        {path: "specs/079-fleet-alignment-recovery/tasks.md", sha256: $tasks_sha}
      ],
      dispositions: [
        disposition("PR #147"; $pr147; "merged"),
        disposition("PR #152"; $pr152; "closed-with-reason"),
        {
          item_id: "local-tip-fixture",
          observed_sha: "3333333333333333333333333333333333333333",
          category: "duplicate",
          immutable_evidence: ["fixture://patch-equivalence"],
          owner: "Graph",
          next_action: "preserve only",
          falsifier: "tree differs",
          preservation_state: "remote-preserved",
          terminal_state: "preserved-only"
        }
      ],
      journey: {
        source_sha: $accepted,
        platform_scope: "Linux/X11/WebKitGTK fixture",
        profile_id: "hermetic-fixture-profile",
        fixture_id: "public-fixture-v1",
        started_at: "2026-08-20T17:00:00-03:00",
        finished_at: "2026-08-20T17:00:01-03:00",
        steps: [
          step("fresh_profile"),
          step("open_pdf"),
          step("no_key_setup_visible"),
          step("start_narration"),
          step("mutate_acknowledged_state"),
          step("normal_close_process_ended"),
          step("relaunch_new_process"),
          step("resume_same_document_page"),
          step("highlight_present")
        ],
        artifacts: [{
          id: "journey-log",
          uri: "artifact://north-star/journey-log",
          sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }],
        result: "pass"
      },
      checks: [{
        name: "north-star journey",
        run_id: 1001,
        subject: "accepted-main",
        head_sha: $accepted,
        conclusion: "success",
        evidence_ref: "https://example.invalid/check/1001"
      }],
      reviews: [{
        reviewer: "independent-fixture-reviewer",
        generator_family: "openai",
        provider_family: "chinese-frontier",
        subject: "accepted-main",
        head_sha: $accepted,
        verdict: "ALLOW",
        evidence_ref: "artifact://review/allow"
      }],
      state_refs: [
        {
          id: "repo-backlog",
          kind: "repository",
          repository: "lectrice",
          path: "docs/agent-backlog-state.md",
          revision: $accepted,
          sha256: $backlog_sha,
          observed_main_sha: $accepted,
          observed_at: "2026-08-20T17:00:00-03:00"
        },
        {
          id: "repo-branch-ledger",
          kind: "repository",
          repository: "lectrice",
          path: "docs/alignment-recovery-branch-ledger.md",
          revision: $accepted,
          sha256: $ledger_sha,
          observed_main_sha: $accepted,
          observed_at: "2026-08-20T17:00:00-03:00"
        },
        {
          id: "vault-save-state",
          kind: "vault",
          repository: "vault",
          path: "1. Projects/Lectrice — Tauri PDF Reader/SAVE-STATE.md",
          revision: $vault_sha,
          sha256: $vault_state_sha,
          observed_main_sha: $accepted,
          observed_at: "2026-08-20T17:00:00-03:00"
        }
      ],
      generated_at: "2026-08-20T17:00:02-03:00"
    }
  ' >"$receipt"

  case "$variant" in
    wrong-accepted-main)
      jq '.accepted_main_sha = "cccccccccccccccccccccccccccccccccccccccc" | .receipt_commit_parent = .accepted_main_sha' "$receipt" >"$receipt.tmp"
      mv "$receipt.tmp" "$receipt"
      ;;
    failed-journey)
      jq '.journey.result = "fail" | .journey.steps[3].result = "fail" | .journey.steps[3].failure_reason = "fixture failure"' "$receipt" >"$receipt.tmp"
      mv "$receipt.tmp" "$receipt"
      ;;
    invalid-schema)
      jq 'del(.program_id)' "$receipt" >"$receipt.tmp"
      mv "$receipt.tmp" "$receipt"
      ;;
    artifact-drift)
      jq '.spec_artifacts[0].sha256 = "0000000000000000000000000000000000000000000000000000000000000000"' "$receipt" >"$receipt.tmp"
      mv "$receipt.tmp" "$receipt"
      ;;
    failed-check)
      jq '.checks[0].conclusion = "failure"' "$receipt" >"$receipt.tmp"
      mv "$receipt.tmp" "$receipt"
      ;;
    same-family-review)
      jq '.reviews[0].provider_family = .reviews[0].generator_family' "$receipt" >"$receipt.tmp"
      mv "$receipt.tmp" "$receipt"
      ;;
    preservation-gap)
      jq '.dispositions[2].preservation_state = "local-only"' "$receipt" >"$receipt.tmp"
      mv "$receipt.tmp" "$receipt"
      ;;
    state-set-drift)
      jq '.state_refs[1] = .state_refs[0]' "$receipt" >"$receipt.tmp"
      mv "$receipt.tmp" "$receipt"
      ;;
  esac

  cp "$receipt" "$repo/docs/alignment-recovery-receipt.json"
  case "$variant" in
    extra-envelope-path)
      printf 'not allowed\n' >"$repo/docs/unexpected-after-A.md"
      ;;
    missing-spec)
      rm -- "$repo/specs/079-fleet-alignment-recovery/tasks.md"
      ;;
    constitution-drift)
      printf '\nconstitution drift\n' >>"$repo/.specify/memory/constitution.md"
      ;;
  esac
  git -C "$repo" add -A
  git -C "$repo" commit -q -m "fixture: receipt-only child"

  cat >"$root/pr-states.json" <<JSON
{
  "147": {"state": "MERGED", "headRefOid": "$pr147_sha"},
  "152": {"state": "CLOSED", "headRefOid": "$pr152_sha"}
}
JSON
  expected_goals >"$root/goals.json"

  if [[ "$variant" == open-pr ]]; then
    jq '.["152"].state = "OPEN"' "$root/pr-states.json" >"$root/pr-states.tmp"
    mv "$root/pr-states.tmp" "$root/pr-states.json"
  elif [[ "$variant" == pr-head-drift ]]; then
    jq '.["152"].headRefOid = "4444444444444444444444444444444444444444"' "$root/pr-states.json" >"$root/pr-states.tmp"
    mv "$root/pr-states.tmp" "$root/pr-states.json"
  fi
  if [[ "$variant" == missing-goal ]]; then
    jq '[.[] | select(.seat != "fleet-qa")]' "$root/goals.json" >"$root/goals.tmp"
    mv "$root/goals.tmp" "$root/goals.json"
  fi
  if [[ "$variant" == vault-progressed ]]; then
    printf 'vault progressed after acceptance\n' >>"$vault/1. Projects/Lectrice — Tauri PDF Reader/SAVE-STATE.md"
    git -C "$vault" add -A
    git -C "$vault" commit -q -m "fixture: legitimate vault progress after acceptance"
  fi
  if [[ "$variant" == vault-rewritten ]]; then
    printf 'vault history rewritten\n' >"$vault/1. Projects/Lectrice — Tauri PDF Reader/SAVE-STATE.md"
    git -C "$vault" add -A
    git -C "$vault" commit --amend -q -m "fixture: vault history rewritten past the referenced revision"
  fi
  if [[ "$variant" == repo-progressed ]]; then
    printf 'unrelated later work\n' >"$repo/docs/later-work.md"
    git -C "$repo" add -A
    git -C "$repo" commit -q -m "fixture: further work merged after acceptance"
  fi
  if [[ "$variant" == repo-merge-progressed ]]; then
    # This repo squash-merges every PR (AGENTS.md), so main is always linear.
    # A true two-parent merge commit is an unusual topology this oracle must
    # still tolerate: an unrelated second-parent branch that never touches
    # RECEIPT_PATH must not be miscounted as a second receipt-touching commit
    # by git's default pathspec history simplification.
    git -C "$repo" checkout -q -b unrelated-branch
    printf 'unrelated branch work\n' >"$repo/docs/unrelated-branch.md"
    git -C "$repo" add -A
    git -C "$repo" commit -q -m "fixture: unrelated branch work"
    git -C "$repo" checkout -q main
    git -C "$repo" merge -q --no-ff unrelated-branch -m "fixture: merge unrelated branch after acceptance"
  fi
  if [[ "$variant" == receipt-tampered ]]; then
    jq '.generated_at = "2026-08-21T00:00:00-03:00"' "$repo/docs/alignment-recovery-receipt.json" >"$repo/docs/alignment-recovery-receipt.json.tmp"
    mv "$repo/docs/alignment-recovery-receipt.json.tmp" "$repo/docs/alignment-recovery-receipt.json"
    git -C "$repo" add -A
    git -C "$repo" commit -q -m "fixture: receipt touched a second time after R"
  fi

  FIXTURE_REPO="$repo"
  FIXTURE_VAULT="$vault"
  FIXTURE_PRS="$root/pr-states.json"
  FIXTURE_GOALS="$root/goals.json"
}

run_fixture() {
  env \
    ORACLE_REPO_ROOT="$FIXTURE_REPO" \
    ORACLE_VAULT_ROOT="$FIXTURE_VAULT" \
    ORACLE_PR_STATES_FILE="$FIXTURE_PRS" \
    ORACLE_GOALS_FILE="$FIXTURE_GOALS" \
    "$ORACLE"
}

expect_pass() {
  local name="$1"
  local output="$TMP_ROOT/$name.output"
  case_count=$((case_count + 1))
  if run_fixture >"$output" 2>&1 && grep -q '^oracle-alignment-recovery: PASS at ' "$output"; then
    printf 'PASS %s\n' "$name"
    pass_count=$((pass_count + 1))
  else
    printf 'FAIL %s\n' "$name" >&2
    cat "$output" >&2
    exit 1
  fi
}

expect_fail() {
  local name="$1" expected_code="$2"
  local output="$TMP_ROOT/$name.output" rc
  case_count=$((case_count + 1))
  set +e
  run_fixture >"$output" 2>&1
  rc=$?
  set -e
  if [[ "$rc" -ne 0 ]] && grep -q "^FAIL $expected_code:" "$output"; then
    printf 'PASS %s -> %s\n' "$name" "$expected_code"
    pass_count=$((pass_count + 1))
  else
    printf 'FAIL %s: expected %s, rc=%s\n' "$name" "$expected_code" "$rc" >&2
    cat "$output" >&2
    exit 1
  fi
}

make_fixture clean clean
expect_pass clean

make_fixture wrong-parent wrong-accepted-main
expect_fail wrong-parent E_RECEIPT_PARENT

make_fixture extra-path extra-envelope-path
expect_fail extra-path E_RECEIPT_ENVELOPE

make_fixture prompt-drift missing-prompt
expect_fail prompt-drift E_PROMPTS

make_fixture pr-open open-pr
expect_fail pr-open E_PR_OPEN

make_fixture goal-drift missing-goal
expect_fail goal-drift E_GOAL_DRIFT

make_fixture schema-invalid invalid-schema
expect_fail schema-invalid E_RECEIPT_SCHEMA

make_fixture journey-failed failed-journey
expect_fail journey-failed E_JOURNEY

make_fixture check-failed failed-check
expect_fail check-failed E_CHECK

make_fixture artifact-drift artifact-drift
expect_fail artifact-drift E_ARTIFACT_HASH

make_fixture vault-rewritten vault-rewritten
expect_fail vault-rewritten E_STATE_STALE

make_fixture vault-progressed vault-progressed
expect_pass vault-progressed

make_fixture repo-progressed repo-progressed
expect_pass repo-progressed

make_fixture repo-merge-progressed repo-merge-progressed
expect_pass repo-merge-progressed

make_fixture receipt-tampered receipt-tampered
expect_fail receipt-tampered E_RECEIPT_PARENT

make_fixture vault-origin-preferred vault-origin-preferred
expect_pass vault-origin-preferred

make_fixture spec-missing missing-spec
expect_fail spec-missing E_SPEC_MISSING

make_fixture constitution-drift constitution-drift
expect_fail constitution-drift E_CONSTITUTION

make_fixture review-same-family same-family-review
expect_fail review-same-family E_REVIEW

make_fixture preservation-gap preservation-gap
expect_fail preservation-gap E_PRESERVATION

make_fixture pr-head-drift pr-head-drift
expect_fail pr-head-drift E_PR_BINDING

make_fixture state-set-drift state-set-drift
expect_fail state-set-drift E_STATE_SET

printf 'test-oracle-alignment-recovery: PASS (%d/%d cases)\n' "$pass_count" "$case_count"

#!/usr/bin/env bash
# Deterministic done-oracle for Spec 079. It validates committed facts at the
# receipt-only child R; prose/model verdicts are never accepted as state.
set -u -o pipefail

REPO_ROOT="${ORACLE_REPO_ROOT:-$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)}"
RECEIPT_PATH="docs/alignment-recovery-receipt.json"
SCHEMA_PATH="docs/alignment-recovery-receipt.schema.json"
VAULT_ROOT="${ORACLE_VAULT_ROOT:-$HOME/Documents/Notes}"
GH_REPOSITORY="${ORACLE_GH_REPOSITORY:-phsb5321/Tauri-PDF-Reader}"
EXPECTED_CONSTITUTION_SHA="408ebe4aef9304338d4100d170f8ac9c8fe87486cc686c22fd27d5e7758a4951"

errors=0
TMP_ROOT="$(mktemp -d)" || {
  printf 'FAIL E_TMP: cannot allocate temporary directory\n' >&2
  exit 2
}

cleanup() {
  rm -rf -- "$TMP_ROOT"
}
trap cleanup EXIT

new_tmp() {
  mktemp "$TMP_ROOT/file.XXXXXX"
}

pass() {
  printf 'OK   %s\n' "$1"
}

fail() {
  local code="$1"
  shift
  printf 'FAIL %s: %s\n' "$code" "$*" >&2
  errors=$((errors + 1))
}

fatal() {
  local code="$1"
  shift
  printf 'FAIL %s: %s\n' "$code" "$*" >&2
  exit 2
}

for command in git jq sha256sum sort diff mktemp; do
  command -v "$command" >/dev/null 2>&1 || fatal E_TOOL_MISSING "$command is required"
done

git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1 ||
  fatal E_REPO_INVALID "$REPO_ROOT is not a git worktree"
HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null)" ||
  fatal E_REPO_INVALID "cannot resolve HEAD"

committed_blob() {
  local revision="$1" path="$2" output="$3"
  git -C "$REPO_ROOT" show "$revision:$path" >"$output" 2>/dev/null
}

blob_sha256() {
  local git_root="$1" revision="$2" path="$3"
  git -C "$git_root" show "$revision:$path" 2>/dev/null | sha256sum | awk '{print $1}'
}

safe_relative_path() {
  local path="$1" component
  [[ -n "$path" && "$path" != /* && "$path" != *$'\n'* && "$path" != *$'\r'* && "$path" != *$'\t'* ]] || return 1
  IFS='/' read -r -a components <<<"$path"
  for component in "${components[@]}"; do
    [[ -n "$component" && "$component" != "." && "$component" != ".." ]] || return 1
  done
}

# Contract inputs are validated independently so a missing receipt does not hide
# prompt, goal, or live-PR drift.
required_specs=(
  "specs/079-fleet-alignment-recovery/spec.md"
  "specs/079-fleet-alignment-recovery/plan.md"
  "specs/079-fleet-alignment-recovery/tasks.md"
)
specs_ok=true
for path in "${required_specs[@]}"; do
  if ! git -C "$REPO_ROOT" cat-file -e "HEAD:$path" 2>/dev/null; then
    fail E_SPEC_MISSING "$path is absent at $HEAD_SHA"
    specs_ok=false
  fi
done
$specs_ok && pass "Spec 079 spec/plan/tasks are committed"

expected_prompts="$(new_tmp)" || fatal E_TMP "cannot allocate prompt list"
actual_prompts="$(new_tmp)" || fatal E_TMP "cannot allocate prompt list"
printf '%s\n' \
  speckit.analyze.md \
  speckit.checklist.md \
  speckit.clarify.md \
  speckit.constitution.md \
  speckit.converge.md \
  speckit.implement.md \
  speckit.plan.md \
  speckit.specify.md \
  speckit.tasks.md \
  speckit.taskstoissues.md >"$expected_prompts"
git -C "$REPO_ROOT" ls-tree -r --name-only HEAD -- .pi/prompts 2>/dev/null |
  awk -F/ 'NF == 3 && $1 == ".pi" && $2 == "prompts" && $3 ~ /^speckit\..*\.md$/ { print $3 }' |
  LC_ALL=C sort >"$actual_prompts"
if diff -u "$expected_prompts" "$actual_prompts" >/dev/null; then
  pass "exactly ten Pi Spec Kit prompts are committed"
else
  fail E_PROMPTS "Pi Spec Kit prompt set differs from the accepted ten-file set"
fi

constitution_tmp="$(new_tmp)" || fatal E_TMP "cannot allocate constitution buffer"
if committed_blob HEAD .specify/memory/constitution.md "$constitution_tmp"; then
  constitution_sha="$(sha256sum "$constitution_tmp" | awk '{print $1}')"
  if [[ "$constitution_sha" == "$EXPECTED_CONSTITUTION_SHA" ]]; then
    pass "Constitution hash is unchanged"
  else
    fail E_CONSTITUTION "expected $EXPECTED_CONSTITUTION_SHA, observed $constitution_sha"
  fi
else
  fail E_CONSTITUTION ".specify/memory/constitution.md is absent at HEAD"
fi

# The four acceptance roles use the durable pi-goal JSON surface. A fixture can
# replace the local tool for bounded tests; it cannot change the expected seats.
goals_tmp="$(new_tmp)" || fatal E_TMP "cannot allocate goal buffer"
goals_loaded=false
if [[ -n "${ORACLE_GOALS_FILE:-}" ]]; then
  if jq empty "$ORACLE_GOALS_FILE" >/dev/null 2>&1; then
    cp -- "$ORACLE_GOALS_FILE" "$goals_tmp"
    goals_loaded=true
  else
    fail E_GOALS_UNAVAILABLE "ORACLE_GOALS_FILE is missing or invalid JSON"
  fi
elif command -v pi >/dev/null 2>&1; then
  if pi goal status --all --json >"$goals_tmp" 2>/dev/null && jq -e 'type == "array"' "$goals_tmp" >/dev/null 2>&1; then
    goals_loaded=true
  else
    fail E_GOALS_UNAVAILABLE "pi goal state could not be read"
  fi
else
  fail E_GOALS_UNAVAILABLE "pi goal is unavailable and no fixture was supplied"
fi

if $goals_loaded; then
  goal_failures=0
  while IFS=$'\t' read -r seat expected_goal; do
    if ! jq -e --arg seat "$seat" --arg goal "$expected_goal" \
      '[.[] | select(.seat == $seat and .goal == $goal)] | length == 1' \
      "$goals_tmp" >/dev/null; then
      fail E_GOAL_DRIFT "$seat does not have its accepted role-specific goal"
      goal_failures=$((goal_failures + 1))
    fi
  done <<'GOALS'
fleet-po	Lectrice product contract: Spec Kit 079 freezes the user outcome and ranks all current work against it
fleet-eng-2	Lectrice alignment recovery: one accepted product contract, PRs #147/#152 resolved, exact-head oracle green, board row in review
fleet-qa	Lectrice QA: independently refute the alignment recovery and gate only exact merged heads
fleet-eng	Lectrice control plane: a deterministic recovery oracle replaces model-authored done state
GOALS
  ((goal_failures == 0)) && pass "Product/Orch/QA/Control durable goals match"
fi

# Live GitHub is optional to the local test harness, but final acceptance fails
# closed when PR state cannot be established. All other local checks still run.
pr_states_tmp="$(new_tmp)" || fatal E_TMP "cannot allocate PR-state buffer"
pr_states_loaded=false
if [[ -n "${ORACLE_PR_STATES_FILE:-}" ]]; then
  if jq -e 'type == "object"' "$ORACLE_PR_STATES_FILE" >/dev/null 2>&1; then
    cp -- "$ORACLE_PR_STATES_FILE" "$pr_states_tmp"
    pr_states_loaded=true
  else
    fail E_PR_UNAVAILABLE "ORACLE_PR_STATES_FILE is missing or invalid JSON"
  fi
elif command -v gh >/dev/null 2>&1; then
  printf '{}\n' >"$pr_states_tmp"
  pr_lookup_failed=false
  for pr in 147 152; do
    one_pr="$(new_tmp)" || fatal E_TMP "cannot allocate PR buffer"
    if command -v timeout >/dev/null 2>&1; then
      timeout "${ORACLE_GH_TIMEOUT_SECONDS:-20}" gh pr view "$pr" -R "$GH_REPOSITORY" --json state,headRefOid >"$one_pr" 2>/dev/null
      gh_rc=$?
    else
      gh pr view "$pr" -R "$GH_REPOSITORY" --json state,headRefOid >"$one_pr" 2>/dev/null
      gh_rc=$?
    fi
    if [[ "$gh_rc" -eq 0 ]]; then
      updated="$(new_tmp)" || fatal E_TMP "cannot allocate PR map"
      jq --arg pr "$pr" --slurpfile state "$one_pr" '. + {($pr): $state[0]}' \
        "$pr_states_tmp" >"$updated" && mv -- "$updated" "$pr_states_tmp"
    else
      fail E_PR_UNAVAILABLE "PR #$pr could not be read from $GH_REPOSITORY"
      pr_lookup_failed=true
    fi
  done
  $pr_lookup_failed || pr_states_loaded=true
else
  fail E_PR_UNAVAILABLE "gh is unavailable and no PR-state fixture was supplied"
fi

if $pr_states_loaded; then
  pr_state_failures=0
  for pr in 147 152; do
    state="$(jq -r --arg pr "$pr" '.[$pr].state // "MISSING"' "$pr_states_tmp")"
    case "$state" in
      MERGED|CLOSED) ;;
      OPEN)
        fail E_PR_OPEN "PR #$pr is still OPEN"
        pr_state_failures=$((pr_state_failures + 1))
        ;;
      *)
        fail E_PR_STATE "PR #$pr has unavailable/unknown state $state"
        pr_state_failures=$((pr_state_failures + 1))
        ;;
    esac
  done
  ((pr_state_failures == 0)) && pass "PR #147 and PR #152 are terminal"
fi

schema_tmp="$(new_tmp)" || fatal E_TMP "cannot allocate schema buffer"
schema_valid=false
if committed_blob HEAD "$SCHEMA_PATH" "$schema_tmp" &&
  jq -e '
    .["$schema"] == "https://json-schema.org/draft/2020-12/schema" and
    .type == "object" and .additionalProperties == false and
    .properties.schema_version.const == 1 and
    .properties.program_id.const == "lectrice-alignment-recovery" and
    .properties.receipt_envelope.const == ["docs/alignment-recovery-receipt.json"]
  ' "$schema_tmp" >/dev/null 2>&1; then
  schema_valid=true
  pass "tracked receipt schema is closed and two-phase"
else
  fail E_SCHEMA_CONTRACT "$SCHEMA_PATH is absent or its fixed contract changed"
fi

receipt_tmp="$(new_tmp)" || fatal E_TMP "cannot allocate receipt buffer"
receipt_loaded=false
if committed_blob HEAD "$RECEIPT_PATH" "$receipt_tmp" && jq empty "$receipt_tmp" >/dev/null 2>&1; then
  receipt_loaded=true
else
  fail E_RECEIPT_MISSING "$RECEIPT_PATH is not valid committed JSON at HEAD"
fi

validate_receipt_shape() {
  jq -e '
    def exact($names): (keys | sort) == ($names | sort);
    def nonempty: type == "string" and length > 0;
    def sha: type == "string" and test("^[0-9a-f]{40}$");
    def digest: type == "string" and test("^[0-9a-f]{64}$");
    def timestamp: type == "string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$");
    def artifact:
      exact(["path", "sha256"]) and .path | nonempty;
    def artifact_shape:
      exact(["path", "sha256"]) and (.path | nonempty) and (.sha256 | digest);
    def disposition:
      exact(["item_id", "observed_sha", "category", "immutable_evidence", "owner", "next_action", "falsifier", "preservation_state", "terminal_state"]) and
      (.item_id | nonempty) and (.observed_sha | sha) and
      (.category | IN("north-star-blocking", "worthwhile-post-release-polish", "duplicate", "stale")) and
      (.immutable_evidence | type == "array" and length > 0 and all(.[]; nonempty)) and
      (.owner | nonempty) and (.next_action | nonempty) and (.falsifier | nonempty) and
      (.preservation_state | IN("not-required", "local-only", "remote-preserved", "merged-content-preserved")) and
      (.terminal_state | IN("open", "merged", "closed-with-reason", "preserved-only"));
    def journey_artifact:
      exact(["id", "uri", "sha256"]) and (.id | nonempty) and (.uri | nonempty) and (.sha256 | digest);
    def journey_step:
      exact(["name", "actor_action", "oracle_observation", "elapsed_ms", "failure_reason", "result"]) and
      (.name | IN("fresh_profile", "open_pdf", "no_key_setup_visible", "start_narration", "mutate_acknowledged_state", "normal_close_process_ended", "relaunch_new_process", "resume_same_document_page", "highlight_present")) and
      (.actor_action | nonempty) and (.oracle_observation | nonempty) and
      (.elapsed_ms | type == "number" and floor == . and . >= 0) and
      (.failure_reason | type == "string" or type == "null") and
      (.result | IN("pass", "fail"));
    def journey:
      exact(["source_sha", "platform_scope", "profile_id", "fixture_id", "started_at", "finished_at", "steps", "artifacts", "result"]) and
      (.source_sha | sha) and (.platform_scope | nonempty) and (.profile_id | nonempty) and (.fixture_id | nonempty) and
      (.started_at | timestamp) and (.finished_at | timestamp) and
      (.steps | type == "array" and length == 9 and all(.[]; journey_step)) and
      (.artifacts | type == "array" and length > 0 and all(.[]; journey_artifact)) and
      (.result | IN("pass", "fail"));
    def check:
      exact(["name", "run_id", "subject", "head_sha", "conclusion", "evidence_ref"]) and
      (.name | nonempty) and (.run_id | type == "number" and floor == . and . >= 1) and
      (.subject | test("^(accepted-main|pr:[0-9]+)$")) and (.head_sha | sha) and
      (.conclusion | IN("success", "failure", "cancelled", "skipped")) and (.evidence_ref | nonempty);
    def review:
      exact(["reviewer", "generator_family", "provider_family", "subject", "head_sha", "verdict", "evidence_ref"]) and
      (.reviewer | nonempty) and (.generator_family | IN("anthropic", "openai", "chinese-frontier")) and
      (.provider_family | IN("anthropic", "openai", "chinese-frontier")) and
      (.subject | test("^(accepted-main|pr:[0-9]+)$")) and (.head_sha | sha) and
      (.verdict | IN("ALLOW", "BLOCK")) and (.evidence_ref | nonempty);
    def state_ref:
      exact(["id", "kind", "repository", "path", "revision", "sha256", "observed_main_sha", "observed_at"]) and
      (.id | IN("repo-backlog", "repo-branch-ledger", "vault-save-state")) and
      (.kind | IN("repository", "vault")) and (.repository | IN("lectrice", "vault")) and
      (.path | nonempty) and (.revision | sha) and (.sha256 | digest) and
      (.observed_main_sha | sha) and (.observed_at | timestamp);
    exact(["schema_version", "program_id", "accepted_main_sha", "receipt_commit_parent", "receipt_envelope", "spec_artifacts", "dispositions", "journey", "checks", "reviews", "state_refs", "generated_at"]) and
    .schema_version == 1 and .program_id == "lectrice-alignment-recovery" and
    (.accepted_main_sha | sha) and (.receipt_commit_parent | sha) and
    .receipt_envelope == ["docs/alignment-recovery-receipt.json"] and
    (.spec_artifacts | type == "array" and length >= 3 and all(.[]; artifact_shape)) and
    (.dispositions | type == "array" and length >= 2 and all(.[]; disposition)) and
    (.journey | journey) and
    (.checks | type == "array" and length > 0 and all(.[]; check)) and
    (.reviews | type == "array" and length > 0 and all(.[]; review)) and
    (.state_refs | type == "array" and length >= 3 and all(.[]; state_ref)) and
    (.generated_at | timestamp)
  ' "$1" >/dev/null 2>&1
}

receipt_shape_valid=false
if $receipt_loaded; then
  if validate_receipt_shape "$receipt_tmp"; then
    receipt_shape_valid=true
    pass "committed receipt satisfies the closed schema shape"
  else
    fail E_RECEIPT_SCHEMA "receipt does not satisfy $SCHEMA_PATH"
  fi
fi

if $receipt_shape_valid; then
  accepted_sha="$(jq -r .accepted_main_sha "$receipt_tmp")"
  declared_parent="$(jq -r .receipt_commit_parent "$receipt_tmp")"

  # Historical acceptance is frozen at the receipt-only child R, found by walking
  # accepted_sha..HEAD for the (exactly one) commit that introduces RECEIPT_PATH.
  # Current regression monitoring is separate: it only requires HEAD to still be
  # a descendant of R, so ordinary post-acceptance commits (further merged PRs)
  # never re-fail an already-accepted historical receipt.
  if ! git -C "$REPO_ROOT" cat-file -e "$accepted_sha" 2>/dev/null ||
    ! git -C "$REPO_ROOT" merge-base --is-ancestor "$accepted_sha" HEAD 2>/dev/null; then
    fail E_RECEIPT_PARENT "accepted_main_sha $accepted_sha does not resolve to an ancestor of HEAD $HEAD_SHA"
  else
    receipt_commits_tmp="$(new_tmp)" || fatal E_TMP "cannot allocate receipt-commit list"
    git -C "$REPO_ROOT" rev-list --ancestry-path --reverse "$accepted_sha..HEAD" -- "$RECEIPT_PATH" \
      >"$receipt_commits_tmp" 2>/dev/null || true
    receipt_commit_count="$(wc -l <"$receipt_commits_tmp" | tr -d ' ')"

    if ((receipt_commit_count == 0)); then
      fail E_RECEIPT_PARENT "no commit between accepted main $accepted_sha and HEAD introduces $RECEIPT_PATH"
    elif ((receipt_commit_count > 1)); then
      fail E_RECEIPT_PARENT "$RECEIPT_PATH was committed $receipt_commit_count times after accepted main; the receipt is not immutable"
    else
      receipt_commit="$(head -n 1 "$receipt_commits_tmp")"
      parent_line="$(git -C "$REPO_ROOT" rev-list --parents -n 1 "$receipt_commit" 2>/dev/null)"
      parent_count=$(($(awk '{print NF}' <<<"$parent_line") - 1))
      actual_parent="$(awk '{print $2}' <<<"$parent_line")"

      if ((parent_count == 1)) && [[ "$actual_parent" == "$accepted_sha" && "$declared_parent" == "$accepted_sha" ]]; then
        pass "receipt-only child R ($receipt_commit) has exactly one parent and R^ = accepted main A; HEAD may be R or any later descendant"
      else
        fail E_RECEIPT_PARENT "parents=$parent_count actual=${actual_parent:-none} accepted=$accepted_sha declared=$declared_parent"
      fi

      actual_paths="$(new_tmp)" || fatal E_TMP "cannot allocate changed-path list"
      allowed_paths="$(new_tmp)" || fatal E_TMP "cannot allocate envelope list"
      git -C "$REPO_ROOT" diff --name-only "$accepted_sha..$receipt_commit" 2>/dev/null | LC_ALL=C sort >"$actual_paths"
      jq -r '.receipt_envelope[]' "$receipt_tmp" | LC_ALL=C sort >"$allowed_paths"
      if diff -u "$allowed_paths" "$actual_paths" >/dev/null &&
        ! git -C "$REPO_ROOT" cat-file -e "$accepted_sha:$RECEIPT_PATH" 2>/dev/null; then
        pass "A..R is the one-file receipt envelope and the receipt is new at R"
      else
        fail E_RECEIPT_ENVELOPE "A..R differs from receipt_envelope or receipt already existed at A"
      fi
    fi
  fi

  for path in "$SCHEMA_PATH" scripts/oracle-alignment-recovery.sh scripts/test-oracle-alignment-recovery.sh; do
    git -C "$REPO_ROOT" cat-file -e "$accepted_sha:$path" 2>/dev/null ||
      fail E_CONTROL_ARTIFACT "$path is not committed at accepted main A"
  done

  artifact_failures=0
  while IFS=$'\t' read -r path expected_hash; do
    if ! safe_relative_path "$path"; then
      fail E_ARTIFACT_PATH "unsafe spec artifact path $path"
      artifact_failures=$((artifact_failures + 1))
      continue
    fi
    observed_hash="$(blob_sha256 "$REPO_ROOT" "$accepted_sha" "$path")"
    if [[ "$observed_hash" != "$expected_hash" ]]; then
      fail E_ARTIFACT_HASH "$path expected $expected_hash, observed ${observed_hash:-missing}"
      artifact_failures=$((artifact_failures + 1))
    fi
  done < <(jq -r '.spec_artifacts[] | [.path, .sha256] | @tsv' "$receipt_tmp")
  for path in "${required_specs[@]}"; do
    count="$(jq -r --arg path "$path" '[.spec_artifacts[] | select(.path == $path)] | length' "$receipt_tmp")"
    if [[ "$count" != 1 ]]; then
      fail E_ARTIFACT_SET "$path must appear exactly once in spec_artifacts"
      artifact_failures=$((artifact_failures + 1))
    fi
  done
  ((artifact_failures == 0)) && pass "Spec artifact digests bind to accepted main A"

  disposition_failures=0
  duplicate_ids="$(jq -r '[.dispositions[].item_id] | length == (unique | length)' "$receipt_tmp")"
  if [[ "$duplicate_ids" != true ]]; then
    fail E_DISPOSITION "disposition item_id values are not unique"
    disposition_failures=$((disposition_failures + 1))
  fi
  if ! jq -e '
    all(.dispositions[];
      if ((.category == "duplicate" or .category == "stale") and .terminal_state != "open")
      then .preservation_state != "local-only"
      else true
      end)
  ' "$receipt_tmp" >/dev/null; then
    fail E_PRESERVATION "a reconciled duplicate/stale item remains local-only"
    disposition_failures=$((disposition_failures + 1))
  fi

  for pr in 147 152; do
    item_id="PR #$pr"
    count="$(jq -r --arg id "$item_id" '[.dispositions[] | select(.item_id == $id)] | length' "$receipt_tmp")"
    if [[ "$count" != 1 ]]; then
      fail E_DISPOSITION "$item_id must appear exactly once"
      disposition_failures=$((disposition_failures + 1))
      continue
    fi
    terminal="$(jq -r --arg id "$item_id" '.dispositions[] | select(.item_id == $id) | .terminal_state' "$receipt_tmp")"
    [[ "$terminal" != open ]] || {
      fail E_DISPOSITION "$item_id is not terminal in the receipt"
      disposition_failures=$((disposition_failures + 1))
    }
    if $pr_states_loaded; then
      live_state="$(jq -r --arg pr "$pr" '.[$pr].state' "$pr_states_tmp")"
      live_head="$(jq -r --arg pr "$pr" '.[$pr].headRefOid' "$pr_states_tmp")"
      receipt_head="$(jq -r --arg id "$item_id" '.dispositions[] | select(.item_id == $id) | .observed_sha' "$receipt_tmp")"
      [[ "$live_head" == "$receipt_head" ]] || {
        fail E_PR_BINDING "$item_id receipt head $receipt_head differs from live head $live_head"
        disposition_failures=$((disposition_failures + 1))
      }
      case "$live_state:$terminal" in
        MERGED:merged|CLOSED:closed-with-reason) ;;
        *)
          fail E_PR_BINDING "$item_id live state $live_state disagrees with terminal_state $terminal"
          disposition_failures=$((disposition_failures + 1))
          ;;
      esac
    fi
  done
  ((disposition_failures == 0)) && pass "PR dispositions are unique, preserved, terminal, and live-bound"

  expected_steps='["fresh_profile","open_pdf","no_key_setup_visible","start_narration","mutate_acknowledged_state","normal_close_process_ended","relaunch_new_process","resume_same_document_page","highlight_present"]'
  if jq -e --arg sha "$accepted_sha" --argjson names "$expected_steps" '
    .journey.source_sha == $sha and .journey.result == "pass" and
    [.journey.steps[].name] == $names and
    all(.journey.steps[]; .result == "pass" and .failure_reason == null) and
    (.journey.profile_id | contains("/") | not) and
    all(.journey.artifacts[]; (.uri | startswith("/tmp/") | not))
  ' "$receipt_tmp" >/dev/null; then
    pass "north-star journey passes all nine ordered steps at A"
  else
    fail E_JOURNEY "journey is failed, reordered, path-leaking, or bound to another SHA"
  fi

  subject_head_matches() {
    local collection="$1" index="$2" subject head pr disposition_head
    subject="$(jq -r ".${collection}[$index].subject" "$receipt_tmp")"
    head="$(jq -r ".${collection}[$index].head_sha" "$receipt_tmp")"
    if [[ "$subject" == accepted-main ]]; then
      [[ "$head" == "$accepted_sha" ]]
      return
    fi
    pr="${subject#pr:}"
    disposition_head="$(jq -r --arg id "PR #$pr" '.dispositions[] | select(.item_id == $id) | .observed_sha' "$receipt_tmp")"
    [[ -n "$disposition_head" && "$disposition_head" != null && "$head" == "$disposition_head" ]]
  }

  check_failures=0
  accepted_main_checks=0
  check_count="$(jq '.checks | length' "$receipt_tmp")"
  for ((i = 0; i < check_count; i++)); do
    conclusion="$(jq -r ".checks[$i].conclusion" "$receipt_tmp")"
    subject="$(jq -r ".checks[$i].subject" "$receipt_tmp")"
    [[ "$subject" == accepted-main ]] && accepted_main_checks=$((accepted_main_checks + 1))
    if [[ "$conclusion" != success ]] || ! subject_head_matches checks "$i"; then
      fail E_CHECK "check index $i is non-success or bound to the wrong subject head"
      check_failures=$((check_failures + 1))
    fi
  done
  if ((accepted_main_checks == 0)); then
    fail E_CHECK "no accepted-main check is recorded"
    check_failures=$((check_failures + 1))
  fi
  ((check_failures == 0)) && pass "all checks succeed at A or an explicit prerequisite PR head"

  review_failures=0
  accepted_main_reviews=0
  review_count="$(jq '.reviews | length' "$receipt_tmp")"
  for ((i = 0; i < review_count; i++)); do
    verdict="$(jq -r ".reviews[$i].verdict" "$receipt_tmp")"
    subject="$(jq -r ".reviews[$i].subject" "$receipt_tmp")"
    [[ "$subject" == accepted-main ]] && accepted_main_reviews=$((accepted_main_reviews + 1))
    generator_family="$(jq -r ".reviews[$i].generator_family" "$receipt_tmp")"
    provider_family="$(jq -r ".reviews[$i].provider_family" "$receipt_tmp")"
    if [[ "$verdict" != ALLOW || "$generator_family" == "$provider_family" ]] || ! subject_head_matches reviews "$i"; then
      fail E_REVIEW "review index $i is non-ALLOW, same-family, or bound to the wrong subject head"
      review_failures=$((review_failures + 1))
    fi
  done
  if ((accepted_main_reviews == 0)); then
    fail E_REVIEW "no accepted-main independent review is recorded"
    review_failures=$((review_failures + 1))
  fi
  ((review_failures == 0)) && pass "different-family reviews ALLOW their exact subject heads"

  state_failures=0
  state_ids="$(jq -c '[.state_refs[].id] | sort' "$receipt_tmp")"
  expected_state_ids='["repo-backlog","repo-branch-ledger","vault-save-state"]'
  if [[ "$state_ids" != "$expected_state_ids" ]]; then
    fail E_STATE_SET "state_refs must contain repo backlog, branch ledger, and vault SAVE-STATE exactly once"
    state_failures=$((state_failures + 1))
  fi
  if ! jq -e --arg sha "$accepted_sha" 'all(.state_refs[]; .observed_main_sha == $sha)' "$receipt_tmp" >/dev/null; then
    fail E_STATE_MAIN "a state ref does not name accepted main A"
    state_failures=$((state_failures + 1))
  fi

  while IFS=$'\t' read -r id kind repository path revision expected_hash; do
    if ! safe_relative_path "$path"; then
      fail E_STATE_PATH "$id has unsafe path $path"
      state_failures=$((state_failures + 1))
      continue
    fi
    case "$id:$kind:$repository:$path" in
      repo-backlog:repository:lectrice:docs/agent-backlog-state.md|repo-branch-ledger:repository:lectrice:docs/alignment-recovery-branch-ledger.md)
        observed_hash="$(blob_sha256 "$REPO_ROOT" "$revision" "$path")"
        if [[ "$revision" != "$accepted_sha" || "$observed_hash" != "$expected_hash" ]]; then
          fail E_STATE_REPO "$id revision/hash does not bind the committed file at A"
          state_failures=$((state_failures + 1))
        fi
        ;;
      vault-save-state:vault:vault:'1. Projects/Lectrice — Tauri PDF Reader/SAVE-STATE.md')
        if ! git -C "$VAULT_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
          fail E_STATE_VAULT_UNAVAILABLE "vault git repository is unavailable at $VAULT_ROOT"
          state_failures=$((state_failures + 1))
          continue
        fi
        # Current regression monitoring trusts the fetched origin/main tip, not a
        # possibly stale/dirty local checkout HEAD, and only proves the historical
        # reference is undisturbed (ancestor, unchanged content at that revision,
        # still present at the current tip). It does not require current content
        # to still equal the historical snapshot: the SAVE-STATE doc legitimately
        # keeps evolving after acceptance.
        if git -C "$VAULT_ROOT" show-ref --verify --quiet refs/remotes/origin/main; then
          current_vault_ref="$(git -C "$VAULT_ROOT" rev-parse origin/main 2>/dev/null)"
        else
          current_vault_ref="$(git -C "$VAULT_ROOT" rev-parse HEAD 2>/dev/null)"
        fi
        referenced_hash="$(blob_sha256 "$VAULT_ROOT" "$revision" "$path")"
        if [[ -z "$current_vault_ref" ]] ||
          ! git -C "$VAULT_ROOT" merge-base --is-ancestor "$revision" "$current_vault_ref" 2>/dev/null ||
          [[ "$referenced_hash" != "$expected_hash" ]] ||
          ! git -C "$VAULT_ROOT" cat-file -e "$current_vault_ref:$path" 2>/dev/null; then
          fail E_STATE_STALE "vault SAVE-STATE was rewritten past $revision, its historical content changed, or it no longer exists at the current vault reference"
          state_failures=$((state_failures + 1))
        fi
        ;;
      *)
        fail E_STATE_MAPPING "$id does not use its canonical repository/path mapping"
        state_failures=$((state_failures + 1))
        ;;
    esac
  done < <(jq -r '.state_refs[] | [.id, .kind, .repository, .path, .revision, .sha256] | @tsv' "$receipt_tmp")
  ((state_failures == 0)) && pass "repository and vault state refs are current through A"
fi

if ((errors > 0)); then
  printf 'oracle-alignment-recovery: BLOCK (%d finding%s)\n' "$errors" "$([[ $errors == 1 ]] || printf s)" >&2
  exit 1
fi

printf 'oracle-alignment-recovery: PASS at %s\n' "$HEAD_SHA"

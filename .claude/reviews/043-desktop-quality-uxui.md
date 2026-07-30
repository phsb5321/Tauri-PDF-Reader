Reading additional input from stdin...
OpenAI Codex v0.144.4

---

workdir: /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019fb07b-c7ce-7612-951b-9e68aceaaf94

---

user
You are an adversarial senior reviewer for Lectrice (a Tauri 2 desktop PDF reader). Review this change set (the diff at /tmp/pr36-diff.patch) for: Tauri v2 security/capabilities, local-first privacy, hexagonal architecture, no-direct-invoke, Rust/TS correctness, file open/reopen behavior, asset/fs scope safety, persisted-scope ordering, generated binding drift, build/profile risk, coverage honesty, and docs accuracy. Attack for: whole-disk exposure, broken library reopen, API-key leakage, over-broad capabilities, missing tests, release breakage. ALSO judge — as a BLOCKER, same severity as a speculative/unproven fix (PR#595 parity) — whether this slice MECHANIZED its acceptance claim with a runnable assertion, or DEFERRED a verifiable property to a human ('looks synced' / 'should work' / 'needs your eyes'). The only legal human-defer is subjective aesthetic judgment. Return BLOCKER, MAJOR, MINOR, TEST GAPS, VERDICT. Do not edit files.
warning: loading hooks from both /home/notroot/.codex/hooks.json and /home/notroot/.codex/config.toml; prefer a single representation for this layer
hook: SessionStart
hook: SessionStart Completed
hook: UserPromptSubmit
hook: UserPromptSubmit
hook: UserPromptSubmit Completed
hook: UserPromptSubmit Failed
codex
I’m using the code-review skill because this is a security- and correctness-focused PR gate. I’ll trace the patch into its callers/configuration, then separate proven defects from test gaps; I won’t modify anything.
hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "sed -n '1,240p' /home/notroot/.claude/plugins/marketplaces/claude-code-workflows/plugins/developer-essentials/skills/code-review-excellence/SKILL.md" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:

---

name: code-review-excellence
description: Master effective code review practices to provide constructive feedback, catch bugs early, and foster knowledge sharing while maintaining team morale. Use when reviewing pull requests, establishing review standards, or mentoring developers.

---

# Code Review Excellence

Transform code reviews from gatekeeping to knowledge sharing through constructive feedback, systematic analysis, and collaborative improvement.

## When to Use This Skill

- Reviewing pull requests and code changes
- Establishing code review standards for teams
- Mentoring junior developers through reviews
- Conducting architecture reviews
- Creating review checklists and guidelines
- Improving team collaboration
- Reducing code review cycle time
- Maintaining code quality standards

## Core Principles

### 1. The Review Mindset

**Goals of Code Review:**

- Catch bugs and edge cases
- Ensure code maintainability
- Share knowledge across team
- Enforce coding standards
- Improve design and architecture
- Build team culture

**Not the Goals:**

- Show off knowledge
- Nitpick formatting (use linters)
- Block progress unnecessarily
- Rewrite to your preference

### 2. Effective Feedback

**Good Feedback is:**

- Specific and actionable
- Educational, not judgmental
- Focused on the code, not the person
- Balanced (praise good work too)
- Prioritized (critical vs nice-to-have)

```markdown
❌ Bad: "This is wrong."
✅ Good: "This could cause a race condition when multiple users
access simultaneously. Consider using a mutex here."

❌ Bad: "Why didn't you use X pattern?"
✅ Good: "Have you considered the Repository pattern? It would
make this easier to test. Here's an example: [link]"

❌ Bad: "Rename this variable."
✅ Good: "[nit] Consider `userCount` instead of `uc` for
clarity. Not blocking if you prefer to keep it."
```

### 3. Review Scope

**What to Review:**

- Logic correctness and edge cases
- Security vulnerabilities
- Performance implications
- Test coverage and quality
- Error handling
- Documentation and comments
- API design and naming
- Architectural fit

**What Not to Review Manually:**

- Code formatting (use Prettier, Black, etc.)
- Import organization
- Linting violations
- Simple typos

## Review Process

### Phase 1: Context Gathering (2-3 minutes)

```markdown
Before diving into code, understand:

1. Read PR description and linked issue
2. Check PR size (>400 lines? Ask to split)
3. Review CI/CD status (tests passing?)
4. Understand the business requirement
5. Note any relevant architectural decisions
```

### Phase 2: High-Level Review (5-10 minutes)

```markdown
1. **Architecture & Design**
   - Does the solution fit the problem?
   - Are there simpler approaches?
   - Is it consistent with existing patterns?
   - Will it scale?

2. **File Organization**
   - Are new files in the right places?
   - Is code grouped logically?
   - Are there duplicate files?

3. **Testing Strategy**
   - Are there tests?
   - Do tests cover edge cases?
   - Are tests readable?
```

### Phase 3: Line-by-Line Review (10-20 minutes)

```markdown
For each file:

1. **Logic & Correctness**
   - Edge cases handled?
   - Off-by-one errors?
   - Null/undefined checks?
   - Race conditions?

2. **Security**
   - Input validation?
   - SQL injection risks?
   - XSS vulnerabilities?
   - Sensitive data exposure?

3. **Performance**
   - N+1 queries?
   - Unnecessary loops?
   - Memory leaks?
   - Blocking operations?

4. **Maintainability**
   - Clear variable names?
   - Functions doing one thing?
   - Complex code commented?
   - Magic numbers extracted?
```

### Phase 4: Summary & Decision (2-3 minutes)

```markdown
1. Summarize key concerns
2. Highlight what you liked
3. Make clear decision:
   - ✅ Approve
   - 💬 Comment (minor suggestions)
   - 🔄 Request Changes (must address)
4. Offer to pair if complex
```

## Review Techniques

### Technique 1: The Checklist Method

```markdown
## Security Checklist

- [ ] User input validated and sanitized
- [ ] SQL queries use parameterization
- [ ] Authentication/authorization checked
- [ ] Secrets not hardcoded
- [ ] Error messages don't leak info

## Performance Checklist

- [ ] No N+1 queries
- [ ] Database queries indexed
- [ ] Large lists paginated
- [ ] Expensive operations cached
- [ ] No blocking I/O in hot paths

## Testing Checklist

- [ ] Happy path tested
- [ ] Edge cases covered
- [ ] Error cases tested
- [ ] Test names are descriptive
- [ ] Tests are deterministic
```

### Technique 2: The Question Approach

Instead of stating problems, ask questions to encourage thinking:

```markdown
❌ "This will fail if the list is empty."
✅ "What happens if `items` is an empty array?"

❌ "You need error handling here."
✅ "How should this behave if the API call fails?"

❌ "This is inefficient."
✅ "I see this loops through all users. Have we considered
the performance impact with 100k users?"
```

### Technique 3: Suggest, Don't Command

````markdown
## Use Collaborative Language

❌ "You must change this to use async/await"
✅ "Suggestion: async/await might make this more readable:
`typescript
    async function fetchUser(id: string) {
        const user = await db.query('SELECT * FROM users WHERE id = ?', id);
        return user;
    }
    `
What do you think?"

❌ "Extract this into a function"
✅ "This logic appears in 3 places. Would it make sense to
extract it into a shared utility function?"
````

### Technique 4: Differentiate Severity

```markdown
Use labels to indicate priority:

🔴 [blocking] - Must fix before merge
🟡 [important] - Should fix, discuss if disagree
🟢 [nit] - Nice to have, not blocking
💡 [suggestion] - Alternative approach to consider
📚 [learning] - Educational comment, no action needed
🎉 [praise] - Good work, keep it up!

Example:
"🔴 [blocking] This SQL query is vulnerable to injection.
Please use parameterized queries."

"🟢 [nit] Consider renaming `data` to `userData` for clarity."

"🎉 [praise] Excellent test coverage! This will catch edge cases."
```

## Language-Specific Patterns

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "wc -l /home/notroot/.claude/plugins/marketplaces/claude-code-workflows/plugins/developer-essentials/skills/code-review-excellence/SKILL.md && sed -n '241,520p' /home/notroot/.claude/plugins/marketplaces/claude-code-workflows/plugins/developer-essentials/skills/code-review-excellence/SKILL.md" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
520 /home/notroot/.claude/plugins/marketplaces/claude-code-workflows/plugins/developer-essentials/skills/code-review-excellence/SKILL.md

### Python Code Review

```python
# Check for Python-specific issues

# ❌ Mutable default arguments
def add_item(item, items=[]):  # Bug! Shared across calls
    items.append(item)
    return items

# ✅ Use None as default
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items

# ❌ Catching too broad
try:
    result = risky_operation()
except:  # Catches everything, even KeyboardInterrupt!
    pass

# ✅ Catch specific exceptions
try:
    result = risky_operation()
except ValueError as e:
    logger.error(f"Invalid value: {e}")
    raise

# ❌ Using mutable class attributes
class User:
    permissions = []  # Shared across all instances!

# ✅ Initialize in __init__
class User:
    def __init__(self):
        self.permissions = []
```

### TypeScript/JavaScript Code Review

```typescript
// Check for TypeScript-specific issues

// ❌ Using any defeats type safety
function processData(data: any) {  // Avoid any
    return data.value;
}

// ✅ Use proper types
interface DataPayload {
    value: string;
}
function processData(data: DataPayload) {
    return data.value;
}

// ❌ Not handling async errors
async function fetchUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    return response.json();  // What if network fails?
}

// ✅ Handle errors properly
async function fetchUser(id: string): Promise<User> {
    try {
        const response = await fetch(`/api/users/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw error;
    }
}

// ❌ Mutation of props
function UserProfile({ user }: Props) {
    user.lastViewed = new Date();  // Mutating prop!
    return <div>{user.name}</div>;
}

// ✅ Don't mutate props
function UserProfile({ user, onView }: Props) {
    useEffect(() => {
        onView(user.id);  // Notify parent to update
    }, [user.id]);
    return <div>{user.name}</div>;
}
```

## Advanced Review Patterns

### Pattern 1: Architectural Review

```markdown
When reviewing significant changes:

1. **Design Document First**
   - For large features, request design doc before code
   - Review design with team before implementation
   - Agree on approach to avoid rework

2. **Review in Stages**
   - First PR: Core abstractions and interfaces
   - Second PR: Implementation
   - Third PR: Integration and tests
   - Easier to review, faster to iterate

3. **Consider Alternatives**
   - "Have we considered using [pattern/library]?"
   - "What's the tradeoff vs. the simpler approach?"
   - "How will this evolve as requirements change?"
```

### Pattern 2: Test Quality Review

```typescript
// ❌ Poor test: Implementation detail testing
test('increments counter variable', () => {
    const component = render(<Counter />);
    const button = component.getByRole('button');
    fireEvent.click(button);
    expect(component.state.counter).toBe(1);  // Testing internal state
});

// ✅ Good test: Behavior testing
test('displays incremented count when clicked', () => {
    render(<Counter />);
    const button = screen.getByRole('button', { name: /increment/i });
    fireEvent.click(button);
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
});

// Review questions for tests:
// - Do tests describe behavior, not implementation?
// - Are test names clear and descriptive?
// - Do tests cover edge cases?
// - Are tests independent (no shared state)?
// - Can tests run in any order?
```

### Pattern 3: Security Review

```markdown
## Security Review Checklist

### Authentication & Authorization

- [ ] Is authentication required where needed?
- [ ] Are authorization checks before every action?
- [ ] Is JWT validation proper (signature, expiry)?
- [ ] Are API keys/secrets properly secured?

### Input Validation

- [ ] All user inputs validated?
- [ ] File uploads restricted (size, type)?
- [ ] SQL queries parameterized?
- [ ] XSS protection (escape output)?

### Data Protection

- [ ] Passwords hashed (bcrypt/argon2)?
- [ ] Sensitive data encrypted at rest?
- [ ] HTTPS enforced for sensitive data?
- [ ] PII handled according to regulations?

### Common Vulnerabilities

- [ ] No eval() or similar dynamic execution?
- [ ] No hardcoded secrets?
- [ ] CSRF protection for state-changing operations?
- [ ] Rate limiting on public endpoints?
```

## Giving Difficult Feedback

### Pattern: The Sandwich Method (Modified)

```markdown
Traditional: Praise + Criticism + Praise (feels fake)

Better: Context + Specific Issue + Helpful Solution

Example:
"I noticed the payment processing logic is inline in the
controller. This makes it harder to test and reuse.

[Specific Issue]
The calculateTotal() function mixes tax calculation,
discount logic, and database queries, making it difficult
to unit test and reason about.

[Helpful Solution]
Could we extract this into a PaymentService class? That
would make it testable and reusable. I can pair with you
on this if helpful."
```

### Handling Disagreements

```markdown
When author disagrees with your feedback:

1. **Seek to Understand**
   "Help me understand your approach. What led you to
   choose this pattern?"

2. **Acknowledge Valid Points**
   "That's a good point about X. I hadn't considered that."

3. **Provide Data**
   "I'm concerned about performance. Can we add a benchmark
   to validate the approach?"

4. **Escalate if Needed**
   "Let's get [architect/senior dev] to weigh in on this."

5. **Know When to Let Go**
   If it's working and not a critical issue, approve it.
   Perfection is the enemy of progress.
```

## Best Practices

1. **Review Promptly**: Within 24 hours, ideally same day
2. **Limit PR Size**: 200-400 lines max for effective review
3. **Review in Time Blocks**: 60 minutes max, take breaks
4. **Use Review Tools**: GitHub, GitLab, or dedicated tools
5. **Automate What You Can**: Linters, formatters, security scans
6. **Build Rapport**: Emoji, praise, and empathy matter
7. **Be Available**: Offer to pair on complex issues
8. **Learn from Others**: Review others' review comments

## Common Pitfalls

- **Perfectionism**: Blocking PRs for minor style preferences
- **Scope Creep**: "While you're at it, can you also..."
- **Inconsistency**: Different standards for different people
- **Delayed Reviews**: Letting PRs sit for days
- **Ghosting**: Requesting changes then disappearing
- **Rubber Stamping**: Approving without actually reviewing
- **Bike Shedding**: Debating trivial details extensively

## Templates

### PR Review Comment Template

```markdown
## Summary

[Brief overview of what was reviewed]

## Strengths

- [What was done well]
- [Good patterns or approaches]

## Required Changes

🔴 [Blocking issue 1]
🔴 [Blocking issue 2]

## Suggestions

💡 [Improvement 1]
💡 [Improvement 2]

## Questions

❓ [Clarification needed on X]
❓ [Alternative approach consideration]

## Verdict

✅ Approve after addressing required changes
```

## Resources

- **references/code-review-best-practices.md**: Comprehensive review guidelines
- **references/common-bugs-checklist.md**: Language-specific bugs to watch for
- **references/security-review-guide.md**: Security-focused review checklist
- **assets/pr-review-template.md**: Standard review comment template
- **assets/review-checklist.md**: Quick reference checklist
- **scripts/pr-analyzer.py**: Analyze PR complexity and suggest reviewers

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "ls -la /home/notroot/.claude/plugins/marketplaces/claude-code-workflows/plugins/developer-essentials/skills/code-review-excellence/references && wc -l /home/notroot/.claude/plugins/marketplaces/claude-code-workflows/plugins/developer-essentials/skills/code-review-excellence/references/security-review-guide.md /home/notroot/.claude/plugins/marketplaces/claude-code-workflows/plugins/developer-essentials/skills/code-review-excellence/references/common-bugs-checklist.md && sed -n '1,260p' /home/notroot/.claude/plugins/marketplaces/claude-code-workflows/plugins/developer-essentials/skills/code-review-excellence/references/security-review-guide.md && sed -n '1,320p' /home/notroot/.claude/plugins/marketplaces/claude-code-workflows/plugins/developer-essentials/skills/code-review-excellence/references/common-bugs-checklist.md" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
exited 2 in 0ms:
ls: cannot access '/home/notroot/.claude/plugins/marketplaces/claude-code-workflows/plugins/developer-essentials/skills/code-review-excellence/references': No such file or directory

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "git rev-parse --show-toplevel && git status --short --branch && wc -l /tmp/pr36-diff.patch && rg '"'^diff --git|''^new file mode|''^deleted file mode|''^rename (from|to)|''^@@'"' /tmp/pr36-diff.patch" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui

## 043-desktop-quality-uxui...origin/043-desktop-quality-uxui

?? .claude/reviews/043-desktop-quality-uxui.md
1501 /tmp/pr36-diff.patch
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
@@ -11,6 +11,24 @@ env:
@@ -58,6 +76,12 @@ jobs:
diff --git a/.gitignore b/.gitignore
@@ -47,3 +47,6 @@ src-tauri/gen/
diff --git a/flake.lock b/flake.lock
new file mode 100644
@@ -0,0 +1,61 @@
diff --git a/flake.nix b/flake.nix
new file mode 100644
@@ -0,0 +1,59 @@
diff --git a/knip.json b/knip.json
new file mode 100644
@@ -0,0 +1,35 @@
diff --git a/package.json b/package.json
@@ -17,6 +17,7 @@
@@ -68,6 +69,7 @@
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
@@ -65,7 +65,7 @@ importers:
@@ -105,6 +105,9 @@ importers:
@@ -119,7 +122,7 @@ importers:
@@ -261,6 +264,15 @@ packages:
@@ -993,30 +1005,35 @@ packages:
@@ -1034,6 +1051,12 @@ packages:
@@ -1049,6 +1072,239 @@ packages:
@@ -1098,66 +1354,79 @@ packages:
@@ -1225,30 +1494,35 @@ packages:
@@ -1308,6 +1582,9 @@ packages:
@@ -2386,6 +2663,9 @@ packages:
@@ -2444,6 +2724,11 @@ packages:
@@ -2960,6 +3245,11 @@ packages:
@@ -3226,6 +3516,13 @@ packages:
@@ -3335,6 +3632,10 @@ packages:
@@ -3664,6 +3965,10 @@ packages:
@@ -3791,6 +4096,10 @@ packages:
@@ -3842,6 +4151,10 @@ packages:
@@ -3944,6 +4257,10 @@ packages:
@@ -4098,6 +4415,10 @@ packages:
@@ -4230,6 +4551,11 @@ packages:
@@ -4276,6 +4602,9 @@ packages:
@@ -4461,6 +4790,22 @@ snapshots:
@@ -4985,6 +5330,13 @@ snapshots:
@@ -4999,6 +5351,133 @@ snapshots:
@@ -5197,6 +5676,11 @@ snapshots:
@@ -5370,7 +5854,7 @@ snapshots:
@@ -5378,7 +5862,7 @@ snapshots:
@@ -6688,6 +7172,10 @@ snapshots:
@@ -6696,6 +7184,10 @@ snapshots:
@@ -6748,6 +7240,10 @@ snapshots:
@@ -7303,6 +7799,22 @@ snapshots:
@@ -7588,6 +8100,53 @@ snapshots:
@@ -7690,6 +8249,8 @@ snapshots:
@@ -8080,6 +8641,8 @@ snapshots:
@@ -8241,6 +8804,8 @@ snapshots:
@@ -8315,6 +8880,11 @@ snapshots:
@@ -8415,6 +8985,8 @@ snapshots:
@@ -8481,7 +9053,7 @@ snapshots:
@@ -8494,7 +9066,7 @@ snapshots:
@@ -8544,6 +9116,8 @@ snapshots:
@@ -8720,6 +9294,8 @@ snapshots:
@@ -8772,6 +9348,8 @@ snapshots:
diff --git a/src/services/pdf-storage-service.ts b/src/services/pdf-storage-service.ts
deleted file mode 100644
@@ -1,102 +0,0 @@
diff --git a/tools/alignment-gate.sh b/tools/alignment-gate.sh
new file mode 100755
@@ -0,0 +1,138 @@

codex
The patch is 1,501 lines but most is lockfile churn. Its substantive changes are CI/tooling plus deletion of `pdf-storage-service.ts`, so I’m now checking whether that deletion is genuinely dead code and whether the new gate actually enforces the claims it advertises.
hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "sed -n '1,260p' /tmp/pr36-diff.patch && sed -n '260,620p' /tmp/pr36-diff.patch" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 273ee21..cbb6eed 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -11,6 +11,24 @@ env:
RUST_BACKTRACE: "1"

jobs:

- alignment-gate:
- name: Alignment Gate
- if: github.event_name == 'pull_request'
- runs-on: [self-hosted, Linux, X64, vm103]
- timeout-minutes: 5
-
- steps:
-      - uses: actions/checkout@v4
-        with:
-          fetch-depth: 0  # full history for the --base diff
-
-      - name: Run alignment gate (PR diff vs base)
-        # Catches completion-theater (TODO/stub in "done" code), skipped/.only
-        # tests, added lint-suppressions, debug artifacts — the class no linter
-        # sees. Vendored from Pedro's experiments/alignment-gate (Standard —
-        # Project Quality & Alignment Enforcement). Zero-dep (git+grep+awk).
-        run: ./tools/alignment-gate.sh --base origin/${{ github.base_ref }}
- frontend:
  name: Frontend Checks
  runs-on: [self-hosted, Linux, X64, vm103]
  @@ -58,6 +76,12 @@ jobs: - name: Architecture tests
  run: pnpm test:arch
-      - name: Knip (dead-code detection)
-        # Whole-module-graph dead-code gate — catches unused files/exports/deps
-        # that tsc/ESLint structurally can't see. #1 agent-slop signature per
-        # Pedro's Standard — Project Quality & Alignment Enforcement.
-        run: pnpm knip
-       - name: Coverage check
          run: pnpm test:coverage

diff --git a/.gitignore b/.gitignore
index cd31cd5..9d41b3a 100644
--- a/.gitignore
+++ b/.gitignore
@@ -47,3 +47,6 @@ src-tauri/gen/

# Database files (development)

_.db
_.db-journal

- +# pnpm 11 stray store (uses host pnpm 10 instead)
  +.pnpm-store/
  diff --git a/flake.lock b/flake.lock
  new file mode 100644
  index 0000000..bdd5c20
  --- /dev/null
  +++ b/flake.lock
  @@ -0,0 +1,61 @@
  +{
- "nodes": {
- "flake-utils": {
-      "inputs": {
-        "systems": "systems"
-      },
-      "locked": {
-        "lastModified": 1731533236,
-        "narHash": "sha256-l0KFg5HjrsfsO/JpG+r7fRrqm12kzFHyUHqHCVpMMbI=",
-        "owner": "numtide",
-        "repo": "flake-utils",
-        "rev": "11707dc2f618dd54ca8739b309ec4fc024de578b",
-        "type": "github"
-      },
-      "original": {
-        "owner": "numtide",
-        "repo": "flake-utils",
-        "type": "github"
-      }
- },
- "nixpkgs": {
-      "locked": {
-        "lastModified": 1785090369,
-        "narHash": "sha256-m0pDuRJG7EDo9ri+4Ksu83VsI+PlxNC9lNBfydejce4=",
-        "owner": "NixOS",
-        "repo": "nixpkgs",
-        "rev": "624af665418d3c65d544145b4d34ad696439570e",
-        "type": "github"
-      },
-      "original": {
-        "owner": "NixOS",
-        "ref": "nixos-unstable",
-        "repo": "nixpkgs",
-        "type": "github"
-      }
- },
- "root": {
-      "inputs": {
-        "flake-utils": "flake-utils",
-        "nixpkgs": "nixpkgs"
-      }
- },
- "systems": {
-      "locked": {
-        "lastModified": 1681028828,
-        "narHash": "sha256-Vy1rq5AaRuLzOxct8nz4T6wlgyUR7zLU309k9mBC768=",
-        "owner": "nix-systems",
-        "repo": "default",
-        "rev": "da67096a3b9bf56a91d16901293e51ba5b49a27e",
-        "type": "github"
-      },
-      "original": {
-        "owner": "nix-systems",
-        "repo": "default",
-        "type": "github"
-      }
- }
- },
- "root": "root",
- "version": 7
  +}
  diff --git a/flake.nix b/flake.nix
  new file mode 100644
  index 0000000..f794a4d
  --- /dev/null
  +++ b/flake.nix
  @@ -0,0 +1,59 @@
  +{
- description = "Lectrice — Tauri 2 desktop PDF reader devshell (Linux)";
-
- inputs = {
- nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
- flake-utils.url = "github:numtide/flake-utils";
- };
-
- outputs = { self, nixpkgs, flake-utils }:
- flake-utils.lib.eachDefaultSystem (system:
-      let
-        pkgs = import nixpkgs { inherit system; };
-
-        # Tauri 2 Linux runtime + build deps. Mirrors the upstream
-        # `apt install libwebkit2gtk-4.1-dev build-essential libssl-dev
-        # libxdo-dev libayatana-appindicator3-dev librsvg2-dev` recipe.
-        tauriLinuxDeps = with pkgs; [
-          # Build tools
-          gnumake
-          pkg-config
-          clang
-          llvmPackages.libclang.lib
-
-          # System libs the Rust crates link against
-          openssl.dev
-          alsa-lib
-          webkitgtk_4_1
-          libsoup_3
-          gtk3
-          glib
-          gobject-introspection
-          gdk-pixbuf
-          pango
-          cairo
-          harfbuzz
-          at-spi2-atk
-          atk
-          librsvg
-          libayatana-appindicator
-        ];
-      in
-      {
-        devShells.default = pkgs.mkShell {
-          # pnpm is NOT pulled from nixpkgs (it ships pnpm 11 which clashes with
-          # the project's pnpm 10 lockfile). The devshell inherits the host PATH,
-          # which has Pedro's pnpm 10 at ~/.local/bin/pnpm.
-          packages = [ pkgs.nodejs_22 ] ++ tauriLinuxDeps;
-
-          # bindgen (used transitively by several -sys crates) needs libclang.
-          LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}/lib";
-
-          # Force host's pnpm 10 (at ~/.local/bin) to take precedence over any
-          # nix-cached pnpm 11 — the project's lockfile is pnpm 10 format.
-          shellHook = ''
-            export PATH="$HOME/.local/bin:$PATH"
-          '';
-        };
-      });
  +}
  diff --git a/knip.json b/knip.json
  new file mode 100644
  index 0000000..f744f2c
  --- /dev/null
  +++ b/knip.json
  @@ -0,0 +1,35 @@
  +{
- "$schema": "https://unpkg.com/knip@latest/schema.json",
- "entry": ["src/main.tsx", "src/App.tsx"],
- "project": ["src/**/*.{ts,tsx}", "src-tauri/src/**/*.rs"],
- "ignore": [
- "src/lib/bindings.ts",
- "src-tauri/gen/\*\*",
- "src-tauri/src/lib.rs",
- "specs/\*\*",
- "docs/\*\*",
- "scripts/\*\*",
- "tools/\*\*",
- "e2e/\*\*",
- "tests/\*\*",
- "src/**tests**/\*\*",
- "src/\*_/_.test.{ts,tsx}",
- "src/\*_/_.spec.{ts,tsx}"
- ],
- "ignoreBinaries": ["tauri", "cargo-tauri", "husky", "tsx"],
- "ignoreDependencies": [
- "@tauri-apps/cli",
- "husky",
- "lint-staged",
- "@vitejs/plugin-react",
- "@testing-library/jest-dom",
- "@types/react",
- "@types/react-dom",
- "archunit",
- "esbuild",
- "globals",
- "typescript-eslint"
- ],
- "exclude": ["exports", "types", "enumMembers", "nsExports", "nsTypes"],
- "ignoreUnresolved": ["@/.*"]
  +}
  diff --git a/package.json b/package.json
  index 8c56651..b8184d3 100644
  --- a/package.json
  +++ b/package.json
  @@ -17,6 +17,7 @@
  "test:arch": "vitest run src/**tests**/architecture/",
  "test:rust": "cd src-tauri && cargo test --features test-mocks",
  "test:rust:coverage": "cd src-tauri && cargo llvm-cov --features test-mocks",
- "knip": "knip",
  "typecheck": "tsc --noEmit",
  "verify": "./scripts/verify.sh",
  "prepare": "husky",
  @@ -68,6 +69,7 @@
  "globals": "^15.14.0",
  "husky": "^9.1.7",
  "jsdom": "^25.0.1",
- "knip": "6.29.0",
  "lint-staged": "^16.2.7",
  "prettier": "3.8.3",
  "typescript": "~5.6.3",
  diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
  index e10d689..0aa3e7f 100644
  --- a/pnpm-lock.yaml
  +++ b/pnpm-lock.yaml
  @@ -65,7 +65,7 @@ importers:
  version: 18.3.7(@types/react@18.3.27)
  '@vitejs/plugin-react':
  specifier: ^4.3.4

*        version: 4.7.0(vite@6.4.1(@types/node@25.6.0)(jiti@2.7.0)(tsx@4.21.0)(yaml@2.8.2))

-        version: 4.7.0(vite@6.4.1(@types/node@25.6.0)(jiti@2.7.0)(tsx@4.21.0)(yaml@2.9.0))
         '@vitest/coverage-v8':
           specifier: ^2.1.9
           version: 2.1.9(vitest@2.1.9(@types/node@25.6.0)(jsdom@25.0.1))
  @@ -105,6 +105,9 @@ importers:
  @@ -105,6 +105,9 @@ importers:
  jsdom:
  specifier: ^25.0.1
  version: 25.0.1
-      knip:
-        specifier: 6.29.0
-        version: 6.29.0
         lint-staged:
           specifier: ^16.2.7
           version: 16.2.7
  @@ -119,7 +122,7 @@ importers:
  version: 8.52.0(eslint@9.39.2(jiti@2.7.0))(typescript@5.6.3)
  vite:
  specifier: ^6.0.7

*        version: 6.4.1(@types/node@25.6.0)(jiti@2.7.0)(tsx@4.21.0)(yaml@2.8.2)

-        version: 6.4.1(@types/node@25.6.0)(jiti@2.7.0)(tsx@4.21.0)(yaml@2.9.0)
         vitest:
           specifier: ^2.1.8
           version: 2.1.9(@types/node@25.6.0)(jsdom@25.0.1)

  @@ -261,6 +264,15 @@ packages:
  resolution: {integrity: sha512-Vd/9EVDiu6PPJt9yAh6roZP6El1xHrdvIVGjyBsHR0RYwNHgL7FJPyIIW4fANJNG6FtyZfvlRPpFI4ZM/lubvw==}
  engines: {node: '>=18'}

- '@emnapi/core@1.11.2':
- resolution: {integrity: sha512-TC8MkTuZUtcTSiFeuC0ksCh9QIJ5+F21MvZ4Wn4ORfYaFJ/0dsiudv5tVkejgwZlwQ39jL9WWDe2lz8x0WglOA==}
-
- '@emnapi/runtime@1.11.2':
- resolution: {integrity: sha512-kyOl3X0DuTiT1h2ft8r2fYO8JYtU9a9Xis/zBSiGArNaagCOWx90N1k2wxp18czFDH+OgcWGb5ZP/XMt3dcyPA==}
-
- '@emnapi/wasi-threads@1.2.2':
- resolution: {integrity: sha512-c95qOXkHdydNKhscBTebqEC1CVAZpyqOfVfBzQ1qgzyl3gfeldUjIggDbIZgDKsHLgnsM+igH7TJ/eAasaVuMA==}
- '@esbuild/aix-ppc64@0.21.5':
  resolution: {integrity: sha512-1SDgH6ZSPTlggy1yI6+Dbkiz8xzpHJEVAlF/AM1tHPLsf5STom9rwtjE4hKAF20FfXXNTFqEYXyJNWh1GiZedQ==}
  engines: {node: '>=12'}
  @@ -993,30 +1005,35 @@ packages:
  engines: {node: '>= 10'}
  cpu: [arm64]
  os: [linux]
- libc: [glibc]

'@napi-rs/canvas-linux-arm64-musl@0.1.88':
resolution: {integrity: sha512-kYyNrUsHLkoGHBc77u4Unh067GrfiCUMbGHC2+OTxbeWfZkPt2o32UOQkhnSswKd9Fko/wSqqGkY956bIUzruA==}
engines: {node: '>= 10'}
cpu: [arm64]
os: [linux]

- libc: [musl]

'@napi-rs/canvas-linux-riscv64-gnu@0.1.88':
resolution: {integrity: sha512-HVuH7QgzB0yavYdNZDRyAsn/ejoXB0hn8twwFnOqUbCCdkV+REna7RXjSR7+PdfW0qMQ2YYWsLvVBT5iL/mGpw==}
engines: {node: '>= 10'}
cpu: [riscv64]
os: [linux]

- libc: [glibc]

'@napi-rs/canvas-linux-x64-gnu@0.1.88':
resolution: {integrity: sha512-hvcvKIcPEQrvvJtJnwD35B3qk6umFJ8dFIr8bSymfrSMem0EQsfn1ztys8ETIFndTwdNWJKWluvxztA41ivsEw==}
engines: {node: '>= 10'}
cpu: [x64]
os: [linux]

- libc: [glibc]

'@napi-rs/canvas-linux-x64-musl@0.1.88':
resolution: {integrity: sha512-eSMpGYY2xnZSQ6UxYJ6plDboxq4KeJ4zT5HaVkUnbObNN6DlbJe0Mclh3wifAmquXfrlgTZt6zhHsUgz++AK6g==}
engines: {node: '>= 10'}
cpu: [x64]
os: [linux]

- libc: [musl]

'@napi-rs/canvas-win32-arm64-msvc@0.1.88':
resolution: {integrity: sha512-qcIFfEgHrchyYqRrxsCeTQgpJZ/GqHiqPcU/Fvw/ARVlQeDX1VyFH+X+0gCR2tca6UJrq96vnW+5o7buCq+erA==}
@@ -1034,6 +1051,12 @@ packages:
resolution: {integrity: sha512-/p08f93LEbsL5mDZFQ3DBxcPv/I4QG9EDYRRq1WNlCOXVfAHBTHMSVMwxlqG/AtnSfUr9+vgfN7MKiyDo0+Weg==}
engines: {node: '>= 10'}

- '@napi-rs/wasm-runtime@1.1.6':
- resolution: {integrity: sha512-ZLv/JdUfkvOy9eCnnBaGfiO+XimbjebAeO+MRQqD/B+FR1tnRN0tpKSJHRbE8sFfS6aqsXZ67TQjfwfsxULVbg==}
- peerDependencies:
-      '@emnapi/core': ^1.7.1
-      '@emnapi/runtime': ^1.7.1
- '@nodable/entities@2.1.1':
  resolution: {integrity: sha512-Pig3HxDIoMgjdEH8OCf/dkcTmLFjJRjWuq8jSnklu284/TKOPibSRERmOykiwmyXTtv61mP+44f3GMx0tLAyjg==}

@@ -1049,6 +1072,239 @@ packages:
resolution: {integrity: sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==}
engines: {node: '>= 8'}

- '@oxc-parser/binding-android-arm-eabi@0.140.0':
- resolution: {integrity: sha512-ZfjDZ422mo7eo3b3VltqNsV9kmv1qt/sPEAMSl64iOSwhVfd0eIZ9LB79Mbs1xYXJnk7WSROwzBCKDIiVxPTvQ==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [arm]
- os: [android]
-
- '@oxc-parser/binding-android-arm64@0.140.0':
- resolution: {integrity: sha512-Ia8jSvikUX6Sf+Ht+KOCUF/k1HpR0VlmqIYymubmWDebOEGtsyliHDR6JxsZ4IX3/c/GbrB1uh09aVGQv/LQmQ==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [arm64]
- os: [android]
-
- '@oxc-parser/binding-darwin-arm64@0.140.0':
- resolution: {integrity: sha512-G6VK0nK61pH0d0mBjUqSZbVxGqqO5uzeginLDQj+gOO6ObfJjXRwgkD/ol0w1INcnFeAb6YGGO7qc3ueGHaycQ==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [arm64]
- os: [darwin]
-
- '@oxc-parser/binding-darwin-x64@0.140.0':
- resolution: {integrity: sha512-HazBOuZzd2pO1C2uMmp8Gv7mhzMHqKSKDS1OZfcLEvpIcgA+48J92HEtNanVHDIzRD9PRPCV6aS6fkZIWOVl8Q==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [x64]
- os: [darwin]
-
- '@oxc-parser/binding-freebsd-x64@0.140.0':
- resolution: {integrity: sha512-9hSUU+HmTUyOe4JzMHxNGgLWNY7rrO+6ShicZwImNJacEAACDMIkuEQQkvXSL+WJN50jaNtLYJv8s4OcBdpyUQ==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [x64]
- os: [freebsd]
-
- '@oxc-parser/binding-linux-arm-gnueabihf@0.140.0':
- resolution: {integrity: sha512-RAEuQsYtS0KcDFqN0ABTjyyNlokS91JeuDuoW9tEbG0JTbRNXnpQUdbYc/16JoA6Z/2ALbNrE3KmxtqDiuIjCQ==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [arm]
- os: [linux]
-
- '@oxc-parser/binding-linux-arm-musleabihf@0.140.0':
- resolution: {integrity: sha512-c4CkHvPvqfojouredJ0w3e6+jiBq0SbFyhH61kr/zPb/7XsaYTNKQ54vmlSsopfdQbNDX40ZeK9Abs2Qet6wcw==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [arm]
- os: [linux]
-
- '@oxc-parser/binding-linux-arm64-gnu@0.140.0':
- resolution: {integrity: sha512-yrjmLj8ixPB25yqvPGr28meGjb+keed7m1GqqY/0uqkhZIoT4t9zmfwUgFEtC33C7dtE+UQ7TU0IaVxf97SWJg==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [arm64]
- os: [linux]
- libc: [glibc]
-
- '@oxc-parser/binding-linux-arm64-musl@0.140.0':
- resolution: {integrity: sha512-ggGMQTN8Agwxp2WiLMpdY671dt0qTDJWiWlJeig3HnUwTnerRl0J2JdGVghWBeDcss2D9S2V2Js6dZHEiVabVA==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [arm64]
- os: [linux]
- libc: [musl]
-
- '@oxc-parser/binding-linux-ppc64-gnu@0.140.0':
- resolution: {integrity: sha512-IgTs8xYAFgAUGNmR65tIqjlJ8vKgrfXzC515e9goSdfMyKQV4aJpd2pUUudU4u51G64H0/DSEJEXKOraxm9ZCA==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [ppc64]
- os: [linux]
- libc: [glibc]
-
- '@oxc-parser/binding-linux-riscv64-gnu@0.140.0':
- resolution: {integrity: sha512-A1x+PMWZmSGaFVOx2YeNTFau8uD+QO14/vLP4GrcuvUPs3+nBkUOjy9Lus86ftHsDojjYMbvBelmKc3F7Rv08g==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [riscv64]
- os: [linux]
- libc: [glibc]
-
- '@oxc-parser/binding-linux-riscv64-musl@0.140.0':
- resolution: {integrity: sha512-zBqpfRo2myWPrPo5xUjeZqlnPXPXsX8BcWtWff66/eGRQdbPjhzPgXa/F+AtxT2afUViPxbuDlwscMKzQ5tg+g==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [riscv64]
- os: [linux]
- libc: [musl]
-
- '@oxc-parser/binding-linux-s390x-gnu@0.140.0':
- resolution: {integrity: sha512-2M1DPm/8w9I//YzFlFC9qXw+r2tJFh5CYwRlYTq2vUJQS7qoQftEDeCZ8EnN7KHtvSiXvYj8mZI5pR7DpXmcEw==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [s390x]
- os: [linux]
- libc: [glibc]
-
- '@oxc-parser/binding-linux-x64-gnu@0.140.0':
- resolution: {integrity: sha512-8aRDbZ/U/jO8N7go1MO72jtbpb4uswV8d7vOkMvt/BPgZiyEYvl1VIWK4ESxZZhnJ4tqwVldgX7dNiP/eB1Jdg==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [x64]
- os: [linux]
- libc: [glibc]
-
- '@oxc-parser/binding-linux-x64-musl@0.140.0':
- resolution: {integrity: sha512-xRqpeI8U2sQQS1W5BMWRyMTxtagkuLG2dEWruet5lFsWHTvBth11/TpSaJatHdqVVwHN0q3uuoS9zRsGinq8hg==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [x64]
- os: [linux]
- libc: [musl]
-
- '@oxc-parser/binding-openharmony-arm64@0.140.0':
- resolution: {integrity: sha512-GbGRe26MqAKciFRvXeHNQJ6VAHYs9R4miP89sEAncysM3n+f4lnyLWgsa9kklJNpfnxdq2yRoNYHFqwBckVimw==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [arm64]
- os: [openharmony]
-
- '@oxc-parser/binding-wasm32-wasi@0.140.0':
- resolution: {integrity: sha512-vFiC1hqys+hkX1GnQkIoiTQJNiUm43Z0lO35ETKXTw0YtpW7+cN58YRRXFAQQ+TgpkIi3lrhcxdlnqz+Oi3ptQ==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [wasm32]
-
- '@oxc-parser/binding-win32-arm64-msvc@0.140.0':
- resolution: {integrity: sha512-fGSQldwEYKhM+H8uLt76Op8hh5+FYaR6lvvQ1Txw3Mhn86DyQXLcI0fi1EkFlTK7F+46OCk/j0AJMzZQm6g5Xg==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [arm64]
- os: [win32]
-
- '@oxc-parser/binding-win32-ia32-msvc@0.140.0':
- resolution: {integrity: sha512-sDS2Bai+g3ZWYwfZqmosiSuFDBcVnZ3Ta6pszzsiJoLMqsJEWKcxXXbGa7b7yXr++W2lQNPb3ZRJ8czseqL7RA==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [ia32]
- os: [win32]
-
- '@oxc-parser/binding-win32-x64-msvc@0.140.0':
- resolution: {integrity: sha512-kHbE1zWyb5OQgJA6/5P4WjiuB01sYdQwtZnSSyE58FQEXDAMnyeeq4vj7KgN75i5SlBzOs8A5MrtlD3gOlDKqQ==}
- engines: {node: ^20.19.0 || >=22.12.0}
- cpu: [x64]
- os: [win32]
-
- '@oxc-project/types@0.140.0':
- resolution: {integrity: sha512-h5LUOzGArYemnW1NMz/DuuQhBi96J6JL2Bk8zE4kvqxB5Sg3jxmCiH4uyOWHDkiKSt5vWlG4FIwCR/DbstcNRQ==}
-
- '@oxc-resolver/binding-android-arm-eabi@11.24.2':
- resolution: {integrity: sha512-y09e0L0SRI2OA2tUIrjBgoV3eH5hvUKXNkJqXmNo5V2WxIjyC7I7aJfRLMEVpA8yi95f90gFDvO0VMgrDw+vwA==}
- cpu: [arm]
- os: [android]
-
- '@oxc-resolver/binding-android-arm64@11.24.2':
- resolution: {integrity: sha512-cl4icWaZFnLdg8m6qtnh5rBMuGbxc/ptStFHLeCNwr+2cZjkjNwQu/jYRS0CHlnPecOJMpuS5M6/BH+0J/YkEg==}
- cpu: [arm64]
- os: [android]
-
- '@oxc-resolver/binding-darwin-arm64@11.24.2':
- resolution: {integrity: sha512-At29QEMF6HajbQvgY8K6OXnHD1x9rad74xBEfmCB6ZqCGsdq75aK7tOYcTbOanMy8qdIBrfL3SMr3p/lfSlb9w==}
- cpu: [arm64]
- os: [darwin]
-
- '@oxc-resolver/binding-darwin-x64@11.24.2':
- resolution: {integrity: sha512-A5Kqr1EUj4oIL5CF4WRssq/o5P0Y11cwoFouMRmQ7YnC/A8V93nv1nb7aSU8HwcgmXropjLNkVTl4MN87cu28Q==}
- cpu: [x64]
- os: [darwin]
-
- '@oxc-resolver/binding-freebsd-x64@11.24.2':
- resolution: {integrity: sha512-R5xkRBRRz7ceH/P5Jrc6G7FmdUdgpLYyESFAUDVTNQ9K0sGPxcp4ljiwEwEqsvNcQ4sYbMRrWcHHBCu7ksAJVw==}
- cpu: [x64]
- os: [freebsd]
-
- '@oxc-resolver/binding-linux-arm-gnueabihf@11.24.2':
- resolution: {integrity: sha512-k/RuYL4L/R58IBn3wT5ma3Wh4k62bp1eYCFRWCmMsasUOqL+H6sW0VGFadEzKWXFFlz+2uIMoeMk9ySSZJHgbg==}
- cpu: [arm]
- os: [linux]
-
- '@oxc-resolver/binding-linux-arm-musleabihf@11.24.2':
- resolution: {integrity: sha512-bnHAak3ujYfH5pKk4NieFNbvYvernfoQDgwLddbZ3OtMYrem87/qjlA+u+aKG0oZcqSLGCful/6/CEA+aeAgaA==}
- cpu: [arm]
- os: [linux]
-
- '@oxc-resolver/binding-linux-arm64-gnu@11.24.2':
- resolution: {integrity: sha512-vDT3KHgzYp47gmtNOqL2VNhCyl5Zv643eyxm//A68J8DeUGXrvD1pZFiaT4jSfe+RInfnn1R2yVHye4enx6RnA==}
- cpu: [arm64]
- os: [linux]
- libc: [glibc]
-
- '@oxc-resolver/binding-linux-arm64-musl@11.24.2':
- resolution: {integrity: sha512-+kMlQvbzfyEYtu5FcjE4p+ttBLpKW4d/AsAsuE69BxV6V4twZJeIQZFfD8gh/wqglY0MkPSezWXQH0jBV13MUw==}
- cpu: [arm64]
- os: [linux]
- libc: [musl]
-
- '@oxc-resolver/binding-linux-ppc64-gnu@11.24.2':
- resolution: {integrity: sha512-shjfMhmZ3gq9fv/w7bi3PnZlgOPG+2QAOFf0BJF0EgBSIGZ6PMLN2zbGEblTUYB/NKVDRyYhE2ff3dJ1QqNPkA==}
- cpu: [ppc64]
- os: [linux]
- libc: [glibc]
-
- '@oxc-resolver/binding-linux-riscv64-gnu@11.24.2':
- resolution: {integrity: sha512-zGelwFR5oRo+b69k8Lrzun86DyUHzfKN6cnjbR9l7Z7NIRznOE/2ZvPa1IUKqAL2PzAXOdwkfVqNvO1H2RlpAw==}
- cpu: [riscv64]
- os: [linux]
- libc: [glibc]
-
- '@oxc-resolver/binding-linux-riscv64-musl@11.24.2':
- resolution: {integrity: sha512-qxZ1SWCXJY0eyhAlP6Lmo9F2Nrtx7EkYj9oCgL8apDPCwXwCEDA2U697bbT81JIc2IrVjxO4KX6WU2N+oN9Z4w==}
- cpu: [riscv64]
- os: [linux]
- libc: [musl]
-
- '@oxc-resolver/binding-linux-s390x-gnu@11.24.2':
- resolution: {integrity: sha512-sGCecF3cx2DFlH4t/z7ApnOnXqN48p5p5mlHDEnHTAukQa2P+qMVE4CwyWE9W+q/m3QJ7kKfGrIjax31f44oFQ==}
- cpu: [s390x]
- os: [linux]
- libc: [glibc]
-
- '@oxc-resolver/binding-linux-x64-gnu@11.24.2':
- resolution: {integrity: sha512-k/VlMMcSzMlahb3/fENM4rTlsJ0s3fFROA0KXPBmKggqmTSaE383sl8F3KCOXPLmVsYfW6hCitMhXCEtNeZxxg==}
- cpu: [x64]
- os: [linux]
- libc: [glibc]
-
- '@oxc-resolver/binding-linux-x64-musl@11.24.2':
- resolution: {integrity: sha512-8hbnZyNi97b/8wapYaIF9+t9GmZKBW2vunaOc3h9HGJptH7b7XpvZqOTBSm/MpTjr7H497BlgOaSfLUdhmy2bw==}
- cpu: [x64]
- os: [linux]
- libc: [musl]
-
- '@oxc-resolver/binding-openharmony-arm64@11.24.2':
- resolution: {integrity: sha512-MvyGik3a6pVgZ0t/kWlbmFxFLmXQJwgLsY2eYFHLpy0wGwRbfzeIGgDwQ3kXqE30z+kSXennRkCrT7TUvkptNg==}
- cpu: [arm64]
- os: [openharmony]
-
- '@oxc-resolver/binding-wasm32-wasi@11.24.2':
- resolution: {integrity: sha512-vHcssMPwO08RTvj/c0iOBz90attxyG3wQJ0dTcyEQK43LRpcdLWZlV5feBhv6Isn6ahbQIzHbCgfa81+RiML0Q==}
- engines: {node: '>=14.0.0'}
- cpu: [wasm32]
-
- '@oxc-resolver/binding-win32-arm64-msvc@11.24.2':
- resolution: {integrity: sha512-uokJqro2iBqkFvJdKQLP7d8/BUmFwESQFVmIJUQKj1Xn1a/LysJoe1vmeECLF5b3jsV8CAL5sEMJXX6SdK9Nhg==}
- cpu: [arm64]
- os: [win32]
-
- '@oxc-resolver/binding-win32-x64-msvc@11.24.2':
- resolution: {integrity: sha512-UqGPmo56KDfLlfXFAFIrNflHT8tFxWGEivWg3Zeyp4Uy2NlKN1FGPr6/BxcLGG3+kZ6Wp14g5Uj+n71boqZfiw==}
- cpu: [x64]
- os: [win32]
- '@pkgjs/parseargs@0.11.0':
  resolution: {integrity: sha512-+1VkjdD0QBLPodGrJUeqarH8VAIvQODIbwh9XpP5Syisf7YoQgsJKPNFoqqLQlu+VQ/tVSshMR6loPMn8U+dPg==}
  engines: {node: '>=14'}
  @@ -1098,66 +1354,79 @@ packages:
  resolution: {integrity: sha512-Rn3n+FUk2J5VWx+ywrG/HGPTD9jXNbicRtTM11e/uorplArnXZYsVifnPPqNNP5BsO3roI4n8332ukpY/zN7rQ==}
  cpu: [arm]
  os: [linux]
- libc: [glibc]

'@rollup/rollup-linux-arm-musleabihf@4.55.1':
resolution: {integrity: sha512-grPNWydeKtc1aEdrJDWk4opD7nFtQbMmV7769hiAaYyUKCT1faPRm2av8CX1YJsZ4TLAZcg9gTR1KvEzoLjXkg==}
cpu: [arm]
os: [linux]

- libc: [musl]

'@rollup/rollup-linux-arm64-gnu@4.55.1':
resolution: {integrity: sha512-a59mwd1k6x8tXKcUxSyISiquLwB5pX+fJW9TkWU46lCqD/GRDe9uDN31jrMmVP3feI3mhAdvcCClhV8V5MhJFQ==}
cpu: [arm64]
os: [linux]

- libc: [glibc]

'@rollup/rollup-linux-arm64-musl@4.55.1':
resolution: {integrity: sha512-puS1MEgWX5GsHSoiAsF0TYrpomdvkaXm0CofIMG5uVkP6IBV+ZO9xhC5YEN49nsgYo1DuuMquF9+7EDBVYu4uA==}
cpu: [arm64]
os: [linux]

- libc: [musl]

'@rollup/rollup-linux-loong64-gnu@4.55.1':
resolution: {integrity: sha512-r3Wv40in+lTsULSb6nnoudVbARdOwb2u5fpeoOAZjFLznp6tDU8kd+GTHmJoqZ9lt6/Sys33KdIHUaQihFcu7g==}
cpu: [loong64]
os: [linux]

- libc: [glibc]

'@rollup/rollup-linux-loong64-musl@4.55.1':
resolution: {integrity: sha512-MR8c0+UxAlB22Fq4R+aQSPBayvYa3+9DrwG/i1TKQXFYEaoW3B5b/rkSRIypcZDdWjWnpcvxbNaAJDcSbJU3Lw==}
cpu: [loong64]
os: [linux]

- libc: [musl]

'@rollup/rollup-linux-ppc64-gnu@4.55.1':

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "awk '/"'^diff --git a'"\\/src\\/services\\/pdf-storage-service.ts/{p=1} p' /tmp/pr36-diff.patch" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
diff --git a/src/services/pdf-storage-service.ts b/src/services/pdf-storage-service.ts
deleted file mode 100644
index 7b95f91..0000000
--- a/src/services/pdf-storage-service.ts
+++ /dev/null
@@ -1,102 +0,0 @@
-/\*\*

- - PDF Storage Service
- - Manages copying PDF files to the app's local data directory for persistence
- - and consistent access across sessions.
- \*/
- -import { appLocalDataDir, join } from '@tauri-apps/api/path';
  -import { readFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
- -const PDF_STORAGE_DIR = 'pdfs';
- -/\*\*
- - Get the path to the PDF storage directory
- \*/
  -async function getStorageDir(): Promise<string> {
- const appDir = await appLocalDataDir();
- return join(appDir, PDF_STORAGE_DIR);
  -}
- -/\*\*
- - Ensure the PDF storage directory exists
- \*/
  -async function ensureStorageDir(): Promise<string> {
- const storageDir = await getStorageDir();
-
- if (!(await exists(storageDir))) {
- await mkdir(storageDir, { recursive: true });
- console.log('[PDF Storage] Created storage directory:', storageDir);
- }
-
- return storageDir;
  -}
- -/\*\*
- - Generate a unique filename for a PDF based on its original path
- \*/
  -function generateStoredFilename(originalPath: string): string {
- // Extract filename from path
- const parts = originalPath.replace(/\\/g, '/').split('/');
- const filename = parts[parts.length - 1];
-
- // Add timestamp to ensure uniqueness
- const timestamp = Date.now();
- const baseName = filename.replace(/\.pdf$/i, '');
-
- return `${baseName}_${timestamp}.pdf`;
  -}
- -/\*\*
- - Copy a PDF file to the app's storage directory
- - Returns the new path to the stored file
- \*/
  -export async function copyPdfToStorage(sourcePath: string): Promise<string> {
- console.log('[PDF Storage] Copying PDF to storage:', sourcePath);
-
- try {
- // Ensure storage directory exists
- const storageDir = await ensureStorageDir();
-
- // Read the source file
- const fileData = await readFile(sourcePath);
- console.log('[PDF Storage] Read source file, size:', fileData.byteLength, 'bytes');
-
- // Generate destination filename
- const storedFilename = generateStoredFilename(sourcePath);
- const destPath = await join(storageDir, storedFilename);
-
- // Write to storage
- await writeFile(destPath, fileData);
- console.log('[PDF Storage] Copied to:', destPath);
-
- return destPath;
- } catch (error) {
- console.error('[PDF Storage] Failed to copy PDF:', error);
- throw error;
- }
  -}
- -/\*\*
- - Check if a PDF exists in storage by its stored path
- \*/
  -export async function pdfExistsInStorage(storedPath: string): Promise<boolean> {
- try {
- return await exists(storedPath);
- } catch {
- return false;
- }
  -}
- -/\*\*
- - Get the storage directory path (for diagnostics)
- \*/
  -export async function getStoragePath(): Promise<string> {
- return getStorageDir();
  -}
- -/\*\*
- - Read a PDF from storage
- \*/
  -export async function readPdfFromStorage(storedPath: string): Promise<Uint8Array> {
- return readFile(storedPath);
  -}
  diff --git a/tools/alignment-gate.sh b/tools/alignment-gate.sh
  new file mode 100755
  index 0000000..830f0b2
  --- /dev/null
  +++ b/tools/alignment-gate.sh
  @@ -0,0 +1,138 @@
  +#!/usr/bin/env bash
  +#
  +# alignment-gate.sh — deterministic "did the agent finish + stay in scope" gate.
  +# Zero-dependency (git + grep + awk). Catches the completion-theater / scope-creep
  +# class no linter sees: TODO/stub left in "done" code, skipped/only tests, added lint
  +# suppressions (goal-hacking), debug artifacts, and over-wide blast radius.
  +#
  +# Heuristics modeled on the deterministic checks in donegate (MIT, intrepideai/donegate),
  +# AgentLiar (MIT), and opencode-swarm's placeholder-scan — reimplemented portably.
  +#
  +# Scope (pick one; default = path "."):
  +# --staged files staged in git → pre-commit / PostToolUse-batch
  +# --base REF files changed vs REF → CI on a PR (scans ADDED lines only)
  +# <path> scan a dir/file → manual (scans all lines)
  +#
  +# Strictness (env-overridable; 1 = fail, 0 = report-only):
  +# ALIGN_FAIL_ON_TODO default 1 TODO/FIXME/HACK/XXX + not-implemented + stubs
  +# ALIGN_FAIL_ON_SKIP default 1 skipped / .only / disabled tests
  +# ALIGN_FAIL_ON_LINT_DISABLE default 1 added eslint-disable / @ts-ignore / noqa / …
  +# ALIGN_FAIL_ON_DEBUG default 0 console.log / debugger / set_trace left in
  +# ALIGN_MAX_FILES default 0 0=off; else fail if changed code files > N
  +#
  +# Exit: 0 = aligned · 1 = violation over threshold · 2 = tooling/usage error.

* +set -uo pipefail
* +SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+ALIGN_FAIL_ON_TODO="${ALIGN_FAIL_ON_TODO:-1}"
  +ALIGN_FAIL_ON_SKIP="${ALIGN_FAIL_ON_SKIP:-1}"
+ALIGN_FAIL_ON_LINT_DISABLE="${ALIGN_FAIL_ON_LINT_DISABLE:-1}"
  +ALIGN_FAIL_ON_DEBUG="${ALIGN_FAIL_ON_DEBUG:-0}"
+ALIGN_MAX_FILES="${ALIGN_MAX_FILES:-0}"
* +# NB: literal dots written [.] so the same patterns are safe in both grep -E and awk.
  +CODE*RE='[.](ts|tsx|js|jsx|py|go|rs|rb|php|java|cs|c|cpp|h|hpp|swift|kt|ex|exs|sh|bash|nix)$'
  +TEST_RE='([.]test[.]|[.]spec[.]|\_test[.]|/tests?/|/**tests**/|(^|/)test*[^/]\*[.]py$|_test[.]go$|\_spec[.]rb$)'
+# self-exemption: never scan the gate's own files (they contain the pattern tables) or meta docs
+SELF_RE='(alignment-gate[.]sh$|/hooks/|posttooluse-aislop|code-slop-gate)'
  +META_RE='[.](md|rst|txt|lock)$'
* +die() { echo "alignment-gate: $\*" >&2; exit 2; }
  +command -v git >/dev/null 2>&1 || die "git required"
  +command -v awk >/dev/null 2>&1 || die "awk required"
* +mode="path"; base="HEAD"; target="."
  +case "${1:-}" in
* --staged) mode="staged" ;;
* --worktree) mode="worktree" ;;
* --changes) mode="changes"; [ "${2:-}" = "--base" ] && base="${3:?--base needs a ref}" ;;
* --base) mode="changes"; base="${2:?--base needs a ref}" ;;
* "") target="." ;;
* -\*) die "unknown flag: $1" ;;
* \*) target="$1" ;;
  +esac
* +WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
  +stream="$WORK/stream"     # path \t lineno \t content   (added lines for diff; all lines for path)
+: >"$stream"
* +emit_diff() {
* local range
* case "$mode" in
* staged) range=(--cached) ;;
* worktree) range=("HEAD") ;;
* changes) range=("$base...HEAD") ;;
* esac
* git diff -U0 --no-color "${range[@]}" 2>/dev/null | awk '
* /^\+\+\+ b\// { file=substr($0,7); next }
* /^@@/ { if (match($0,/\+[0-9]+/)) { n=substr($0,RSTART+1,RLENGTH-1)+0; ln=n-1 } next }
* /^\+/ && !/^\+\+\+/ { ln++; print file "\t" ln "\t" substr($0,2) }
* '
  +}
  +emit_path() {
* while IFS= read -r f; do
* [ -f "$f" ] || continue
* awk -v p="$f" '{print p "\t" NR "\t" $0}' "$f"
* done < <(find "$target" -type f 2>/dev/null)
  +}
* +# build the filtered line stream
  +{ [ "$mode" = "path" ] && emit_path || emit_diff; } | \
* awk -F'\t' -v code="$CODE_RE" -v self="$SELF_RE" -v meta="$META_RE" \
* '$1 ~ code && $1 !~ self && $1 !~ meta' >"$stream"
* +# changed code-file count (for blast-radius)
  +nfiles="$(cut -f1 "$stream" | sort -u | grep -c . || true)"
* +# checks: rule | severity | test_only | toggle | ERE | message
  +checks=(
* "incomplete/todo|error|0|$ALIGN_FAIL_ON_TODO|\b(TODO|FIXME|HACK|XXX)\b|TODO/FIXME/HACK/XXX left in changed code"
* "incomplete/not-implemented|error|0|$ALIGN_FAIL_ON_TODO|NotImplementedError|NotImplementedException|[Nn]ot implemented|unimplemented|not-implemented marker"
* "incomplete/throw-stub|error|0|$ALIGN_FAIL_ON_TODO|(throw new Error|raise)[^;]\*(implement|stub|placeholder|TODO)|stub raises/throws instead of implementing"
* "incomplete/ellipsis-body|error|0|$ALIGN_FAIL_ON_TODO|^[[:space:]]*\.\.\.[[:space:]]*$|ellipsis placeholder body"
* "test/skip|error|1|$ALIGN_FAIL_ON_SKIP|\b(it|test|describe)\.(skip|todo|failing|only)\b|\bx(it|describe|test)[[:space:]]\*\(|@pytest\.mark\.(skip|skipif|xfail)\b|pytest\.skip\(|unittest\.skip|\bt\.Skip(f|Now)?\(|#\[ignore\b|@(Disabled|Ignore)\b|markTestSkipped|markTestIncomplete|skipped / .only / disabled test added"
* "align/lint-suppressed|error|0|$ALIGN_FAIL_ON_LINT_DISABLE|eslint-disable|biome-ignore|@ts-(ignore|nocheck|expect-error)|#[[:space:]]*noqa|#[[:space:]]*type:[[:space:]]*ignore|#[[:space:]]*pylint:[[:space:]]*disable|//[[:space:]]*nolint|#\[allow\(|@SuppressWarnings|rubocop:disable|swiftlint:disable|lint suppression added (goal-hacking)"
* "align/debug-artifact|warn|0|$ALIGN_FAIL_ON_DEBUG|console\.(log|debug)\(|^[[:space:]]\*debugger;|pdb\.set_trace\(|binding\.pry|[[:space:]]dbg!\(|debug artifact left in code"
  +)
* +findings="$WORK/findings"; : >"$findings" # sev \t rule \t path:lineno \t message
  +for spec in "${checks[@]}"; do
* # spec layout: rule|sev|test_only|toggle|<re...>|msg (re may contain | alternation,
* # so peel fixed fields off the front and msg off the back; re is what remains).
* rule="${spec%%|*}"; rest="${spec#\*|}"
* sev="${rest%%|*}"; rest="${rest#\*|}"
* test_only="${rest%%|*}"; rest="${rest#\*|}"
* toggle="${rest%%|*}"; rest="${rest#\*|}"
* msg="${rest##*|}"; re="${rest%|\*}"
* [ "$toggle" = "0" ] && [ "$sev" = "error" ] && sev="warn" # strictness downgrade
* while IFS=$'\t' read -r path lineno content; do
* [ "$test_only" = "1" ] && { echo "$path" | grep -qE "$TEST_RE" || continue; }
* if printf '%s' "$content" | grep -qE "$re"; then
*      printf '%s\t%s\t%s:%s\t%s\n' "$sev" "$rule" "$path" "$lineno" "$msg" >>"$findings"
* fi
* done <"$stream"
  +done
* +# blast-radius
  +if [ "$ALIGN_MAX_FILES" -gt 0 ] && [ "${nfiles:-0}" -gt "$ALIGN_MAX_FILES" ]; then
* printf 'error\tscope/blast-radius\t(%s files)\tchanged code files %s > max %s\n' \
* "$nfiles" "$nfiles" "$ALIGN_MAX_FILES" >>"$findings"
  +fi
* +errs="$(grep -c '^error' "$findings" 2>/dev/null)"; errs="${errs:-0}"
+warns="$(grep -c '^warn' "$findings" 2>/dev/null)"; warns="${warns:-0}"
* +echo "── alignment gate ─────────────────────────────"
  +printf 'scanned: %s changed code file(s) · %s error(s) · %s warning(s)\n' "${nfiles:-0}" "$errs" "$warns"
+if [ -s "$findings" ]; then
* echo "findings:"
* sort "$findings" | awk -F'\t' '{printf "  %-5s %-26s %-28s %s\n", toupper($1), $2, $3, $4}'
+fi
+echo "───────────────────────────────────────────────"
+if [ "${errs:-0}" -gt 0 ]; then
* echo "✗ FAIL — finish the work / tighten scope before claiming done."
* exit 1
  +fi
  +echo "✓ PASS — no completion-theater or scope violations over threshold."
  +exit 0

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "git log --oneline --decorate --no-merges origin/main..HEAD && git diff --stat origin/main...HEAD && git diff --name-status origin/main...HEAD && rg -n --hidden -S \"pdf-storage-service|copyPdfToStorage|pdfExistsInStorage|readPdfFromStorage|getStoragePath|persisted scope|persistedScope|persisted-scope|assetProtocol|convertFileSrc|plugin-fs|scope\\.allow|assetScope|withGlobalTauri|invoke\\(\" --glob '"'!node_modules/**'"' --glob '"'!.git/**'"' ." in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
2e1bcba (HEAD -> 043-desktop-quality-uxui, origin/043-desktop-quality-uxui) ci(quality): add knip gate + pnpm script + CI step
167ffef ci(quality): add knip dead-code gate + drop dead pdf-storage-service.ts
58dbcbd ci(quality): adopt alignment-gate as a PR gate
2fc5bd4 feat(nix): add flake.nix devshell for Tauri 2 desktop dev on NixOS
.github/workflows/ci.yml | 24 ++
.gitignore | 3 +
flake.lock | 61 ++++
flake.nix | 59 ++++
knip.json | 35 +++
package.json | 2 +
pnpm-lock.yaml | 590 +++++++++++++++++++++++++++++++++++-
src/services/pdf-storage-service.ts | 102 -------
tools/alignment-gate.sh | 138 +++++++++
9 files changed, 906 insertions(+), 108 deletions(-)
M .github/workflows/ci.yml
M .gitignore
A flake.lock
A flake.nix
A knip.json
M package.json
M pnpm-lock.yaml
D src/services/pdf-storage-service.ts
A tools/alignment-gate.sh
./AGENTS.md:87:**Direct `invoke()` calls are forbidden.** Always use:
./AGENTS.md:96:await invoke("some_command");
./pnpm-lock.yaml:26: '@tauri-apps/plugin-fs':
./pnpm-lock.yaml:1553: '@tauri-apps/plugin-fs@2.4.5':
./pnpm-lock.yaml:5639: '@tauri-apps/plugin-fs@2.4.5':
./.specify/memory/constitution.md:39:Direct `invoke()` calls from `@tauri-apps/api/core` are FORBIDDEN in application code.
./tests/setup.ts:8: convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
./docs/agent-backlog-state.md:64: - Self-checks: capabilities/tauri.conf **unchanged** (no scope widening) · `bindings.ts` unchanged (no drift) · no new UI `invoke(` · no conflict markers · 018 code absent.
./docs/agent-backlog-state.md:129:- **Branch:** `020-persisted-scope` (off `origin/main` 8c366d7). Commit `42c1ef8`. Local only — awaiting push/PR.
./docs/agent-backlog-state.md:130:- **Slice:** S2 (P0#3 follow-up from 008). Add `tauri-plugin-persisted-scope` (2.3.5) AFTER `tauri_plugin_fs::init()` so the runtime per-file fs grant from `dialog.open()` survives restart → library documents reopen via `readFile(originalPath)` without re-prompting.
./docs/agent-backlog-state.md:133:- **Verified (build):** nix-shell `cargo fmt --check` clean; `clippy --all-targets --features test-mocks -D warnings` clean; `cargo test --features test-mocks -j 1` → 273+ pass / 0 fail. persisted-scope 2.3.5 vs tauri 2.9.5. Frontend unchanged (no lint/typecheck delta).
./docs/agent-backlog-state.md:134:- **Codex:** `.claude/reviews/020-persisted-scope.md` — VERDICT **PASS**, no BLOCKER/MAJOR. 1 MINOR (comment overstated "only picked files") FIXED via amend `42c1ef8`; 1 MINOR informational (asset grants not persisted — fine, app uses readFile not asset protocol).
./docs/agent-backlog-state.md:146:- **Next slice:** **S2 persisted-scope** (P0#3 follow-up from 008) — add `tauri-plugin-persisted-scope` AFTER `tauri_plugin_fs::init()` so a picked PDF reopens after restart without re-granting; build+restart verify, else ship narrowest safe scope + document the exact remaining task. Then P1 word-level karaoke highlighting (#6/#7).
./docs/agent-backlog-state.md:164:- **#1 Spec 008 `008-security-housekeeping` `93065ac`** — asset scope `[]`; fs scope `$APPLOCALDATA/**`; backend `validate_pdf_path`; metadata. 8 tests. Codex 4 rounds → Pass. Follow-ups: S2 persisted-scope, S-provenance, WebView raw-SQL.
./docs/agent-backlog-state.md:169:- **Unmerged branches awaiting push/PR (loop, off 8c366d7):** `026-audio-duration` (`3ab99a1`, this iter), `025-page-boundary` (`f1c0619`), `024-karaoke-fallback` (`954bdd5`), `023-reduced-motion` (`2e1db32`), `022-karaoke-ui` (`612188e`), `021-tts-timestamp-adapter` (`409383c`), `020-persisted-scope` (`42c1ef8`), `019-coverage-ratchet` (`42e5825`). **7 stacked branches — STRONGLY recommend Pedro batch-review/merge now (merge oldest-first; each carries the cumulative backlog doc → `--theirs` the latest on conflict). Loop value is dropping vs. the review/GUI-verify backlog.** Also local-only: `016-cache-coverage-tests` / `017-domain-coverage-tests` (older base — rebase onto 8c366d7 + measure before they affect the coverage floor), and `018-render-perf` (UNCOMMITTED desktop-integration: GPU compositing + niri decorations + AT-SPI app-menu export — Pedro-directed, separate from the loop; see [[lectrice-niri-desktop-integration]]). NOTE: 019/020/021 each carry the cumulative `docs/agent-backlog-state.md`; merge oldest-first or `git checkout --theirs` the latest to resolve the add/add.
./docs/agent-backlog-state.md:173:- **Open worktrees:** `-008-…`–`-015-…` already removed post-merge. Current: `-016-…`, `-017-…`, `-018-render-perf`, `-019-coverage-ratchet`, `-020-persisted-scope`, `-021-tts-timestamp-adapter`, `-022-karaoke-ui`, `-023-reduced-motion`, `-024-karaoke-fallback`, `-025-page-boundary`, `-026-audio-duration`, `-run` (detached dev-run @ 8c366d7; dev server currently stopped). Loop worktrees reuse `-run/node_modules` via symlink to skip redundant installs.
./.claude/skills/lectrice-merge-train/SKILL.md:34:- Do not break hexagonal architecture or the direct-`invoke()` ban.
./.claude/skills/lectrice-merge-train/SKILL.md:46: | 020 | `020-persisted-scope` | `42c1ef8` | S2: persist fs scope, picked PDF reopens after restart |
./eslint.config.js:151: "Direct invoke() calls are not allowed. Use type-safe adapters from src/adapters/ or the generated bindings in src/lib/bindings.ts instead.",
./package.json:43: "@tauri-apps/plugin-fs": "^2",
./src/services/pdf-service.ts:15: const { readFile } = await import('@tauri-apps/plugin-fs');
./src/e2e-native-bootstrap.ts:17: _ real `handlePlay → speakWithHighlight → invoke(ai_tts_speak_with_timestamps)`
./docs/gui-validation-019-026.md:14:| 2 | 020 persisted-scope | Open a PDF from an **arbitrary path** (not app data dir), quit fully, relaunch, reopen it from the library | Reopens via `readFile(originalPath)` with **no re-grant / no file-picker re-prompt** | "permission denied" / re-prompt |
./.claude/skills/lectrice-forward-loop/SKILL.md:23:- Do not bypass hexagonal boundaries. Do not use direct `invoke()` in UI (use typed adapters / tauri-specta bindings).
./.claude/skills/lectrice-forward-loop/SKILL.md:36:- PDF loading path: `@tauri-apps/plugin-fs` `readFile(path)` -> bytes -> pdf.js `getDocument({data})`. NO `convertFileSrc` / asset protocol usage anywhere.
./.claude/skills/lectrice-forward-loop/SKILL.md:37:- Library stores the ORIGINAL picked path and reopens via `readFile(originalPath)`. `pdf-storage-service.ts` (copyPdfToStorage/readPdfFromStorage) is DEAD CODE (defined, never called).
./.claude/skills/lectrice-forward-loop/SKILL.md:38:- Tauri Builder plugin order in `src-tauri/src/lib.rs`: sql -> dialog -> fs -> shell. persisted-scope MUST register AFTER `tauri_plugin_fs::init()`.
./.claude/skills/lectrice-forward-loop/SKILL.md:39:- Tauri v2 JS dialog `open()` auto-grants `fs_scope().allow_file(pickedPath)` at runtime (in-memory, non-persistent). Survives restart only with `tauri-plugin-persisted-scope`.
./.claude/skills/lectrice-forward-loop/SKILL.md:59:3. Tauri security scope tightening — narrow `app.security.assetProtocol.scope` and fs/capability scope while preserving open + reopen. Add `tauri-plugin-persisted-scope` (after fs::init) only if reopen-after-restart needs it and it is build+restart verified. If not safely verifiable in one slice: ship the narrowest safe scope + document the exact remaining task.
./.claude/skills/lectrice-forward-loop/SKILL.md:85:Every checklist must cover: hexagonal boundary compliance, no direct `invoke()`,
./.claude/skills/lectrice-forward-loop/SKILL.md:111: direct `invoke()`; hexagonal layers intact.
./.claude/skills/lectrice-forward-loop/SKILL.md:147:asset/fs scope safety, persisted-scope ordering, generated binding drift, build/profile risk,
./src/components/settings/DebugLogs.tsx:54: await invoke('clear_debug_logs');
./src-tauri/tauri.conf.json:13: "withGlobalTauri": true,
./src-tauri/tauri.conf.json:27: "assetProtocol": {
./src/hooks/useHwAccelStatus.ts:63: await invoke("clear_safe_mode");
./src-tauri/Cargo.toml:18:tauri-plugin-fs = "2"
./src-tauri/Cargo.toml:22:tauri-plugin-persisted-scope = "2"
./src/components/dialogs/ExportDialog.tsx:57: const { writeTextFile } = await import("@tauri-apps/plugin-fs");
./.claude/reviews/022-karaoke-ui.md:18:Also confirmed: the hook still gates store/callback updates on `newWordIndex !== lastWordIndexRef.current && newWordIndex >= 0` (no new per-frame thrash); only the 3 files above changed; no package/lockfile change, no Tauri capability/scope change, no direct `invoke()`; a hook importing a pure `src/lib` utility respects the existing boundaries. Tests cover empty / pre-start `-1` / `[start,end)` boundaries / gap-fill (incl. exact gap start) / tail (incl. exact last end + far past) / single-word.
./e2e/critical-loop.spec.ts:105: // real invoke('ai_tts_speak_with_timestamps') -> mocked IPC fixture.
./e2e/native-play.e2e.mjs:16: _ → invoke("ai_tts_speak_with_timestamps") (REAL Tauri IPC → Rust)
./.claude/reviews/043-desktop-quality-uxui.md:14:You are an adversarial senior reviewer for Lectrice (a Tauri 2 desktop PDF reader). Review this change set (the diff at /tmp/pr36-diff.patch) for: Tauri v2 security/capabilities, local-first privacy, hexagonal architecture, no-direct-invoke, Rust/TS correctness, file open/reopen behavior, asset/fs scope safety, persisted-scope ordering, generated binding drift, build/profile risk, coverage honesty, and docs accuracy. Attack for: whole-disk exposure, broken library reopen, API-key leakage, over-broad capabilities, missing tests, release breakage. ALSO judge — as a BLOCKER, same severity as a speculative/unproven fix (PR#595 parity) — whether this slice MECHANIZED its acceptance claim with a runnable assertion, or DEFERRED a verifiable property to a human ('looks synced' / 'should work' / 'needs your eyes'). The only legal human-defer is subjective aesthetic judgment. Return BLOCKER, MAJOR, MINOR, TEST GAPS, VERDICT. Do not edit files.
./.claude/reviews/043-desktop-quality-uxui.md:634:diff --git a/src/services/pdf-storage-service.ts b/src/services/pdf-storage-service.ts
./.claude/reviews/043-desktop-quality-uxui.md:642:The patch is 1,501 lines but most is lockfile churn. Its substantive changes are CI/tooling plus deletion of `pdf-storage-service.ts`, so I’m now checking whether that deletion is genuinely dead code and whether the new gate actually enforces the claims it advertises.
./.claude/reviews/043-desktop-quality-uxui.md:1273:/run/current-system/sw/bin/zsh -lc "awk '/"'^diff --git a'"\\/src\\/services\\/pdf-storage-service.ts/{p=1} p' /tmp/pr36-diff.patch" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
./.claude/reviews/043-desktop-quality-uxui.md:1275:diff --git a/src/services/pdf-storage-service.ts b/src/services/pdf-storage-service.ts
./.claude/reviews/043-desktop-quality-uxui.md:1278:--- a/src/services/pdf-storage-service.ts
./.claude/reviews/043-desktop-quality-uxui.md:1288:-import { readFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
./.claude/reviews/043-desktop-quality-uxui.md:1333:-export async function copyPdfToStorage(sourcePath: string): Promise<string> {
./.claude/reviews/043-desktop-quality-uxui.md:1362:-export async function pdfExistsInStorage(storedPath: string): Promise<boolean> {
./.claude/reviews/043-desktop-quality-uxui.md:1373:-export async function getStoragePath(): Promise<string> {
./.claude/reviews/043-desktop-quality-uxui.md:1380:-export async function readPdfFromStorage(storedPath: string): Promise<Uint8Array> {
./.claude/reviews/008-security-housekeeping-round1.md:13:gates only the plugin-fs JS API, not custom commands. `invoke("library_add_document",
./.claude/reviews/008-security-housekeeping-round1.md:26:residual config noise (asset protocol confirmed unused, no `convertFileSrc`);
./.claude/reviews/008-security-housekeeping-round1.md:27:`pdf-storage-service.ts`confirmed dead code.
./.claude/reviews/008-security-housekeeping-round1.md:39:  reopen is not a live path; reopen+persisted-scope tracked as S2.
./src/lib/api/sessions.ts:27:  return invoke("session_create", { name, documentIds });
./src/lib/api/sessions.ts:39:  return invoke("session_get", { sessionId });
./src/lib/api/sessions.ts:48:  return invoke("session_list");
./src/lib/api/sessions.ts:63:  return invoke("session_update", { sessionId, name, documentIds });
./src/lib/api/sessions.ts:72:  return invoke("session_delete", { sessionId });
./src/lib/api/sessions.ts:86:  return invoke("session_restore", { sessionId });
./src/lib/api/sessions.ts:101:  return invoke("session_add_document", { sessionId, documentId, position });
./src/lib/api/sessions.ts:114:  return invoke("session_remove_document", { sessionId, documentId });
./src/lib/api/sessions.ts:131:  return invoke("session_update_document", {
./src/lib/api/sessions.ts:145:  return invoke("session_touch", { sessionId });
./src/lib/api/library.ts:15:  return invoke('library_add_document', { filePath, title, pageCount });
./src/lib/api/library.ts:19:  return invoke('library_get_document', { id });
./src/lib/api/library.ts:23:  return invoke('library_get_document_by_path', { filePath });
./src/lib/api/library.ts:31:  return invoke('library_list_documents', { orderBy, limit, offset });
./src/lib/api/library.ts:40:  return invoke('library_update_progress', {
./src/lib/api/library.ts:52:  return invoke('library_update_document', { id, ...updates });
./src/lib/api/library.ts:56:  return invoke('library_update_title', { id, title });
./src/lib/api/library.ts:63:  return invoke('library_relocate_document', { id, newFilePath });
./src/lib/api/library.ts:67:  return invoke('library_remove_document', { id });
./src/lib/api/library.ts:71:  return invoke('library_open_document', { id });
./src/lib/api/library.ts:75:  return invoke('library_check_file_exists', { id });
./src/lib/api/settings.ts:23:  return invoke('settings_get_v2', { key });
./src/lib/api/settings.ts:27:  return invoke('settings_set_v2', { key, value });
./src/lib/api/settings.ts:31:  return invoke('settings_get_all_v2');
./src/lib/api/settings.ts:35:  return invoke('settings_delete_v2', { key });
./src/lib/api/settings.ts:41:  return invoke('settings_set_batch_v2', { settings });
./src/lib/api/tts.ts:14:  return invoke('tts_init');
./src/lib/api/tts.ts:18:  return invoke('tts_list_voices');
./src/lib/api/tts.ts:25:  return invoke('tts_speak', { text, interrupt });
./src/lib/api/tts.ts:32:  return invoke('tts_speak_long', { text, interrupt });
./src/lib/api/tts.ts:36:  return invoke('tts_stop');
./src/lib/api/tts.ts:40:  return invoke('tts_pause');
./src/lib/api/tts.ts:44:  return invoke('tts_resume');
./src/lib/api/tts.ts:50:  return invoke('tts_set_voice', { voiceId });
./src/lib/api/tts.ts:54:  return invoke('tts_set_rate', { rate });
./src/lib/api/tts.ts:58:  return invoke('tts_get_state');
./src/lib/api/tts.ts:70:  return invoke('tts_check_capabilities');
./src/lib/api/audio-export.ts:29:  return invoke("audio_export_check_ready", { documentId, voiceId });
./src/lib/api/audio-export.ts:55:  return invoke("audio_export_document", {
./src/lib/api/audio-export.ts:71:  return invoke("audio_export_cancel");
./src/lib/api/ai-tts.ts:60:  return invoke('ai_tts_init', { apiKey });
./src/lib/api/ai-tts.ts:64:  return invoke('ai_tts_list_voices');
./src/lib/api/ai-tts.ts:71:  return invoke('ai_tts_speak', { text, voiceId });
./src/lib/api/ai-tts.ts:83:  return invoke('ai_tts_speak_with_timestamps', { text, voiceId });
./src/lib/api/ai-tts.ts:87:  return invoke('ai_tts_stop');
./src/lib/api/ai-tts.ts:91:  return invoke('ai_tts_pause');
./src/lib/api/ai-tts.ts:95:  return invoke('ai_tts_resume');
./src/lib/api/ai-tts.ts:99:  return invoke('ai_tts_set_voice', { voiceId });
./src/lib/api/ai-tts.ts:103:  return invoke('ai_tts_set_speed', { speed });
./src/lib/api/ai-tts.ts:107:  return invoke('ai_tts_get_state');
./src/lib/api/ai-tts.ts:111:  return invoke('ai_tts_get_config');
./src/lib/api/ai-tts.ts:145:  return invoke('ai_tts_cache_info');
./src/lib/api/ai-tts.ts:152:  return invoke('ai_tts_cache_clear');
./src/lib/api/ai-tts.ts:159:  return invoke('ai_tts_cache_invalidate_voice', { voiceId });
./src/lib/api/ai-tts.ts:174:  return invoke('ai_tts_prebuffer', { text, voiceId });
./src/lib/api/audio-cache.ts:50:  return invoke("audio_cache_get_coverage", { documentId });
./src/lib/api/audio-cache.ts:61:  return invoke("audio_cache_clear_document", { documentId });
./src/lib/api/audio-cache.ts:70:  return invoke("audio_cache_get_stats");
./src/lib/api/audio-cache.ts:81:  return invoke("audio_cache_set_limit", { maxSizeBytes });
./src/lib/api/audio-cache.ts:90:  return invoke("audio_cache_get_limit");
./src/lib/api/audio-cache.ts:103:  return invoke("audio_cache_evict", { targetSizeBytes });
./src/lib/api/audio-cache.ts:156:  return invoke("audio_cache_notify_coverage", { documentId });
./src-tauri/Cargo.lock:4990: "tauri-plugin-fs",
./src-tauri/Cargo.lock:4991: "tauri-plugin-persisted-scope",
./src-tauri/Cargo.lock:5033: "tauri-plugin-fs",
./src-tauri/Cargo.lock:5039:name = "tauri-plugin-fs"
./src-tauri/Cargo.lock:5061:name = "tauri-plugin-persisted-scope"
./src-tauri/Cargo.lock:5072: "tauri-plugin-fs",
./src/lib/api/highlights.ts:19:  return invoke('highlights_create', { ...input });
./src/lib/api/highlights.ts:25:  return invoke('highlights_batch_create', { highlights });
./src/lib/api/highlights.ts:29:  return invoke('highlights_get', { id });
./src/lib/api/highlights.ts:35:  return invoke('highlights_list_for_document', { documentId });
./src/lib/api/highlights.ts:42:  return invoke('highlights_list_for_page', { documentId, pageNumber });
./src/lib/api/highlights.ts:49:  return invoke('highlights_update', { id, ...updates });
./src/lib/api/highlights.ts:53:  return invoke('highlights_delete', { id });
./src/lib/api/highlights.ts:59:  return invoke('highlights_delete_for_document', { documentId });
./src/lib/api/highlights.ts:66:  return invoke('highlights_export', { documentId, format });
./CLAUDE.md:176:**Direct`invoke()`calls are not allowed.** All Tauri IPC must go through:
./.claude/reviews/020-persisted-scope.md:1:# Codex Adversarial Review — 020-persisted-scope (S2)
./.claude/reviews/020-persisted-scope.md:6:- **Scope:**`git diff origin/main...HEAD`—`Cargo.toml`, `Cargo.lock`, `src-tauri/src/lib.rs`. Adds `tauri-plugin-persisted-scope`2.3.5 after`tauri_plugin_fs::init()`.
./.claude/reviews/020-persisted-scope.md:15:- **Local-only / no telemetry** — the persisted scope file lives in app data; no new network path. The plugin self-forbids fs access to its own `.persisted-scope`file after fs init.
./.claude/reviews/020-persisted-scope.md:16:- No new capability permission needed (plugin registers no commands). No secrets, no unrelated diffs, hexagonal boundaries intact, no direct`invoke()`added.
./.claude/reviews/020-persisted-scope.md:19:1. **(FIXED)** The original`lib.rs`comment / commit message said persisted-scope persists "only the exact files the user already opened." Codex: it serializes ALL current`scope.allowed_patterns()`— the static`$APPLOCALDATA/**` plus the runtime per-file grants — not only the picked files. No effective widening (the static pattern was already allowed), but the wording was inaccurate. Corrected in commit `42c1ef8` (comment + message now say "current allowed patterns … introduces no new/broader pattern").
./.claude/reviews/020-persisted-scope.md:24:- No automated state-file inspection test asserting `.persisted-scope` contains only `$APPLOCALDATA/**`+ picked-file grants.
./.claude/reviews/020-persisted-scope.md:26:Build verification (this iteration):`cargo fmt --check`clean,`cargo clippy --all-targets --features test-mocks -- -D warnings`clean,`cargo test --features test-mocks -j 1` → 273+ pass / 0 fail. persisted-scope 2.3.5 resolves against tauri 2.9.5.
./specs/spec.md:45:**Solution**: Use Tauri's asset protocol with `convertFileSrc()` and proper scope configuration.
./specs/011-highlight-store-tests/checklist.md:4:- [x] **No direct `invoke()`** — store actions only; no IPC in the test.
./specs/006-reading-session-audio-cache/plan.md:40:| No direct invoke() calls | PASS | Adapters use `commands` from `@/lib/bindings` |
./specs/006-reading-session-audio-cache/plan.md:44:**Note**: quickstart.md line 229-254 shows a direct `invoke()` example - this must be corrected to use generated bindings during implementation.
./src-tauri/src/lib.rs:295: // persisted-scope MUST init AFTER fs so it can hook the fs plugin's
./specs/006-reading-session-audio-cache/quickstart.md:269:> **IMPORTANT**: Always use generated bindings from `@/lib/bindings` instead of direct `invoke()` calls. This is a non-negotiable rule per the project constitution.
./specs/research.md:97:import { convertFileSrc } from '@tauri-apps/api/core';
./specs/research.md:101: const assetUrl = convertFileSrc(filePath);
./specs/research.md:506:**Mitigation**: Use `convertFileSrc()` consistently, test with paths containing spaces and Unicode.
./specs/research.md:602:| `src/hooks/useHwAccelStatus.ts` | 9, 45, 61 | Direct `invoke()` in hooks layer |
./specs/research.md:603:| `src/components/settings/DebugLogs.tsx` | 54 | Direct `invoke()` in components |
./specs/research.md:768:| `src/lib/api/*.ts` | 73 direct `invoke()` calls | P2 |
./specs/research.md:769:| `src/services/library-service.ts` | Legacy service, 32 `invoke()` calls | P1 |
./specs/023-reduced-motion/spec.md:48:- [x] No direct `invoke()`.
./specs/contracts/tts.contract.md:19:await invoke('tts_init');
./specs/contracts/tts.contract.md:43:await invoke('tts_speak', { text: 'Hello world' });
./specs/contracts/tts.contract.md:74:await invoke('tts_stop');
./specs/contracts/tts.contract.md:92:await invoke('tts_pause');
./specs/contracts/tts.contract.md:112:await invoke('tts_resume');
./specs/contracts/tts.contract.md:130:await invoke('tts_set_rate', { rate: 1.5 });
./specs/contracts/tts.contract.md:158:await invoke('tts_set_voice', { voiceId: 'com.apple.voice.compact.en-US.Samantha' });
./specs/contracts/tts.contract.md:266: await invoke('tts_init');
./specs/contracts/tts.contract.md:271: return await invoke('tts_check_available');
./specs/contracts/tts.contract.md:276: await invoke('tts_speak', { text, interrupt });
./specs/contracts/tts.contract.md:280: await invoke('tts_stop');
./specs/contracts/tts.contract.md:284: await invoke('tts_pause');
./specs/contracts/tts.contract.md:288: await invoke('tts_resume');
./specs/contracts/tts.contract.md:292: await invoke('tts_set_rate', { rate });
./specs/contracts/tts.contract.md:296: await invoke('tts_set_voice', { voiceId });
./specs/contracts/tts.contract.md:300: return await invoke('tts_list_voices');
./specs/contracts/tts.contract.md:304: return await invoke('tts_is_speaking');
./specs/020-persisted-scope/spec.md:14:Add `tauri-plugin-persisted-scope` (2.3.5) to the builder, **after**
./specs/020-persisted-scope/spec.md:31:- `src-tauri/Cargo.toml` — add `tauri-plugin-persisted-scope = "2"` (+ lockfile).
./specs/020-persisted-scope/spec.md:41: -j 1` → 273+ pass / 0 fail. persisted-scope 2.3.5 resolves vs tauri 2.9.5.
./specs/020-persisted-scope/spec.md:43:  (`.claude/reviews/020-persisted-scope.md`). One MINOR (comment accuracy) fixed.
./specs/020-persisted-scope/spec.md:54:data/migration impact; an existing `.persisted-scope`file becomes inert.
./specs/020-persisted-scope/spec.md:59:- [x] No direct`invoke()`: N/A.
./specs/contracts/highlights.contract.md:150:await invoke('highlights_update', {
./specs/contracts/highlights.contract.md:183:await invoke('highlights_delete', { id: 'uuid' });
./specs/contracts/highlights.contract.md:258: return await invoke('highlights_create', input);
./specs/contracts/highlights.contract.md:262: return await invoke('highlights_get', { id });
./specs/contracts/highlights.contract.md:266: return await invoke('highlights_list_for_document', { documentId });
./specs/contracts/highlights.contract.md:270: return await invoke('highlights_list_for_page', { documentId, pageNumber });
./specs/contracts/highlights.contract.md:274: await invoke('highlights_update', { id, ...updates });
./specs/contracts/highlights.contract.md:278: await invoke('highlights_delete', { id });
./specs/contracts/highlights.contract.md:282: return await invoke('highlights_delete_for_document', { documentId });
./specs/015-tts-store-tests/checklist.md:4:- [x] **No direct `invoke()`** — store is pure; no IPC.
./src-tauri/src/commands/library/db.rs:31:/// `tauri-plugin-fs` capability scope. Without this guard a compromised WebView
./src-tauri/src/commands/library/db.rs:32:/// could `invoke("library_add_document", { filePath })` against any path:
./specs/contracts/library.contract.md:135:await invoke('library_update_progress', {
./specs/contracts/library.contract.md:168:await invoke('library_update_document', {
./specs/contracts/library.contract.md:198:await invoke('library_remove_document', { id: 'uuid' });
./specs/contracts/library.contract.md:284: return await invoke('library_add_document', { filePath, title });
./specs/contracts/library.contract.md:288: return await invoke('library_get_document', { id });
./specs/contracts/library.contract.md:292: return await invoke('library_get_document_by_path', { filePath });
./specs/contracts/library.contract.md:300: return await invoke('library_list_documents', { orderBy, limit, offset });
./specs/contracts/library.contract.md:304: await invoke('library_update_progress', { id, currentPage });
./specs/contracts/library.contract.md:311: await invoke('library_update_document', { id, ...updates });
./specs/contracts/library.contract.md:315: await invoke('library_remove_document', { id });
./specs/contracts/library.contract.md:319: return await invoke('library_open_document', { id });
./specs/contracts/library.contract.md:323: return await invoke('library_check_file_exists', { id });
./specs/019-coverage-ratchet/spec.md:57:- [x] No direct `invoke()`: N/A.
./specs/014-settings-store-tests/checklist.md:4:- [x] **No direct `invoke()`** — Tauri IPC mocked; store actions tested via state.
./specs/013-library-store-tests/checklist.md:4:- [x] **No direct `invoke()`** — pure derivation tested; async IPC actions out of scope.
./specs/009-coverage-gate/checklist.md:4:- [x] **No direct `invoke()`** — n/a, no app code touched.
./specs/tasks.md:31:- [X] T002 Configure Rust dependencies in src-tauri/Cargo.toml (tauri, tauri-plugin-sql, tauri-plugin-dialog, tauri-plugin-fs, tts, serde, uuid)
./specs/tasks.md:102:- [X] T035 [US1] Implement asset protocol PDF loading with convertFileSrc in src/services/pdf-service.ts
./specs/024-karaoke-fallback/spec.md:54:- [x] No direct `invoke()`.
./specs/quickstart.md:109:tauri-plugin-fs = "2"
./specs/quickstart.md:314:- [ ] Rust commands can be invoked from frontend (`invoke()`)
./specs/016-cache-coverage-tests/checklist.md:4:- [x] **No direct `invoke()`** — domain has no IPC.
./specs/026-completion-guard/spec.md:54:- [x] No direct `invoke()`.
./specs/008-security-housekeeping/checklist.md:4:- [x] **No direct `invoke()`** — no UI code touched; rule unaffected.
./specs/008-security-housekeeping/checklist.md:10:- [x] **Reopen flow** — `LibraryView` is unmounted; no live reopen path. Every open goes through the picker (runtime grant). fs scope is `$APPLOCALDATA/**`only; persisted-scope is the S2 follow-up if/when reopen is wired.
./specs/checklists/requirements.md:38:- [x] Local file loading approach documented (asset protocol + convertFileSrc)
./specs/002-hexagonal-arch-tdd/spec.md:142:- **FR-016**: System MUST NOT allow raw`invoke("string", {...})`calls outside the command client adapter.
./specs/002-hexagonal-arch-tdd/spec.md:177:- **SC-007**: No raw`invoke()`calls exist outside the command client adapter (verified by grep/lint rule).
./specs/010-word-timing-tests/checklist.md:4:- [x] **No direct`invoke()`** — n/a (backend tests).
./specs/008-security-housekeeping/plan.md:7:this slice (persisted-scope deferred to S2 with its own runtime verification).
./specs/008-security-housekeeping/plan.md:12:`app.security.assetProtocol.scope`: `["**/*"]`->`[]`.
./specs/008-security-housekeeping/plan.md:13:Safe because no code uses `convertFileSrc`/asset protocol (grep-verified).
./specs/008-security-housekeeping/plan.md:18:`fs:scope.allow`: `[{ "path": "**/*" }]`->`[{ "path": "$APPLOCALDATA/**" }]`.
./specs/008-security-housekeeping/plan.md:22:wired path reads a stored original path via plugin-fs. The static scope is thus
./specs/008-security-housekeeping/plan.md:77:- **S2 (next slice):** add `tauri-plugin-persisted-scope`. Cargo dep
./specs/008-security-housekeeping/plan.md:78:  `tauri-plugin-persisted-scope = "2"`; register in `src-tauri/src/lib.rs`./specs/008-security-housekeeping/plan.md:82:- **S3 (optional):** either delete the dead`pdf-storage-service.ts` or wire it
./specs/008-security-housekeeping/risk-register.md:6:| R2 | Reopen-after-restart breaks for out-of-`$HOME` files (USB, `/mnt`, `/tmp`) | Medium | Medium | Documented residual; first-open still works; closed by S2 persisted-scope | Accepted + tracked |
./specs/008-security-housekeeping/risk-register.md:7:| R3 | Empty asset scope breaks PDF/icon/font loading | Very low | High | No `convertFileSrc`/`asset.localhost` in code; worker + fonts load from app origin/bundle, not asset protocol | Mitigated |
./specs/008-security-housekeeping/risk-register.md:21:grant). Reopen wiring + persisted-scope is the S2 follow-up.
./specs/008-security-housekeeping/rollback.md:13:  `src-tauri/capabilities/default.json` `fs:scope.allow` (e.g. add
./specs/008-security-housekeeping/rollback.md:17:  `app.security.assetProtocol.scope` in `src-tauri/tauri.conf.json` to its prior
./specs/017-domain-coverage-tests/checklist.md:4:- [x] **No direct `invoke()`** — domain has no IPC.
./specs/008-security-housekeeping/tasks.md:7:- [x] T002 Verify open/reopen flow + scope usage (no `convertFileSrc`; plugin-fs `readFile` path; dead storage service; `LibraryView` unmounted; library add reads original path in native Rust).
./specs/008-security-housekeeping/tasks.md:8:- [x] T003 Research Tauri v2 dialog scope grant + persisted-scope ordering (HIGH confidence).
./specs/008-security-housekeeping/tasks.md:17:- [x] T030 C1: `tauri.conf.json` `assetProtocol.scope ["**/*"] -> []`.
./specs/008-security-housekeeping/tasks.md:35:- [x] T052 S2 (persisted-scope) + symlink + existence-oracle residuals captured in spec/plan/risk-register.
./specs/025-page-boundary/spec.md:51:- [x] No direct `invoke()`.
./specs/008-security-housekeeping/spec.md:15:   `app.security.assetProtocol.scope = ["**/*"]`. The asset protocol is **never
./specs/008-security-housekeeping/spec.md:16:   used** by app code (no `convertFileSrc`, no `asset.localhost`; PDFs load via
./specs/008-security-housekeeping/spec.md:17:   `plugin-fs` `readFile` -> bytes -> `pdf.js getDocument({data})`). Dead config
./specs/008-security-housekeeping/spec.md:22:   `std::fs` and therefore BYPASS the plugin-fs capability scope entirely.
./specs/008-security-housekeeping/spec.md:35:- Remove the whole-disk fs scope; scope plugin-fs to the app's own data dir.
./specs/008-security-housekeeping/spec.md:39:- Leave a precise, verified plan for the remaining persisted-scope work.
./specs/008-security-housekeeping/spec.md:43:- Wiring the dead `pdf-storage-service.ts` copy-into-app-dir flow (separate slice).
./specs/008-security-housekeeping/spec.md:44:- Adding `tauri-plugin-persisted-scope` (needs a GUI build + restart-reopen test; tracked as S2).
./specs/008-security-housekeeping/spec.md:53:| Render bytes | `pdfService.loadDocument(picked)` -> plugin-fs `readFile(picked)` | plugin-fs | covered by dialog runtime grant — NOT static scope |
./specs/008-security-housekeeping/spec.md:67:- **fs scope** `["**/*"] -> ["$APPLOCALDATA/**"]`. plugin-fs reads of user PDFs
./specs/008-security-housekeeping/spec.md:78:This slice removes whole-disk exposure on the **WebView plugin-fs surface** and
./specs/008-security-housekeeping/spec.md:95:- **S2 (persisted-scope):** if a future slice wires library-click reopen that
./specs/008-security-housekeeping/spec.md:96: reads a stored ORIGINAL path via plugin-fs (no fresh pick), it will need
./specs/008-security-housekeeping/spec.md:97: `tauri-plugin-persisted-scope` (register after `tauri_plugin_fs::init()`,
./specs/008-security-housekeeping/spec.md:120:- [x] `assetProtocol.scope` no longer contains `**/_`.
./specs/021-tts-timestamp-adapter/spec.md:53:- [x] No direct `invoke()`: N/A.
./specs/002-hexagonal-arch-tdd/tasks.md:164:**Goal**: Typed command client with autocomplete and compile-time validation. No raw invoke() calls.
./specs/002-hexagonal-arch-tdd/tasks.md:193:- [X] T067 [US3] Verify grep finds no raw invoke() calls outside adapters: grep -r "invoke(" src/ | grep -v adapters/
./specs/002-hexagonal-arch-tdd/tasks.md:205:**Checkpoint**: All commands have typed wrappers. No raw invoke() outside adapters. Contract tests pass.
./specs/012-release-smoke/checklist.md:4:- [x] **No direct `invoke()`** — n/a.
./specs/022-karaoke-ui/spec.md:49:- [x] No direct `invoke()`: none added.
./specs/007-ui-ux-overhaul/spec.md:164:- **FR-022**: No new direct `invoke()`calls MUST be added to components (preserve hexagonal architecture).
./specs/007-ui-ux-overhaul/spec.md:204:- **No direct`invoke()`calls**: UI layer must use adapters/bindings.
./specs/001-tauri-pdf-tts-reader/contracts/library.contract.md:237:  return invoke('library_open_document', { filePath });
./specs/001-tauri-pdf-tts-reader/contracts/library.contract.md:246:  return invoke('library_get_document', { id });
./specs/001-tauri-pdf-tts-reader/contracts/library.contract.md:255:  return invoke('library_update_progress', {
./specs/001-tauri-pdf-tts-reader/contracts/library.contract.md:264:  await invoke('library_remove_document', { id });
./specs/007-ui-ux-overhaul/plan.md:19:**Constraints**: No direct`invoke()`calls, all`@tauri-apps/plugin-_`access via adapters, WCAG 2.2 Level A minimum  
./specs/007-ui-ux-overhaul/plan.md:29:| **II. Type-Safe Tauri IPC**       | ✅ PASS      | No new`invoke()`calls; existing adapters used                                                       |
./specs/001-tauri-pdf-tts-reader/quickstart.md:103:  return invoke('my_command', { input });
./specs/001-tauri-pdf-tts-reader/contracts/highlights.contract.md:306:  return invoke('highlights_create', input);
./specs/001-tauri-pdf-tts-reader/contracts/highlights.contract.md:344:  return invoke('highlights_update', { id, ...updates });
./specs/001-tauri-pdf-tts-reader/contracts/highlights.contract.md:348:  await invoke('highlights_delete', { id });
./specs/001-tauri-pdf-tts-reader/contracts/highlights.contract.md:355:  return invoke('highlights_export', { documentId, format });
./specs/001-tauri-pdf-tts-reader/contracts/tts.contract.md:325:  return invoke('tts_init');
./specs/001-tauri-pdf-tts-reader/contracts/tts.contract.md:350:  await invoke('tts_stop');
./specs/001-tauri-pdf-tts-reader/contracts/tts.contract.md:354:  return invoke('tts_pause');
./specs/001-tauri-pdf-tts-reader/contracts/tts.contract.md:358:  await invoke('tts_resume');
./specs/001-tauri-pdf-tts-reader/contracts/tts.contract.md:367:  await invoke('tts_set_rate', { rate });
./specs/001-tauri-pdf-tts-reader/contracts/tts.contract.md:371:  return invoke('tts_get_state');
./specs/007-ui-ux-overhaul/ui-spec.md:26:- **Architecture preservation**: UI layer stays thin, no direct`invoke()` calls

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "sed -n '1,130p' package.json && sed -n '1,130p' .github/workflows/ci.yml && sed -n '1,130p' src-tauri/tauri.conf.json && sed -n '1,160p' src-tauri/capabilities/default.json && sed -n '270,320p' src-tauri/src/lib.rs && sed -n '1,180p' src/services/pdf-service.ts && rg -n \"pdfService|loadDocument\\(|library_open_document|openDocument|filePath\" src/components src/stores src/hooks src/services src/application src/adapters src/ports --glob '_.{ts,tsx}'" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
exited 2 in 0ms:
{
"name": "lectrice",
"private": true,
"version": "0.1.0",
"type": "module",
"scripts": {
"dev": "vite",
"build": "tsc && vite build",
"lint": "eslint .",
"lint:boundaries": "eslint --rule 'boundaries/element-types: error' src/",
"preview": "vite preview",
"tauri": "tauri",
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage",
"test:coverage:check": "vitest run --coverage --coverage.thresholds.100 || echo 'Coverage below threshold!'",
"test:arch": "vitest run src/**tests**/architecture/",
"test:rust": "cd src-tauri && cargo test --features test-mocks",
"test:rust:coverage": "cd src-tauri && cargo llvm-cov --features test-mocks",
"knip": "knip",
"typecheck": "tsc --noEmit",
"verify": "./scripts/verify.sh",
"prepare": "husky",
"test:e2e": "wdio run wdio.conf.mjs",
"test:e2e:native": "bash scripts/e2e-native.sh",
"test:e2e:all": "bash scripts/e2e-all.sh"
},
"lint-staged": {
"src/\*\*/_.{ts,tsx}": [
"eslint --fix",
"vitest related --run"
],
"\*.{ts,tsx,js,jsx,json,md}": [
"prettier --write --ignore-unknown"
]
},
"dependencies": {
"@fontsource/ibm-plex-mono": "5.2.7",
"@fontsource/ibm-plex-sans": "5.2.8",
"@fontsource/space-grotesk": "5.2.10",
"@tauri-apps/api": "^2",
"@tauri-apps/plugin-dialog": "^2",
"@tauri-apps/plugin-fs": "^2",
"@tauri-apps/plugin-sql": "^2",
"pdfjs-dist": "^4.10.38",
"react": "^18.3.1",
"react-dom": "^18.3.1",
"zod": "^3.24.1",
"zustand": "^5.0.3"
},
"devDependencies": {
"@eslint/js": "^9.17.0",
"@tauri-apps/cli": "^2",
"@testing-library/jest-dom": "^6.9.1",
"@testing-library/react": "^16.1.0",
"@types/react": "^18.3.18",
"@types/react-dom": "^18.3.5",
"@vitejs/plugin-react": "^4.3.4",
"@vitest/coverage-v8": "^2.1.9",
"@wdio/cli": "9.27.2",
"@wdio/local-runner": "9.27.2",
"@wdio/mocha-framework": "9.27.2",
"@wdio/spec-reporter": "9.27.2",
"archunit": "^2.1.63",
"eslint": "^9.17.0",
"eslint-plugin-boundaries": "^5.3.1",
"eslint-plugin-react": "^7.37.3",
"eslint-plugin-react-hooks": "^5.1.0",
"globals": "^15.14.0",
"husky": "^9.1.7",
"jsdom": "^25.0.1",
"knip": "6.29.0",
"lint-staged": "^16.2.7",
"prettier": "3.8.3",
"typescript": "~5.6.3",
"typescript-eslint": "^8.19.1",
"vite": "^6.0.7",
"vitest": "^2.1.8",
"webdriverio": "9.27.2"
},
"pnpm": {
"onlyBuiltDependencies": [
"esbuild"
]
}
}
name: CI

on:
push:
branches: [main, develop]
pull_request:
branches: [main, develop]

env:
CARGO_TERM_COLOR: always
RUST_BACKTRACE: "1"

jobs:
alignment-gate:
name: Alignment Gate
if: github.event_name == 'pull_request'
runs-on: [self-hosted, Linux, X64, vm103]
timeout-minutes: 5

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # full history for the --base diff

      - name: Run alignment gate (PR diff vs base)
        # Catches completion-theater (TODO/stub in "done" code), skipped/.only
        # tests, added lint-suppressions, debug artifacts — the class no linter
        # sees. Vendored from Pedro's experiments/alignment-gate (Standard —
        # Project Quality & Alignment Enforcement). Zero-dep (git+grep+awk).
        run: ./tools/alignment-gate.sh --base origin/${{ github.base_ref }}

frontend:
name: Frontend Checks
runs-on: [self-hosted, Linux, X64, vm103]
timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Get pnpm store directory
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> "$GITHUB_ENV"

      - name: Setup pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install

      - name: TypeScript check
        run: pnpm typecheck

      - name: ESLint
        run: pnpm lint

      - name: ESLint Boundaries
        run: pnpm lint:boundaries

      - name: Run tests
        run: pnpm test:run

      - name: Architecture tests
        run: pnpm test:arch

      - name: Knip (dead-code detection)
        # Whole-module-graph dead-code gate — catches unused files/exports/deps
        # that tsc/ESLint structurally can't see. #1 agent-slop signature per
        # Pedro's Standard — Project Quality & Alignment Enforcement.
        run: pnpm knip

      - name: Coverage check
        run: pnpm test:coverage

backend:
name: Backend Checks
runs-on: [self-hosted, Linux, X64, vm103]
timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libspeechd-dev libasound2-dev libssl-dev pkg-config clang libclang-dev

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - name: Cache cargo registry
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            src-tauri/target
          key: ${{ runner.os }}-cargo-${{ hashFiles('src-tauri/Cargo.lock') }}
          restore-keys: ${{ runner.os }}-cargo-

      - name: Stub frontend dist (tauri generate_context! reads frontendDist)
        run: |
          mkdir -p dist
          echo '<!doctype html><meta charset="utf-8"><title>Lectrice</title>' > dist/index.html

      - name: Check formatting
        working-directory: src-tauri
        run: cargo fmt --check

      - name: Clippy
        working-directory: src-tauri
        run: cargo clippy -- -D warnings

      - name: Run tests
        working-directory: src-tauri

{
"$schema": "https://schema.tauri.app/config/2",
  "productName": "Lectrice",
  "version": "0.1.0",
  "identifier": "com.lectrice.reader",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "Lectrice",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self' asset: http://asset.localhost; script-src 'self' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' asset: http://asset.localhost blob: data:; connect-src 'self' asset: http://asset.localhost https://cdn.jsdelivr.net; worker-src 'self' blob:",
      "assetProtocol": {
        "enable": true,
        "scope": []
      }
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png"]
  },
  "plugins": {
    "sql": {
      "preload": ["sqlite:pdf-reader.db"]
    }
  }
}
{
  "$schema": "../gen/schemas/desktop-schema.json",
"identifier": "default",
"description": "Default capabilities for Lectrice",
"windows": ["main"],
"permissions": [
"core:default",
"fs:default",
"fs:allow-read-file",
{
"identifier": "fs:scope",
"allow": [{ "path": "$APPLOCALDATA/**" }]
},
"dialog:default",
"dialog:allow-open",
"sql:default",
"sql:allow-execute",
"sql:allow-select",
"shell:allow-open"
]
}
highlights_batch_create,
highlights_list_for_page,
highlights_list_for_document,
highlights_get,
highlights_update,
highlights_delete,
highlights_delete_for_document,
highlights_export,
]);

    // Generate TypeScript bindings in development
    // Using header to disable strict type checking for auto-generated code
    #[cfg(debug_assertions)]
    specta_builder
        .export(
            specta_typescript::Typescript::default().header("// @ts-nocheck\n/* eslint-disable */"),
            "../src/lib/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // persisted-scope MUST init AFTER fs so it can hook the fs plugin's
        // scope. It serializes the fs plugin's CURRENT allowed patterns — the
        // static $APPLOCALDATA/** plus the runtime per-file grants that
        // dialog.open() adds for a picked PDF — and restores them on the next
        // launch, so a library document reopens via readFile(originalPath)
        // without re-prompting. It introduces NO new or broader pattern, so the
        // effective scope is unchanged across restarts (no whole-disk exposure).
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ExportState::new());

    // Register TTS state if feature enabled
    #[cfg(feature = "native-tts")]
    {
        builder = builder.manage(tts::TtsEngine::new());
    }

    // Register AI TTS state if feature enabled
    #[cfg(feature = "elevenlabs-tts")]
    {
        use std::sync::Arc;
        use tokio::sync::RwLock;
        builder = builder.manage(AiTtsEngineState(Arc::new(RwLock::new(
            ai_tts::AiTtsEngine::new(),
        ))));
    }

import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';

// Check if running in Tauri environment
function isTauriAvailable(): boolean {
return typeof window !== 'undefined' &&
'**TAURI_INTERNALS**' in window &&
window.**TAURI_INTERNALS** !== undefined;
}

// Dynamic import for Tauri fs plugin (only in Tauri context)
async function readFileFromTauri(filePath: string): Promise<Uint8Array> {
if (!isTauriAvailable()) {
throw new Error('Not running in Tauri environment. Please use the desktop app to open local files.');
}
const { readFile } = await import('@tauri-apps/plugin-fs');
return readFile(filePath);
}

// Extend Window interface for Tauri
declare global {
interface Window {
**TAURI_INTERNALS**?: unknown;
}
}

// Define TextItem interface for PDF.js text content
interface PdfTextItem {
str: string;
transform: number[];
width: number;
height: number;
}

// Configure PDF.js worker
GlobalWorkerOptions.workerSrc = new URL(
'pdfjs-dist/build/pdf.worker.min.mjs',
import.meta.url
).toString();

export interface PageRenderOptions {
canvas: HTMLCanvasElement;
scale: number;
page: PDFPageProxy;
/\*_ Optional output scale override (for quality modes). If not provided, uses RenderPolicy. _/
outputScale?: number;
}

// Type guard for TextItem
function isTextItem(item: unknown): item is PdfTextItem {
return typeof item === 'object' && item !== null && 'str' in item && 'transform' in item;
}

export interface TextContent {
text: string;
items: Array<{
str: string;
transform: number[];
width: number;
height: number;
}>;
}

/\*\*

- PDF service for loading and rendering PDF documents
  \*/
  export const pdfService = {
  /\*\*
  - Load a PDF document from a local file path
  - Uses Tauri's fs plugin to read the file as binary data
    \*/
    async loadDocument(filePath: string): Promise<PDFDocumentProxy> {
    console.log('[PDF Service] Loading document:', filePath);


      try {
        // Read the file as binary data using Tauri's fs plugin
        console.log('[PDF Service] Reading file with fs plugin...');
        console.log('[PDF Service] Tauri available:', isTauriAvailable());
        const fileData = await readFileFromTauri(filePath);
        console.log('[PDF Service] File read successfully, size:', fileData.byteLength, 'bytes');

        console.log('[PDF Service] Creating PDF document...');
        const loadingTask = getDocument({
          data: fileData,
          // Enable built-in CMap support for better character rendering
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        console.log('[PDF Service] PDF loaded successfully, pages:', pdf.numPages);
        return pdf;
      } catch (error) {
        console.error('[PDF Service] Error loading PDF:', error);
        // Handle common PDF errors
        if (error instanceof Error) {
          console.error('[PDF Service] Error message:', error.message);
          if (error.message.includes('password')) {
            throw new Error('PDF_PASSWORD_REQUIRED: This PDF is password protected');
          }
          if (error.message.includes('Invalid PDF')) {
            throw new Error('PDF_INVALID: The file is not a valid PDF or is corrupted');
          }
          if (error.message.includes('denied') || error.message.includes('permission')) {
            throw new Error('PDF_ACCESS_DENIED: Cannot access the file. Check file permissions.');
          }
        }
        throw error;
      }

  },

/\*\*

- Load a PDF from a URL (for testing/development)
  \*/
  async loadDocumentFromUrl(url: string): Promise<PDFDocumentProxy> {
  const loadingTask = getDocument({
  url,
  cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
  cMapPacked: true,
  });


    return loadingTask.promise;

},

/\*\*

- Get a specific page from a PDF document
  \*/
  async getPage(pdf: PDFDocumentProxy, pageNumber: number): Promise<PDFPageProxy> {
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
  throw new Error(`Invalid page number: ${pageNumber}. Document has ${pdf.numPages} pages.`);
  }
  return pdf.getPage(pageNumber);
  },

/\*\*

- Render a PDF page to a canvas
- Uses the official PDF.js HiDPI approach with transform matrix
- Reference: https://mozilla.github.io/pdf.js/examples/
-
- @param options.canvas - Canvas element to render to
- @param options.scale - Zoom level (1.0 = 100%)
- @param options.page - PDF.js page object
- @param options.outputScale - Optional output scale override (for quality modes)
- @returns RenderTask that can be cancelled
  \*/
  renderPage(options: PageRenderOptions): { promise: Promise<void>; cancel: () => void } {
  const { canvas, scale, page, outputScale: providedOutputScale } = options;


    // Get viewport at the desired scale
    const viewport = page.getViewport({ scale });

    // Support HiDPI screens
    // If outputScale is provided (from RenderPolicy), use it; otherwise use DPR with 2x minimum
    const devicePixelRatio = window.devicePixelRatio || 1;
    const outputScale = providedOutputScale ?? Math.max(devicePixelRatio, 2);

    // Set canvas physical dimensions (scaled for HiDPI)
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);

    // Set canvas CSS dimensions (logical size on screen)
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    // Get hardware-accelerated 2D context with optimal settings
    const context = canvas.getContext('2d', {
      alpha: false,           // Opaque canvas - faster rendering (PDF.js uses opaque background)
      desynchronized: true,   // Direct GPU→display path (critical for Tauri WebView performance)
      willReadFrequently: false, // Keep GPU acceleration enabled
    });
    if (!context) {
      throw new Error('Could not get canvas 2D context');
    }

    // Enable high-quality image rendering
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Create transform matrix for HiDPI rendering
    const transform: [number, number, number, number, number, number] | undefined =
      outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

rg: src/application: No such file or directory (os error 2)
src/ports/document-repository.port.ts:10: filePath: string;
src/ports/document-repository.port.ts:23: filePath: string;
src/ports/document-repository.port.ts:32: add(filePath: string, title?: string, pageCount?: number): Promise<Document>;
src/ports/document-repository.port.ts:42: getByPath(filePath: string): Promise<Document | null>;
src/ports/document-repository.port.ts:77: checkFileExists(filePath: string): Promise<FileExistsResponse>;
src/services/library-service.ts:5: filePath: string;
src/services/library-service.ts:33: file_path: options.filePath,
src/services/library-service.ts:49: async getDocumentByPath(filePath: string): Promise<Document | null> {
src/services/library-service.ts:51: return invoke<Document | null>('library_get_document_by_path', { file_path: filePath });
src/services/library-service.ts:97: async openDocument(id: string): Promise<Document> {
src/services/library-service.ts:98: return invoke<Document>('library_open_document', { id });
src/services/pdf-service.ts:11:async function readFileFromTauri(filePath: string): Promise<Uint8Array> {
src/services/pdf-service.ts:16: return readFile(filePath);
src/services/pdf-service.ts:66:export const pdfService = {
src/services/pdf-service.ts:71: async loadDocument(filePath: string): Promise<PDFDocumentProxy> {
src/services/pdf-service.ts:72: console.log('[PDF Service] Loading document:', filePath);
src/services/pdf-service.ts:78: const fileData = await readFileFromTauri(filePath);
src/hooks/useOpenPdf.ts:15:import { pdfService } from "../services/pdf-service";
src/hooks/useOpenPdf.ts:39: const filePath = selected as string;
src/hooks/useOpenPdf.ts:40: const pdf = await pdfService.loadDocument(filePath);
src/hooks/useOpenPdf.ts:43: let document = await libraryService.getDocumentByPath(filePath);
src/hooks/useOpenPdf.ts:45: document = await libraryService.openDocument(document.id);
src/hooks/useOpenPdf.ts:49: filePath,
src/adapters/tauri/document-repository.adapter.ts:38: filePath: string,
src/adapters/tauri/document-repository.adapter.ts:43: filePath,
src/adapters/tauri/document-repository.adapter.ts:56: async getByPath(filePath: string): Promise<Document | null> {
src/adapters/tauri/document-repository.adapter.ts:57: const result = await commands.libraryGetDocumentByPath(filePath);
src/adapters/tauri/document-repository.adapter.ts:106: async checkFileExists(filePath: string): Promise<FileExistsResponse> {
src/adapters/tauri/document-repository.adapter.ts:107: // Note: The binding command uses document ID, but our port expects filePath
src/adapters/tauri/document-repository.adapter.ts:109: const doc = await this.getByPath(filePath);
src/adapters/tauri/document-repository.adapter.ts:111: return { exists: false, filePath };
src/hooks/useKeyboardShortcuts.ts:4:import { pdfService } from "../services/pdf-service";
src/hooks/useKeyboardShortcuts.ts:58: const filePath = selected as string;
src/hooks/useKeyboardShortcuts.ts:59: const pdf = await pdfService.loadDocument(filePath);
src/hooks/useKeyboardShortcuts.ts:62: let document = await libraryService.getDocumentByPath(filePath);
src/hooks/useKeyboardShortcuts.ts:65: document = await libraryService.openDocument(document.id);
src/hooks/useKeyboardShortcuts.ts:69: filePath,
src/adapters/mock/document-repository.adapter.ts:17: filePath: string,
src/adapters/mock/document-repository.adapter.ts:25: filePath,
src/adapters/mock/document-repository.adapter.ts:43: async getByPath(filePath: string): Promise<Document | null> {
src/adapters/mock/document-repository.adapter.ts:45: if (doc.filePath === filePath) {
src/adapters/mock/document-repository.adapter.ts:127: const updated: Document = { ...doc, filePath: newPath };
src/adapters/mock/document-repository.adapter.ts:136: async checkFileExists(filePath: string): Promise<FileExistsResponse> {
src/adapters/mock/document-repository.adapter.ts:138: return { exists: true, filePath };
src/hooks/useTtsPrebuffer.ts:12:import { pdfService } from '../services/pdf-service';
src/hooks/useTtsPrebuffer.ts:58: const page = await pdfService.getPage(pdfDocument, pageNum);
src/stores/library-store.ts:145: d.filePath.toLowerCase().includes(query)
src/components/Toolbar.tsx:4:import { pdfService } from "../services/pdf-service";
src/components/Toolbar.tsx:52: const filePath = selected as string;
src/components/Toolbar.tsx:55: const pdf = await pdfService.loadDocument(filePath);
src/components/Toolbar.tsx:59: const existingResult = await commands.libraryGetDocumentByPath(filePath);
src/components/Toolbar.tsx:73: filePath,
src/components/Toolbar.tsx:159: <span className="document-title" title={currentDocument.filePath}>
src/components/dialogs/ExportDialog.tsx:48: const filePath = await saveFile({
src/components/dialogs/ExportDialog.tsx:55: if (filePath) {
src/components/dialogs/ExportDialog.tsx:58: await writeTextFile(filePath, result.content);
src/components/reader/ReaderView.tsx:8:import { pdfService } from "../../services/pdf-service";
src/components/reader/ReaderView.tsx:88: const page = await pdfService.getPage(pdfDocument, currentPage);
src/components/pdf-viewer/PdfPage.tsx:3:import { pdfService } from '../../services/pdf-service';
src/components/pdf-viewer/PdfPage.tsx:116: const renderTask = pdfService.renderPage({
src/components/pdf-viewer/PdfPage.tsx:129: const textContent = await pdfService.getPageText(page);
src/components/export-dialog/AudioExportDialog.tsx:110: const filePath = await saveFile({
src/components/export-dialog/AudioExportDialog.tsx:115: if (!filePath) {
src/components/export-dialog/AudioExportDialog.tsx:124: filePath,
src/components/playback-bar/AiPlaybackBar.tsx:8:import { pdfService } from "../../services/pdf-service";
src/components/playback-bar/AiPlaybackBar.tsx:70: const page = await pdfService.getPage(pdfDocument, pageNum);
src/components/library/DocumentCard.tsx:67: const parts = document.filePath.split(/[/\\]/);
src/components/library/DocumentCard.tsx:68: return parts[parts.length - 1] || document.filePath;
src/components/library/DocumentCard.tsx:69: }, [document.filePath]);
src/components/library/DocumentCard.tsx:90: <span className="document-card-path" title={document.filePath}>
src/components/session-menu/CreateSessionDialog.tsx:191: {doc.title || doc.filePath.split("/").pop()}
src/components/sidebar/TableOfContents.tsx:3:import { pdfService, OutlineItem } from '../../services/pdf-service';
src/components/sidebar/TableOfContents.tsx:23: const pdfOutline = await pdfService.getOutline(pdfDocument);
src/components/PdfViewer.tsx:6:import { pdfService } from "../services/pdf-service";
src/components/PdfViewer.tsx:233: const page = await pdfService.getPage(pdfDocument, currentPage);
src/components/PdfViewer.tsx:528: const hasText = await pdfService.hasTextLayer(pdfDocument);

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc 'git remote -v' in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
origin git@github.com:phsb5321/Tauri-PDF-Reader.git (fetch)
origin git@github.com:phsb5321/Tauri-PDF-Reader.git (push)

mcp: codex_apps/github.get_pr_info started
mcp: codex_apps/github.get_pr_info (completed)
codex
The PR body exposes the core acceptance claim: “the gate catches” five classes, but its sole proof is that it exits 0 on this clean PR. I’m validating both positive behavior and negative-control coverage; a clean self-pass cannot prove a detector rejects bad input.
hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc './tools/alignment-gate.sh --base origin/main' in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
mktemp: failed to create directory via template ‘/tmp/tmp.XXXXXXXXXX’: Read-only file system
./tools/alignment-gate.sh: line 58: /stream: Read-only file system
./tools/alignment-gate.sh: line 82: /stream: Read-only file system
cut: /stream: No such file or directory
./tools/alignment-gate.sh: line 99: /findings: Read-only file system
./tools/alignment-gate.sh: line 100: /stream: No such file or directory
./tools/alignment-gate.sh: line 100: /stream: No such file or directory
./tools/alignment-gate.sh: line 100: /stream: No such file or directory
./tools/alignment-gate.sh: line 100: /stream: No such file or directory
./tools/alignment-gate.sh: line 100: /stream: No such file or directory
./tools/alignment-gate.sh: line 100: /stream: No such file or directory
./tools/alignment-gate.sh: line 100: /stream: No such file or directory
── alignment gate ─────────────────────────────
scanned: 0 changed code file(s) · 0 error(s) · 0 warning(s)
───────────────────────────────────────────────
✓ PASS — no completion-theater or scope violations over threshold.

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc 'pnpm knip' in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
exited 1 in 2105ms:

> lectrice@0.1.0 knip /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
> knip

Unused files (54)
src/adapters/tauri/document-repository.adapter.ts
src/adapters/tauri/highlight-repository.adapter.ts
src/adapters/tauri/index.ts  
src/adapters/tauri/session.adapter.ts  
src/adapters/tauri/tts.adapter.ts  
src/components/audio-progress/index.ts  
src/components/dialogs/ExportDialog.tsx  
src/components/dialogs/index.ts  
src/components/highlights/HighlightsPanel.tsx  
src/components/highlights/NoteEditor.tsx  
src/components/layout/index.ts  
src/components/library/DocumentCard.tsx  
src/components/library/index.ts  
src/components/library/LibraryView.tsx  
src/components/library/SearchBar.tsx  
src/components/pdf-viewer/HighlightContextMenu.tsx
src/components/pdf-viewer/index.ts  
src/components/pdf-viewer/PdfPage.tsx  
src/components/pdf-viewer/TtsHighlight.tsx  
src/components/playback-bar/ChunkNavigation.tsx  
src/components/playback-bar/index.ts  
src/components/playback-bar/PlaybackBar.tsx  
src/components/playback-bar/SpeedSlider.tsx  
src/components/playback-bar/VoiceSelector.tsx  
src/components/reader/index.ts  
src/components/session-menu/index.ts  
src/components/settings/CacheSettings.tsx  
src/components/settings/DebugLogs.tsx  
src/components/settings/HighlightSettings.tsx  
src/components/settings/index.ts  
src/components/settings/KeyboardShortcuts.tsx  
src/components/settings/RenderSettings.tsx  
src/components/settings/SettingsPanel.tsx  
src/components/settings/TelemetrySettings.tsx  
src/components/settings/ThemeToggle.tsx  
src/components/settings/TtsSettings.tsx  
src/components/sidebar/index.ts  
src/components/sidebar/TableOfContents.tsx  
src/domain/cache/index.ts  
src/domain/errors.ts  
src/domain/export/index.ts  
src/domain/sessions/index.ts  
src/hooks/useFollowAlong.ts  
src/hooks/useHwAccelStatus.ts  
src/hooks/useKeyboardShortcuts.ts  
src/hooks/usePageCache.ts  
src/hooks/useRenderSettings.ts  
src/hooks/useTextSelection.ts  
src/hooks/useTheme.ts  
src/hooks/useTtsEvents.ts  
src/lib/pdf.ts  
src/ports/audio-cache-repository.ts  
src/ports/session-repository.ts  
src/ui/components/index.ts  
Unused dependencies (3)
@fontsource/ibm-plex-mono package.json:38:6
@fontsource/ibm-plex-sans package.json:39:6
@fontsource/space-grotesk package.json:40:6
Unused devDependencies (4)
@wdio/local-runner package.json:61:6
@wdio/mocha-framework package.json:62:6
@wdio/spec-reporter package.json:63:6
webdriverio package.json:79:6
Duplicate exports (2)
DebugOverlay|default src/components/settings/DebugOverlay.tsx
RenderSettingsSchema|GetRenderSettingsResponseSchema src/domain/rendering/types.ts  
Configuration hints (31)
. (root) knip.json Add entry and/or refine project files (54 unused files)
src/lib/bindings.ts knip.json Remove from ignore  
src-tauri/gen/** knip.json Remove from ignore  
src-tauri/src/lib.rs knip.json Remove from ignore  
specs/** knip.json Remove from ignore  
docs/** knip.json Remove from ignore  
scripts/** knip.json Remove from ignore  
tools/** knip.json Remove from ignore  
e2e/** knip.json Remove from ignore  
tests/** knip.json Remove from ignore  
src/**tests**/** knip.json Remove from ignore  
...2 more similar hints  
@tauri-apps/cli knip.json Remove from ignoreDependencies  
husky knip.json Remove from ignoreDependencies  
lint-staged knip.json Remove from ignoreDependencies  
@vitejs/plugin-react knip.json Remove from ignoreDependencies  
@testing-library/jest-dom knip.json Remove from ignoreDependencies  
@types/react knip.json Remove from ignoreDependencies  
@types/react-dom knip.json Remove from ignoreDependencies  
archunit knip.json Remove from ignoreDependencies  
esbuild knip.json Remove from ignoreDependencies  
globals knip.json Remove from ignoreDependencies  
...1 more similar hints  
tauri knip.json Remove from ignoreBinaries  
cargo-tauri knip.json Remove from ignoreBinaries  
husky knip.json Remove from ignoreBinaries  
tsx knip.json Remove from ignoreBinaries  
@/.\* knip.json Remove from ignoreUnresolved  
src/main.tsx knip.json Remove redundant entry pattern  
.rs knip.json Extension in project not registered as a compiler  
 ELIFECYCLE  Command failed with exit code 1.

mcp: codex_apps/github.get_commit_combined_status started
mcp: codex_apps/github.get_commit_combined_status (completed)
codex
Two concrete blockers are now reproduced:

- `pnpm knip` exits 1 with 54 unused files, 7 unused dependencies, duplicate exports, and an unsupported `.rs` project-extension warning, so the newly added required frontend CI step is red at the proposed head.
- When temporary-workspace creation fails, `alignment-gate.sh` prints filesystem errors but still exits 0 and declares PASS. The detector is fail-open because setup errors are unchecked.

I’m checking the remaining configuration/behavior claims for independent majors and test gaps.
hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "git grep -n -E 'copyPdfToStorage|pdfExistsInStorage|readPdfFromStorage|getStoragePath' origin/main -- ':"'!docs'"' ':"'!specs'"' || true
git log --all --oneline -S'copyPdfToStorage' -- src/services/pdf-storage-service.ts
sed -n '1,240p' src/App.tsx
sed -n '1,150p' src/hooks/useOpenPdf.ts
sed -n '1,130p' src/components/Toolbar.tsx
sed -n '1,170p' src/components/library/LibraryView.tsx
sed -n '1,140p' src/components/library/DocumentCard.tsx
rg -n \"LibraryView|DocumentCard|onDocument|library\" src/App.tsx src/components --glob '\*.{ts,tsx}'" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 133ms:
a99c600 feat: implement Hexagonal Architecture, UI polish, and PDF rendering improvements (#2)
import { ReaderView } from './components/reader/ReaderView';
import './styles/App.css';

function App() {
return <ReaderView />;
}

export default App;
/\*\*

- useOpenPdf Hook
-
- The open-a-PDF flow as a reusable hook: pick a file, load it, register or
- refresh it in the library, and push it into the document store. Shared so the
- toolbar button and the native File -> Open menu item trigger identical
- behavior. Mirrors the flow in `Toolbar` / `useKeyboardShortcuts`.
-
- @module hooks/useOpenPdf
  \*/

import { useCallback } from "react";
import { useFileDialog, FILE_FILTERS } from "./useFileDialog";
import { useDocumentStore } from "../stores/document-store";
import { pdfService } from "../services/pdf-service";
import { libraryService } from "../services/library-service";

/\*_ Provides `openPdf`, the shared open-document action. _/
export function useOpenPdf() {
const { openFile } = useFileDialog();
const { setDocument, setPdfDocument, setLoading, setError, setCurrentPage } =
useDocumentStore();

const openPdf = useCallback(async () => {
try {
setLoading(true);
setError(null);

      const selected = await openFile({
        multiple: false,
        filters: [FILE_FILTERS.PDF],
      });

      // User cancelled the dialog.
      if (!selected) {
        return;
      }

      const filePath = selected as string;
      const pdf = await pdfService.loadDocument(filePath);
      setPdfDocument(pdf);

      let document = await libraryService.getDocumentByPath(filePath);
      if (document) {
        document = await libraryService.openDocument(document.id);
        setCurrentPage(document.currentPage);
      } else {
        document = await libraryService.addDocument({
          filePath,
          pageCount: pdf.numPages,
        });
      }

      setDocument(document);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to open PDF";
      setError(message);
      console.error("Error opening PDF:", error);
    } finally {
      setLoading(false);
    }

}, [
openFile,
setDocument,
setPdfDocument,
setLoading,
setError,
setCurrentPage,
]);

return { openPdf };
}
import { useState, useRef } from "react";
import { useFileDialog, FILE_FILTERS } from "../hooks/useFileDialog";
import { useDocumentStore } from "../stores/document-store";
import { pdfService } from "../services/pdf-service";
import { commands } from "../lib/bindings";
import { useRovingTabindex } from "../hooks/useRovingTabindex";
import { PageNavigation } from "./PageNavigation";
import { ZoomControls } from "./ZoomControls";
import { SessionMenu } from "./session-menu/SessionMenu";
import "./Toolbar.css";

export function Toolbar() {
const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
const { openFile } = useFileDialog();
const toolbarRef = useRef<HTMLDivElement>(null);

// Roving tabindex for keyboard navigation within the toolbar
const { getItemProps } = useRovingTabindex({
containerRef: toolbarRef,
itemSelector: "button:not([disabled])",
orientation: "horizontal",
loop: true,
});

const {
currentDocument,
pdfDocument,
isLoading,
setDocument,
setPdfDocument,
setLoading,
setError,
setCurrentPage,
} = useDocumentStore();

const handleOpenFile = async () => {
try {
setLoading(true);
setError(null);

      // Open file dialog for PDF selection
      const selected = await openFile({
        multiple: false,
        filters: [FILE_FILTERS.PDF],
      });

      if (!selected) {
        setLoading(false);
        return;
      }

      const filePath = selected as string;

      // Load the PDF document
      const pdf = await pdfService.loadDocument(filePath);
      setPdfDocument(pdf);

      // Check if document exists in library (using tauri-specta generated bindings)
      const existingResult = await commands.libraryGetDocumentByPath(filePath);
      let document =
        existingResult.status === "ok" ? existingResult.data : null;

      if (document) {
        // Document exists, mark as opened and restore progress
        const openResult = await commands.libraryOpenDocument(document.id);
        if (openResult.status === "ok") {
          document = openResult.data;
          setCurrentPage(document.currentPage);
        }
      } else {
        // New document, add to library
        const addResult = await commands.libraryAddDocument(
          filePath,
          null,
          pdf.numPages,
        );
        if (addResult.status === "error") {
          throw new Error(addResult.error);
        }
        document = addResult.data;
      }

      // Update page count if it wasn't set
      if (!document.pageCount) {
        await commands.libraryUpdateDocument(
          document.id,
          null,
          pdf.numPages,
          null,
        );
        document = { ...document, pageCount: pdf.numPages };
      }

      setDocument(document);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to open PDF";
      setError(message);
      console.error("Error opening PDF:", error);
    } finally {
      setLoading(false);
    }

};

const handleSessionRestored = () => {
// Close the session menu after restoring
setIsSessionMenuOpen(false);
// TODO: Open documents from the restored session
};

return (
<>
<div
        className="toolbar"
        ref={toolbarRef}
        role="toolbar"
        aria-label="Document toolbar"
      >
<div className="toolbar-section toolbar-left">
<button
type="button"
className="toolbar-button sessions-button"
onClick={() => setIsSessionMenuOpen((open) => !open)}
title="Reading Sessions"
aria-pressed={isSessionMenuOpen}
{...getItemProps(0)} >
<svg
viewBox="0 0 24 24"
className="toolbar-icon"
import { useEffect, useCallback } from "react";
import { useLibraryStore } from "../../stores/library-store";
import { DocumentCard } from "./DocumentCard";
import { SearchBar } from "./SearchBar";
import { EmptyState } from "../../ui/components/EmptyState/EmptyState";
import type { Document } from "../../lib/schemas";
import "./LibraryView.css";

interface LibraryViewProps {
onDocumentSelect: (document: Document) => void;
}

export function LibraryView({ onDocumentSelect }: LibraryViewProps) {
const {
isLoading,
error,
viewMode,
sortOrder,
loadDocuments,
setSearchQuery,
setSortOrder,
setViewMode,
getFilteredDocuments,
removeDocument,
selectedDocumentId,
setSelectedDocument,
} = useLibraryStore();

const documents = getFilteredDocuments();

// Load documents on mount
useEffect(() => {
loadDocuments();
}, [loadDocuments]);

const handleDocumentClick = useCallback(
(document: Document) => {
setSelectedDocument(document.id);
},
[setSelectedDocument],
);

const handleDocumentOpen = useCallback(
(document: Document) => {
onDocumentSelect(document);
},
[onDocumentSelect],
);

const handleDocumentDelete = useCallback(
async (documentId: string) => {
if (window.confirm("Remove this document from the library?")) {
try {
await removeDocument(documentId);
} catch (error) {
console.error("Failed to remove document:", error);
}
}
},
[removeDocument],
);

if (isLoading) {
return (
<div className="library-view library-view--loading">
<div className="loading-spinner" />
<p>Loading library...</p>
</div>
);
}

if (error) {
return (
<div className="library-view library-view--error">
<div className="error-message">
<span className="error-icon">!</span>
<p>{error}</p>
<button onClick={loadDocuments}>Retry</button>
</div>
</div>
);
}

return (
<div className="library-view">
<div className="library-header">
<h1 className="library-title">Library</h1>
<div className="library-controls">
<SearchBar onSearch={setSearchQuery} />
<div className="library-sort">
<label htmlFor="sort-select">Sort:</label>
<select
id="sort-select"
value={sortOrder}
onChange={(e) =>
setSortOrder(e.target.value as "recent" | "created" | "title")
} >
<option value="recent">Recently Opened</option>
<option value="created">Date Added</option>
<option value="title">Title</option>
</select>
</div>
<div className="library-view-toggle">
<button
className={`view-button ${viewMode === "grid" ? "active" : ""}`}
onClick={() => setViewMode("grid")}
title="Grid view"
aria-label="Grid view" >
<GridIcon />
</button>
<button
className={`view-button ${viewMode === "list" ? "active" : ""}`}
onClick={() => setViewMode("list")}
title="List view"
aria-label="List view" >
<ListIcon />
</button>
</div>
</div>
</div>

      {documents.length === 0 ? (
        <EmptyState
          title="No recent documents"
          description="Open a PDF to add it to your library"
          icon={<DocumentIcon />}
        />
      ) : (
        <div className={`library-grid library-grid--${viewMode}`}>
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              isSelected={selectedDocumentId === document.id}
              viewMode={viewMode}
              onClick={() => handleDocumentClick(document)}
              onDoubleClick={() => handleDocumentOpen(document)}
              onDelete={() => handleDocumentDelete(document.id)}
            />
          ))}
        </div>
      )}
    </div>

);
}

function GridIcon() {
return (
<svg viewBox="0 0 16 16" className="icon" aria-hidden="true">
<path
        d="M1 1h5v5H1V1zm0 6h5v5H1V7zm6-6h5v5H7V1zm0 6h5v5H7V7z"
        fill="currentColor"
      />
</svg>
);
}

function ListIcon() {
return (
<svg viewBox="0 0 16 16" className="icon" aria-hidden="true">
<path
        d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z"
        fill="currentColor"
      />
</svg>
);
}
import { useState, useCallback, useMemo } from 'react';
import type { Document } from '../../lib/schemas';
import type { ViewMode } from '../../stores/library-store';
import './DocumentCard.css';

interface DocumentCardProps {
document: Document;
isSelected: boolean;
viewMode: ViewMode;
onClick: () => void;
onDoubleClick: () => void;
onDelete: () => void;
}

export function DocumentCard({
document,
isSelected,
viewMode,
onClick,
onDoubleClick,
onDelete,
}: DocumentCardProps) {
const [showContextMenu, setShowContextMenu] = useState(false);
const [fileExists] = useState<boolean | null>(null);

// Calculate progress percentage
const progress = useMemo(() => {
if (!document.pageCount || document.pageCount <= 0) return 0;
return Math.round((document.currentPage / document.pageCount) \* 100);
}, [document.currentPage, document.pageCount]);

// Format date for display
const lastOpened = useMemo(() => {
if (!document.lastOpenedAt) return 'Never';
try {
const date = new Date(document.lastOpenedAt);
return date.toLocaleDateString(undefined, {
month: 'short',
day: 'numeric',
year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
});
} catch {
return 'Unknown';
}
}, [document.lastOpenedAt]);

const handleContextMenu = useCallback((e: React.MouseEvent) => {
e.preventDefault();
setShowContextMenu(true);
}, []);

const handleCloseContextMenu = useCallback(() => {
setShowContextMenu(false);
}, []);

const handleDelete = useCallback(
(e: React.MouseEvent) => {
e.stopPropagation();
handleCloseContextMenu();
onDelete();
},
[onDelete, handleCloseContextMenu]
);

// Get file name from path
const fileName = useMemo(() => {
const parts = document.filePath.split(/[/\\]/);
return parts[parts.length - 1] || document.filePath;
}, [document.filePath]);

if (viewMode === 'list') {
return (
<div
className={`document-card document-card--list ${isSelected ? 'selected' : ''} ${fileExists === false ? 'missing' : ''}`}
onClick={onClick}
onDoubleClick={onDoubleClick}
onContextMenu={handleContextMenu}
role="button"
tabIndex={0}
onKeyDown={(e) => {
if (e.key === 'Enter') onDoubleClick();
if (e.key === ' ') onClick();
}} >
<div className="document-card-icon">
<PdfIcon />
</div>
<div className="document-card-info">
<span className="document-card-title">{document.title || fileName}</span>
<span className="document-card-path" title={document.filePath}>
{fileName}
</span>
</div>
<div className="document-card-meta">
<span className="document-card-pages">
{document.currentPage}/{document.pageCount || '?'} pages
</span>
<span className="document-card-date">{lastOpened}</span>
</div>
<div className="document-card-progress">
<div className="progress-bar">
<div className="progress-fill" style={{ width: `${progress}%` }} />
</div>
<span className="progress-text">{progress}%</span>
</div>
<button
          className="document-card-delete"
          onClick={handleDelete}
          title="Remove from library"
          aria-label="Remove from library"
        >
<DeleteIcon />
</button>
</div>
);
}

return (
<div
className={`document-card document-card--grid ${isSelected ? 'selected' : ''} ${fileExists === false ? 'missing' : ''}`}
onClick={onClick}
onDoubleClick={onDoubleClick}
onContextMenu={handleContextMenu}
role="button"
tabIndex={0}
onKeyDown={(e) => {
if (e.key === 'Enter') onDoubleClick();
if (e.key === ' ') onClick();
}} >
<div className="document-card-thumbnail">
<PdfIcon />
{progress > 0 && (
<div className="document-card-progress-badge">{progress}%</div>
)}
</div>
<div className="document-card-content">
<h3 className="document-card-title" title={document.title || fileName}>
{document.title || fileName}
</h3>
src/components/Toolbar.tsx:58: // Check if document exists in library (using tauri-specta generated bindings)
src/components/Toolbar.tsx:59: const existingResult = await commands.libraryGetDocumentByPath(filePath);
src/components/Toolbar.tsx:65: const openResult = await commands.libraryOpenDocument(document.id);
src/components/Toolbar.tsx:71: // New document, add to library
src/components/Toolbar.tsx:72: const addResult = await commands.libraryAddDocument(
src/components/Toolbar.tsx:85: await commands.libraryUpdateDocument(
src/components/PageNavigation.tsx:26: const result = await commands.libraryUpdateProgress(
src/components/session-menu/CreateSessionDialog.tsx:11:import { useLibraryStore } from "../../stores/library-store";
src/components/session-menu/CreateSessionDialog.tsx:172: No documents in library
src/components/library/SearchBar.tsx:9:export function SearchBar({ onSearch, placeholder = 'Search library...' }: SearchBarProps) {
src/components/library/SearchBar.tsx:65: aria-label="Search library"
src/components/library/LibraryView.tsx:2:import { useLibraryStore } from "../../stores/library-store";
src/components/library/LibraryView.tsx:3:import { DocumentCard } from "./DocumentCard";
src/components/library/LibraryView.tsx:7:import "./LibraryView.css";
src/components/library/LibraryView.tsx:9:interface LibraryViewProps {
src/components/library/LibraryView.tsx:10: onDocumentSelect: (document: Document) => void;
src/components/library/LibraryView.tsx:13:export function LibraryView({ onDocumentSelect }: LibraryViewProps) {
src/components/library/LibraryView.tsx:45: onDocumentSelect(document);
src/components/library/LibraryView.tsx:47: [onDocumentSelect],
src/components/library/LibraryView.tsx:52: if (window.confirm("Remove this document from the library?")) {
src/components/library/LibraryView.tsx:65: <div className="library-view library-view--loading">
src/components/library/LibraryView.tsx:67: <p>Loading library...</p>
src/components/library/LibraryView.tsx:74: <div className="library-view library-view--error">
src/components/library/LibraryView.tsx:85: <div className="library-view">
src/components/library/LibraryView.tsx:86: <div className="library-header">
src/components/library/LibraryView.tsx:87: <h1 className="library-title">Library</h1>
src/components/library/LibraryView.tsx:88: <div className="library-controls">
src/components/library/LibraryView.tsx:90: <div className="library-sort">
src/components/library/LibraryView.tsx:104: <div className="library-view-toggle">
src/components/library/LibraryView.tsx:128: description="Open a PDF to add it to your library"
src/components/library/LibraryView.tsx:132: <div className={`library-grid library-grid--${viewMode}`}>
src/components/library/LibraryView.tsx:134: <DocumentCard
src/components/common/LoadingState.tsx:60: \* Skeleton for document card in library view
src/components/common/LoadingState.tsx:62:export function DocumentCardSkeleton() {
src/components/library/index.ts:1:export { LibraryView } from './LibraryView';
src/components/library/index.ts:2:export { DocumentCard } from './DocumentCard';
src/components/library/DocumentCard.tsx:3:import type { ViewMode } from '../../stores/library-store';
src/components/library/DocumentCard.tsx:4:import './DocumentCard.css';
src/components/library/DocumentCard.tsx:6:interface DocumentCardProps {
src/components/library/DocumentCard.tsx:15:export function DocumentCard({
src/components/library/DocumentCard.tsx:22:}: DocumentCardProps) {
src/components/library/DocumentCard.tsx:109: title="Remove from library"
src/components/library/DocumentCard.tsx:110: aria-label="Remove from library"
src/components/library/DocumentCard.tsx:154: title="Remove from library"
src/components/library/DocumentCard.tsx:155: aria-label="Remove from library"
src/components/common/index.ts:4: DocumentCardSkeleton,

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "rg -n \"coverage|threshold|all:\" vite.config._ vitest.config._ package.json scripts .github --glob '\*.{ts,js,mjs,cjs,json,sh,yml,yaml}' && sed -n '1,240p' vite.config.ts 2>/dev/null || true && sed -n '1,240p' vitest.config.ts 2>/dev/null || true && git diff --check origin/main...HEAD && git diff --numstat origin/main...HEAD" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
package.json:15: "test:coverage": "vitest run --coverage",
package.json:16: "test:coverage:check": "vitest run --coverage --coverage.thresholds.100 || echo 'Coverage below threshold!'",
package.json:19: "test:rust:coverage": "cd src-tauri && cargo llvm-cov --features test-mocks",
package.json:59: "@vitest/coverage-v8": "^2.1.9",
vitest.config.ts:23: coverage: {
vitest.config.ts:34: // their own functions drag the coverage denominator below the ratchet.
vitest.config.ts:39: // as e2e/\*\* — test infrastructure, excluded from the coverage denominator.
vitest.config.ts:43: // Coverage ratchet — last raised by 019-coverage-ratchet (2026-05-31).
vitest.config.ts:45: // an aspirational 80%. They act as a REGRESSION gate — coverage may not
vitest.config.ts:49: // Policy + ratchet history: docs/coverage-budget.md.
vitest.config.ts:58: // real code, not lost coverage. Documented, not silent. Follow-up to push
vitest.config.ts:60: thresholds: {
.github/workflows/ci.yml:86: run: pnpm test:coverage
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
plugins: [react()],

// Prevent Vite from obscuring Rust errors
clearScreen: false,

server: {
// Tauri expects a fixed port, fail if that port is not available
strictPort: true,
host: host || false,
port: 1420,
},

// Required for PDF.js worker handling
optimizeDeps: {
exclude: ['pdfjs-dist'],
},

// Env variables starting with TAURI* are exposed to the client
envPrefix: ['VITE*', 'TAURI\_'],

build: {
// Tauri uses Chromium on Windows and WebKit on macOS and Linux
target:
process.env.TAURI_ENV_PLATFORM === 'windows'
? 'chrome105'
: 'safari14',
// Don't minify for debug builds
minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
// Produce sourcemaps for debug builds
sourcemap: !!process.env.TAURI_ENV_DEBUG,
},
});
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
plugins: [react()],
test: {
globals: true,
environment: "jsdom",
setupFiles: ["./tests/setup.ts"],
include: [
"src/**/*.{test,spec}.{ts,tsx}",
"tests/**/*.{test,spec}.{ts,tsx}",
// mockIPC headless E2E rung (jsdom, CI-runnable). The tauri-driver real
// E2E lives in e2e/*.e2e.mjs and runs via wdio, never vitest.
"e2e/**/*.spec.ts",
],
exclude: ["node_modules", "dist", "src-tauri"],
// Performance: Domain tests should complete quickly without external dependencies
// Fail if any individual test takes longer than 5 seconds
testTimeout: 5000,
// Fail if the entire test suite takes too long (indicates test pollution)
hookTimeout: 10000,
coverage: {
provider: "v8",
reporter: ["text", "json", "html", "lcov"],
exclude: [
"node_modules",
"dist",
"src-tauri",
"**/*.d.ts",
"**/*.config.*",
"**/tests/**",
// E2E specs are test infrastructure, not source-under-test — don't let
// their own functions drag the coverage denominator below the ratchet.
"e2e/**",
"src/main.tsx",
// E2E-only bootstrap shim (VITE_E2E_NATIVE): drives the real play path for
// the tauri-driver native-play E2E, never imported by vitest. Same class
// as e2e/** — test infrastructure, excluded from the coverage denominator.
"src/e2e-native-bootstrap.ts",
"src/vite-env.d.ts",
],
// Coverage ratchet — last raised by 019-coverage-ratchet (2026-05-31).
// Floors are pinned just under the MEASURED baseline at this commit, not
// an aspirational 80%. They act as a REGRESSION gate — coverage may not
// drop below the floor — and MUST be ratcheted UP as tests are added,
// never silently down. Raised from 42/53/80/42 (009, 2026-05-30) after the
// 010–015 store-test branches merged. Target: 80 across the board.
// Policy + ratchet history: docs/coverage-budget.md.
//
// 031 (2026-06-01): stmts/branch/lines all ROSE (now 51.38 / 90.37 / 51.38)
// — raised those is N/A since floors already below. funcs adjusted 59 -> 57:
// NOT a regression. The mockIPC E2E (e2e/critical-loop.spec.ts) drives the
// REAL lib/api/ai-tts.ts invoke wire that every other test mocked away, so
// that module's ~22 functions entered the denominator for the first time.
// We ratcheted funcs UP from 54.28 -> 57.84 by adding the api wire-contract
// test (src/lib/api/ai-tts.test.ts); the residual ~1pt is newly-measured
// real code, not lost coverage. Documented, not silent. Follow-up to push
// funcs back toward 59+: cover the remaining ai-tts.ts / prebuffer paths.
thresholds: {
lines: 46,
functions: 57,
branches: 88,
statements: 46,
},
},
},
});
24 0 .github/workflows/ci.yml
3 0 .gitignore
61 0 flake.lock
59 0 flake.nix
35 0 knip.json
2 0 package.json
584 6 pnpm-lock.yaml
0 102 src/services/pdf-storage-service.ts
138 0 tools/alignment-gate.sh

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "rg -n -S \"alignment-gate|ALIGN*FAIL|ALIGN_MAX_FILES|knip|flake.nix|nix develop\" --glob '*.{test,spec}.{ts,tsx,js,mjs,sh}' --glob 'tests/**' --glob 'src/**' --glob 'tools/**' --glob 'scripts/**' --glob 'e2e/**' . || true
rg -n -S \"alignment-gate|knip|NixOS devshell|flake.nix|pnpm 10\" README.md CLAUDE.md AGENTS.md docs specs .github tools package.json flake.nix knip.json --glob '"'!docs/agent-backlog-state.md'"' --glob '"'!specs/008-security-housekeeping/**'"' --glob '"'!specs/020-persisted-scope/\*\*'"' || true
nl -ba tools/alignment-gate.sh | sed -n '1,180p'
nl -ba knip.json
nl -ba .github/workflows/ci.yml | sed -n '1,105p'
nl -ba flake.nix" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
./tools/alignment-gate.sh:3:# alignment-gate.sh — deterministic "did the agent finish + stay in scope" gate.
./tools/alignment-gate.sh:17:# ALIGN_FAIL_ON_TODO default 1 TODO/FIXME/HACK/XXX + not-implemented + stubs
./tools/alignment-gate.sh:18:# ALIGN_FAIL_ON_SKIP default 1 skipped / .only / disabled tests
./tools/alignment-gate.sh:19:# ALIGN_FAIL_ON_LINT_DISABLE default 1 added eslint-disable / @ts-ignore / noqa / …
./tools/alignment-gate.sh:20:# ALIGN_FAIL_ON_DEBUG default 0 console.log / debugger / set_trace left in
./tools/alignment-gate.sh:21:# ALIGN_MAX_FILES default 0 0=off; else fail if changed code files > N
./tools/alignment-gate.sh:28:ALIGN_FAIL_ON_TODO="${ALIGN_FAIL_ON_TODO:-1}"
./tools/alignment-gate.sh:29:ALIGN_FAIL_ON_SKIP="${ALIGN_FAIL_ON_SKIP:-1}"
./tools/alignment-gate.sh:30:ALIGN_FAIL_ON_LINT_DISABLE="${ALIGN_FAIL_ON_LINT_DISABLE:-1}"
./tools/alignment-gate.sh:31:ALIGN_FAIL_ON_DEBUG="${ALIGN_FAIL_ON_DEBUG:-0}"
./tools/alignment-gate.sh:32:ALIGN_MAX_FILES="${ALIGN_MAX_FILES:-0}"
./tools/alignment-gate.sh:38:SELF_RE='(alignment-gate[.]sh$|/hooks/|posttooluse-aislop|code-slop-gate)'
./tools/alignment-gate.sh:41:die() { echo "alignment-gate: $*" >&2; exit 2; }
./tools/alignment-gate.sh:90: "incomplete/todo|error|0|$ALIGN_FAIL_ON_TODO|\b(TODO|FIXME|HACK|XXX)\b|TODO/FIXME/HACK/XXX left in changed code"
./tools/alignment-gate.sh:91:  "incomplete/not-implemented|error|0|$ALIGN_FAIL_ON_TODO|NotImplementedError|NotImplementedException|[Nn]ot implemented|unimplemented|not-implemented marker"
./tools/alignment-gate.sh:92: "incomplete/throw-stub|error|0|$ALIGN_FAIL_ON_TODO|(throw new Error|raise)[^;]*(implement|stub|placeholder|TODO)|stub raises/throws instead of implementing"
./tools/alignment-gate.sh:93:  "incomplete/ellipsis-body|error|0|$ALIGN_FAIL_ON_TODO|^[[:space:]]*\.\.\.[[:space:]]*$|ellipsis placeholder body"
./tools/alignment-gate.sh:94:  "test/skip|error|1|$ALIGN_FAIL_ON_SKIP|\b(it|test|describe)\.(skip|todo|failing|only)\b|\bx(it|describe|test)[[:space:]]*\(|@pytest\.mark\.(skip|skipif|xfail)\b|pytest\.skip\(|unittest\.skip|\bt\.Skip(f|Now)?\(|#\[ignore\b|@(Disabled|Ignore)\b|markTestSkipped|markTestIncomplete|skipped / .only / disabled test added"
./tools/alignment-gate.sh:95: "align/lint-suppressed|error|0|$ALIGN_FAIL_ON_LINT_DISABLE|eslint-disable|biome-ignore|@ts-(ignore|nocheck|expect-error)|#[[:space:]]*noqa|#[[:space:]]*type:[[:space:]]*ignore|#[[:space:]]*pylint:[[:space:]]*disable|//[[:space:]]*nolint|#\[allow\(|@SuppressWarnings|rubocop:disable|swiftlint:disable|lint suppression added (goal-hacking)"
./tools/alignment-gate.sh:96: "align/debug-artifact|warn|0|$ALIGN_FAIL_ON_DEBUG|console\.(log|debug)\(|^[[:space:]]*debugger;|pdb\.set_trace\(|binding\.pry|[[:space:]]dbg!\(|debug artifact left in code"
./tools/alignment-gate.sh:118:if [ "$ALIGN_MAX_FILES" -gt 0 ] && [ "${nfiles:-0}" -gt "$ALIGN_MAX_FILES" ]; then
./tools/alignment-gate.sh:120: "$nfiles" "$nfiles" "$ALIGN_MAX_FILES" >>"$findings"
knip.json:2: "$schema": "https://unpkg.com/knip@latest/schema.json",
package.json:20:    "knip": "knip",
package.json:72:    "knip": "6.29.0",
flake.nix:45:          # the project's pnpm 10 lockfile). The devshell inherits the host PATH,
flake.nix:46:          # which has Pedro's pnpm 10 at ~/.local/bin/pnpm.
flake.nix:52:          # Force host's pnpm 10 (at ~/.local/bin) to take precedence over any
flake.nix:53:          # nix-cached pnpm 11 — the project's lockfile is pnpm 10 format.
tools/alignment-gate.sh:3:# alignment-gate.sh — deterministic "did the agent finish + stay in scope" gate.
tools/alignment-gate.sh:38:SELF_RE='(alignment-gate[.]sh$|/hooks/|posttooluse-aislop|code-slop-gate)'
tools/alignment-gate.sh:41:die() { echo "alignment-gate: $*" >&2; exit 2; }
.github/workflows/ci.yml:14:  alignment-gate:
.github/workflows/ci.yml:28:        # sees. Vendored from Pedro's experiments/alignment-gate (Standard —
.github/workflows/ci.yml:30:        run: ./tools/alignment-gate.sh --base origin/${{ github.base_ref }}
.github/workflows/ci.yml:83: run: pnpm knip
1 #!/usr/bin/env bash
2 #
3 # alignment-gate.sh — deterministic "did the agent finish + stay in scope" gate.
4 # Zero-dependency (git + grep + awk). Catches the completion-theater / scope-creep
5 # class no linter sees: TODO/stub left in "done" code, skipped/only tests, added lint
6 # suppressions (goal-hacking), debug artifacts, and over-wide blast radius.
7 #
8 # Heuristics modeled on the deterministic checks in donegate (MIT, intrepideai/donegate),
9 # AgentLiar (MIT), and opencode-swarm's placeholder-scan — reimplemented portably.
10 #
11 # Scope (pick one; default = path "."):
12 # --staged files staged in git → pre-commit / PostToolUse-batch
13 # --base REF files changed vs REF → CI on a PR (scans ADDED lines only)
14 # <path> scan a dir/file → manual (scans all lines)
15 #
16 # Strictness (env-overridable; 1 = fail, 0 = report-only):
17 # ALIGN_FAIL_ON_TODO default 1 TODO/FIXME/HACK/XXX + not-implemented + stubs
18 # ALIGN_FAIL_ON_SKIP default 1 skipped / .only / disabled tests
19 # ALIGN_FAIL_ON_LINT_DISABLE default 1 added eslint-disable / @ts-ignore / noqa / …
20 # ALIGN_FAIL_ON_DEBUG default 0 console.log / debugger / set_trace left in
21 # ALIGN_MAX_FILES default 0 0=off; else fail if changed code files > N
22 #
23 # Exit: 0 = aligned · 1 = violation over threshold · 2 = tooling/usage error.
24
25 set -uo pipefail
26
27 SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    28	ALIGN_FAIL_ON_TODO="${ALIGN_FAIL_ON_TODO:-1}"
29 ALIGN_FAIL_ON_SKIP="${ALIGN_FAIL_ON_SKIP:-1}"
    30	ALIGN_FAIL_ON_LINT_DISABLE="${ALIGN_FAIL_ON_LINT_DISABLE:-1}"
31 ALIGN_FAIL_ON_DEBUG="${ALIGN_FAIL_ON_DEBUG:-0}"
    32	ALIGN_MAX_FILES="${ALIGN_MAX_FILES:-0}"
33
34 # NB: literal dots written [.] so the same patterns are safe in both grep -E and awk.
35 CODE_RE='[.](ts|tsx|js|jsx|py|go|rs|rb|php|java|cs|c|cpp|h|hpp|swift|kt|ex|exs|sh|bash|nix)$'
36 TEST_RE='([.]test[.]|[.]spec[.]|\_test[.]|/tests?/|/**tests**/|(^|/)test*[^/]_[.]py$|_test[.]go$|\_spec[.]rb$)'
    37	# self-exemption: never scan the gate's own files (they contain the pattern tables) or meta docs
    38	SELF_RE='(alignment-gate[.]sh$|/hooks/|posttooluse-aislop|code-slop-gate)'
39 META_RE='[.](md|rst|txt|lock)$'
40
41 die() { echo "alignment-gate: $_" >&2; exit 2; }
42 command -v git >/dev/null 2>&1 || die "git required"
43 command -v awk >/dev/null 2>&1 || die "awk required"
44
45 mode="path"; base="HEAD"; target="."
46 case "${1:-}" in
    47	  --staged)   mode="staged" ;;
    48	  --worktree) mode="worktree" ;;
    49	  --changes) mode="changes"; [ "${2:-}" = "--base" ] && base="${3:?--base needs a ref}" ;;
    50	  --base)    mode="changes"; base="${2:?--base needs a ref}" ;;
51 "") target="." ;;
52 -_) die "unknown flag: $1" ;;
53 _) target="$1" ;;
    54	esac
    55	
    56	WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
    57	stream="$WORK/stream" # path \t lineno \t content (added lines for diff; all lines for path)
58 : >"$stream"
    59	
    60	emit_diff() {
    61	  local range
    62	  case "$mode" in
63 staged) range=(--cached) ;;
64 worktree) range=("HEAD") ;;
65 changes) range=("$base...HEAD") ;;
    66	  esac
    67	  git diff -U0 --no-color "${range[@]}" 2>/dev/null | awk '
68 /^\+\+\+ b\// { file=substr($0,7); next }
    69	    /^@@/ { if (match($0,/\+[0-9]+/)) { n=substr($0,RSTART+1,RLENGTH-1)+0; ln=n-1 } next }
    70	    /^\+/ && !/^\+\+\+/ { ln++; print file "\t" ln "\t" substr($0,2) }
    71	  '
    72	}
    73	emit_path() {
    74	  while IFS= read -r f; do
    75	    [ -f "$f" ] || continue
76 awk -v p="$f" '{print p "\t" NR "\t" $0}' "$f"
77 done < <(find "$target" -type f 2>/dev/null)
    78	}
    79	
    80	# build the filtered line stream
    81	{ [ "$mode" = "path" ] && emit_path || emit_diff; } | \
 82 awk -F'\t' -v code="$CODE_RE" -v self="$SELF_RE" -v meta="$META_RE" \
    83	    '$1 ~ code && $1 !~ self && $1 !~ meta' >"$stream"
84
85 # changed code-file count (for blast-radius)
86 nfiles="$(cut -f1 "$stream" | sort -u | grep -c . || true)"
87
88 # checks: rule | severity | test_only | toggle | ERE | message
89 checks=(
90 "incomplete/todo|error|0|$ALIGN_FAIL_ON_TODO|\b(TODO|FIXME|HACK|XXX)\b|TODO/FIXME/HACK/XXX left in changed code"
    91	  "incomplete/not-implemented|error|0|$ALIGN_FAIL_ON_TODO|NotImplementedError|NotImplementedException|[Nn]ot implemented|unimplemented|not-implemented marker"
92 "incomplete/throw-stub|error|0|$ALIGN_FAIL_ON_TODO|(throw new Error|raise)[^;]*(implement|stub|placeholder|TODO)|stub raises/throws instead of implementing"
    93	  "incomplete/ellipsis-body|error|0|$ALIGN_FAIL_ON_TODO|^[[:space:]]_\.\.\.[[:space:]]_$|ellipsis placeholder body"
    94	  "test/skip|error|1|$ALIGN_FAIL_ON_SKIP|\b(it|test|describe)\.(skip|todo|failing|only)\b|\bx(it|describe|test)[[:space:]]*\(|@pytest\.mark\.(skip|skipif|xfail)\b|pytest\.skip\(|unittest\.skip|\bt\.Skip(f|Now)?\(|#\[ignore\b|@(Disabled|Ignore)\b|markTestSkipped|markTestIncomplete|skipped / .only / disabled test added"
95 "align/lint-suppressed|error|0|$ALIGN_FAIL_ON_LINT_DISABLE|eslint-disable|biome-ignore|@ts-(ignore|nocheck|expect-error)|#[[:space:]]*noqa|#[[:space:]]*type:[[:space:]]*ignore|#[[:space:]]*pylint:[[:space:]]*disable|//[[:space:]]*nolint|#\[allow\(|@SuppressWarnings|rubocop:disable|swiftlint:disable|lint suppression added (goal-hacking)"
96 "align/debug-artifact|warn|0|$ALIGN_FAIL_ON_DEBUG|console\.(log|debug)\(|^[[:space:]]*debugger;|pdb\.set_trace\(|binding\.pry|[[:space:]]dbg!\(|debug artifact left in code"
97 )
98
99 findings="$WORK/findings"; : >"$findings" # sev \t rule \t path:lineno \t message
100 for spec in "${checks[@]}"; do
   101	  # spec layout: rule|sev|test_only|toggle|<re...>|msg  (re may contain | alternation,
   102	  # so peel fixed fields off the front and msg off the back; re is what remains).
   103	  rule="${spec%%|_}"; rest="${spec#_|}"
104 sev="${rest%%|*}"; rest="${rest#_|}"
105 test_only="${rest%%|_}"; rest="${rest#*|}"
   106	  toggle="${rest%%|_}"; rest="${rest#_|}"
107 msg="${rest##*|}"; re="${rest%|_}"
108 [ "$toggle" = "0" ] && [ "$sev" = "error" ] && sev="warn" # strictness downgrade
109 while IFS=$'\t' read -r path lineno content; do
   110	    [ "$test_only" = "1" ] && { echo "$path" | grep -qE "$TEST_RE" || continue; }
111 if printf '%s' "$content" | grep -qE "$re"; then
112 printf '%s\t%s\t%s:%s\t%s\n' "$sev" "$rule" "$path" "$lineno" "$msg" >>"$findings"
113 fi
114 done <"$stream"
   115	done
   116	
   117	# blast-radius
   118	if [ "$ALIGN_MAX_FILES" -gt 0 ] && [ "${nfiles:-0}" -gt "$ALIGN_MAX_FILES" ]; then
119 printf 'error\tscope/blast-radius\t(%s files)\tchanged code files %s > max %s\n' \
 120 "$nfiles" "$nfiles" "$ALIGN_MAX_FILES" >>"$findings"
121 fi
122
123 errs="$(grep -c '^error' "$findings" 2>/dev/null)"; errs="${errs:-0}"
   124	warns="$(grep -c '^warn' "$findings" 2>/dev/null)"; warns="${warns:-0}"
125
126 echo "── alignment gate ─────────────────────────────"
127 printf 'scanned: %s changed code file(s) · %s error(s) · %s warning(s)\n' "${nfiles:-0}" "$errs" "$warns"
   128	if [ -s "$findings" ]; then
129 echo "findings:"
130 sort "$findings" | awk -F'\t' '{printf "  %-5s %-26s %-28s %s\n", toupper($1), $2, $3, $4}'
   131	fi
   132	echo "───────────────────────────────────────────────"
   133	if [ "${errs:-0}" -gt 0 ]; then
134 echo "✗ FAIL — finish the work / tighten scope before claiming done."
135 exit 1
136 fi
137 echo "✓ PASS — no completion-theater or scope violations over threshold."
138 exit 0
1 {
2 "$schema": "https://unpkg.com/knip@latest/schema.json",
3 "entry": ["src/main.tsx", "src/App.tsx"],
4 "project": ["src/\*\*/_.{ts,tsx}", "src-tauri/src/**/\*.rs"],
5 "ignore": [
6 "src/lib/bindings.ts",
7 "src-tauri/gen/**",
8 "src-tauri/src/lib.rs",
9 "specs/**",
10 "docs/**",
11 "scripts/**",
12 "tools/**",
13 "e2e/**",
14 "tests/**",
15 "src/**tests**/**",
16 "src/**/_.test.{ts,tsx}",
17 "src/\*\*/_.spec.{ts,tsx}"
18 ],
19 "ignoreBinaries": ["tauri", "cargo-tauri", "husky", "tsx"],
20 "ignoreDependencies": [
21 "@tauri-apps/cli",
22 "husky",
23 "lint-staged",
24 "@vitejs/plugin-react",
25 "@testing-library/jest-dom",
26 "@types/react",
27 "@types/react-dom",
28 "archunit",
29 "esbuild",
30 "globals",
31 "typescript-eslint"
32 ],
33 "exclude": ["exports", "types", "enumMembers", "nsExports", "nsTypes"],
34 "ignoreUnresolved": ["@/.*"]
35 }
1 name: CI
2
3 on:
4 push:
5 branches: [main, develop]
6 pull_request:
7 branches: [main, develop]
8
9 env:
10 CARGO_TERM_COLOR: always
11 RUST_BACKTRACE: "1"
12
13 jobs:
14 alignment-gate:
15 name: Alignment Gate
16 if: github.event_name == 'pull_request'
17 runs-on: [self-hosted, Linux, X64, vm103]
18 timeout-minutes: 5
19
20 steps:
21 - uses: actions/checkout@v4
22 with:
23 fetch-depth: 0 # full history for the --base diff
24
25 - name: Run alignment gate (PR diff vs base)
26 # Catches completion-theater (TODO/stub in "done" code), skipped/.only
27 # tests, added lint-suppressions, debug artifacts — the class no linter
28 # sees. Vendored from Pedro's experiments/alignment-gate (Standard —
29 # Project Quality & Alignment Enforcement). Zero-dep (git+grep+awk).
30 run: ./tools/alignment-gate.sh --base origin/${{ github.base_ref }}
    31	
    32	  frontend:
    33	    name: Frontend Checks
    34	    runs-on: [self-hosted, Linux, X64, vm103]
    35	    timeout-minutes: 10
    36	
    37	    steps:
    38	      - uses: actions/checkout@v4
    39	
    40	      - name: Setup Node.js
    41	        uses: actions/setup-node@v4
    42	        with:
    43	          node-version: "20"
    44	
    45	      - name: Setup pnpm
    46	        uses: pnpm/action-setup@v4
    47	        with:
    48	          version: 10
    49	
    50	      - name: Get pnpm store directory
    51	        shell: bash
    52	        run: echo "STORE_PATH=$(pnpm store path --silent)" >> "$GITHUB_ENV"
    53	
    54	      - name: Setup pnpm cache
    55	        uses: actions/cache@v4
    56	        with:
    57	          path: ${{ env.STORE_PATH }}
    58	          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
59 restore-keys: ${{ runner.os }}-pnpm-store-
    60	
    61	      - name: Install dependencies
    62	        run: pnpm install
    63	
    64	      - name: TypeScript check
    65	        run: pnpm typecheck
    66	
    67	      - name: ESLint
    68	        run: pnpm lint
    69	
    70	      - name: ESLint Boundaries
    71	        run: pnpm lint:boundaries
    72	
    73	      - name: Run tests
    74	        run: pnpm test:run
    75	
    76	      - name: Architecture tests
    77	        run: pnpm test:arch
    78	
    79	      - name: Knip (dead-code detection)
    80	        # Whole-module-graph dead-code gate — catches unused files/exports/deps
    81	        # that tsc/ESLint structurally can't see. #1 agent-slop signature per
    82	        # Pedro's Standard — Project Quality & Alignment Enforcement.
    83	        run: pnpm knip
    84	
    85	      - name: Coverage check
    86	        run: pnpm test:coverage
    87	
    88	  backend:
    89	    name: Backend Checks
    90	    runs-on: [self-hosted, Linux, X64, vm103]
    91	    timeout-minutes: 15
    92	
    93	    steps:
    94	      - uses: actions/checkout@v4
    95	
    96	      - name: Install system dependencies
    97	        run: |
    98	          sudo apt-get update
    99	          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libspeechd-dev libasound2-dev libssl-dev pkg-config clang libclang-dev
   100	
   101	      - name: Setup Rust
   102	        uses: dtolnay/rust-toolchain@stable
   103	        with:
   104	          components: rustfmt, clippy
   105	
     1	{
     2	  description = "Lectrice — Tauri 2 desktop PDF reader devshell (Linux)";
     3	
     4	  inputs = {
     5	    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
     6	    flake-utils.url = "github:numtide/flake-utils";
     7	  };
     8	
     9	  outputs = { self, nixpkgs, flake-utils }:
    10	    flake-utils.lib.eachDefaultSystem (system:
    11	      let
    12	        pkgs = import nixpkgs { inherit system; };
    13	
    14	        # Tauri 2 Linux runtime + build deps. Mirrors the upstream
    15	        # `apt install libwebkit2gtk-4.1-dev build-essential libssl-dev
    16	        # libxdo-dev libayatana-appindicator3-dev librsvg2-dev` recipe.
    17	        tauriLinuxDeps = with pkgs; [
    18	          # Build tools
    19	          gnumake
    20	          pkg-config
    21	          clang
    22	          llvmPackages.libclang.lib
    23	
    24	          # System libs the Rust crates link against
    25	          openssl.dev
    26	          alsa-lib
    27	          webkitgtk_4_1
    28	          libsoup_3
    29	          gtk3
    30	          glib
    31	          gobject-introspection
    32	          gdk-pixbuf
    33	          pango
    34	          cairo
    35	          harfbuzz
    36	          at-spi2-atk
    37	          atk
    38	          librsvg
    39	          libayatana-appindicator
    40	        ];
    41	      in
    42	      {
    43	        devShells.default = pkgs.mkShell {
    44	          # pnpm is NOT pulled from nixpkgs (it ships pnpm 11 which clashes with
    45	          # the project's pnpm 10 lockfile). The devshell inherits the host PATH,
    46	          # which has Pedro's pnpm 10 at ~/.local/bin/pnpm.
    47	          packages = [ pkgs.nodejs_22 ] ++ tauriLinuxDeps;
    48	
    49	          # bindgen (used transitively by several -sys crates) needs libclang.
    50	          LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}/lib";
51
52 # Force host's pnpm 10 (at ~/.local/bin) to take precedence over any
53 # nix-cached pnpm 11 — the project's lockfile is pnpm 10 format.
54 shellHook = ''
55 export PATH="$HOME/.local/bin:$PATH"
56 '';
57 };
58 });
59 }

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc 'nix flake check --no-build --no-write-lock-file' in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 3516ms:
evaluating flake...
checking flake output 'devShells'...
checking derivation devShells.x86_64-linux.default...
derivation evaluated to /nix/store/ydq9ri8i6zw05ci32jydlhl1dc6hjn9b-nix-shell.drv
all checks passed!
warning: The check omitted these incompatible systems: aarch64-darwin, aarch64-linux, x86_64-darwin
Use '--all-systems' to check all.

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc 'nix flake check --no-build --no-write-lock-file --all-systems' in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
exited 1 in 3087ms:
derivation evaluated to /nix/store/ydq9ri8i6zw05ci32jydlhl1dc6hjn9b-nix-shell.drv
checking derivation devShells.x86_64-darwin.default...
error:
… while checking flake output 'devShells'
at «github:numtide/flake-utils/11707dc2f618dd54ca8739b309ec4fc024de578b?narHash=sha256-l0KFg5HjrsfsO/JpG%2Br7fRrqm12kzFHyUHqHCVpMMbI%3D»/lib.nix:43:9:
42| // {
43| ${key} = (attrs.${key} or { }) // {
| ^
44| ${system} = ret.${key};

       … while checking the derivation 'devShells.x86_64-darwin.default'
         at /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/flake.nix:43:9:
           42|       {
           43|         devShells.default = pkgs.mkShell {
             |         ^
           44|           # pnpm is NOT pulled from nixpkgs (it ships pnpm 11 which clashes with

       (stack trace truncated; use '--show-trace' to show the full, detailed trace)

       error: Nixpkgs 26.11 has dropped support for x86_64-darwin.

       The 26.05 stable branch still supports x86_64-darwin, and will
       receive security fixes until the end of 2026. If you use channels,
       you can switch to 26.05 as follows:

           $ sudo nix-channel --add https://nixos.org/channels/nixpkgs-26.05-darwin nixpkgs
           $ sudo nix-channel --update

       If this doesn’t work, you may need to run:

           # Lack of sudo is deliberate:
           $ nix-channel --remove nixpkgs

       If you use flakes, switch your flake input:

           inputs.nixpkgs = {
             url = "github:NixOS/nixpkgs/nixpkgs-26.05-darwin";
           };

       See the release notes for more information and alternatives:

         https://nixos.org/manual/nixpkgs/unstable/release-notes#x86_64-darwin-26.11

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "rg -n -i \"api[_ -]?key|secret|token|password|authorization|https?://|telemetry|sentry|posthog|analytics|home|root|\\_\\_/\\_|fs:|capabilit|persisted|invoke\\(\" /tmp/pr36-diff.patch | sed -n '1,240p'" in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
96:+ "root": {
118:+ "root": "root",
181:+ export PATH="$HOME/.local/bin:$PATH"
193:+ "$schema": "https://unpkg.com/knip@latest/schema.json",
195:+ "project": ["src/\*\*/_.{ts,tsx}", "src-tauri/src/**/\*.rs"],
207:+ "src/**/_.test.{ts,tsx}",
208:+ "src/\*\*/_.spec.{ts,tsx}"
848: '@csstools/css-tokenizer@3.0.4': {}

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc 'bash -n tools/alignment-gate.sh && pnpm typecheck' in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 6591ms:

> lectrice@0.1.0 typecheck /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
> tsc --noEmit

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc 'pnpm lint' in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 8732ms:

> lectrice@0.1.0 lint /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
> eslint .

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/**tests**/hooks/useRovingTabindex.test.tsx
171:25 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion
175:25 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion
179:25 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/**tests**/integration/session-flow.test.ts
202:7 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/**tests**/ui/AudioExportDialog.test.tsx
562:25 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion
610:25 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/**tests**/ui/ListRow.test.tsx
33:21 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion
50:21 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/adapters/mock/tts.adapter.ts
51:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/components/PageNavigation.tsx
50:11 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/components/PdfViewer.tsx
95:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
107:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
110:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
116:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
119:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
144:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
151:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
157:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
166:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
174:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
180:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
191:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
195:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
318:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
395:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
462:11 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
495:11 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion
504:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/components/pdf-viewer/HighlightCreationHandler.tsx
56:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
87:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
175:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
206:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/components/pdf-viewer/HighlightToolbar.tsx
37:3 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/components/pdf-viewer/PdfPage.tsx
69:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
161:6 warning React Hook useEffect has missing dependencies: 'displayInfo' and 'settings'. Either include them or remove the dependency array react-hooks/exhaustive-deps

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/components/playback-bar/AiPlaybackBar.tsx
121:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
135:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
152:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
155:6 warning React Hook useCallback has a missing dependency: 'speakWithHighlight'. Either include it or remove the dependency array react-hooks/exhaustive-deps
170:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/hooks/useAiTts.ts
85:13 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
94:13 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
103:13 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
112:13 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
120:13 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
128:13 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
169:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
190:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
201:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
256:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/hooks/useHighlightPersistence.ts
88:6 warning React Hook useCallback has a missing dependency: 'scheduleFlush'. Either include it or remove the dependency array react-hooks/exhaustive-deps
177:29 warning The ref value 'pendingUpdatesRef.current' will likely have changed by the time this effect cleanup function runs. If this ref points to a node rendered by React, copy 'pendingUpdatesRef.current' to a variable inside the effect, and use that variable in the cleanup function react-hooks/exhaustive-deps

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/hooks/usePageCache.ts
205:16 warning The ref value 'cacheRef.current' will likely have changed by the time this effect cleanup function runs. If this ref points to a node rendered by React, copy 'cacheRef.current' to a variable inside the effect, and use that variable in the cleanup function react-hooks/exhaustive-deps
206:23 warning The ref value 'preRenderingRef.current' will likely have changed by the time this effect cleanup function runs. If this ref points to a node rendered by React, copy 'preRenderingRef.current' to a variable inside the effect, and use that variable in the cleanup function react-hooks/exhaustive-deps

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/hooks/useTtsPrebuffer.ts
94:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
102:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
141:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
147:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
190:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
205:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/hooks/useTtsWordHighlight.ts
52:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
70:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
94:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
129:6 warning React Hook useCallback has an unnecessary dependency: 'ttsStore'. Either exclude it or remove the dependency array react-hooks/exhaustive-deps
136:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
170:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
179:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
233:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
252:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
265:11 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
273:11 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
289:13 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/lib/db-init.ts
77:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
83:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
89:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
95:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
98:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
106:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
123:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/main.tsx
28:23 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/services/pdf-service.ts
72:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
76:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
77:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
79:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
81:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
90:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/stores/ai-tts-store.ts
133:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
141:11 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
159:9 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/stores/toast-store.ts
39:3 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/stores/tts-highlight-store.ts
58:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
77:5 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
92:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console
103:7 warning Unexpected console statement. Only these console methods are allowed: warn, error no-console

/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/src/ui/components/Dialog/Dialog.test.tsx
65:21 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion
88:21 warning Forbidden non-null assertion @typescript-eslint/no-non-null-assertion

✖ 96 problems (0 errors, 96 warnings)

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc "git diff --name-only origin/main...HEAD -- src-tauri src/lib/bindings.ts src/adapters src/ports src/lib/api src/hooks src/components src/services | sed -n '1,120p'
git diff -U0 origin/main...HEAD | rg -n '"'^'"\\+.\*(@tauri-apps/api/core|invoke\\(|apiKey|secret|token|fs:|assetProtocol|persisted.scope|capabilit)' || true
git diff --quiet origin/main...HEAD -- src/lib/bindings.ts; printf 'bindings_diff_exit=%s\\n' \""'$?"
git diff --quiet origin/main...HEAD -- src-tauri/tauri.conf.json src-tauri/capabilities src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock; printf '"'tauri_security_diff_exit=%s\\n' \""'$?"' in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:
src/services/pdf-storage-service.ts
bindings_diff_exit=0
tauri_security_diff_exit=0

hook: PreToolUse
hook: PreToolUse Completed
exec
/run/current-system/sw/bin/zsh -lc 'git status --short --branch && git diff --name-only && git diff --cached --name-only' in /home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui
succeeded in 0ms:

## 043-desktop-quality-uxui...origin/043-desktop-quality-uxui

?? .claude/reviews/043-desktop-quality-uxui.md

codex

## BLOCKER

1. **The new required Knip CI step is red.** Running the exact command from [ci.yml](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/.github/workflows/ci.yml:79), `pnpm knip`, exits 1. It reports 54 unused files, 3 unused dependencies, 4 unused devDependencies, 2 duplicate exports, and that `.rs` is not a registered compiler extension. This PR cannot pass its own newly introduced gate.

2. **The alignment gate fails open on tooling errors.** [alignment-gate.sh](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/tools/alignment-gate.sh:25) omits `set -e`, then leaves `mktemp`, stream creation, and diff generation unchecked. Reproduction in the read-only review environment:
   - `mktemp` failed.
   - `/stream` and `/findings` could not be created.
   - The script nevertheless printed `✓ PASS` and exited 0.

   A missing base ref or failed `git diff` is similarly silenced at [line 67](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/tools/alignment-gate.sh:67) and can become an empty successful scan.

3. **The acceptance claim is not mechanized.** The PR’s only assertion is that the gate exits 0 on this clean diff. There is no negative-control test proving that TODOs, skipped tests, suppressions, or setup failures produce nonzero status. A clean self-pass cannot distinguish a functioning detector from a no-op—and blocker 2 demonstrates exactly that failure. This violates the requested PR#595-parity rule.

4. **The devshell claim is also unmechanized and not portable as exported.** [flake.nix](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/flake.nix:10) uses `eachDefaultSystem` despite describing a Linux-only shell. `nix flake check --all-systems --no-build` exits 1 on `x86_64-darwin`. No CI assertion actually enters the Linux shell and builds/checks Lectrice.

## MAJOR

1. **All application hooks are exempted from the gate.** `SELF_RE` contains `/hooks/` at [alignment-gate.sh:38](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/tools/alignment-gate.sh:38), excluding `src/hooks/**`. TODOs, suppressions, and debug artifacts added to a major application surface pass unseen.

2. **The advertised blast-radius enforcement is disabled.** `ALIGN_MAX_FILES` defaults to `0`, and CI never overrides it. Furthermore, `nfiles` counts only files contributing added lines to the filtered stream, so deletion-only changes and some renames are omitted. The PR body’s statement that CI catches over-wide blast radius is false.

3. **“Whole-module-graph” is materially overstated.** [knip.json](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/knip.json:4):
   - Adds unsupported Rust files to `project`.
   - Ignores the Rust root and generated bindings.
   - Excludes unused exports/types.
   - Suppresses all `@/.*` unresolved imports.

   It therefore does not cover Rust reachability, generated-binding drift, or even the unused-export class claimed by the CI comment.

4. **The Nix shell is host-dependent rather than a complete devshell.** Its packages omit Rust/Cargo and pnpm, while the shell hook assumes Pedro-specific `~/.local/bin/pnpm`. A clean NixOS host cannot rely on the shell alone to build the application.

## MINOR

1. PR #36’s title/body omit the later Knip gate and deletion of `pdf-storage-service.ts`; the review description is stale.

2. The Knip dependency is pinned to `6.29.0`, but its schema URL uses `@latest`, allowing editor validation to drift.

3. The alignment script claims dependencies are only `git+grep+awk`, but also requires `mktemp`, `find`, `cut`, and `sort`.

## TEST GAPS

- Negative fixtures for every alignment rule, plus missing-base, unwritable-temp, malformed diff, `src/hooks/**`, inline Rust `#[ignore]`, deletion-only, and rename cases.
- A CI-clean Knip baseline/configuration test.
- `nix flake check` restricted to declared Linux systems and a clean-shell `nix develop --command cargo check` with pinned pnpm/Rust versions.
- Automated arbitrary-path open → quit → restart → library reopen without picker, while asserting asset scope remains empty and persisted scope contains no whole-disk grant.
- A generated-bindings regeneration/diff assertion.
- Bash/Nix behavior is outside Vitest coverage. Numeric coverage thresholds were not manipulated, but the new objective behavior has zero automated coverage.

## VERDICT

**REQUEST CHANGES — FAIL. Do not merge.**

No Tauri runtime security regression was introduced: capabilities, asset/fs scopes, persisted-scope ordering, Cargo configuration, generated bindings, and direct `invoke()` usage are unchanged. No API key, telemetry path, or whole-disk grant was added. The deleted PDF storage service has no callers on `origin/main`, so its deletion does not appear to break the live open/reopen path.

Verification: TypeScript passed; ESLint had no errors; Bash syntax passed; Linux flake evaluation passed. Knip failed, all-system flake evaluation failed, and the alignment gate demonstrably returned a false PASS. No files were edited.
hook: Stop
hook: Stop Completed
tokens used
134,911

## BLOCKER

1. **The new required Knip CI step is red.** Running the exact command from [ci.yml](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/.github/workflows/ci.yml:79), `pnpm knip`, exits 1. It reports 54 unused files, 3 unused dependencies, 4 unused devDependencies, 2 duplicate exports, and that `.rs` is not a registered compiler extension. This PR cannot pass its own newly introduced gate.

2. **The alignment gate fails open on tooling errors.** [alignment-gate.sh](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/tools/alignment-gate.sh:25) omits `set -e`, then leaves `mktemp`, stream creation, and diff generation unchecked. Reproduction in the read-only review environment:
   - `mktemp` failed.
   - `/stream` and `/findings` could not be created.
   - The script nevertheless printed `✓ PASS` and exited 0.

   A missing base ref or failed `git diff` is similarly silenced at [line 67](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/tools/alignment-gate.sh:67) and can become an empty successful scan.

3. **The acceptance claim is not mechanized.** The PR’s only assertion is that the gate exits 0 on this clean diff. There is no negative-control test proving that TODOs, skipped tests, suppressions, or setup failures produce nonzero status. A clean self-pass cannot distinguish a functioning detector from a no-op—and blocker 2 demonstrates exactly that failure. This violates the requested PR#595-parity rule.

4. **The devshell claim is also unmechanized and not portable as exported.** [flake.nix](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/flake.nix:10) uses `eachDefaultSystem` despite describing a Linux-only shell. `nix flake check --all-systems --no-build` exits 1 on `x86_64-darwin`. No CI assertion actually enters the Linux shell and builds/checks Lectrice.

## MAJOR

1. **All application hooks are exempted from the gate.** `SELF_RE` contains `/hooks/` at [alignment-gate.sh:38](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/tools/alignment-gate.sh:38), excluding `src/hooks/**`. TODOs, suppressions, and debug artifacts added to a major application surface pass unseen.

2. **The advertised blast-radius enforcement is disabled.** `ALIGN_MAX_FILES` defaults to `0`, and CI never overrides it. Furthermore, `nfiles` counts only files contributing added lines to the filtered stream, so deletion-only changes and some renames are omitted. The PR body’s statement that CI catches over-wide blast radius is false.

3. **“Whole-module-graph” is materially overstated.** [knip.json](/home/notroot/Documents/Code/personal/tauri-pdf-reader-043-desktop-quality-uxui/knip.json:4):
   - Adds unsupported Rust files to `project`.
   - Ignores the Rust root and generated bindings.
   - Excludes unused exports/types.
   - Suppresses all `@/.*` unresolved imports.

   It therefore does not cover Rust reachability, generated-binding drift, or even the unused-export class claimed by the CI comment.

4. **The Nix shell is host-dependent rather than a complete devshell.** Its packages omit Rust/Cargo and pnpm, while the shell hook assumes Pedro-specific `~/.local/bin/pnpm`. A clean NixOS host cannot rely on the shell alone to build the application.

## MINOR

1. PR #36’s title/body omit the later Knip gate and deletion of `pdf-storage-service.ts`; the review description is stale.

2. The Knip dependency is pinned to `6.29.0`, but its schema URL uses `@latest`, allowing editor validation to drift.

3. The alignment script claims dependencies are only `git+grep+awk`, but also requires `mktemp`, `find`, `cut`, and `sort`.

## TEST GAPS

- Negative fixtures for every alignment rule, plus missing-base, unwritable-temp, malformed diff, `src/hooks/**`, inline Rust `#[ignore]`, deletion-only, and rename cases.
- A CI-clean Knip baseline/configuration test.
- `nix flake check` restricted to declared Linux systems and a clean-shell `nix develop --command cargo check` with pinned pnpm/Rust versions.
- Automated arbitrary-path open → quit → restart → library reopen without picker, while asserting asset scope remains empty and persisted scope contains no whole-disk grant.
- A generated-bindings regeneration/diff assertion.
- Bash/Nix behavior is outside Vitest coverage. Numeric coverage thresholds were not manipulated, but the new objective behavior has zero automated coverage.

## VERDICT

**REQUEST CHANGES — FAIL. Do not merge.**

No Tauri runtime security regression was introduced: capabilities, asset/fs scopes, persisted-scope ordering, Cargo configuration, generated bindings, and direct `invoke()` usage are unchanged. No API key, telemetry path, or whole-disk grant was added. The deleted PDF storage service has no callers on `origin/main`, so its deletion does not appear to break the live open/reopen path.

Verification: TypeScript passed; ESLint had no errors; Bash syntax passed; Linux flake evaluation passed. Knip failed, all-system flake evaluation failed, and the alignment gate demonstrably returned a false PASS. No files were edited.

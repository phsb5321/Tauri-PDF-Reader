# Quality Gates: UI Regression Prevention

**Feature**: 003-ui-ux-polish
**Date**: 2026-01-13
**Status**: Complete

---

## Overview

This document defines the quality gates for preventing UI regressions. It includes checklists for manual review, component test requirements, and E2E test specifications.

---

## 1. Focus & Keyboard Checklist

Run this checklist for every UI change that affects interactive elements.

### 1.1 Focus Management

- [ ] **Focus visible**: All interactive elements have visible focus indicator
- [ ] **Focus order**: Tab order follows logical flow (left-to-right, top-to-bottom)
- [ ] **No focus trap**: Focus can escape any modal or panel via Escape key
- [ ] **Focus restoration**: After closing modal, focus returns to trigger element
- [ ] **Skip link**: Skip to main content link available (optional)

### 1.2 Keyboard Accessibility

- [ ] **All actions keyboard accessible**: Every action can be performed via keyboard
- [ ] **Enter/Space activation**: Buttons and links activate with Enter or Space
- [ ] **Arrow key navigation**: Lists, sliders, and menus navigate with arrow keys
- [ ] **Escape closes**: All modals and popups close with Escape
- [ ] **Shortcuts work**: Global keyboard shortcuts function as documented

### 1.3 Screen Reader Support

- [ ] **ARIA labels**: Interactive elements have accessible names
- [ ] **Role attributes**: Custom components have appropriate roles
- [ ] **Live regions**: Dynamic content changes are announced
- [ ] **Landmark regions**: Page structure uses semantic landmarks

---

## 2. Accessibility Checklist (WCAG 2.2 Level A)

### 2.1 Perceivable

| Criterion | Description | Check |
|-----------|-------------|-------|
| 1.1.1 Non-text Content | Images have alt text | [ ] |
| 1.3.1 Info and Relationships | Structure conveyed in markup | [ ] |
| 1.3.2 Meaningful Sequence | Content order is logical | [ ] |
| 1.4.1 Use of Color | Color is not only indicator | [ ] |
| 1.4.3 Contrast (Minimum) | Text contrast ≥ 4.5:1 | [ ] |

### 2.2 Operable

| Criterion | Description | Check |
|-----------|-------------|-------|
| 2.1.1 Keyboard | All functionality via keyboard | [ ] |
| 2.1.2 No Keyboard Trap | Focus can be moved away | [ ] |
| 2.4.1 Bypass Blocks | Skip links or landmarks | [ ] |
| 2.4.3 Focus Order | Logical focus sequence | [ ] |
| 2.4.4 Link Purpose | Link text is descriptive | [ ] |
| 2.4.7 Focus Visible | Focus indicator visible | [ ] |

### 2.3 Understandable

| Criterion | Description | Check |
|-----------|-------------|-------|
| 3.1.1 Language of Page | Page has lang attribute | [ ] |
| 3.2.1 On Focus | No context change on focus | [ ] |
| 3.3.1 Error Identification | Errors clearly identified | [ ] |
| 3.3.2 Labels or Instructions | Form fields have labels | [ ] |

### 2.4 Robust

| Criterion | Description | Check |
|-----------|-------------|-------|
| 4.1.1 Parsing | Valid HTML/markup | [ ] |
| 4.1.2 Name, Role, Value | ARIA used correctly | [ ] |

---

## 3. Component Test Requirements

### 3.1 Required Tests for Each Component

Every UI component must have tests covering:

| Test Category | Description | Required |
|---------------|-------------|----------|
| Render | Component renders without errors | Yes |
| Props | All props produce expected output | Yes |
| Accessibility | Has accessible name and role | Yes |
| Keyboard | Keyboard interactions work | Yes |
| States | Disabled, loading, error states | Yes |
| Events | Click, focus, change handlers | Yes |

### 3.2 Test File Locations

```
src/__tests__/ui/
├── Button.test.tsx
├── IconButton.test.tsx
├── Panel.test.tsx
├── EmptyState.test.tsx
├── ListRow.test.tsx
└── Toast.test.tsx
```

### 3.3 Running Component Tests

```bash
# Run all UI component tests
pnpm test -- src/__tests__/ui/

# Run specific component test
pnpm test -- src/__tests__/ui/Button.test.tsx

# Run with coverage
pnpm test -- --coverage src/__tests__/ui/
```

### 3.4 Coverage Requirements

| Metric | Minimum |
|--------|---------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

---

## 4. E2E Test Requirements

### 4.1 Critical Loop Test

**File**: `e2e/critical-loop.spec.ts`

**Purpose**: Verify the primary user journey completes efficiently.

**Flow Tested**:
1. Open document
2. Create highlight
3. Activate TTS

**Success Criteria**:
- Complete flow in < 5 clicks from document open
- All UI feedback visible (loading states, confirmations)
- No console errors during flow

### 4.2 Running E2E Tests

```bash
# Install Playwright (first time)
pnpm add -D @playwright/test
npx playwright install

# Run E2E tests
pnpm exec playwright test

# Run with UI mode
pnpm exec playwright test --ui

# Run specific test
pnpm exec playwright test e2e/critical-loop.spec.ts
```

### 4.3 E2E Test Coverage

| Scenario | Test File | Status |
|----------|-----------|--------|
| Critical loop (open → highlight → TTS) | `critical-loop.spec.ts` | Created |
| Keyboard navigation | `critical-loop.spec.ts` | Planned |
| Component rendering | `critical-loop.spec.ts` | Planned |
| Accessibility | `critical-loop.spec.ts` | Planned |

### 4.4 Tauri-Specific Testing

E2E tests for Tauri apps require special setup:

```typescript
// playwright.config.ts (example)
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    // Tauri webview testing configuration
    // See: https://tauri.app/v1/guides/testing/
  },
});
```

---

## 5. Pre-commit Checklist

Run before every UI-related commit:

```bash
# 1. Type check
pnpm build

# 2. Lint
pnpm lint

# 3. Run component tests
pnpm test:run

# 4. Manual checks (if UI changed):
#    - Open app (pnpm tauri dev)
#    - Test keyboard navigation
#    - Test in both light and dark mode
#    - Test with different viewport sizes
```

---

## 6. Visual Regression Testing

### 6.1 Recommended Setup

For catching visual regressions, consider adding:

```bash
pnpm add -D @playwright/test @percy/playwright
```

### 6.2 Baseline Screenshots

Store baseline screenshots for:
- Main reader view (light + dark)
- Settings panel open
- Highlights panel open
- Playback bar active
- Empty states
- Error states

### 6.3 Screenshot Comparison

```typescript
// Example visual regression test
test('main view matches baseline', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('main-view.png');
});
```

---

## 7. Continuous Integration

### 7.1 CI Pipeline Steps

```yaml
# Example GitHub Actions workflow
name: UI Quality Gates

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Type check
        run: pnpm build

      - name: Lint
        run: pnpm lint

      - name: Run tests
        run: pnpm test:run

      - name: Run E2E tests
        run: pnpm exec playwright test
```

### 7.2 Required Checks

| Check | Command | Must Pass |
|-------|---------|-----------|
| Type check | `pnpm build` | Yes |
| Lint | `pnpm lint` | Yes |
| Unit tests | `pnpm test:run` | Yes |
| E2E tests | `playwright test` | Yes |

---

## 8. Summary

### Quality Gate Matrix

| Gate | Type | Frequency | Owner |
|------|------|-----------|-------|
| Component tests | Automated | Every commit | CI |
| E2E critical loop | Automated | Every PR | CI |
| Accessibility checklist | Manual | New components | Developer |
| Keyboard checklist | Manual | UI changes | Developer |
| Visual regression | Semi-auto | Major UI changes | Developer |

### When to Run What

| Change Type | Tests Required |
|-------------|----------------|
| New component | Component tests + Accessibility checklist |
| Modify component | Component tests |
| Layout change | E2E tests + Visual check |
| Token change | All tests + Visual check |
| Keyboard shortcut | Manual keyboard test |

---

## 9. Resources

- WCAG 2.2 Guidelines: https://www.w3.org/WAI/WCAG22/quickref/
- Playwright Documentation: https://playwright.dev/
- Vitest Documentation: https://vitest.dev/
- Tauri Testing Guide: https://tauri.app/v1/guides/testing/

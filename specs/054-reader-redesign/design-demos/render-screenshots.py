#!/usr/bin/env python3
"""Render the spec-054 design directions and assert the brief's hard gates.

Gates asserted (exit 1 on any failure):
  1. every direction renders with zero page errors and zero console errors;
  2. every request the page makes is local (file:/data:) — the brief forbids
     network-loaded fonts, images, or scripts;
  3. the captured PNG is exactly 1440 x 900 CSS pixels;
  4. every visible interactive control is at least 44 x 44 CSS pixels
     (visually-hidden inputs behind a custom control are exempt);
  5. the three interactions the brief requires each mutate observable state:
     play/pause, opening a navigation or session surface, and changing a
     visible reader control (next page).

The smallest rendered font size per direction is reported, not gated: the
brief's 14px floor covers body copy, while eyebrow/monospace chrome labels are
a per-direction typographic choice for the reviewer to judge.

Usage: python3 render-screenshots.py [direction-slug ...]
"""

from __future__ import annotations

import re
import struct
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

CHROME = "/run/current-system/sw/bin/google-chrome"
VIEWPORT = {"width": 1440, "height": 900}
HERE = Path(__file__).resolve().parent
SHOTS = HERE / "screenshots"


def png_size(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    width, height = struct.unpack(">II", header[16:24])
    return width, height


MEASURE_JS = """
() => {
  const SELECTOR = 'button,[role="button"],a,input,select,summary';
  const undersized = [];
  for (const el of document.querySelectorAll(SELECTOR)) {
    const rect = el.getBoundingClientRect();
    // A 0/1px input is the hidden half of a custom control; the visible
    // label carries the hit target and is measured on its own.
    if (rect.width <= 1 || rect.height <= 1) continue;
    if (rect.width < 44 || rect.height < 44) {
      undersized.push(
        `${Math.round(rect.width)}x${Math.round(rect.height)} <${el.tagName.toLowerCase()}> ` +
        JSON.stringify((el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40))
      );
    }
  }
  let smallestFont = Infinity;
  for (const el of document.querySelectorAll('body *')) {
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    smallestFont = Math.min(smallestFont, parseFloat(getComputedStyle(el).fontSize));
  }
  return { undersized, smallestFont };
}
"""


STATE_JS = """
() => {
  const flags = [...document.querySelectorAll('[aria-pressed],[aria-expanded],[aria-hidden],[data-state],[open],[checked]')]
    .map(el => [el.tagName, el.getAttribute('aria-pressed'), el.getAttribute('aria-expanded'),
                el.getAttribute('aria-hidden'), el.getAttribute('data-state'), el.hasAttribute('open')].join('|'));
  return document.body.innerText + '\\n' + flags.join('\\n');
}
"""

# Brief: each direction must demonstrate play/pause, a revealable surface, and
# a reader-control change. Matching is by accessible name so each direction can
# name its own surface (sessions / library / listening inspector) and can carry
# the name as either an aria-label or visible button text.
INTERACTIONS = [
    ("play/pause", re.compile(r"^play", re.I)),
    ("reveal surface", re.compile(r"sessions|library|inspector", re.I)),
    ("reader control", re.compile(r"^next page$", re.I)),
]


def first_onscreen(page, name: re.Pattern):
    """First button with this accessible name inside the 1440x900 frame.

    A closed drawer keeps its own controls mounted and off-canvas, so the
    entry-state control is the one a user could really click.
    """
    candidates = page.get_by_role("button", name=name)
    for index in range(candidates.count()):
        control = candidates.nth(index)
        box = control.bounding_box()
        if not box:
            continue
        if 0 <= box["x"] < VIEWPORT["width"] and 0 <= box["y"] < VIEWPORT["height"]:
            return control
    return None


def check_interactions(page) -> list[str]:
    problems: list[str] = []
    for label, name in INTERACTIONS:
        control = first_onscreen(page, name)
        if control is None:
            problems.append(f"{label}: no on-screen button named {name.pattern}")
            continue
        before = page.evaluate(STATE_JS)
        control.click()
        page.wait_for_timeout(250)
        if page.evaluate(STATE_JS) == before:
            problems.append(f"{label}: clicking {name.pattern} changed no observable state")
    return problems


def render(page, html: Path) -> list[str]:
    problems: list[str] = []
    page.on("pageerror", lambda exc: problems.append(f"pageerror: {exc}"))
    page.on(
        "console",
        lambda msg: problems.append(f"console.{msg.type}: {msg.text}")
        if msg.type in ("error", "warning")
        else None,
    )
    page.on(
        "request",
        lambda req: problems.append(f"remote request: {req.url}")
        if not req.url.startswith(("file:", "data:", "about:"))
        else None,
    )
    page.goto(html.as_uri(), wait_until="load")
    page.wait_for_timeout(400)
    out = SHOTS / f"{html.stem}.png"
    page.screenshot(path=str(out))
    width, height = png_size(out)
    if (width, height) != (VIEWPORT["width"], VIEWPORT["height"]):
        problems.append(f"viewport: got {width}x{height}, want 1440x900")
    measured = page.evaluate(MEASURE_JS)
    for control in measured["undersized"]:
        problems.append(f"hit target below 44x44: {control}")
    print(f"  smallest rendered font: {measured['smallestFont']}px")
    problems.extend(check_interactions(page))
    return problems


def main(argv: list[str]) -> int:
    slugs = argv or [p.stem for p in sorted(HERE.glob("direction-*.html"))]
    SHOTS.mkdir(exist_ok=True)
    failures = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True, executable_path=CHROME, args=["--disable-gpu"]
        )
        for slug in slugs:
            html = HERE / f"{slug}.html"
            if not html.exists():
                print(f"FAIL {slug}: {html} missing")
                failures += 1
                continue
            page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1)
            problems = render(page, html)
            page.close()
            if problems:
                failures += 1
                print(f"FAIL {slug}:")
                for problem in problems:
                    print(f"  {problem}")
            else:
                print(f"PASS {slug} -> screenshots/{slug}.png (1440x900, 0 errors)")
        browser.close()
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

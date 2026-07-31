#!/usr/bin/env python3
"""Render the spec-054 design directions and assert the brief's hard gates.

Gates asserted (exit 1 on any failure):
  1. every direction renders with zero page errors and zero console errors;
  2. every request the page makes is local (file:/data:) — the brief forbids
     network-loaded fonts, images, or scripts. WebSockets and workers are
     separate Playwright events, so they are watched separately: neither is
     allowed at all;
  3. the captured PNG is exactly 1440 x 900 CSS pixels;
  4. every visible interactive control is at least 44 x 44 CSS pixels
     (visually-hidden inputs behind a custom control are exempt);
  5. every text run whose background resolves to an opaque colour clears the
     brief's contrast floor (4.5:1, or 3:1 for large text per WCAG 1.4.3);
  6. under `prefers-reduced-motion: reduce` no element animates or transitions;
  7. the three interactions the brief requires each mutate observable state:
     play/pause, opening a navigation or session surface, and changing a
     visible reader control (next page); and opening the session surface
     leaves the PDF page itself visible and unoccluded, because "the page is
     the anchor" is a layout claim, not a matter of taste.

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


# The brief asks for 4.5:1 text contrast. Only text over a background that
# resolves to an opaque colour can be judged from the DOM, so anything sitting
# on an image or a partially transparent stack is counted as skipped rather
# than silently passed — and a direction where EVERYTHING is unresolvable fails
# the gate instead of sailing through it.
CONTRAST_JS = """
() => {
  // Chrome reports `color-mix()` results as `color(srgb 0.89 0.86 0.95)`,
  // whose components are 0-1 — parsing the digits directly would read those
  // as near-black. A canvas round-trip normalises every colour syntax to
  // non-premultiplied 8-bit sRGB.
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const parse = value => {
    if (!value || value === 'transparent') return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const luminance = ([r, g, b]) => {
    const f = c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const opaqueBackground = el => {
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none') return null;   // over an image
      const colour = parse(style.backgroundColor);
      if (!colour) continue;
      const alpha = colour.length > 3 ? colour[3] : 1;
      if (alpha === 1) return colour.slice(0, 3);
      if (alpha > 0) return null;                          // translucent stack
    }
    return null;
  };
  const low = [];
  let checked = 0;
  let skipped = 0;
  for (const el of document.querySelectorAll('body *')) {
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue;
    const background = opaqueBackground(el);
    const foreground = parse(style.color);
    if (!background || !foreground) { skipped += 1; continue; }
    const alpha = foreground.length > 3 ? foreground[3] : 1;
    if (alpha < 1) { skipped += 1; continue; }
    checked += 1;
    const [lighter, darker] = [luminance(background), luminance(foreground.slice(0, 3))]
      .sort((a, b) => b - a);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    const size = parseFloat(style.fontSize);
    const weight = parseInt(style.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const floor = large ? 3 : 4.5;
    if (ratio < floor) {
      low.push(
        `${ratio.toFixed(2)}:1 (needs ${floor}:1) ${style.color} on rgb(${background}) ` +
        `${size}px ` + JSON.stringify(el.textContent.trim().slice(0, 40))
      );
    }
  }
  return { low, checked, skipped };
}
"""


# The brief calls for reduced-motion-safe transitions. Under an emulated
# `prefers-reduced-motion: reduce` nothing may animate: a direction that only
# declares the media query without actually zeroing its durations fails here.
MOTION_JS = """
() => {
  const moving = [];
  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el);
    const durations = [style.transitionDuration, style.animationDuration]
      .flatMap(value => (value || '').split(',').map(v => parseFloat(v) || 0));
    const longest = Math.max(0, ...durations);
    // The canonical reduced-motion reset sets 0.01ms rather than 0 so that
    // animation/transition events still fire; anything under 20ms is
    // imperceptible and is that idiom, not motion.
    if (longest >= 0.02) {
      moving.push(`${longest}s <${el.tagName.toLowerCase()}> ` +
        JSON.stringify((el.className || '').toString().slice(0, 40)));
    }
  }
  return moving.slice(0, 8);
}
"""


# "The page is the visual anchor" is the brief's central layout claim, so it is
# asserted rather than asked about: after the session surface opens, the real
# fixture page must keep most of its on-screen area AND still be the element
# under its own centre point.
PAGE_JS = """
() => {
  const page = document.querySelector('img[src*="e2e-fixture-page"]');
  if (!page) return null;
  const rect = page.getBoundingClientRect();
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, window.innerWidth);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  const visible = Math.max(0, right - left) * Math.max(0, bottom - top);
  const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
  return { visible, occluded: !(hit && (hit === page || hit.contains(page) || page.contains(hit))) };
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

# The play control additionally has to re-describe itself, because "listening
# state is legible" is the brief's whole point: a direction that starts playing
# while its button still says Play has failed even if the page text changed.
CONTROL_JS = """
el => [el.getAttribute('aria-label'), el.getAttribute('aria-pressed'), el.textContent.trim()].join('|')
"""


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
        # A handle, not the locator: the play control renames itself to Pause,
        # so re-resolving by name after the click would find nothing.
        handle = control.element_handle()
        before = page.evaluate(STATE_JS)
        control_before = handle.evaluate(CONTROL_JS)
        page_before = page.evaluate(PAGE_JS)
        control.click()
        page.wait_for_timeout(250)
        if page.evaluate(STATE_JS) == before:
            problems.append(f"{label}: clicking {name.pattern} changed no observable state")
        if label == "play/pause" and handle.evaluate(CONTROL_JS) == control_before:
            problems.append(
                f"play/pause: the control still describes itself as {control_before!r} after the click"
            )
        if label == "reveal surface":
            problems.extend(check_page_survives(page, page_before))
    return problems


def check_page_survives(page, before) -> list[str]:
    """The fixture page must survive the session surface opening over it."""
    if before is None or before["visible"] == 0:
        return ["reveal surface: no fixture page on screen to protect"]
    after = page.evaluate(PAGE_JS)
    problems: list[str] = []
    kept = after["visible"] / before["visible"]
    if kept < 0.6:
        problems.append(
            f"reveal surface: opening the session surface left only "
            f"{kept:.0%} of the page visible (needs 60%)"
        )
    if after["occluded"]:
        problems.append("reveal surface: the session surface covers the centre of the page")
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
    # Sockets and workers do not surface as requests, so an offline claim that
    # only watches `request` would miss both.
    page.on("websocket", lambda ws: problems.append(f"websocket opened: {ws.url}"))
    page.on("worker", lambda worker: problems.append(f"worker spawned: {worker.url}"))
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

    contrast = page.evaluate(CONTRAST_JS)
    for run in contrast["low"]:
        problems.append(f"text contrast below the floor: {run}")
    if contrast["checked"] == 0:
        problems.append("contrast: no text run had a resolvable background — gate proved nothing")
    print(f"  contrast: {contrast['checked']} runs checked, {contrast['skipped']} unresolvable")

    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(100)
    for element in page.evaluate(MOTION_JS):
        problems.append(f"still animates under prefers-reduced-motion: {element}")
    page.emulate_media(reduced_motion="no-preference")

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

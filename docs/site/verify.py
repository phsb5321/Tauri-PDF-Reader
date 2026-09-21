#!/usr/bin/env python3
"""Render/assert the static site. Requires Playwright + a local Chrome, not a site build."""
import argparse
import functools
import hashlib
import http.server
import json
import re
import shutil
import subprocess
import threading
import xml.etree.ElementTree as ET
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = Path(__file__).resolve().parent
ROOT = SITE.parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True, help="Durable evidence directory")
    parser.add_argument("--chrome", default=shutil.which("google-chrome-stable") or shutil.which("chromium"))
    args = parser.parse_args()
    assert args.chrome, "Chrome/Chromium required; no skipped-green browser gate"
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    # A failed replay must not leave a previous run's PASS receipt.
    (out / "verification.json").unlink(missing_ok=True)
    html = (SITE / "index.html").read_text()
    css = (SITE / "style.css").read_text()
    readme = (ROOT / "README.md").read_text()
    assert "<script" not in html and "@import" not in css
    assert "pending from the capture seat" not in html, "Real product captures are required"
    captures = json.loads((SITE / "product-shots.json").read_text())
    assert {shot["file"] for shot in captures["shots"]} == {"reader.png", "library.png"}
    for shot in captures["shots"]:
        assert hashlib.sha256((SITE / "assets" / shot["file"]).read_bytes()).hexdigest() == shot["sha256"], "Product capture bytes changed"
    colors = set(re.findall(r"#[0-9a-fA-F]{6}\b", html + css + "".join(p.read_text() for p in (SITE / "assets").glob("*.svg"))))
    assert {c.lower() for c in colors} == {"#f4efe4", "#14110d", "#c8462c"}, colors
    ns = {"s": "http://www.w3.org/2000/svg"}
    original = ET.parse(ROOT / "docs/brand/lectrice-mark.svg")
    copied = ET.parse(SITE / "assets/nightingale.svg")
    for tag, attribute in [("path", "d"), ("g", "transform")]:
        assert [e.get(attribute) for e in original.findall(f".//s:{tag}", ns)] == [e.get(attribute) for e in copied.findall(f".//s:{tag}", ns)]
    assert (SITE / "assets/favicon.svg").read_bytes() == (ROOT / "public/lectrice-mark-small.svg").read_bytes()
    for font in ["fraunces", "newsreader"]:
        assert (SITE / f"assets/{font}.woff2").read_bytes()[:4] == b"wOF2"
        assert "SIL OPEN FONT LICENSE" in (SITE / f"assets/{font.title()}-OFL.txt").read_text()

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(SITE)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}/"
    receipt = {"commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(), "screenshots": [], "viewports": [], "fonts": {}}
    errors, external, failures = [], [], []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=args.chrome, headless=True)
            receipt["browser"] = browser.version
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.on("requestfailed", lambda req: failures.append(req.url))
            page.on("response", lambda res: failures.append(f"{res.status} {res.url}") if res.status >= 400 else None)
            def local_only(route):
                if route.request.url.startswith(base):
                    route.continue_()
                else:
                    external.append(route.request.url)
                    route.abort()
            page.route("**/*", local_only)
            page.goto(base)
            page.evaluate("document.fonts.ready")
            assert page.locator('link[rel="stylesheet"]').count() == 1
            assert page.locator("h1").inner_text() == "Lectrice"
            assert page.locator(".tagline").inner_text() == "Every page, read aloud."
            assert page.locator(".product-shot img").count() == 2
            for image in page.locator(".product-shot img").all():
                assert image.locator("..").get_attribute("href") == image.get_attribute("src")
                shot = next(s for s in captures["shots"] if image.get_attribute("src") == "assets/" + s["file"])
                assert image.evaluate("el => [el.naturalWidth, el.naturalHeight]") == [shot["width"], shot["height"]]
            for code in page.locator("pre code").all_text_contents():
                assert code in readme, f"Command drift: {code}"
            for link in page.locator('a[href^="#"]').all():
                assert page.locator(link.get_attribute("href")).count() == 1
            assert page.evaluate("Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)")
            assert page.request.get(base + "assets/favicon.svg").ok
            for name in ["Fraunces", "Newsreader"]:
                assert page.evaluate("name => [...document.fonts].some(f => f.family === name && f.status === 'loaded')", name)
            cdp = page.context.new_cdp_session(page)
            cdp.send("DOM.enable")
            cdp.send("CSS.enable")
            root_node = cdp.send("DOM.getDocument")["root"]["nodeId"]
            for selector, family in [("h1", "Fraunces"), (".introduction", "Newsreader")]:
                node = cdp.send("DOM.querySelector", {"nodeId": root_node, "selector": selector})["nodeId"]
                fonts = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node})["fonts"]
                assert fonts and all(f["isCustomFont"] and family in f["familyName"] for f in fonts), fonts
                receipt["fonts"][selector] = fonts

            def shot(name, target=None):
                # Let viewport/font reflow reach the compositor before capture.
                page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
                path = out / name
                if target is None:
                    page.screenshot(path=str(path), full_page=True)
                else:
                    target.screenshot(path=str(path))
                receipt["screenshots"].append(name)

            # Inspect the real CSS animation on a controlled clock (no product state injection).
            page.evaluate("""() => {
              const line = document.querySelector('.voice-line path');
              if (getComputedStyle(line).animationName !== 'speak') throw new Error('speaking animation missing');
              // Replay the stylesheet animation if slow font/CDP checks outlasted it.
              line.style.animationName = 'none';
              void line.getBoundingClientRect();
              line.style.removeProperty('animation-name');
              window.proofAnimation = line.getAnimations()[0];
              window.proofAnimation.pause(); }""")
            assert page.evaluate("document.getAnimations().length") == 1
            offsets = []
            for time, name in [(0, "voice-start.png"), (1800, "voice-middle.png"), (3600, "voice-end.png")]:
                page.evaluate("t => window.proofAnimation.currentTime = t", time)
                offsets.append(page.locator(".voice-line path").evaluate("el => getComputedStyle(el).strokeDashoffset"))
                shot(name, page.locator(".hero"))
            assert len(set(offsets)) == 3, offsets
            timing = page.evaluate("window.proofAnimation.effect.getTiming()")
            assert timing["iterations"] == 1 and timing["duration"] < 5000
            receipt["motion"] = {"offsets": offsets, "timing": timing}

            for width, height, name in [(1440, 1000, "desktop.png"), (768, 1024, "tablet.png"), (390, 844, "mobile.png"), (320, 720, "narrow.png")]:
                page.set_viewport_size({"width": width, "height": height})
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Overflow at {width}"
                shot(name)
                receipt["viewports"].append({"width": width, "height": height, "noOverflow": True})
            page.set_viewport_size({"width": 640, "height": 900})
            page.evaluate("document.documentElement.style.fontSize = '200%'")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "200% text overflow"
            shot("text-200.png")
            page.evaluate("document.documentElement.style.fontSize = ''")
            page.set_viewport_size({"width": 1440, "height": 1000})
            page.reload()
            page.evaluate("document.fonts.ready")
            page.keyboard.press("Tab")
            assert page.locator(".skip-link").evaluate("el => el === document.activeElement")
            shot("keyboard-focus.png")
            page.keyboard.press("Enter")
            assert page.locator("main").evaluate("el => el === document.activeElement")
            page.get_by_role("link", name="Find your installation").click()
            assert page.url.endswith("#install")
            assert page.locator("#install-title").evaluate("el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }")
            page.locator("summary").focus()
            page.keyboard.press("Enter")
            assert page.locator("details").get_attribute("open") is not None
            shot("install-expanded.png", page.locator("#install"))
            page.emulate_media(reduced_motion="reduce")
            assert page.locator(".voice-line path").evaluate("el => getComputedStyle(el).animationName") == "none"
            assert page.locator(".voice-line path").evaluate("el => el.getAnimations().length") == 0
            page.goto(base)
            page.evaluate("document.fonts.ready")
            shot("reduced-motion.png")
            assert not errors and not external and not failures, (errors, external, failures)
            # file:// is a supported delivery path too; all assets are relative.
            local = browser.new_page()
            local.goto((SITE / "index.html").as_uri())
            local.evaluate("document.fonts.ready")
            assert local.evaluate("Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)")
            assert local.evaluate("[...document.fonts].every(f => f.status === 'loaded')")
            local.close()

            # Every shipped visual asset, including favicon cuts and actual type.
            asset = base + "assets"
            proof = f'''<!doctype html><html lang="en"><meta charset="utf-8"><title>Lectrice asset proof</title>
<style>@font-face{{font-family:Fraunces;src:url("{asset}/fraunces.woff2");font-weight:100 900}}
@font-face{{font-family:Newsreader;src:url("{asset}/newsreader.woff2");font-weight:200 800}}
body{{margin:40px;background:#F4EFE4;color:#14110D;font:24px Newsreader}}h1{{font:600 80px Fraunces;font-variation-settings:"opsz" 144,"WONK" 1;margin:20px 0}}
.row{{display:flex;gap:48px;align-items:center}}.pixel{{image-rendering:pixelated}}p{{margin:16px 0}}img{{object-fit:contain}}</style>
<h1>Lectrice</h1><p>Every page, read aloud. / Newsreader — café, naïve, cœur, São Paulo.</p>
<div class="row"><div><img src="{asset}/nightingale.svg" width="230" height="260"><p>Detail cut · 230 px</p></div>
<div><p>Small cut · native sizes</p>{''.join(f'<img src="{asset}/favicon.svg" width="{s}" height="{s}"> {s} ' for s in [16,24])}
<p>Detail cut · native sizes</p>{''.join(f'<img src="{asset}/nightingale.svg" width="{s}" height="{s}"> {s} ' for s in [32,64])}
<p>Favicon · 128 px inspection</p><img src="{asset}/favicon.svg" width="128" height="128"></div></div>
<p>Unmodified running-app captures (full-size originals in assets/)</p>
<div class="row"><img src="{asset}/reader.png" width="440"><img src="{asset}/library.png" width="440"></div></html>'''
            proof_page = browser.new_page(viewport={"width": 1040, "height": 650})
            proof_page.goto(base)
            proof_page.set_content(proof)
            proof_page.evaluate("document.fonts.ready")
            assert proof_page.evaluate("Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)")
            proof_page.screenshot(path=str(out / "assets.png"), full_page=True)
            receipt["screenshots"].append("assets.png")
            browser.close()
        receipt["productCaptures"] = captures
        receipt.update({"status": "PASS", "consoleErrors": errors, "externalRequests": external, "failedRequests": failures, "fileMode": "PASS", "keyboardAndAnchors": "PASS", "reducedMotion": "PASS"})
        receipt["sha256"] = {str(p.relative_to(SITE)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [SITE / "index.html", SITE / "style.css", *sorted((SITE / "assets").iterdir())]}
        (out / "verification.json").write_text(json.dumps(receipt, indent=2) + "\n")
        print(json.dumps(receipt, indent=2))
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    main()

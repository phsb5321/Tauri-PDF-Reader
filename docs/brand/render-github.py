#!/usr/bin/env python3
"""Render + assert GitHub identity assets. See README.md for the pinned tool command."""
import argparse
import base64
from contextlib import contextmanager
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import tempfile
from threading import Thread
import xml.etree.ElementTree as ET

from PIL import Image, ImageChops, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ASSETS = Path(".github/assets")
EVIDENCE = Path("docs/brand/github-identity")
PAPER = (244, 239, 228)
INK = (20, 17, 13)
VERMILION = (200, 70, 44)
NS = {"s": "http://www.w3.org/2000/svg"}


def contrast(a, b):
    def luminance(rgb):
        channels = [c / 255 for c in rgb]
        linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
        return sum(c * w for c, w in zip(linear, (0.2126, 0.7152, 0.0722)))
    high, low = sorted((luminance(a), luminance(b)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def circle_crop(image):
    size = image.width
    mask = Image.new("L", (size * 4, size * 4))
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    result = image.convert("RGBA")
    result.putalpha(mask.resize(image.size, Image.Resampling.LANCZOS))
    return result


@contextmanager
def local_server():
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def png_uri(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def render(out):
    (out / ASSETS).mkdir(parents=True, exist_ok=True)
    (out / EVIDENCE).mkdir(parents=True, exist_ok=True)
    source = ET.parse(ROOT / "docs/brand/lectrice-mark.svg").getroot()
    seal = ET.parse(ROOT / ASSETS / "lectrice-avatar.svg").getroot()
    # Protect the trace AND the transform: losing potrace's group flips the bird.
    assert seal.find(".//s:path", NS).attrib["d"] == source.find(".//s:path", NS).attrib["d"]
    assert seal.find(".//s:g", NS).attrib["transform"] == source.find(".//s:g", NS).attrib["transform"]
    assert seal.find(".//s:g", NS).attrib["fill"] == "#C8462C"
    assert not seal.findall(".//s:image", NS), "No raster may be embedded in the seal"
    errors = []
    with local_server() as url, sync_playwright() as pw:
        executable = os.environ.get("CHROME_BIN") or shutil.which("google-chrome") or shutil.which("chromium")
        browser = pw.chromium.launch(executable_path=executable, headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 640}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("requestfailed", lambda req: errors.append(f"{req.url}: {req.failure}"))
        # Rendering is offline. No font/CDN fallback or background art downloads.
        def local_only(route):
            if route.request.url.startswith((url, "data:")):
                route.continue_()
            else:
                errors.append(f"Unexpected network request: {route.request.url}")
                route.abort()
        page.route("**/*", local_only)
        page.goto(url + str(ASSETS / "lectrice-social-preview.html"))
        page.evaluate("document.fonts.ready")
        assert page.locator("main").bounding_box() == {"x": 0, "y": 0, "width": 1280, "height": 640}
        fonts = page.evaluate("Array.from(document.fonts, f => ({family: f.family, status: f.status}))")
        assert len(fonts) == 2 and all(f["status"] == "loaded" for f in fonts), fonts
        cdp = page.context.new_cdp_session(page)
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        root_id = cdp.send("DOM.getDocument")["root"]["nodeId"]
        actual_fonts = {}
        for selector, expected in (("h1", "Fraunces"), (".tagline", "Newsreader"), (".category", "Newsreader")):
            node = cdp.send("DOM.querySelector", {"nodeId": root_id, "selector": selector})["nodeId"]
            used = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node})["fonts"]
            assert used and all(f["isCustomFont"] and expected in f["familyName"] for f in used), used
            actual_fonts[selector] = used
            box = page.locator(selector).bounding_box()
            assert box["x"] >= 40 and box["y"] >= 40
            assert box["x"] + box["width"] <= 1240 and box["y"] + box["height"] <= 600, box
        axes = page.locator("h1").evaluate("e => getComputedStyle(e).fontVariationSettings")
        assert all(value in axes for value in ('"opsz" 144', '"wght" 600', '"WONK" 1')), axes
        assert page.locator(".bird path").get_attribute("d") == source.find(".//s:path", NS).attrib["d"]
        assert page.locator(".bird g").get_attribute("transform") == source.find(".//s:g", NS).attrib["transform"]
        page.screenshot(path=str(out / ASSETS / "lectrice-social-preview.png"))
        page.set_viewport_size({"width": 460, "height": 460})
        page.set_content(f'<html><body style="margin:0"><img width="460" height="460" src="{url + str(ASSETS / "lectrice-avatar.svg")}"></body></html>')
        page.wait_for_function("document.images[0].complete && document.images[0].naturalWidth === 460")
        page.screenshot(path=str(out / ASSETS / "lectrice-avatar.png"))
        avatar = Image.open(out / ASSETS / "lectrice-avatar.png").convert("RGB")
        assert avatar.size == (460, 460)
        assert avatar.getpixel((0, 0)) == PAPER
        assert avatar.getcolors(460 * 460) and VERMILION in [color for _, color in avatar.getcolors(460 * 460)]
        # Native 64px proof comes from the SHIPPED upload raster, not a large SVG thumbnail.
        small = avatar.resize((64, 64), Image.Resampling.LANCZOS)
        small.save(out / EVIDENCE / "avatar-64.png")
        for image, name in ((avatar, "avatar-circle-460.png"), (small, "avatar-circle-64.png")):
            crop = circle_crop(image)
            # No ink/vermilion pixel may be removed by the circular crop.
            composite = Image.new("RGBA", image.size, PAPER + (255,))
            composite.alpha_composite(crop)
            assert ImageChops.difference(composite.convert("RGB"), image).getbbox() is None
            crop.save(out / EVIDENCE / name)
        small.resize((256, 256), Image.Resampling.NEAREST).save(out / EVIDENCE / "avatar-64-nearest.png")
        social = Image.open(out / ASSETS / "lectrice-social-preview.png").convert("RGB")
        assert social.size == (1280, 640)
        assert social.getpixel((0, 0)) == PAPER
        # The bird's chest must really be painted, not merely present in the DOM.
        assert social.getpixel((285, 315)) == VERMILION, "Social bird is missing"
        assert (out / ASSETS / "lectrice-social-preview.png").stat().st_size < 1_000_000
        social.resize((640, 320), Image.Resampling.LANCZOS).save(out / EVIDENCE / "social-640.png")
        # Contact sheet preserves the native 64px views alongside a labelled pixel zoom.
        page.set_viewport_size({"width": 1120, "height": 750})
        page.set_content(f'''<html lang="en"><head><meta charset="utf-8"><title>Identity proof</title><style>
          *{{box-sizing:border-box}} body{{margin:0;padding:30px;background:#F4EFE4;color:#14110D;font:18px serif}}
          h1{{font-size:26px;margin:0 0 20px}} h2{{font-size:18px;margin:0 0 12px}}
          .row{{display:flex;gap:40px;margin-bottom:28px}} img{{display:block}}
          .dark{{background:#14110D;padding:16px;width:96px}} .zoom{{image-rendering:pixelated}}
        </style></head><body><h1>Lectrice · actual upload rasters · 1× proof</h1><div class="row">
          <section><h2>Social preview · 640×320</h2><img src="{png_uri(out / EVIDENCE / 'social-640.png')}"></section>
          <section><h2>Avatar · 64px / circle</h2><div class="row">
            <img width="64" height="64" src="{png_uri(out / EVIDENCE / 'avatar-64.png')}">
            <img width="64" height="64" src="{png_uri(out / EVIDENCE / 'avatar-circle-64.png')}"></div>
            <h2>Circle on ink · 64px</h2><div class="dark"><img width="64" height="64" src="{png_uri(out / EVIDENCE / 'avatar-circle-64.png')}"></div>
          </section></div><div class="row"><section><h2>64px raster · nearest-neighbour 4× (not extra detail)</h2>
            <img class="zoom" src="{png_uri(out / EVIDENCE / 'avatar-64-nearest.png')}"></section>
          <section><h2>Checks</h2><p>1280×640 opaque PNG, under 1 MB</p><p>460×460 avatar, circle-safe</p>
            <p>Real local Fraunces 600 · opsz 144 · WONK 1</p><p>Unchanged traced bird, no generated text</p>
            <p>Files only — GitHub settings NOT applied</p></section></div></body></html>''')
        page.wait_for_function("Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)")
        page.screenshot(path=str(out / EVIDENCE / "proof.png"))
        version = browser.version
        browser.close()
    assert not errors, errors
    ratios = {"ink_on_paper": round(contrast(INK, PAPER), 3), "vermilion_on_paper": round(contrast(VERMILION, PAPER), 3)}
    assert ratios["ink_on_paper"] >= 7 and ratios["vermilion_on_paper"] >= 3
    paths = sorted([p for folder in (ASSETS, EVIDENCE) for p in (out / folder).glob("*.png")])
    hashes = {str(p.relative_to(out)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    sources = [ROOT / ASSETS / "lectrice-social-preview.html", ROOT / ASSETS / "lectrice-avatar.svg", ROOT / "docs/brand/lectrice-mark.svg", *sorted((ROOT / "docs/brand/fonts").glob("*.ttf")), Path(__file__).resolve()]
    report = {"browser": version, "errors": errors, "fonts": actual_fonts, "wordmark_axes": axes, "contrast": ratios,
              "sha256": hashes, "source_sha256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}}
    (out / EVIDENCE / "render-report.json").write_text(json.dumps(report, indent=2) + "\n")
    return paths, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Compare fresh renders with committed PNGs without overwriting them")
    args = parser.parse_args()
    if args.check:
        with tempfile.TemporaryDirectory(prefix="lectrice-identity-") as temporary:
            out = Path(temporary)
            paths, report = render(out)
            for generated in paths:
                existing = ROOT / generated.relative_to(out)
                with Image.open(generated) as fresh, Image.open(existing) as saved:
                    assert fresh.size == saved.size and fresh.convert("RGBA").tobytes() == saved.convert("RGBA").tobytes(), f"Render drift: {existing}"
            print(f"PASS: {len(paths)} PNGs reproduce pixel-for-pixel; fonts, trace, crop, dimensions, contrast and offline checks passed.")
    else:
        paths, report = render(ROOT)
        print(f"PASS: rendered {len(paths)} PNGs; {json.dumps(report['contrast'])}; no browser errors.")


if __name__ == "__main__":
    main()

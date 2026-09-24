#!/usr/bin/env python3
"""Rebuild approved brand assets: trace-assets.py BRAND_SOURCE_DIR.

Requires ImageMagick and potrace on PATH. Source rasters stay in the brand
archive; only vectors ship. No polarity inversion: dark foreground is black.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[1])
STATE_SOURCE = SOURCE / 'ai/states/20260921T115658001-keep-this-exact-bird-silhouette-draw-the-same-nightingale-in.png'
EMPTY_SOURCE = SOURCE / 'ai/icons/20260921T090820757-an-empty-state-illustration-for-a-reading-app-on-a-warm-off.png'
INK = '#14110D'
RED = '#C8462C'
SVG = 'http://www.w3.org/2000/svg'


def run(*args):
    subprocess.run([str(arg) for arg in args], check=True)


def body(text):
    # Slice the balanced SVG body, NEVER a regex over possibly nested <g>s.
    root = ET.fromstring(text)
    assert root.tag == f'{{{SVG}}}svg'
    return text[text.index('>', text.index('<svg')) + 1:text.rindex('</svg>')].strip()


def trace(mask, dest, colour):
    run('potrace', '-s', '--turdsize', '4', '--opttolerance', '0.3', mask, '-o', dest)
    text = dest.read_text()
    assert 'scale(0.100000,-0.100000)' in text
    return body(text).replace('fill="#000000"', f'fill="{colour}"')


def write_svg(path, label, geometry):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f'<svg xmlns="{SVG}" viewBox="0 0 24 24" role="img" aria-label="{label}">\n'
                    '<!-- Traced foreground. Preserve the nested potrace transforms. -->\n'
                    f'{geometry}\n</svg>\n')


# Common source y-origin, scale and foot/perch baseline; no per-state auto-fit.
# Singing's long voice is shortened horizontally, anchored at its beak, to
# leave the bird at the same optical scale as the other four states.
PANELS = {
    'idle': (40, 380), 'singing': (430, 535), 'paused': (880, 365),
    'asleep': (1295, 355), 'working': (1720, 395),
}
with tempfile.TemporaryDirectory() as directory:
    tmp = Path(directory)
    for name, (x, width) in PANELS.items():
        crop, mask, raw = tmp / 'crop.png', tmp / 'ink.pbm', tmp / 'raw.svg'
        run('magick', STATE_SOURCE, '-crop', f'{width}x440+{x}+120', '+repage', crop)
        # Red is brighter than 30% gray; isolate it in a second pass below.
        args = ['magick', crop, '-colorspace', 'Gray', '-threshold', '30%']
        if name == 'singing':
            args += ['-fill', 'white', '-draw', 'rectangle 360,0 534,439']
        run(*args, mask)
        ink = trace(mask, raw, INK)
        accent = ''
        if name in ('singing', 'asleep'):
            run('magick', crop, '-fx', 'r>0.4 && r>g*1.4 && r>b*1.4 ? 0 : 1', '-threshold', '50%', mask)
            accent = trace(mask, raw, RED)
            if name == 'singing':
                accent = f'<g transform="translate(320 0) scale(0.42 1) translate(-320 0)">{accent}</g>'
        write_svg(ROOT / f'public/brand/states/{name}.svg', f'Nightingale: {name}',
                  f'<g transform="translate(1 0.8) scale(0.052)">{ink}{accent}</g>')

    crop, mask, raw = tmp / 'empty.png', tmp / 'empty.pbm', tmp / 'empty.svg'
    run('magick', EMPTY_SOURCE, '-crop', '880x820+330+260', '+repage', crop)
    run('magick', crop, '-colorspace', 'Gray', '-threshold', '30%', mask)
    ink = trace(mask, raw, INK)
    run('magick', crop, '-fx', 'r>0.4 && r>g*1.4 && r>b*1.4 ? 0 : 1', '-threshold', '50%', mask)
    accent = trace(mask, raw, RED)
    write_svg(ROOT / 'public/brand/illustrations/empty-library.svg', 'A singing nightingale on two books',
              f'<g transform="translate(1 1.75) scale(0.025)">{ink}{accent}</g>')

manifest = {
    'sources': [{'path': str(p.relative_to(SOURCE)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                for p in (STATE_SOURCE, EMPTY_SOURCE)],
    'state_panels': {name: f'{w}x440+{x}+120' for name, (x, w) in PANELS.items()},
    'state_grid': '24x24; translate(1 0.8) scale(0.052), common y-origin 120',
    'ink_threshold': 'Gray 30%; no negate',
    'accent_mask': 'r>0.4 && r>g*1.4 && r>b*1.4',
    'singing_voice': 'horizontal 0.42 scale anchored at x=320; bird scale unchanged',
    'empty_crop': '880x820+330+260; translate(1 1.75) scale(0.025)',
    'potrace': '1.16; turdsize=4; opttolerance=0.3; complete SVG body retained',
}
(ROOT / 'docs/brand/vector-sources.json').write_text(json.dumps(manifest, indent=2) + '\n')

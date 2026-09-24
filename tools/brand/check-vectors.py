#!/usr/bin/env python3
"""Render actual assets/cuts at 16/48px, assert polarity/bounds, make visual proofs.

First export React output with BRAND_RENDER_DIR=docs/brand/vector-evidence/icons
and the focused lectrice-icons.test.tsx test. Requires librsvg + ImageMagick.
"""
import json
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/brand/vector-evidence'
NS = 'http://www.w3.org/2000/svg'


def run(*args):
    subprocess.run([str(a) for a in args], check=True)


def pixels(path, size):
    alpha = subprocess.check_output(['magick', str(path), '-alpha', 'extract', '-depth', '8', 'gray:-'])
    assert len(alpha) == size * size
    assert all(alpha[y * size + x] == 0 for x, y in ((0, 0), (size-1, 0), (0, size-1), (size-1, size-1))), 'background traced / opaque corners'
    occupied = [(i % size, i // size) for i, value in enumerate(alpha) if value > 64]
    ratio = len(occupied) / (size * size)
    assert 0.04 < ratio < 0.65, f'foreground polarity or scale: {ratio}'
    xs, ys = zip(*occupied)
    bounds = [min(xs), min(ys), max(xs), max(ys)]
    assert max(xs)-min(xs) > size * 0.35 and max(ys)-min(ys) > size * 0.35, f'tiny fragment: {bounds}'
    return {'coverage': round(ratio, 4), 'bounds': bounds, 'corners': 'transparent'}


OUT.mkdir(parents=True, exist_ok=True)
assets = sorted((ROOT / 'public/brand/states').glob('*.svg')) + list((ROOT / 'public/brand/illustrations').glob('*.svg'))
assert len(assets) == 6
small = sorted((ROOT / 'docs/brand/small-cuts').glob('*.svg'))
assert len(small) == 6
icons = sorted((OUT / 'icons').glob('*-16.svg')) + sorted((OUT / 'icons').glob('*-48.svg'))
assert len(icons) == 12, 'export actual React output first'
results = []
with tempfile.TemporaryDirectory() as directory:
    tmp = Path(directory)
    sheets = {'assets': [], 'small-cuts': [], 'icons': []}
    native = []
    for source, category in [(p, 'assets') for p in assets] + [(p, 'small-cuts') for p in small] + [(p, 'icons') for p in icons]:
        root = ET.parse(source).getroot()
        assert root.attrib['viewBox'] == '0 0 24 24'
        assert any('scale(0.100000,-0.100000)' in g.get('transform', '') for g in root.iter(f'{{{NS}}}g')), source
        assert not any(el.tag.rsplit('}', 1)[-1] in ('image', 'script', 'foreignObject') for el in root.iter())
        sizes = (int(source.stem.rsplit('-', 1)[-1]),) if category == 'icons' else (16, 48)
        for size in sizes:
            label = f'{category}-{source.stem}-{size}'
            png = OUT / f'{label}.png'
            run('rsvg-convert', '-w', size, '-h', size, source, '-o', png)
            results.append({'source': str(source.relative_to(ROOT)), 'size': size, **pixels(png, size)})
            zoom = tmp / f'{label}.png'
            run('magick', png, '-background', '#F4EFE4', '-alpha', 'remove', '-filter', 'point',
                '-resize', '192x192', '-gravity', 'south', '-background', '#F4EFE4', '-splice', '0x24',
                '-font', 'DejaVu-Sans', '-pointsize', '12', '-annotate', '0', f'{source.stem} at {size}px', zoom)
            sheets[category].append(zoom)
            tile = tmp / f'native-{label}.png'
            run('magick', png, '-background', '#F4EFE4', '-alpha', 'remove', '-gravity', 'center',
                '-extent', '150x72', '-gravity', 'south', '-splice', '0x24', '-font', 'DejaVu-Sans',
                '-pointsize', '10', '-annotate', '0', f'{source.stem} / {size}px', tile)
            native.append(tile)
    for category, files in sheets.items():
        run('magick', 'montage', *files, '-tile', '6x2', '-geometry', '+4+4', '-background', '#F4EFE4', OUT / f'{category}-inspection.png')
    run('magick', 'montage', *native, '-tile', '6x', '-geometry', '+4+4', '-background', '#F4EFE4', OUT / 'native-sizes.png')

    # Negative controls prove the two historic failure modes cannot pass.
    original = ET.parse(ROOT / 'public/brand/states/idle.svg').getroot()
    for fault in ('missing-transform', 'background-polarity'):
        mutant = ET.fromstring(ET.tostring(original))
        if fault == 'missing-transform':
            for group in mutant.iter(f'{{{NS}}}g'):
                if 'scale(0.100000,-0.100000)' in group.get('transform', ''):
                    del group.attrib['transform']
        else:
            mutant.insert(0, ET.Element(f'{{{NS}}}rect', width='24', height='24', fill='black'))
        bad_svg, bad_png = tmp / 'bad.svg', tmp / 'bad.png'
        ET.ElementTree(mutant).write(bad_svg)
        run('rsvg-convert', '-w', '48', '-h', '48', bad_svg, '-o', bad_png)
        try:
            pixels(bad_png, 48)
        except AssertionError:
            print(f'Negative control rejected: {fault}')
        else:
            raise AssertionError(f'Checker failed to reject {fault}')

(OUT / 'checks.json').write_text(json.dumps(results, indent=2) + '\n')
print(f'PASS: {len(results)} renders; transforms, foreground bounds, polarity, transparent corners; two negative controls rejected.')

#!/usr/bin/env python3
"""Clearer pictures for body parts: a child's face with the part highlighted and a finger pointing at it.

Built from Google Noto Emoji SVGs (Apache 2.0): 🧒 1f9d2, 👈 1f448, 😛 1f61b, 😁 1f601.
Output: assets/img/<id>.svg (the items carry "custom": true, so build_assets.py won't overwrite them).
    python3 tools/compose_pictures.py
"""
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_io import ROOT, dump, load  # noqa: E402

NOTO = "https://fonts.gstatic.com/s/e/notoemoji/latest/{code}/emoji.svg"
FINGERTIP = (9, 49)          # where the finger of 👈 ends, in its 128×128 box
HAND_BOX = (55, 10, 123, 105)  # the fist part of 👈 (for the picture bounds)

# id: base face, highlight shapes (cx, cy, rx, ry), fingertip target (or None), hand scale, extra drawing
PICTURES = {
    "koz":   {"base": "1f9d2", "marks": [(42, 80, 10, 10), (85, 80, 10, 10)], "point": (94, 80), "scale": 0.5},
    "qulaq": {"base": "1f9d2", "marks": [(114, 84, 11, 16)], "point": (124, 84), "scale": 0.45, "ear": True},
    "muryn": {"base": "1f9d2", "marks": [(64, 90, 11, 9)], "point": (73, 91), "scale": 0.5, "nose": True},
    "auyz":  {"base": "1f9d2", "marks": [(64, 103, 20, 10)], "point": (85, 103), "scale": 0.5},
    "til":   {"base": "1f61b", "marks": [(65, 104, 22, 22)], "point": None},
    "tis":   {"base": "1f601", "marks": [(66, 85, 44, 20)], "point": None},
}

_cache = {}


def noto(code):
    if code not in _cache:
        req = urllib.request.Request(NOTO.format(code=code), headers={"User-Agent": "bul-kim-builder"})
        with urllib.request.urlopen(req, timeout=30) as r:
            _cache[code] = r.read().decode("utf-8")
    return _cache[code]


def inner(svg, prefix):
    """Contents of an SVG document with ids prefixed, so two emojis can live in one file."""
    body = svg[svg.index(">", svg.index("<svg")) + 1: svg.rindex("</svg>")]
    body = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{prefix}{m.group(1)}"', body)
    body = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{prefix}{m.group(1)})", body)
    body = re.sub(r'(xlink:href|href)="#([^"]+)"', lambda m: f'{m.group(1)}="#{prefix}{m.group(2)}"', body)
    return body


def compose(spec):
    parts = []
    x0, y0, x1, y1 = 0, 0, 128, 128
    parts.append(f'<g>{inner(noto(spec["base"]), "f_")}</g>')
    if spec.get("nose"):  # the Noto child has a tiny nose: draw a clearer one
        parts.append('<ellipse cx="64" cy="90" rx="7.5" ry="5.5" fill="#E8A200"/>'
                     '<ellipse cx="61.6" cy="88.4" rx="2.3" ry="1.4" fill="#FFE082" opacity=".9"/>')
    if spec.get("ear"):  # the right ear hides behind the hair: draw a bigger one on top
        parts.append('<path d="M106 72c6-6 15-3 15 9 0 10-6 17-13 16-3 0-4-2-3-4" fill="#E59600"/>'
                     '<path d="M110 78c3-2 6 0 6 4s-2 6-5 6" fill="none" stroke="#B36B00" stroke-width="2" stroke-linecap="round"/>')
    for i, (cx, cy, rx, ry) in enumerate(spec["marks"]):
        parts.append(f'<ellipse class="mark" style="animation-delay:{i * 0.15}s" cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"/>')
    if spec.get("point"):
        s = spec["scale"]
        tx, ty = spec["point"][0] - FINGERTIP[0] * s, spec["point"][1] - FINGERTIP[1] * s
        parts.append(f'<g class="hand"><g transform="translate({tx:.1f} {ty:.1f}) scale({s})">{inner(noto("1f448"), "h_")}</g></g>')
        x1 = max(x1, tx + HAND_BOX[2] * s)
        y1 = max(y1, ty + HAND_BOX[3] * s)
    # square view box around face + hand, face kept as large as possible
    w, h = x1 - x0, y1 - y0
    side = max(w, h) + 6
    vx, vy = x0 - (side - w) / 2, y0 - (side - h) / 2
    style = (
        "<style>"
        ".mark{fill:none;stroke:#FF3D71;stroke-width:4.2;paint-order:stroke;filter:drop-shadow(0 0 1.5px #fff);transform-box:fill-box;transform-origin:center;"
        "animation:mark 1.6s ease-in-out infinite}"
        "@keyframes mark{0%,100%{opacity:.45;transform:scale(.9)}50%{opacity:1;transform:scale(1.08)}}"
        ".hand{animation:tap 1.6s ease-in-out infinite}"
        "@keyframes tap{0%,100%{transform:translate(0,0)}50%{transform:translate(-2.5px,0)}}"
        "@media (prefers-reduced-motion:reduce){.mark,.hand{animation:none}}"
        "</style>"
    )
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'viewBox="{vx:.1f} {vy:.1f} {side:.1f} {side:.1f}">{style}{"".join(parts)}</svg>\n')


def main():
    out = ROOT / "assets" / "img"
    for key, spec in PICTURES.items():
        (out / f"{key}.svg").write_text(compose(spec), "utf-8")
        print(f"  ✎ assets/img/{key}.svg")
    cfg = load()
    for s in cfg["sets"]:
        for it in s["items"]:
            if it["id"] in PICTURES:
                it["custom"] = True
                it["anim"] = False  # the picture animates itself (pulsing mark, tapping finger)
    dump(cfg)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Clearer pictures: a child's face with the body part highlighted and a finger pointing at it,
and actions acted out (eating from a spoon, drinking from a glass, "all done" hands).

Built from Google Noto Emoji SVGs (Apache 2.0): 🧒 1f9d2, 👈 1f448, 😛 1f61b, 😁 1f601, 🥄 1f944, ✋ 270b,
and our water glass (assets/img/su.svg, itself a recoloured Noto 🥛).
Output: assets/img/<id>.svg (the items carry "custom": true, so build_assets.py won't overwrite them).
    python3 tools/compose_pictures.py
"""
import math
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
    # actions: layers = (source, native bbox, anchor in source, placed at, angle, scale, mirror, css class)
    "zhe": {"base": "1f9d2", "marks": [], "point": None, "mouth": "open",
            "layers": [("1f944", (8, 2, 124, 128), (30, 28), (71, 118), -28, 0.55, False, "spoon", "porridge")]},
    "ish": {"base": "1f9d2", "marks": [], "point": None, "mouth": "o",
            "layers": [("img:su", (26, 4, 98, 124), (62, 10), (71, 101), -42, 0.46, False, "sip", None)]},
    "bitti": {"base": "1f9d2", "marks": [], "point": None,
              "layers": [("270b", (26, 6, 114, 124), (64, 118), (116, 124), 18, 0.42, False, "palm", None),
                         ("270b", (26, 6, 114, 124), (64, 118), (12, 124), -18, 0.42, True, "palm", None),
                         ("1f963", (4, 20, 124, 122), (64, 64), (64, 146), 0, 0.42, False, "", None)]},
    # Сәлем: the child waves
    "salem": {"base": "1f9d2", "marks": [], "point": None,
              "layers": [("1f44b", (10, 6, 115, 120), (78, 118), (126, 124), 8, 0.5, False, "wave", None)]},
    # Рақмет: folded hands under the chin, a little bow
    "raqmet": {"base": "1f9d2", "marks": [], "point": None, "head": "bow",
               "layers": [("1f64f", (14, 4, 112, 124), (64, 110), (64, 162), 0, 0.55, False, "inhead", None)]},
    # Иә: nodding + thumbs up
    "iia": {"base": "1f9d2", "marks": [], "point": None, "head": "nod",
            "layers": [("1f44d", (14, 8, 115, 122), (64, 64), (134, 104), 0, 0.4, False, "", None)]},
    # Жоқ: shaking the head + wagging finger
    "zhoq": {"base": "1f9d2", "marks": [], "point": None, "head": "shake", "mouth": "flat",
             "layers": [("261d_fe0f", (24, 4, 98, 124), (64, 122), (132, 128), 0, 0.42, False, "wag", None)]},
    # Шомыл: the child in the bath, bubbles rising
    "shomyl": {"base": "1f6c0", "marks": [], "point": None, "bubbles": True},
    # food with the right contents
    "botqa": {"base": "1f963", "marks": [], "point": None,
              # the bowl's opening becomes porridge; the spoon's shadow on it a darker porridge
              "recolor": {'style="fill:#1D89FE;" d="M12.27,54.07': 'style="fill:#F1D9A7;" d="M12.27,54.07', "#025ABC": "#D8B97E"},
              "extra": '<ellipse cx="44" cy="54" rx="22" ry="3.6" fill="#FFF3D6" opacity=".8"/>'
                       '<rect x="34" y="49.5" width="13" height="7" rx="2" fill="#FFE066" stroke="#F4C430" stroke-width="1"/>'},
    "shai": {"base": "1f375", "marks": [], "point": None, "recolor": {"#7DB240": "#B9875A", "#AAD876": "#D9B08A"}},
}
SELF_ANIMATED = {"koz", "qulaq", "muryn", "auyz", "til", "tis", "zhe", "ish", "bitti", "salem", "raqmet", "iia", "zhoq", "shomyl"}

MOUTHS = {  # replaces the smile of 🧒
    "flat": '<path d="M55 102h18" stroke="#795548" stroke-width="4.5" stroke-linecap="round"/>',
    "open": '<ellipse cx="64" cy="101" rx="9.5" ry="7.5" fill="#6D4C41"/><ellipse cx="64" cy="105" rx="6" ry="3" fill="#EC6C8C"/>',
    "o": '<ellipse cx="64.5" cy="101" rx="4.6" ry="4.2" fill="#6D4C41"/>',
}
PORRIDGE = '<ellipse cx="30" cy="27" rx="15" ry="11" fill="#F3DDB0"/><ellipse cx="25" cy="23" rx="5" ry="3" fill="#FFF4DC"/>'


def place(pt, anchor, at, angle, scale, mirror):
    """Where a point of a layer lands after: translate(at) rotate(angle) scale(±scale, scale) translate(-anchor)."""
    x, y = (pt[0] - anchor[0]) * scale * (-1 if mirror else 1), (pt[1] - anchor[1]) * scale
    a = math.radians(angle)
    return at[0] + x * math.cos(a) - y * math.sin(a), at[1] + x * math.sin(a) + y * math.cos(a)

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
    face = inner(noto(spec["base"]), "f_")
    for a, b in spec.get("recolor", {}).items():
        face = face.replace(a, b)
    if spec.get("mouth"):
        face = re.sub(r'<path id="f_mouth"[^>]*/>', "", face, flags=re.S)
    parts.append(f"<g>{face}</g>")
    if spec.get("mouth"):
        parts.append(MOUTHS[spec["mouth"]])
    if spec.get("extra"):
        parts.append(spec["extra"])
    if spec.get("bubbles"):
        for i, (bx, by, r) in enumerate([(52, 66, 5), (70, 70, 4), (88, 64, 6), (104, 68, 4), (40, 60, 3.5)]):
            parts.append(f'<circle class="bubble" style="animation-delay:{i * 0.45}s" cx="{bx}" cy="{by}" r="{r}" '
                         f'fill="#E1F5FE" stroke="#81D4FA" stroke-width="1.2"/>')
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
    head_extra = []
    for n, (src, box, anchor, at, angle, scale, mirror, cls, extra) in enumerate(spec.get("layers", [])):
        body = inner((ROOT / "assets" / "img" / f"{src[4:]}.svg").read_text("utf-8") if src.startswith("img:") else noto(src), f"l{n}_")
        if extra == "porridge":
            body += PORRIDGE
        sx = -scale if mirror else scale
        tf = f"translate({at[0]} {at[1]}) rotate({angle}) scale({sx} {scale}) translate({-anchor[0]} {-anchor[1]})"
        parts.append(f'<g class="{cls}" style="transform-origin:{at[0]}px {at[1]}px"><g transform="{tf}">{body}</g></g>')
        if cls == "inhead":  # moves together with the head
            parts[-1] = parts[-1].replace('class="inhead"', 'class=""')
            head_extra.append(parts.pop())
        for corner in [(box[0], box[1]), (box[2], box[1]), (box[0], box[3]), (box[2], box[3])]:
            cx, cy = place(corner, anchor, at, angle, scale, mirror)
            x0, y0, x1, y1 = min(x0, cx), min(y0, cy), max(x1, cx), max(y1, cy)
    if spec.get("head"):  # the face (and what moves with it) nods / shakes / bows around the neck
        parts[0] = f'<g class="{spec["head"]}" style="transform-origin:64px 126px">{parts[0]}{"".join(head_extra)}</g>'
    else:
        parts.extend(head_extra)
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
        ".spoon,.sip,.palm{transform-box:view-box}"
        ".spoon{animation:feed 1.6s ease-in-out infinite}"
        "@keyframes feed{0%,100%{transform:translate(5px,7px)}50%{transform:translate(0,0)}}"
        ".sip{animation:sip 2s ease-in-out infinite}"
        "@keyframes sip{0%,100%{transform:rotate(10deg)}50%{transform:rotate(-6deg)}}"
        ".palm{animation:twist .9s ease-in-out infinite alternate}"
        "@keyframes twist{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}"
        ".wave,.wag,.nod,.shake,.bow{transform-box:view-box}"
        ".wave{animation:wave 1s ease-in-out infinite alternate}"
        "@keyframes wave{from{transform:rotate(-16deg)}to{transform:rotate(14deg)}}"
        ".wag{animation:wag .5s ease-in-out infinite alternate}"
        "@keyframes wag{from{transform:rotate(-16deg)}to{transform:rotate(16deg)}}"
        ".nod{animation:nod 1s ease-in-out infinite}"
        "@keyframes nod{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(5px) rotate(0) scaleY(.97)}}"
        ".shake{animation:shake 1s ease-in-out infinite}"
        "@keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}"
        ".bow{animation:bow 2.2s ease-in-out infinite}"
        "@keyframes bow{0%,60%,100%{transform:rotate(0) translateY(0)}30%{transform:translateY(5px) rotate(0)}}"
        ".bubble{transform-box:fill-box;transform-origin:center;animation:bubble 2.4s ease-in infinite;opacity:0}"
        "@keyframes bubble{0%{opacity:0;transform:translate(0,0) scale(.6)}15%{opacity:1}100%{opacity:0;transform:translate(4px,-46px) scale(1.2)}}"
        "@media (prefers-reduced-motion:reduce){.mark,.hand,.spoon,.sip,.palm,.wave,.wag,.nod,.shake,.bow,.bubble{animation:none}}"
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
                it["anim"] = False
                it["emoji"] = PICTURES[it["id"]]["base"]
                if it["id"] in SELF_ANIMATED:
                    it["selfanim"] = True  # the picture moves by itself: the page doesn't add its own bobbing
    dump(cfg)


if __name__ == "__main__":
    main()

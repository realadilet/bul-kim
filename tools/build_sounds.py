#!/usr/bin/env python3
"""Нарезает звуки животных/предметов из записей Wikimedia Commons.

Источник каждого звука и место нарезки записаны в tools/sounds.json:
    "mysyq": {"title": "File:...", "url": "...", "page": "...", "license": "...",
              "author": "...", "start": 32.16, "dur": 2.6}
Результат: assets/sounds/<id>.mp3, флаг "sound": true в content.json, файл CREDITS.md.

Запуск из корня проекта (нужен только ffmpeg):
    python3 tools/build_sounds.py            # только недостающие
    python3 tools/build_sounds.py --force    # всё заново
"""
import argparse
import html
import json
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_io import ROOT, dump, load  # noqa: E402

SOUNDS = ROOT / "tools" / "sounds.json"
CACHE = ROOT / "tools" / ".cache"
OUT = ROOT / "assets" / "sounds"
UA = "bul-kim-builder/1.0 (https://github.com/realadilet/bul-kim)"
TARGET_LUFS = -23.0   # чуть тише голоса (≈ -21 LUFS), чтобы слово оставалось главным
MAX_LEN = 3.0
SR = 32000


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=True, **kw)


def fetch(src):
    CACHE.mkdir(parents=True, exist_ok=True)
    name = re.sub(r"[^\w.-]+", "_", src["title"].removeprefix("File:"))[-100:]
    dest = CACHE / name
    if not dest.exists():
        req = urllib.request.Request(src["url"], headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            dest.write_bytes(r.read())
        time.sleep(1.0)  # Wikimedia просит не частить
    return dest


def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).stdout)


def lufs(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
                         capture_output=True, text=True, timeout=120).stderr
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    return float(m[-1]) if m else -30.0


def volume(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
                         capture_output=True, text=True, timeout=120).stderr
    mean = re.search(r"mean_volume:\s+(-?[\d.]+) dB", err)
    peak = re.search(r"max_volume:\s+(-?[\d.]+) dB", err)
    return float(mean.group(1)) if mean else -30.0, float(peak.group(1)) if peak else -1.0


def build(key, src, sources, tmp):
    base = sources[src["derive"]] if "derive" in src else src
    raw = fetch(base)
    # 1) вырезаем окно как есть
    win = tmp / f"{key}-win.wav"
    start = max(0.0, base.get("start", 0) - 0.15)
    pre = f"{src['af']}," if "af" in src else ""
    run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-t", f"{base.get('dur', 2.6) + 0.4:.2f}",
         "-i", str(raw), "-ac", "1", "-ar", str(SR), "-af", f"{pre}highpass=f=60", str(win)])
    # 2) поднимаем пик до -1 dB и только потом срезаем тишину по краям (иначе тихие записи исчезают)
    _, peak = volume(win)
    trim = "silenceremove=start_periods=1:start_threshold=-32dB"
    cut = tmp / f"{key}-cut.wav"
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(win),
         "-af", f"volume={-1 - peak:.1f}dB,{trim},areverse,{trim},areverse,atrim=0:{MAX_LEN}", str(cut)])
    try:
        d = duration(cut)
    except ValueError:
        d = 0.0
    if d < 0.25:  # обрезка съела всё — берём окно целиком
        cut, d = win, duration(win)
    # 3) выравниваем громкость (для очень коротких клипов LUFS не меряется — берём среднее)
    loud = lufs(cut) if d >= 0.6 else volume(cut)[0]
    gain = max(-30.0, min(30.0, TARGET_LUFS - loud))
    fade = min(0.3, d / 3)
    dest = OUT / f"{key}.mp3"
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(cut),
         "-af", f"volume={gain:.1f}dB,afade=t=in:d=0.02,afade=t=out:st={d - fade:.2f}:d={fade:.2f},alimiter=limit=0.9",
         "-ac", "1", "-ar", str(SR), "-b:a", "64k", str(dest)])
    print(f"  ♪ {dest.relative_to(ROOT)}  {d:.1f}s  gain {gain:+.1f} dB")


def credits(sources, cfg):
    names = {it["id"]: it for s in cfg["sets"] for it in s["items"]}
    rows = []
    for key, src in sources.items():
        it = names.get(key, {"kk": key, "ru": ""})
        if "derive" in src:
            base = sources[src["derive"]]
            note = f"өзгертілген / изменено: {names[src['derive']]['kk']}"
        else:
            base, note = src, ""
        title = base["title"].removeprefix("File:")
        author = html.unescape(base["author"]).replace("|", "/")
        rows.append(f"| {it['kk']} ({it['ru']}) | [{title}]({base['page']}) {note} | {author} | {base['license']} |")
    text = [
        "# Дыбыстар / Звуки",
        "",
        "Жануарлар мен заттардың дыбыстары [Wikimedia Commons](https://commons.wikimedia.org) жазбаларынан қиылып,",
        "дыбыс деңгейі теңестірілді. Әр жазба өз лицензиясымен таратылады (CC BY / CC BY-SA жазбаларының",
        "өңделген нұсқалары да сол лицензиямен).",
        "",
        "Звуки животных и предметов вырезаны из записей Wikimedia Commons, громкость выровнена.",
        "Каждый фрагмент распространяется под лицензией исходной записи (для CC BY-SA — под той же лицензией).",
        "",
        "| Сөз / Слово | Дереккөз / Источник | Автор | Лицензия |",
        "|---|---|---|---|",
        *rows,
        "",
        "Суреттер / Картинки: [Noto Emoji](https://github.com/googlefonts/noto-emoji) (Apache 2.0),",
        "[Noto Animated Emoji](https://googlefonts.github.io/noto-emoji-animation/) (CC BY 4.0), Google.",
        "«Су» суреті — Noto 🥛 (1f95b) негізінде, түсі өзгертілген / картинка «Су» — перекрашенный Noto 🥛 (Apache 2.0).",
        "Дене мүшелерінің суреттері Noto 🧒 👈 😛 😁 негізінде құрастырылған (tools/compose_pictures.py) / "
        "картинки частей тела собраны из Noto 🧒 👈 😛 😁 (Apache 2.0).",
        "Дауыс / Голос: Microsoft Aigul (kk-KZ) через [edge-tts](https://github.com/rany2/edge-tts).",
        "Қаріп / Шрифт: Nunito (SIL OFL). Анимация ойнатқышы / Плеер: lottie-web (MIT).",
        "",
    ]
    (ROOT / "CREDITS.md").write_text("\n".join(text), "utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    sources = json.loads(SOUNDS.read_text("utf-8"))
    cfg = load()
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as t:
        for key, src in sources.items():
            if args.force or not (OUT / f"{key}.mp3").exists():
                print(key)
                build(key, src, sources, Path(t))
    have = {p.stem for p in OUT.glob("*.mp3")}
    for s in cfg["sets"]:
        for it in s["items"]:
            it["sound"] = it["id"] in have
    dump(cfg)
    credits(sources, cfg)
    print(f"готово: {len(have)} звуков")


if __name__ == "__main__":
    main()

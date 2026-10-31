#!/usr/bin/env python3
"""Скачивает картинки/анимации и генерирует казахскую озвучку для animals.json.

Нужно: python3, ffmpeg, пакет edge-tts (pip install edge-tts).
Запуск из корня проекта:
    python3 tools/build_assets.py            # докачать/доозвучить только новое
    python3 tools/build_assets.py --force    # переозвучить всё заново
    python3 tools/build_assets.py --only maimyl --force
"""
import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOTO = "https://fonts.gstatic.com/s/e/notoemoji/latest/{code}/{file}"


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "bul-kim-builder"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    dest.write_bytes(data)
    print(f"  ↓ {dest.relative_to(ROOT)} ({len(data) // 1024} KB)")


async def tts(text: str, dest: Path, voice: str, rate: str) -> None:
    import edge_tts  # pip install edge-tts

    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "raw.mp3"
        await edge_tts.Communicate(text, voice, rate=rate).save(str(raw))
        # обрезаем тишину в начале и в конце, чтобы звук начинался сразу
        trim = "silenceremove=start_periods=1:start_threshold=-45dB"
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw),
             "-af", f"{trim},areverse,{trim},areverse,apad=pad_dur=0.08",
             "-ac", "1", "-ar", "24000", "-b:a", "48k", str(dest)],
            check=True, timeout=60,
        )
    print(f"  ♪ {dest.relative_to(ROOT)}  «{text}»")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="переозвучить существующие mp3")
    ap.add_argument("--only", help="id одного животного")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("Нужен ffmpeg (brew install ffmpeg)")

    cfg = json.loads((ROOT / "animals.json").read_text("utf-8"))
    voice, rate = cfg["voice"], cfg.get("rate", "+0%")
    img, anim, audio = (ROOT / "assets" / d for d in ("img", "anim", "audio"))
    for d in (img, anim, audio):
        d.mkdir(parents=True, exist_ok=True)

    jobs = [(a["id"], a["kk"], a) for a in cfg["animals"]]
    jobs += [(f"_{k}", v, None) for k, v in cfg.get("phrases", {}).items()]

    sem = asyncio.Semaphore(6)

    async def build(key, text, a):
        async with sem:
            if a:
                svg = img / f"{key}.svg"
                if not svg.exists():
                    await asyncio.to_thread(download, NOTO.format(code=a["emoji"], file="emoji.svg"), svg)
                lottie = anim / f"{key}.json"
                if a.get("anim") and not lottie.exists():
                    await asyncio.to_thread(download, NOTO.format(code=a["emoji"], file="lottie.json"), lottie)
            mp3 = audio / f"{key}.mp3"
            if args.force or not mp3.exists():
                await tts(text, mp3, voice, rate)

    await asyncio.gather(*(build(*j) for j in jobs if not args.only or j[0] == args.only))

if __name__ == "__main__":
    asyncio.run(main())

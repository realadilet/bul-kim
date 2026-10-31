#!/usr/bin/env python3
"""Скачивает картинки/анимации и генерирует казахскую озвучку для content.json.

Нужно: python3, ffmpeg, пакет edge-tts (pip install edge-tts).
Запуск из корня проекта:
    python3 tools/build_assets.py              # докачать/доозвучить только новое
    python3 tools/build_assets.py --force      # переозвучить всё заново
    python3 tools/build_assets.py --only maimyl --force

Для каждого слова получается:
    assets/img/<id>.svg       картинка
    assets/anim/<id>.json     анимация (если "anim": true)
    assets/audio/<id>.mp3     «Маймыл»
    assets/audio/q_<id>.mp3   «Маймыл қайда?» (для игры)
"""
import argparse
import asyncio
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_io import ROOT, load  # noqa: E402

NOTO = "https://fonts.gstatic.com/s/e/notoemoji/latest/{code}/{file}"
GAME_EMOJI = "1f389"  # 🎉 картинка для кнопки «Ойын»


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
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-loglevel", "error", "-y", "-i", str(raw),
            "-af", f"{trim},areverse,{trim},areverse,apad=pad_dur=0.08",
            "-ac", "1", "-ar", "24000", "-b:a", "48k", str(dest))
        if await asyncio.wait_for(proc.wait(), 60) != 0:
            raise RuntimeError(f"ffmpeg failed for {dest}")
    print(f"  ♪ {dest.relative_to(ROOT)}  «{text}»")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="переозвучить существующие mp3")
    ap.add_argument("--only", help="id одного слова")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("Нужен ffmpeg (brew install ffmpeg)")

    cfg = load()
    voice, rate = cfg["voice"], cfg.get("rate", "+0%")
    img, anim, audio = (ROOT / "assets" / d for d in ("img", "anim", "audio"))
    for d in (img, anim, audio):
        d.mkdir(parents=True, exist_ok=True)

    downloads = []   # (url, dest)
    speech = []      # (text, dest)
    for s in cfg["sets"]:
        for it in s["items"]:
            key = it["id"]
            if args.only and key != args.only:
                continue
            if not it.get("custom"):  # "custom": true — свой рисунок в assets/img, не скачиваем
                downloads.append((NOTO.format(code=it["emoji"], file="emoji.svg"), img / f"{key}.svg"))
            if it.get("anim"):
                downloads.append((NOTO.format(code=it["emoji"], file="lottie.json"), anim / f"{key}.json"))
            speech.append((it["kk"], audio / f"{key}.mp3"))
            speech.append((cfg["question"].format(kk=it["kk"]), audio / f"q_{key}.mp3"))
    if not args.only:
        downloads.append((NOTO.format(code=GAME_EMOJI, file="emoji.svg"), img / "_game.svg"))
        for k, text in cfg.get("phrases", {}).items():
            speech.append((text, audio / f"_{k}.mp3"))

    for url, dest in downloads:
        if not dest.exists():
            download(url, dest)

    sem = asyncio.Semaphore(6)

    async def one(text, dest):
        async with sem:
            await tts(text, dest, voice, rate)

    todo = [(t, d) for t, d in speech if args.force or not d.exists()]
    await asyncio.gather(*(one(t, d) for t, d in todo))
    print(f"готово: {len(todo)} новых записей")


if __name__ == "__main__":
    asyncio.run(main())

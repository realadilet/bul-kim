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
    assets/audio/q_<id>.mp3   «Маймыл қайда?»       (игра)
    assets/audio/f_<id>.mp3   «Маймылды таптың!»    (игра, правильно)
    assets/audio/b_<id>.mp3   «Бұл — маймыл.»       (игра, неправильно)
    assets/audio/c_<id>.mp3   «Маймыл ма?»          (игра «выбери»)
    assets/audio/h_<id>.mp3   «Үйден допты тап!»    (наборы с "home": true)
    assets/audio/s_<id>.mp3   «Мұрныңды көрсет!»    (поле "show")
Тексты этих фраз пишутся в assets/phrases.json — их показывает страница.
"""


def phrases_for(it, s, tpl):
    """Generated sentences for one word (see kazakh.py for the grammar)."""
    kk = it["kk"]
    a = it.get("acc") or acc(kk)
    low = lambda t: t[:1].lower() + t[1:]
    out = {}
    if s.get("quiz", True):
        out["q"] = tpl["question"].format(kk=kk)
        out["f"] = tpl["found"].format(acc=a)
        out["b"] = tpl["this"].format(low=low(kk))
        out["c"] = tpl["choice"].format(kk=kk, q=it.get("q") or q(kk))
    if s.get("home"):
        out["h"] = tpl["home"].format(acc_low=low(a))
    if it.get("show"):
        out["s"] = it["show"]
    return out
import argparse
import asyncio
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_io import ROOT, load  # noqa: E402
from kazakh import acc, q  # noqa: E402
import json  # noqa: E402

NOTO = "https://fonts.gstatic.com/s/e/notoemoji/latest/{code}/{file}"
GAME_EMOJI = "1f389"  # 🎉 картинка для кнопки «Ойын»
BYE_EMOJI = "1f971"   # 🥱 «Сау бол!» в конце сессии


def download(url: str, dest: Path, tries: int = 4) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "bul-kim-builder"})
    for n in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            break
        except (TimeoutError, OSError) as e:
            if n == tries - 1:
                raise
            print(f"  … повтор {dest.name}: {e}")
            time.sleep(2 * (n + 1))
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
    texts = {}       # id -> {kind: text} for the page
    for s in cfg["sets"]:
        for it in s["items"]:
            key = it["id"]
            ph = phrases_for(it, s, cfg["templates"])
            texts[key] = ph
            if args.only and key != args.only:
                continue
            if not it.get("custom"):  # "custom": true — свой рисунок в assets/img, не скачиваем
                downloads.append((NOTO.format(code=it["emoji"], file="emoji.svg"), img / f"{key}.svg"))
            if it.get("anim"):
                downloads.append((NOTO.format(code=it["emoji"], file="lottie.json"), anim / f"{key}.json"))
            speech.append((it["kk"], audio / f"{key}.mp3"))
            for kind, text in ph.items():
                speech.append((text, audio / f"{kind}_{key}.mp3"))
    if not args.only:
        downloads.append((NOTO.format(code=GAME_EMOJI, file="emoji.svg"), img / "_game.svg"))
        downloads.append((NOTO.format(code=BYE_EMOJI, file="emoji.svg"), img / "_bye.svg"))
        downloads.append((NOTO.format(code=BYE_EMOJI, file="lottie.json"), anim / "_bye.json"))
        for k, text in cfg.get("phrases", {}).items():
            speech.append((text, audio / f"_{k}.mp3"))
    (ROOT / "assets" / "phrases.json").write_text(json.dumps(texts, ensure_ascii=False, indent=0), "utf-8")

    for url, dest in downloads:
        if not dest.exists():
            download(url, dest)

    sem = asyncio.Semaphore(6)

    async def one(text, dest):
        async with sem:
            for n in range(4):
                try:
                    return await tts(text, dest, voice, rate)
                except Exception as e:  # сеть или сервис TTS — пробуем ещё
                    if n == 3:
                        raise
                    print(f"  … повтор «{text}»: {e}")
                    await asyncio.sleep(2 * (n + 1))

    todo = [(t, d) for t, d in speech if args.force or not d.exists()]
    await asyncio.gather(*(one(t, d) for t, d in todo))
    print(f"готово: {len(todo)} новых записей")


if __name__ == "__main__":
    asyncio.run(main())

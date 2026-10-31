"""Read/write content.json keeping one item per line (easy to edit by hand)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATH = ROOT / "content.json"
ITEM_KEYS = ["id", "kk", "ru", "emoji", "anim", "sound"]  # остальные поля (show, acc, custom) — в конце строки


def load():
    return json.loads(PATH.read_text("utf-8"))


def dump(cfg):
    j = lambda v: json.dumps(v, ensure_ascii=False)
    out = ["{"]
    for k, v in cfg.items():
        if k == "sets":
            continue
        out.append(f"  {j(k)}: {j(v)},")
    out.append('  "sets": [')
    for si, s in enumerate(cfg["sets"]):
        head = ", ".join(f"{j(k)}: {j(v)}" for k, v in s.items() if k != "items")
        out.append(f"    {{ {head}, \"items\": [")
        w = {k: max(len(j(it.get(k))) for it in s["items"]) for k in ITEM_KEYS}
        for ii, it in enumerate(s["items"]):
            keys = [k for k in ITEM_KEYS if k in it] + [k for k in it if k not in ITEM_KEYS]
            parts = []
            for n, k in enumerate(keys):
                cell = f"{j(k)}: {j(it[k])}"
                if n < len(keys) - 1:
                    cell = (cell + ",").ljust(len(j(k)) + 3 + w.get(k, 0))
                parts.append(cell)
            out.append(f"      {{ {' '.join(parts)} }}" + ("," if ii < len(s["items"]) - 1 else ""))
        out.append("    ] }" + ("," if si < len(cfg["sets"]) - 1 else ""))
    out.append("  ]")
    out.append("}")
    PATH.write_text("\n".join(out) + "\n", "utf-8")

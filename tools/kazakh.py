"""Tiny Kazakh morphology for generated phrases: accusative (табыс септігі) and the question particle.

    acc("Мысық") -> "Мысықты"    acc("Түлкі") -> "Түлкіні"    acc("Қаз") -> "Қазды"
    q("Алма") -> "ма"            q("Ит") -> "пе"              q("Банан") -> "ба"
Words that don't follow the rules (possessive compounds like «Тіс щеткасы») get an "acc" field in content.json.
"""
VOWELS = set("аәеоөұүыіэяё")          # a word ending in one of these takes -ны/-ні, ма/ме
SONORANT_Y = set("лрйуюи")             # -ды/-ді, ма/ме
NASAL_Z = set("мнңзж")                 # -ды/-ді, ба/бе
BACK = set("аоұыяуюё")                 # vowel harmony: last vowel decides
FRONT = set("әеөүіэи")


def _last(word: str) -> str:
    w = word.lower().rstrip("!?. ")
    return w[-1]


def _back(word: str) -> bool:
    for ch in reversed(word.lower().split()[-1]):
        if ch in BACK:
            return True
        if ch in FRONT:
            return False
    return True


def acc(word: str) -> str:
    end, back = _last(word), _back(word)
    if end in VOWELS:
        suf = "ны" if back else "ні"
    elif end in SONORANT_Y or end in NASAL_Z:
        suf = "ды" if back else "ді"
    else:
        suf = "ты" if back else "ті"
    return word + suf


def q(word: str) -> str:
    end, back = _last(word), _back(word)
    if end in VOWELS or end in SONORANT_Y:
        return "ма" if back else "ме"
    if end in NASAL_Z:
        return "ба" if back else "бе"
    return "па" if back else "пе"


if __name__ == "__main__":
    cases = {
        "Мысық": ("Мысықты", "па"), "Ит": ("Итті", "пе"), "Сиыр": ("Сиырды", "ма"), "Жылқы": ("Жылқыны", "ма"),
        "Қой": ("Қойды", "ма"), "Түлкі": ("Түлкіні", "ме"), "Қаз": ("Қазды", "ба"), "Тиін": ("Тиінді", "бе"),
        "Аю": ("Аюды", "ма"), "Су": ("Суды", "ма"), "Үй": ("Үйді", "ме"), "Алма": ("Алманы", "ма"),
        "Банан": ("Бананды", "ба"), "Доп": ("Допты", "па"), "Велосипед": ("Велосипедті", "пе"),
        "Телефон": ("Телефонды", "ба"), "Кенгуру": ("Кенгуруды", "ма"), "Әже": ("Әжені", "ме"),
        "Аяқ киім": ("Аяқ киімді", "бе"), "Мұрын": ("Мұрынды", "ба"), "Динозавр": ("Динозаврды", "ма"),
        "Көгершін": ("Көгершінді", "бе"), "Тәрелке": ("Тәрелкені", "ме"), "Кит": ("Китті", "пе"),
    }
    bad = [(w, acc(w), q(w), e) for w, e in cases.items() if (acc(w), q(w)) != e]
    print("ok" if not bad else bad)

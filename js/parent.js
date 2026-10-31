// Parent zone: settings, own-voice recordings (IndexedDB, stays on the device), word log, tips, texts.
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const defaultLang = /^ru/i.test(navigator.language || "") ? "ru" : "kk";
export const settings = Object.assign(
  { turn: "pause", limit: 10, tips: true, lang: defaultLang },
  LS.get("bul-kim:settings", {})
);
export function saveSettings() { LS.set("bul-kim:settings", settings); }

// ---------------------------------------------------------------- texts for adults
const T = {
  kk: {
    parents: "Ата-аналарға", hold: "Ашу үшін басып тұрыңыз", close: "Жабу",
    turn: "Баланың кезегі", turnHelp: "Сөзден кейін бала өзі айтып көруі үшін 6 секунд күтеді. Бала дыбыс шығарса — мақтайды.",
    off: "Жоқ", pause: "Үзіліс", mic: "Микрофон", micTest: "Микрофонды тексеру",
    micOk: "Бірдеңе айтып көріңіз — жолақ қозғалады", micNo: "Микрофонға рұқсат берілмеді",
    privacy: "Дыбыс ешқайда жіберілмейді: тек дыбыс деңгейі өлшенеді.",
    limit: "Бір ойын уақыты", min: "мин", noLimit: "∞",
    tips: "Ата-анаға кеңестер", lang: "Кеңестер тілі",
    rec: "Өз дауысыңызды жазу", recHelp: "Сөзді өз дауысыңызбен жазыңыз — бала сіздің дауысыңызды естиді. Жазба тек осы құрылғыда сақталады.",
    record: "Жазу", stop: "Тоқтату", play: "Тыңдау", del: "Өшіру",
    log: "Баланың сөздігі", logHelp: "Бала айта алатын сөздерді белгілеңіз. Логопедке барғанда пайдалы.",
    total: "Барлық сөз", kkShort: "ҚАЗ", ruShort: "ОРЫС",
    guide: "Ата-аналарға нұсқаулық ↗", said: "Айтты!", again: "Тағы ойнау — басып тұрыңыз", bye: "Сау бол!",
    on: "Иә", none: "Жоқ",
  },
  ru: {
    parents: "Для родителей", hold: "Удерживайте, чтобы открыть", close: "Закрыть",
    turn: "Очередь ребёнка", turnHelp: "После слова ждёт 6 секунд, чтобы ребёнок попробовал сказать сам. Любой звук ребёнка — похвала.",
    off: "Выкл", pause: "Пауза", mic: "Микрофон", micTest: "Проверить микрофон",
    micOk: "Скажите что-нибудь — полоска должна двигаться", micNo: "Нет доступа к микрофону",
    privacy: "Звук никуда не отправляется: измеряется только громкость.",
    limit: "Длина одной игры", min: "мин", noLimit: "∞",
    tips: "Подсказки родителю", lang: "Язык подсказок",
    rec: "Записать свой голос", recHelp: "Запишите слова своим голосом — ребёнок будет слышать вас. Запись хранится только на этом устройстве.",
    record: "Записать", stop: "Стоп", play: "Слушать", del: "Удалить",
    log: "Словарик ребёнка", logHelp: "Отмечайте слова, которые ребёнок уже говорит. Пригодится на приёме у логопеда.",
    total: "Всего слов", kkShort: "КАЗ", ruShort: "РУС",
    guide: "Памятка для родителей ↗", said: "Сказал(а)!", again: "Играть ещё — удерживайте", bye: "Сау бол!",
    on: "Да", none: "Нет",
  },
};
export const t = (k) => (T[settings.lang] || T.kk)[k] ?? T.kk[k] ?? k;

// Tips for the adult, about the word on the screen. {kk} word, {low} word in lower case,
// {acc} accusative («мысықты»), {choice} «Алма ма, банан ба?», {show} «Мұрныңды көрсет!», {ru} Russian meaning.
const TIPS = {
  any: {
    kk: ["Басқанға дейін күтіңіз: бала «{kk}» деп өзі айтып көрсін.", "Бала кез келген дыбыс шығарса — қуанып, «{kk}» деп қайталаңыз."],
    ru: ["Подождите перед нажатием: пусть ребёнок сам попробует сказать «{kk}».", "Любой звук ребёнка — порадуйтесь и повторите: «{kk}»."],
  },
  animals: {
    kk: ["Бірге айтыңыз: «{kk}!» — сосын дыбысын салыңыз.", "Бір сөз қосыңыз: «үлкен {low}», «кішкентай {low}».", "Кітаптан немесе серуенде нағыз {acc} іздеңіз."],
    ru: ["Скажите вместе «{kk}!», а потом изобразите звук животного.", "Добавьте слово: «үлкен {low}» (большой), «кішкентай {low}» (маленький).", "Поищите «{kk}» в книжке или на прогулке."],
  },
  family: {
    kk: ["Фотодан көрсетіңіз: «Міне, {low}!»", "Кездескенде бала өзі «{kk}» деп айтсын — көмектесіңіз."],
    ru: ["Покажите фото и скажите: «Міне, {low}!» (вот {ru}).", "При встрече пусть ребёнок сам скажет «{kk}» — подскажите первый слог."],
  },
  food: {
    kk: ["Тамақ кезінде таңдау беріңіз: «{choice}»", "Нағыз {acc} көрсетіп, дәмін татқызыңыз: «{kk}!»"],
    ru: ["За едой дайте выбор: «{choice}»", "Дайте попробовать по-настоящему и скажите: «{kk}!» ({ru})."],
  },
  things: {
    kk: ["Үйден нағыз {acc} тауып, қолына беріңіз: «{kk}!»", "Таңдау беріңіз: «{choice}»"],
    ru: ["Найдите дома этот предмет ({ru}) и дайте подержать: «{kk}!»", "Дайте выбор: «{choice}»"],
  },
  body: {
    kk: ["Алдымен өзіңізден көрсетіңіз, сосын сұраңыз: «{show}»", "Айнаның алдында бірге көрсетіңіз: «{show}»"],
    ru: ["Сначала покажите на себе, потом попросите: «{show}»", "Покажите вместе перед зеркалом: «{show}»"],
  },
  actions: {
    kk: ["Бірге жасаңыз: «{kk}» — қимылын көрсетіңіз.", "Күні бойы айтыңыз: нағыз әрекет кезінде «{kk}»."],
    ru: ["Сделайте вместе: «{kk}» — покажите движение.", "Говорите «{kk}» в жизни, когда это действительно делаете."],
  },
};
let lastTip = "";
const lowerFirst = (x) => x.slice(0, 1).toLowerCase() + x.slice(1);
export function tipFor(set, it, phrases) {
  const lang = settings.lang === "ru" ? "ru" : "kk";
  const own = TIPS[set.id]?.[lang] || [];
  const ph = phrases[it.id] || {};
  const others = set.items.filter((o) => o.id !== it.id && phrases[o.id]?.c);
  const other = others[Math.floor(Math.random() * others.length)];
  const vars = {
    kk: it.kk, low: lowerFirst(it.kk), ru: it.ru, show: it.show || "",
    acc: lowerFirst((ph.f || it.kk).replace(/ таптың!$/, "")),
    choice: ph.c && other ? `${ph.c.replace(/\?$/, "")}, ${lowerFirst(phrases[other.id].c)}` : "",
  };
  const pool = [...own, ...TIPS.any[lang]].filter((tpl) => !/\{(choice|show)\}/.test(tpl) || (tpl.includes("{choice}") ? vars.choice : vars.show));
  const fill = (tpl) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  // mostly a tip specific to this kind of word; now and then a general one
  let options = pool.map(fill).filter((x) => x !== lastTip);
  if (own.length && Math.random() < 0.75) options = options.slice(0, Math.max(1, own.length)).filter((x) => x !== lastTip);
  lastTip = options[Math.floor(Math.random() * options.length)] || fill(TIPS.any[lang][0]);
  return lastTip;
}

// ---------------------------------------------------------------- word log
const log = LS.get("bul-kim:log", {});
export const said = (id, lang) => !!(log[id] && log[id][lang]);
export function markSaid(id, lang, on = true) {
  log[id] = { ...(log[id] || {}), [lang]: on ? 1 : 0 };
  LS.set("bul-kim:log", log);
}
export function logCounts(ids) {
  let kk = 0, ru = 0, any = 0;
  for (const id of ids) {
    const a = said(id, "kk"), b = said(id, "ru");
    kk += a; ru += b; any += a || b;
  }
  return { kk, ru, any };
}

// ---------------------------------------------------------------- recordings (IndexedDB)
const recUrls = new Map(); // id -> blob: URL
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("bul-kim", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("rec");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const x = db.transaction("rec", mode);
    const req = fn(x.objectStore("rec"));
    x.oncomplete = () => res(req && req.result);
    x.onerror = () => rej(x.error);
  });
}
export async function loadRecordings() {
  try {
    const db = await openDb();
    await new Promise((res) => {
      const st = db.transaction("rec").objectStore("rec");
      const cur = st.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return res();
        recUrls.set(c.key, URL.createObjectURL(c.value));
        c.continue();
      };
      cur.onerror = () => res();
    });
  } catch { /* IndexedDB unavailable (private mode) */ }
}
export const recUrl = (id) => recUrls.get(id) || null;
export async function saveRecording(id, blob) {
  if (recUrls.has(id)) URL.revokeObjectURL(recUrls.get(id));
  recUrls.set(id, URL.createObjectURL(blob));
  try { await tx("readwrite", (st) => st.put(blob, id)); } catch { /* kept for this session only */ }
}
export async function deleteRecording(id) {
  if (recUrls.has(id)) URL.revokeObjectURL(recUrls.get(id));
  recUrls.delete(id);
  try { await tx("readwrite", (st) => st.delete(id)); } catch { /* ignore */ }
}
// the word clip: parent's recording if there is one, otherwise the generated voice
export const nameUrl = (id) => recUrl(id) || `assets/audio/${id}.mp3`;

// ---------------------------------------------------------------- press-and-hold (keeps toddlers out)
export function holdButton(el, ms, onDone, onTap) {
  let timer = 0;
  const cancel = () => { clearTimeout(timer); el.classList.remove("holding"); };
  el.style.setProperty("--hold", `${ms}ms`);
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.classList.add("holding");
    timer = setTimeout(() => { el.classList.remove("holding"); onDone(); }, ms);
  });
  el.addEventListener("pointerup", () => { if (el.classList.contains("holding")) { cancel(); onTap && onTap(); } });
  el.addEventListener("pointerleave", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("click", (e) => e.preventDefault());
}

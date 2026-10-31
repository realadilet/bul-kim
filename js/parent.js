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

const TIPS = {
  kk: [
    "Суретті көрсетіп, іштей 10-ға дейін санаңыз — бала өзі айтып көрсін.",
    "Бала кез келген дыбыс шығарса — бірден қуанып, сөзді қайталаңыз.",
    "Бір сөз қосыңыз: «ит» → «үлкен ит».",
    "Үйден нағыз затты тауып, қолға ұстатыңыз.",
    "Баяу, қысқа айтыңыз, негізгі сөзді ерекшелеңіз.",
    "Дыбысын бірге салыңыз: мияу, мөө, ау-ау — бұл да сөз.",
    "Таңдау беріңіз: «Алма ма, банан ба?»",
    "Қате айтса түзетпеңіз — дұрысын қуанып қайталаңыз.",
    "Қимылмен көрсетіңіз: мысықтың мұрты, құстың қанаты.",
    "Бірге ойнаңыз: экран — тек көмекші, сөйлеуді сіз үйретесіз.",
    "Бүгінгі 3 сөзді күні бойы қайталаңыз: тамақ кезінде, серуенде.",
    "Мультфильмді фонда қоспаңыз — фондық теледидар сөйлеуге кедергі.",
  ],
  ru: [
    "Покажите картинку и посчитайте про себя до 10 — дайте ребёнку сказать самому.",
    "Любой звук ребёнка — сразу радуйтесь и повторите слово.",
    "Добавьте одно слово: «ит» → «үлкен ит».",
    "Найдите этот предмет дома и дайте подержать.",
    "Говорите медленно и коротко, выделяйте главное слово.",
    "Изображайте звук вместе: мияу, мөө, ау-ау — это тоже слово.",
    "Давайте выбор: «Алма ма, банан ба?»",
    "Не исправляйте — просто радостно повторите правильно.",
    "Показывайте жестом: усы кота, крылья птицы.",
    "Играйте вместе: экран только помощник, говорить учите вы.",
    "Повторяйте 3 слова дня весь день: за едой, на прогулке.",
    "Не включайте мультики фоном — фоновый телевизор мешает речи.",
  ],
};
let tipIndex = Math.floor(Math.random() * 12);
export function nextTip() { const list = TIPS[settings.lang] || TIPS.kk; tipIndex = (tipIndex + 1) % list.length; return list[tipIndex]; }

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

/* kvocab — трохи логіки для тренажера */
"use strict";

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const shuffle = (a) => {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const sample = (arr, n) => shuffle(arr).slice(0, n);

// canonical answers accepted in typing mode
function acceptedAnswers(item) {
  const set = new Set();
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  set.add(norm(item.ko));
  set.add(item.ko.replace(/\s+/g, "")); // no-space variant
  (item.alts || []).forEach((a) => {
    set.add(norm(a));
    set.add(a.replace(/\s+/g, ""));
  });
  return set;
}

// ---------- state ----------
const TOPICS = [...new Set(VOCAB.flatMap((v) => v.topics))];
let selectedTopics = new Set();
let mode = "ko2tr";
let pool = [];
let queue = [];
let qIndex = 0;
let scoreOk = 0;
let mistakes = [];
let current = null;
let flashIndex = 0;
let flashFlipped = false;

// ---------- home screen ----------
function renderTopics() {
  const wrap = $("topic-chips");
  wrap.innerHTML = "";
  TOPICS.forEach((t) => {
    const n = VOCAB.filter((v) => v.topics.includes(t)).length;
    const b = document.createElement("button");
    b.className = "chip" + (selectedTopics.has(t) ? " on" : "");
    b.innerHTML = `${t} <span class="n">${n}</span>`;
    b.onclick = () => {
      if (selectedTopics.has(t)) selectedTopics.delete(t);
      else selectedTopics.add(t);
      renderTopics();
      updatePoolInfo();
    };
    wrap.appendChild(b);
  });
}

function currentPool() {
  return VOCAB.filter((v) => v.topics.some((t) => selectedTopics.has(t)));
}

function updatePoolInfo() {
  $("pool-info").textContent = `обрано слів: ${currentPool().length}`;
  $("start-btn").disabled = currentPool().length < 4;
}

document.querySelectorAll(".mode-card").forEach((card) => {
  card.onclick = () => {
    document.querySelectorAll(".mode-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    mode = card.dataset.mode;
  };
});
document.querySelector('.mode-card[data-mode="ko2tr"]').classList.add("selected");

$("topics-all").onclick = () => {
  selectedTopics = new Set(TOPICS);
  renderTopics();
  updatePoolInfo();
};
$("topics-none").onclick = () => {
  selectedTopics = new Set();
  renderTopics();
  updatePoolInfo();
};

$("start-btn").onclick = startSession;

function show(screen) {
  ["screen-home", "screen-quiz", "screen-flash", "screen-list", "screen-end"].forEach((s) => {
    $(s).hidden = s !== screen;
  });
}

// ---------- session ----------
function startSession() {
  pool = currentPool();
  if (mode === "list") {
    if (!pool.length) return;
    show("screen-list");
    $("list-search").value = "";
    renderList();
    return;
  }
  if (pool.length < 4) return;
  const qc = $("qcount").value;
  const n = qc === "all" ? pool.length : Math.min(parseInt(qc, 10), pool.length);
  queue = sample(pool, n);
  qIndex = 0;
  scoreOk = 0;
  mistakes = [];
  if (mode === "flash") {
    flashIndex = 0;
    show("screen-flash");
    renderFlash();
  } else {
    show("screen-quiz");
    nextQuestion();
  }
}

$("quit-btn").onclick = endSession;
$("flash-quit").onclick = () => show("screen-home");
$("again-btn").onclick = startSession;
$("home-btn").onclick = () => show("screen-home");
$("next-btn").onclick = nextQuestion;

function endSession() {
  show("screen-end");
  const total = qIndex;
  $("end-title").textContent =
    scoreOk === total && total > 0 ? "Бездоганно! Квока пишається 🎉" : "Раунд завершено";
  $("end-stats").textContent = `Правильно: ${scoreOk} з ${total}`;
  const wrap = $("end-mistakes");
  wrap.innerHTML = "";
  mistakes.forEach((m) => {
    const d = document.createElement("div");
    d.className = "mist";
    d.innerHTML = `<b>${m.ko}</b> — ${m.tr}`;
    wrap.appendChild(d);
  });
}

function nextQuestion() {
  if (qIndex >= queue.length) return endSession();
  current = queue[qIndex];
  qIndex++;
  $("progress").textContent = `${qIndex} / ${queue.length}`;
  $("score").textContent = `✓ ${scoreOk}`;
  $("feedback").hidden = true;
  $("feedback").className = "";
  $("next-btn").hidden = true;
  $("options").innerHTML = "";
  $("type-area").hidden = true;

  if (mode === "ko2tr" || mode === "tr2ko") renderChoice();
  else renderType();
}

// ---------- multiple choice ----------
function distractors(item, n) {
  const shares = (v) => v.topics.some((t) => item.topics.includes(t));
  const sameTopic = pool.filter((v) => v !== item && shares(v) && v.tr !== item.tr);
  const others = pool.filter((v) => v !== item && !shares(v) && v.tr !== item.tr);
  const picks = sample(sameTopic, n);
  if (picks.length < n) picks.push(...sample(others, n - picks.length));
  return picks;
}

function renderChoice() {
  const q = $("question");
  if (mode === "ko2tr") q.innerHTML = escapeHtml(current.ko);
  else q.innerHTML = escapeHtml(current.tr);

  const opts = shuffle([current, ...distractors(current, 3)]);
  const optWrap = $("options");
  opts.forEach((item) => {
    const b = document.createElement("button");
    b.className = "opt";
    b.textContent = mode === "ko2tr" ? item.tr : item.ko;
    b.onclick = () => answerChoice(b, item, opts);
    optWrap.appendChild(b);
  });
}

function answerChoice(btn, picked, opts) {
  const correct = picked === current;
  if (correct) scoreOk++;
  else mistakes.push(current);

  [...$("options").children].forEach((b, i) => {
    b.disabled = true;
    const item = opts[i];
    if (item === current) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
    // показуємо переклади всіх варіантів після відповіді
    const sub = document.createElement("span");
    sub.className = "opt-tr";
    sub.textContent = mode === "ko2tr" ? item.ko : item.tr;
    b.appendChild(sub);
  });

  showFeedback(correct, null);
}

// ---------- typing mode ----------
function renderType() {
  $("question").innerHTML =
    escapeHtml(current.tr) + '<span class="sub">введи корейською</span>';
  $("type-area").hidden = false;
  const inp = $("answer-input");
  inp.value = "";
  inp.disabled = false;
  $("check-btn").disabled = false;
  inp.focus();
}

$("check-btn").onclick = checkTyped;
$("answer-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !$("check-btn").disabled) checkTyped();
});

function checkTyped() {
  const inp = $("answer-input");
  const val = inp.value.replace(/\s+/g, " ").trim();
  if (!val) return;
  const ok = acceptedAnswers(current).has(val) || acceptedAnswers(current).has(val.replace(/\s+/g, ""));
  if (ok) scoreOk++;
  else mistakes.push(current);
  inp.disabled = true;
  $("check-btn").disabled = true;

  // якщо ввели інше слово, яке теж є в базі — показати його значення
  let homonym = null;
  if (!ok) {
    homonym = VOCAB.find((v) => acceptedAnswers(v).has(val));
  }
  showFeedback(ok, homonym);
}

// ---------- feedback ----------
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showFeedback(correct, homonym) {
  $("score").textContent = `✓ ${scoreOk}`;
  const f = $("feedback");
  f.hidden = false;
  f.className = correct ? "good" : "bad";
  let html = correct
    ? `✅ Правильно!`
    : `❌ Правильна відповідь: <span class="big-answer">${escapeHtml(current.ko)}</span> — ${escapeHtml(current.tr)}`;
  if (current.note) html += `<div class="note">💬 ${escapeHtml(current.note)}</div>`;
  if (current.pol) html += `<div class="pol">розмовно-ввічлива форма: <b>${escapeHtml(current.pol)}</b></div>`;
  if (homonym) {
    html += `<div class="homonym">⚠️ Введене слово теж є в базі: <b>${escapeHtml(homonym.ko)}</b> — ${escapeHtml(homonym.tr)}</div>`;
  }
  f.innerHTML = html;
  $("next-btn").hidden = false;
  $("next-btn").focus();
}

// ---------- flashcards ----------
function renderFlash() {
  const item = queue[flashIndex];
  flashFlipped = false;
  $("flash-progress").textContent = `${flashIndex + 1} / ${queue.length}`;
  $("flash-front").hidden = false;
  $("flash-back").hidden = true;
  $("flash-front").innerHTML = escapeHtml(item.ko);
  let back = escapeHtml(item.tr);
  if (item.note) back += `<span class="sub">💬 ${escapeHtml(item.note)}</span>`;
  if (item.pol) back += `<span class="sub">${escapeHtml(item.pol)}</span>`;
  $("flash-back").innerHTML = back;
}

function flipFlash() {
  flashFlipped = !flashFlipped;
  $("flash-front").hidden = flashFlipped;
  $("flash-back").hidden = !flashFlipped;
}

$("flash-card").onclick = flipFlash;
$("flash-flip").onclick = flipFlash;
$("flash-prev").onclick = () => {
  flashIndex = (flashIndex - 1 + queue.length) % queue.length;
  renderFlash();
};
$("flash-next").onclick = () => {
  flashIndex = (flashIndex + 1) % queue.length;
  renderFlash();
};

// ---------- word list ----------
function renderList() {
  const q = $("list-search").value.trim().toLowerCase();
  const words = currentPool().filter(
    (v) =>
      !q ||
      v.ko.toLowerCase().includes(q) ||
      v.tr.toLowerCase().includes(q) ||
      (v.note || "").toLowerCase().includes(q)
  );
  $("list-count").textContent = `слів: ${words.length}`;

  // групуємо за першою (основною) темою, зберігаючи порядок тем
  const groups = new Map();
  words.forEach((v) => {
    const t = v.topics[0];
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(v);
  });

  const wrap = $("word-list");
  wrap.innerHTML = "";
  groups.forEach((items, t) => {
    const h = document.createElement("h3");
    h.className = "list-topic";
    h.textContent = t;
    wrap.appendChild(h);
    items.forEach((v) => {
      const row = document.createElement("div");
      row.className = "word-row";
      let extra = "";
      if (v.pol) extra += `<span class="wr-pol">${escapeHtml(v.pol)}</span>`;
      if (v.note) extra += `<span class="wr-note">💬 ${escapeHtml(v.note)}</span>`;
      row.innerHTML =
        `<span class="wr-ko">${escapeHtml(v.ko)}</span>` +
        `<span class="wr-tr">${escapeHtml(v.tr)}${extra}</span>`;
      wrap.appendChild(row);
    });
  });
}

$("list-search").addEventListener("input", renderList);
$("list-quit").onclick = () => show("screen-home");

// ---------- Korean on-screen keyboard with hangul composition ----------
const CHO = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const JUNG = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const DOUBLE_JUNG = { "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ", "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ", "ㅡㅣ": "ㅢ" };
const DOUBLE_JONG = { "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ", "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ", "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ", "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ", "ㄱㄱ": "ㄲ", "ㅅㅅ": "ㅆ" };
const SPLIT_JONG = {};
Object.entries(DOUBLE_JONG).forEach(([pair, d]) => { SPLIT_JONG[d] = [pair[0], pair[1]]; });
const SPLIT_JUNG = {};
Object.entries(DOUBLE_JUNG).forEach(([pair, d]) => { SPLIT_JUNG[d] = [pair[0], pair[1]]; });

const isSyl = (ch) => ch >= "가" && ch <= "힣";
const isVowel = (j) => JUNG.includes(j);
const decompSyl = (ch) => {
  const o = ch.charCodeAt(0) - 0xac00;
  return [CHO[Math.floor(o / 588)], JUNG[Math.floor((o % 588) / 28)], JONG[o % 28]];
};
const compSyl = (c, j, g = "") =>
  String.fromCharCode(0xac00 + CHO.indexOf(c) * 588 + JUNG.indexOf(j) * 28 + JONG.indexOf(g));

function kbInput(jamo) {
  const inp = $("answer-input");
  if (inp.disabled) return;
  let v = inp.value;
  const last = v.slice(-1);

  if (isVowel(jamo)) {
    if (last && CHO.includes(last)) {
      v = v.slice(0, -1) + compSyl(last, jamo);
    } else if (last && isSyl(last)) {
      const [c, j, g] = decompSyl(last);
      if (g === "" && DOUBLE_JUNG[j + jamo]) {
        v = v.slice(0, -1) + compSyl(c, DOUBLE_JUNG[j + jamo]);
      } else if (g !== "") {
        if (SPLIT_JONG[g]) {
          const [g1, g2] = SPLIT_JONG[g];
          v = v.slice(0, -1) + compSyl(c, j, g1) + compSyl(g2, jamo);
        } else if (CHO.includes(g)) {
          v = v.slice(0, -1) + compSyl(c, j, "") + compSyl(g, jamo);
        } else {
          v += jamo;
        }
      } else {
        v += jamo;
      }
    } else {
      v += jamo;
    }
  } else {
    // consonant
    if (last && isSyl(last)) {
      const [c, j, g] = decompSyl(last);
      if (g === "" && JONG.includes(jamo)) {
        v = v.slice(0, -1) + compSyl(c, j, jamo);
      } else if (g !== "" && DOUBLE_JONG[g + jamo]) {
        v = v.slice(0, -1) + compSyl(c, j, DOUBLE_JONG[g + jamo]);
      } else {
        v += jamo;
      }
    } else {
      v += jamo;
    }
  }
  inp.value = v;
  inp.focus();
}

function kbBackspace() {
  const inp = $("answer-input");
  if (inp.disabled) return;
  let v = inp.value;
  if (!v) return;
  const last = v.slice(-1);
  if (isSyl(last)) {
    const [c, j, g] = decompSyl(last);
    if (g !== "") {
      const ng = SPLIT_JONG[g] ? SPLIT_JONG[g][0] : "";
      v = v.slice(0, -1) + compSyl(c, j, ng);
    } else if (SPLIT_JUNG[j]) {
      v = v.slice(0, -1) + compSyl(c, SPLIT_JUNG[j][0]);
    } else {
      v = v.slice(0, -1) + c;
    }
  } else {
    v = v.slice(0, -1);
  }
  inp.value = v;
  inp.focus();
}

const KB_ROWS = [
  ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"],
  ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"],
  ["⇧", "ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ", "⌫"],
  ["␣"],
];
const SHIFT_MAP = { "ㅂ": "ㅃ", "ㅈ": "ㅉ", "ㄷ": "ㄸ", "ㄱ": "ㄲ", "ㅅ": "ㅆ", "ㅐ": "ㅒ", "ㅔ": "ㅖ" };
let kbShift = false;

function renderKeyboard() {
  const kb = $("keyboard");
  kb.innerHTML = "";
  KB_ROWS.forEach((row) => {
    const r = document.createElement("div");
    r.className = "kb-row";
    row.forEach((key) => {
      if (key === "空") return; // filler skipped
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kb-key";
      if (key === "␣") {
        b.classList.add("space");
        b.textContent = "пробіл";
        b.onclick = () => { const i = $("answer-input"); if (!i.disabled) { i.value += " "; i.focus(); } };
      } else if (key === "⌫") {
        b.classList.add("wide");
        b.textContent = "⌫";
        b.onclick = kbBackspace;
      } else if (key === "⇧") {
        b.classList.add("wide");
        b.textContent = "⇧";
        if (kbShift) b.classList.add("active");
        b.onclick = () => { kbShift = !kbShift; renderKeyboard(); };
      } else {
        const shown = kbShift && SHIFT_MAP[key] ? SHIFT_MAP[key] : key;
        b.textContent = shown;
        b.onclick = () => {
          kbInput(shown);
          if (kbShift) { kbShift = false; renderKeyboard(); }
        };
      }
      r.appendChild(b);
    });
    kb.appendChild(r);
  });
}

$("kb-toggle").onclick = () => {
  const kb = $("keyboard");
  kb.hidden = !kb.hidden;
  if (!kb.hidden) renderKeyboard();
};

// ---------- init ----------
renderTopics();
updatePoolInfo();
$("total-count").textContent = VOCAB.length;

/* =========================================================
   NEON QUIZ // one question at a time, powered by
   https://the-trivia-api.com/
   ========================================================= */

const CFG = {
  api: "https://the-trivia-api.com/v2/questions",
  total: 10,
  lives: 5,
  seconds: 20,
  basePoints: 100,
  timePoints: 12,
  streakPoints: 25,
  nextDelay: 1500,
};

const $ = (id) => document.getElementById(id);

const ui = {
  chipCategory: $("chipCategory"),
  chipDifficulty: $("chipDifficulty"),
  progressFill: $("progressFill"),
  qCounter: $("qCounter"),
  scoreValue: $("scoreValue"),
  scorebox: document.querySelector(".scorebox"),
  lives: $("lives"),
  soundBtn: $("soundBtn"),
  flash: $("flash"),
  selCategory: $("selCategory"),
  selDifficulty: $("selDifficulty"),
  btnStart: $("btnStart"),
  btnRetry: $("btnRetry"),
  btnAgain: $("btnAgain"),
  btnMenu: $("btnMenu"),
  loadText: $("loadText"),
  qCategory: $("qCategory"),
  qDifficulty: $("qDifficulty"),
  qStreak: $("qStreak"),
  qNum: $("qNum"),
  questionText: $("questionText"),
  questionPanel: $("questionPanel"),
  answers: $("answers"),
  feedback: $("feedback"),
  timer: $("timer"),
  timerRing: $("timerRing"),
  timerText: $("timerText"),
  resultKicker: $("resultKicker"),
  resultRing: $("resultRing"),
  ringWrap: document.querySelector(".ring-wrap"),
  resultPercent: $("resultPercent"),
  resultGrade: $("resultGrade"),
  statScore: $("statScore"),
  statCorrect: $("statCorrect"),
  statStreak: $("statStreak"),
  statTime: $("statTime"),
  toastWrap: $("toastWrap"),
};

const RING_C = 169.65; // 2 * PI * 27
const RESULT_RING_C = 540.35; // 2 * PI * 86

const state = {
  qs: [],
  i: 0,
  score: 0,
  shownScore: 0,
  lives: CFG.lives,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  locked: true,
  running: false,
  raf: 0,
  startedAt: 0,
  settings: { category: "all", difficulty: "all" },
};

/* ---------------------------------------------------------
   helpers
   --------------------------------------------------------- */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pretty(str) {
  return String(str || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pad(n) {
  return String(n).padStart(2, "0");
}

/* ---------------------------------------------------------
   screen flow
   --------------------------------------------------------- */

let switching = false;
let showToken = 0;

function show(id) {
  const next = document.getElementById(id);
  if (!next) return;
  const cur = document.querySelector(".screen.is-active");
  if (cur === next) return;

  const token = ++showToken;
  switching = true;

  if (cur) {
    cur.classList.remove("is-active");
    cur.classList.add("is-out");
    setTimeout(() => cur.classList.remove("is-out"), 280);
  }

  setTimeout(
    () => {
      if (token !== showToken) return;
      next.classList.remove("is-out");
      next.classList.add("is-active");
      switching = false;
    },
    cur ? 210 : 0
  );
}

/* ---------------------------------------------------------
   audio feedback (tiny synth blips)
   --------------------------------------------------------- */

const audio = {
  ctx: null,
  on: true,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },
  tone(freq, dur, type, vol, delay) {
    if (!this.on || !this.ctx) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  },
  good() {
    this.tone(660, 0.14, "triangle", 0.14, 0);
    this.tone(990, 0.2, "triangle", 0.12, 0.09);
    this.tone(1320, 0.24, "sine", 0.1, 0.18);
  },
  bad() {
    this.tone(200, 0.2, "sawtooth", 0.1, 0);
    this.tone(140, 0.3, "sawtooth", 0.09, 0.1);
  },
  tick() {
    this.tone(880, 0.05, "square", 0.05);
  },
  start() {
    [440, 660, 880, 1320].forEach((f, k) => this.tone(f, 0.16, "triangle", 0.12, k * 0.08));
  },
  end() {
    [880, 660, 520, 330].forEach((f, k) => this.tone(f, 0.24, "sine", 0.12, k * 0.12));
  },
};

ui.soundBtn.addEventListener("click", () => {
  audio.on = !audio.on;
  ui.soundBtn.classList.toggle("muted", !audio.on);
  audio.ensure();
  if (audio.on) audio.tone(880, 0.1, "triangle", 0.1);
});

/* ---------------------------------------------------------
   background canvas: drifting particles + answer bursts
   --------------------------------------------------------- */

const fx = (() => {
  const canvas = $("fx");
  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;
  let dpr = 1;
  const dust = [];
  const sparks = [];
  const COLORS = ["#00f0ff", "#ff2bd6", "#b6ff2e", "#ffb020"];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    dust.length = 0;
    const n = Math.round(Math.min(90, (w * h) / 16000));
    for (let i = 0; i < n; i++) {
      dust.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.9 + 0.5,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        a: Math.random() * 0.5 + 0.18,
        c: COLORS[(Math.random() * COLORS.length) | 0],
      });
    }
  }

  function burst(x, y, color) {
    for (let i = 0; i < 46; i++) {
      const ang = (Math.PI * 2 * i) / 46 + Math.random() * 0.4;
      const sp = 2 + Math.random() * 7;
      sparks.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 1,
        decay: 0.016 + Math.random() * 0.02,
        size: Math.random() * 3 + 1.5,
        c: color,
      });
    }
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);

    for (const p of dust) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
      ctx.globalAlpha = p.a;
      ctx.fillStyle = p.c;
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.955;
      s.vy = s.vy * 0.955 + 0.09;
      s.life -= s.decay;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(s.life, 0);
      ctx.fillStyle = s.c;
      ctx.shadowBlur = 14;
      ctx.shadowColor = s.c;
      ctx.fillRect(s.x, s.y, s.size, s.size * (0.4 + s.life * 0.8));
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    requestAnimationFrame(frame);
  }

  resize();
  seed();
  frame();
  window.addEventListener("resize", () => {
    resize();
    seed();
  });

  return { burst };
})();

/* ---------------------------------------------------------
   toasts + flash
   --------------------------------------------------------- */

function toast(text, kind) {
  const el = document.createElement("div");
  el.className = "toast " + (kind || "");
  el.textContent = text;
  ui.toastWrap.appendChild(el);
  setTimeout(() => el.remove(), 2450);
}

function flash(kind) {
  ui.flash.className = "flash";
  void ui.flash.offsetWidth;
  ui.flash.classList.add(kind);
}

/* ---------------------------------------------------------
   score / hud
   --------------------------------------------------------- */

function setScore(value) {
  const from = state.shownScore;
  const to = value;
  state.shownScore = to;
  const t0 = performance.now();
  const dur = 650;

  function step(now) {
    const k = Math.min((now - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - k, 3);
    ui.scoreValue.textContent = Math.round(from + (to - from) * eased);
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  ui.scorebox.classList.remove("bump");
  void ui.scorebox.offsetWidth;
  ui.scorebox.classList.add("bump");
}

function paintHud() {
  ui.qCounter.textContent = pad(state.i + 1) + " / " + pad(CFG.total);
  ui.progressFill.style.width = ((state.i + 1) / CFG.total) * 100 + "%";
  ui.qStreak.textContent = "streak x" + state.streak;
  ui.qStreak.classList.toggle("hot", state.streak >= 3);
}

function syncLives() {
  ui.lives.querySelectorAll("img").forEach((img, k) => {
    img.classList.toggle("lost", k >= state.lives);
    img.classList.remove("dying");
  });
}

function loseLife() {
  const hearts = ui.lives.querySelectorAll("img");
  const victim = hearts[state.lives - 1];
  state.lives = Math.max(0, state.lives - 1);
  if (victim) {
    victim.classList.add("dying");
    setTimeout(() => {
      victim.classList.remove("dying");
      victim.classList.add("lost");
    }, 480);
  }
  ui.qStreak.classList.remove("hot");
}

/* ---------------------------------------------------------
   question fetching
   --------------------------------------------------------- */

async function fetchQuestions(category, difficulty) {
  const params = new URLSearchParams({ limit: "50" });
  if (category && category !== "all") params.set("categories", category);
  if (difficulty && difficulty !== "all") params.set("difficulties", difficulty);

  const res = await fetch(CFG.api + "?" + params.toString());
  if (!res.ok) throw new Error("API svarte " + res.status);

  const raw = await res.json();
  const usable = raw.filter(
    (q) =>
      q &&
      q.type === "text_choice" &&
      typeof q.correctAnswer === "string" &&
      Array.isArray(q.incorrectAnswers) &&
      q.incorrectAnswers.length >= 3 &&
      typeof q.question?.text === "string"
  );

  if (usable.length < CFG.total) throw new Error("for få spørsmål i denne kombinasjonen");
  return shuffle(usable).slice(0, CFG.total);
}

/* ---------------------------------------------------------
   timer
   --------------------------------------------------------- */

function startTimer() {
  stopTimer();
  const total = CFG.seconds * 1000;
  const t0 = performance.now();
  let lastShown = -1;

  function frame(now) {
    const left = total - (now - t0);
    const k = Math.max(left / total, 0);

    ui.timerRing.style.strokeDashoffset = RING_C * (1 - k);
    const secs = Math.ceil(left / 1000);

    if (secs !== lastShown) {
      lastShown = secs;
      ui.timerText.textContent = secs;
      if (secs <= 5 && secs > 0) audio.tick();
    }

    ui.timer.classList.toggle("warn", k <= 0.5 && k > 0.25);
    ui.timer.classList.toggle("crit", k <= 0.25);

    if (left <= 0) {
      state.raf = 0;
      handleAnswer(null);
      return;
    }
    state.raf = requestAnimationFrame(frame);
  }

  ui.timerRing.style.strokeDashoffset = 0;
  ui.timerText.textContent = CFG.seconds;
  ui.timer.classList.remove("warn", "crit");
  state.raf = requestAnimationFrame(frame);
}

function stopTimer() {
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = 0;
}

/* ---------------------------------------------------------
   quiz flow
   --------------------------------------------------------- */

async function startRun() {
  if (state.starting || state.running) return;
  state.starting = true;
  audio.ensure();
  audio.start();

  state.settings.category = ui.selCategory.value;
  state.settings.difficulty = ui.selDifficulty.value;

  state.qs = [];
  state.i = 0;
  state.score = 0;
  state.shownScore = 0;
  state.lives = CFG.lives;
  state.correct = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.locked = true;
  state.running = false;

  setScore(0);
  ui.scoreValue.textContent = "0";
  ui.progressFill.style.width = "0%";
  ui.qCounter.textContent = "00 / " + pad(CFG.total);
  ui.feedback.textContent = "";
  ui.btnRetry.hidden = true;
  ui.loadText.textContent = "henter spørsmål fra API ...";
  syncLives();
  paintHud();

  show("screenLoad");

  try {
    const qs = await fetchQuestions(state.settings.category, state.settings.difficulty);
    state.qs = qs;
    ui.chipCategory.textContent =
      state.settings.category === "all" ? "ALLE KATEGORIER" : pretty(state.settings.category);
    ui.chipCategory.classList.add("live");
    ui.chipDifficulty.textContent =
      state.settings.difficulty === "all" ? "BLANDET" : state.settings.difficulty;
    ui.chipDifficulty.dataset.d =
      state.settings.difficulty === "all" ? "" : state.settings.difficulty;

    state.running = true;
    state.startedAt = Date.now();
    await wait(650);
    show("screenQuiz");
    await wait(240);
    renderQuestion();
    state.starting = false;
  } catch (err) {
    ui.loadText.textContent = "klarte ikke å hente spørsmål // " + err.message;
    ui.btnRetry.hidden = false;
    state.starting = false;
    audio.bad();
  }
}

function syncStartChips() {
  const c = ui.selCategory.value;
  const d = ui.selDifficulty.value;
  ui.chipCategory.textContent = c === "all" ? "ALLE KATEGORIER" : pretty(c);
  ui.chipCategory.classList.remove("live");
  ui.chipDifficulty.textContent = d === "all" ? "BLANDET" : d;
  ui.chipDifficulty.dataset.d = d === "all" ? "" : d;
}

function renderQuestion() {
  const q = state.qs[state.i];
  if (!q) return endRun(false);

  state.locked = false;

  ui.qCategory.textContent = pretty(q.category);
  ui.qDifficulty.textContent = q.difficulty;
  ui.qDifficulty.dataset.d = q.difficulty;
  ui.qNum.textContent = "SPØRSMÅL " + pad(state.i + 1);
  ui.questionText.textContent = q.question.text;
  ui.feedback.textContent = "";
  ui.answers.innerHTML = "";

  ui.questionPanel.classList.remove("replay");
  void ui.questionPanel.offsetWidth;
  ui.questionPanel.classList.add("replay");

  const options = shuffle([q.correctAnswer, ...q.incorrectAnswers.slice(0, 3)]);
  const keys = ["A", "B", "C", "D"];

  options.forEach((text, k) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer";
    btn.dataset.value = text;
    btn.innerHTML =
      '<span class="key">' + keys[k] + '</span><span class="txt"></span>';
    btn.querySelector(".txt").textContent = text;
    btn.addEventListener("click", () => handleAnswer(btn));
    ui.answers.appendChild(btn);
  });

  paintHud();
  startTimer();
}

function handleAnswer(btn) {
  if (state.locked || !state.running) return;
  state.locked = true;
  stopTimer();

  const q = state.qs[state.i];
  const value = btn ? btn.dataset.value : null;
  const ok = value === q.correctAnswer;
  const buttons = Array.from(ui.answers.children);
  const chosen = btn;

  buttons.forEach((b) => {
    b.disabled = true;
    if (b.dataset.value === q.correctAnswer) b.classList.add("correct");
    else if (b === chosen) b.classList.add("wrong");
    else b.classList.add("dim");
  });

  if (ok) {
    state.correct += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    const secsLeft = Math.ceil(parseFloat(ui.timerText.textContent) || 0);
    const pts =
      CFG.basePoints +
      secsLeft * CFG.timePoints +
      Math.min(state.streak - 1, 8) * CFG.streakPoints;

    state.score += pts;
    setScore(state.score);

    flash("ok");
    audio.good();
    const rect = btn.getBoundingClientRect();
    fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, "#b6ff2e");
    fx.burst(window.innerWidth / 2, window.innerHeight / 2, "#00f0ff");

    ui.feedback.innerHTML =
      '<span class="good">RIKTIG</span><span class="pts">+' + pts + " poeng</span>";

    if (state.streak >= 3) toast("COMBO x" + state.streak, "good");
    if (secsLeft >= CFG.seconds - 1) toast("BLITZ +bonus", "good");
  } else {
    const timedOut = !btn;
    state.streak = 0;
    loseLife();
    flash("no");
    audio.bad();

    if (chosen) {
      const rect = chosen.getBoundingClientRect();
      fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, "#ff3b6b");
    }

    ui.feedback.innerHTML =
      '<span class="bad">' +
      (timedOut ? "TIDEN GIKK UT" : "FEIL") +
      '</span><span class="ans">riktig svar: ' +
      q.correctAnswer +
      "</span>";

    if (state.lives <= 0) toast("INGEN LIV IGJEN", "bad");
    else toast("-1 liv", "bad");
  }

  paintHud();

  const dead = state.lives <= 0;
  const last = state.i >= state.qs.length - 1;

  setTimeout(() => {
    if (dead) return endRun(true);
    if (last) return endRun(false);
    state.i += 1;
    renderQuestion();
  }, dead ? 1100 : CFG.nextDelay);
}

function endRun(dead) {
  stopTimer();
  state.running = false;
  state.locked = true;
  audio.end();

  const total = state.qs.length || CFG.total;
  const pct = Math.round((state.correct / total) * 100);
  const used = Math.round((Date.now() - state.startedAt) / 1000);

  ui.resultKicker.textContent = dead ? "// terminated - no lives left" : "// run complete";
  ui.resultPercent.textContent = pct + "%";
  ui.statScore.textContent = state.score;
  ui.statCorrect.textContent = state.correct + "/" + total;
  ui.statStreak.textContent = state.bestStreak;
  ui.statTime.textContent = used + "s";

  let grade = "WIPEOUT";
  if (pct >= 90) grade = "LEGENDARY";
  else if (pct >= 75) grade = "SHARP";
  else if (pct >= 50) grade = "SOLID";
  else if (pct >= 25) grade = "ROOKIE";
  ui.resultGrade.textContent = grade;

  ui.ringWrap.classList.toggle("low", pct < 40);
  ui.ringWrap.classList.toggle("mid", pct >= 40 && pct < 70);
  ui.resultRing.style.strokeDashoffset = RESULT_RING_C;

  show("screenResult");

  setTimeout(() => {
    ui.resultRing.style.strokeDashoffset = RESULT_RING_C * (1 - pct / 100);
    if (pct >= 70) fx.burst(window.innerWidth / 2, window.innerHeight / 2, "#00f0ff");
  }, 420);
}

/* ---------------------------------------------------------
   events
   --------------------------------------------------------- */

ui.btnStart.addEventListener("click", startRun);
ui.btnRetry.addEventListener("click", startRun);
ui.btnAgain.addEventListener("click", startRun);
ui.btnMenu.addEventListener("click", () => {
  state.running = false;
  stopTimer();
  syncStartChips();
  show("screenStart");
});

ui.selCategory.addEventListener("change", syncStartChips);
ui.selDifficulty.addEventListener("change", syncStartChips);

document.addEventListener("keydown", (e) => {
  const active = document.querySelector(".screen.is-active");
  if (!active) return;

  if (e.key === "Enter") {
    if (active.id === "screenStart" || active.id === "screenResult") {
      e.preventDefault();
      if (!switching) startRun();
    }
    return;
  }

  if (active.id !== "screenQuiz" || state.locked) return;

  const map = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
  const idx = map[e.key.toLowerCase()];
  if (idx === undefined) return;
  const btn = ui.answers.children[idx];
  if (btn && !btn.disabled) btn.click();
});

paintHud();

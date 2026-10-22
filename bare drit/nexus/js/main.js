(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    mouse: { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 },
    scroll: 0,
    theme: localStorage.getItem("nx-theme") || "neon",
    sound: localStorage.getItem("nx-sound") === "1",
  };

  document.documentElement.dataset.theme = state.theme === "amber" ? "amber" : "neon";

  /* ---------- audio ---------- */
  const audio = {
    ctx: null,
    on: state.sound,
    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx?.state === "suspended") this.ctx.resume();
    },
    blip(freq = 720, dur = 0.06, type = "triangle", vol = 0.05) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    toggle() {
      this.on = !this.on;
      state.sound = this.on;
      localStorage.setItem("nx-sound", this.on ? "1" : "0");
      if (this.on) {
        this.init();
        this.blip(880, 0.1, "sine", 0.07);
      }
      return this.on;
    },
  };

  /* ---------- preloader ---------- */
  function preloader() {
    const el = $(".preloader");
    if (!el) return Promise.resolve();
    const fill = $(".preloader__fill", el);
    const num = $("#preNum");
    const full = sessionStorage.getItem("nx-seen") === "1";
    const target = full ? 100 : 100;
    const speed = full ? 5 : 14;
    let p = 0;

    return new Promise((res) => {
      const t = setInterval(() => {
        p = clamp(p + Math.random() * 22, 0, target);
        if (fill) fill.style.width = p + "%";
        if (num) num.textContent = String(Math.floor(p)).padStart(3, "0") + "%";
        if (p >= 100) {
          clearInterval(t);
          el.classList.add("done");
          sessionStorage.setItem("nx-seen", "1");
          document.body.classList.add("loaded");
          setTimeout(res, 520);
        } else if (Math.random() > 0.65) {
          audio.blip(320 + p * 6, 0.04, "square", 0.03);
        }
      }, speed);
    });
  }

  /* ---------- cursor ---------- */
  function cursor() {
    const dot = $(".cursor-dot");
    const ring = $(".cursor-ring");
    if (!dot || !ring) return;
    const pos = { x: state.mouse.x, y: state.mouse.y, rx: state.mouse.x, ry: state.mouse.y };

    const loop = () => {
      pos.x += (state.mouse.x - pos.x) * 0.55;
      pos.y += (state.mouse.y - pos.y) * 0.55;
      pos.rx += (state.mouse.x - pos.rx) * 0.16;
      pos.ry += (state.mouse.y - pos.ry) * 0.16;
      dot.style.transform = `translate(${pos.x}px,${pos.y}px) translate(-50%,-50%)`;
      ring.style.transform = `translate(${pos.rx}px,${pos.ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    };
    loop();

    const hot = "a,button,.card,.project,.filter,.tab,input,textarea,.acc__q,.nav__link";
    document.addEventListener("mouseover", (e) => {
      ring.classList.toggle("hot", !!e.target.closest(hot));
    });
    document.addEventListener("mousedown", () => (ring.style.opacity = "0.4"));
    document.addEventListener("mouseup", () => (ring.style.opacity = "1"));
  }

  /* ---------- nav / progress ---------- */
  function nav() {
    const bar = $(".progress");
    const el = $(".nav");
    const links = $$(".nav__link");
    const burger = $(".burger");
    const list = $(".nav__links");
    const here = location.pathname.split("/").pop() || "index.html";

    links.forEach((a) => {
      const href = a.getAttribute("href");
      if (href === here || (here === "" && href === "index.html")) a.classList.add("active");
      a.addEventListener("mouseenter", () => audio.blip(560, 0.05));
    });

    burger?.addEventListener("click", () => {
      const open = list.classList.toggle("open");
      document.body.classList.toggle("nav-open", open);
      burger.textContent = open ? "✕" : "≡";
      audio.blip(open ? 780 : 420, 0.07);
    });

    const onScroll = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      state.scroll = scrollY;
      if (bar) bar.style.width = (h > 0 ? (scrollY / h) * 100 : 0) + "%";
      el?.classList.toggle("solid", scrollY > 30);
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- reveal ---------- */
  function reveal() {
    const els = $$("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("seen"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target;
          const d = Number(el.dataset.delay || 0);
          setTimeout(() => el.classList.add("seen"), d);
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px" }
    );
    els.forEach((e) => io.observe(e));
  }

  /* ---------- counters ---------- */
  function counters() {
    const els = $$("[data-count]");
    if (!els.length) return;
    const run = (el) => {
      const end = Number(el.dataset.count);
      const suf = el.dataset.suffix || "";
      const t0 = performance.now();
      const dur = 1600;
      const step = (now) => {
        const k = clamp((now - t0) / dur, 0, 1);
        const e = 1 - Math.pow(1 - k, 4);
        el.textContent = Math.round(end * e) + suf;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (en) => {
        en.forEach((e) => {
          if (e.isIntersecting) {
            run(e.target);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    els.forEach((e) => io.observe(e));
  }

  /* ---------- skills ---------- */
  function skills() {
    const bars = $$("[data-skill]");
    if (!bars.length) return;
    const io = new IntersectionObserver(
      (en) => {
        en.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          setTimeout(() => {
            el.style.width = el.dataset.skill + "%";
          }, 120);
          io.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    bars.forEach((b) => io.observe(b));
  }

  /* ---------- magnetic ---------- */
  function magnetic() {
    if (reduce) return;
    $$(".btn, .icon-btn").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.22}px, ${y * 0.3}px)`;
      });
      el.addEventListener("mouseleave", () => (el.style.transform = ""));
    });
  }

  /* ---------- tilt ---------- */
  function tilt() {
    if (reduce) return;
    $$(".tilt").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${px * 12}deg) rotateX(${
          -py * 12
        }deg) translateY(-6px)`;
      });
      el.addEventListener("mouseleave", () => (el.style.transform = ""));
    });
  }

  /* ---------- parallax ---------- */
  function parallax() {
    if (reduce) return;
    const els = $$("[data-par]");
    if (!els.length) return;
    addEventListener(
      "scroll",
      () => {
        els.forEach((el) => {
          const sp = Number(el.dataset.par || 0.15);
          const r = el.getBoundingClientRect();
          const off = (r.top + r.height / 2 - innerHeight / 2) * sp;
          el.style.transform = `translateY(${off.toFixed(1)}px)`;
        });
      },
      { passive: true }
    );
    addEventListener("mousemove", (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      els.forEach((el) => {
        const d = Number(el.dataset.depth || 0);
        if (!d) return;
        el.style.marginLeft = nx * d * 30 + "px";
        el.style.marginTop = ny * d * 30 + "px";
      });
    });
  }

  /* ---------- background network ---------- */
  function background() {
    const cv = $("#bgCanvas");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let w, h, dpr, nodes = [];

    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth;
      h = innerHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = w + "px";
      cv.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = clamp(Math.round((w * h) / 15000), 30, 110);
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.34,
        vy: (Math.random() - 0.5) * 0.34,
        r: Math.random() * 1.8 + 0.6,
      }));
    };

    const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const A = cssVar("--a") || "#00f0ff";
      const B = cssVar("--b") || "#ff2bd6";

      for (const p of nodes) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        const dx = state.mouse.rx - p.x;
        const dy = state.mouse.ry - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 150 && d > 0.1) {
          p.x -= (dx / d) * (150 - d) * 0.02;
          p.y -= (dy / d) * (150 - d) * 0.02;
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist > 145) continue;
          ctx.globalAlpha = (1 - dist / 145) * 0.35;
          ctx.strokeStyle = A;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      for (const p of nodes) {
        const dm = Math.hypot(state.mouse.rx - p.x, state.mouse.ry - p.y);
        ctx.fillStyle = dm < 170 ? B : A;
        ctx.shadowBlur = 12;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      requestAnimationFrame(draw);
    };

    size();
    draw();
    addEventListener("resize", size);
  }

  /* ---------- clock ---------- */
  function clock() {
    const els = $$(".clock");
    if (!els.length) return;
    const tick = () => {
      const d = new Date();
      const s = d.toLocaleTimeString("nb-NO", { hour12: false });
      const t =
        s +
        " : " +
        d.toLocaleDateString("nb-NO", { day: "2-digit", month: "short", year: "numeric" });
      els.forEach((e) => (e.textContent = t));
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- terminal ---------- */
  function terminal() {
    const body = $("#termBody");
    if (!body) return;
    const lines = [
      { t: ">> nexus.core --init", c: "cmd" },
      { t: "loader: moduler koblet til ......... OK", c: "ok" },
      { t: "gpu: canvas-accelerert render aktiv", c: "" },
      { t: "nettverk: 84 noder synkronisert", c: "" },
      { t: "!! advarsel: animasjonsnivå over anbefalt", c: "warn" },
      { t: "hud: custom cursor, palette og wipe lastet", c: "" },
      { t: ">> kjør --render --fps 60 --confetti", c: "cmd" },
      { t: "alt systemer grønne. velkommen ombord.", c: "ok" },
    ];
    let li = 0;
    let ci = 0;
    let cur = null;

    const caret = document.createElement("span");
    caret.className = "caret";

    const step = () => {
      if (li >= lines.length) {
        body.appendChild(caret);
        return;
      }
      if (!cur) {
        cur = document.createElement("div");
        if (lines[li].c) cur.className = lines[li].c;
        body.appendChild(cur);
        ci = 0;
      }
      cur.textContent = lines[li].t.slice(0, ++ci);
      if (ci >= lines[li].t.length) {
        li++;
        cur = null;
        setTimeout(step, 380);
      } else {
        setTimeout(step, 14 + Math.random() * 26);
      }
    };

    const io = new IntersectionObserver(
      (en) => {
        if (en[0].isIntersecting) {
          io.disconnect();
          setTimeout(step, 300);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(body);
  }

  /* ---------- page transition ---------- */
  function transitions() {
    const wipe = $(".page-wipe");
    const links = $$('a[href$=".html"]');
    let leaving = false;

    links.forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        if (!href || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
        if (leaving || href === location.pathname.split("/").pop()) return;
        e.preventDefault();
        leaving = true;
        audio.blip(940, 0.1, "triangle", 0.06);
        if (!wipe || reduce) {
          location.href = href;
          return;
        }
        wipe.classList.add("in");
        setTimeout(() => {
          location.href = href;
        }, 430);
      });
    });

    $("main")?.classList.add("page-in");
  }

  /* ---------- theme + sound buttons ---------- */
  function tools() {
    const themeBtn = $("#themeBtn");
    const soundBtn = $("#soundBtn");
    if (themeBtn) {
      themeBtn.textContent = state.theme === "amber" ? "◐" : "◑";
      themeBtn.addEventListener("click", () => {
        state.theme = state.theme === "amber" ? "neon" : "amber";
        localStorage.setItem("nx-theme", state.theme);
        document.documentElement.dataset.theme = state.theme;
        themeBtn.textContent = state.theme === "amber" ? "◐" : "◑";
        flash();
        audio.blip(660, 0.09, "sine", 0.06);
      });
    }
    if (soundBtn) {
      const sync = () => (soundBtn.textContent = audio.on ? "♪" : "∅");
      sync();
      soundBtn.addEventListener("click", () => {
        audio.init();
        audio.toggle();
        sync();
      });
    }
  }

  function flash() {
    const f = $(".fx-flash");
    if (!f || reduce) return;
    f.classList.remove("go");
    void f.offsetWidth;
    f.classList.add("go");
  }

  /* ---------- accordion ---------- */
  function accordion() {
    $$(".acc__q").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.parentElement;
        const open = item.classList.contains("open");
        $$(".acc").forEach((a) => a.classList.remove("open"));
        if (!open) item.classList.add("open");
        audio.blip(open ? 420 : 740, 0.07);
      });
    });
  }

  /* ---------- command palette ---------- */
  function palette() {
    const box = $("#palette");
    if (!box) return;
    const input = $("#paletteInput");
    const list = $("#paletteList");
    const items = $$("li", list);
    let sel = 0;

    const render = () => {
      const q = input.value.toLowerCase().trim();
      let visible = 0;
      items.forEach((li) => {
        const hit = li.textContent.toLowerCase().includes(q);
        li.style.display = hit ? "" : "none";
        if (hit) visible++;
      });
      const shown = items.filter((li) => li.style.display !== "none");
      sel = clamp(sel, 0, Math.max(shown.length - 1, 0));
      items.forEach((li) => li.classList.remove("sel"));
      shown[sel]?.classList.add("sel");
      shown[sel]?.scrollIntoView({ block: "nearest" });
      return shown;
    };

    const open = () => {
      box.classList.add("open");
      document.body.classList.add("palette-open");
      input.value = "";
      sel = 0;
      render();
      setTimeout(() => input.focus(), 60);
      audio.blip(880, 0.07);
    };
    const close = () => {
      box.classList.remove("open");
      document.body.classList.remove("palette-open");
      audio.blip(420, 0.07);
    };

    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
      const shown = render();
      if (e.key === "ArrowDown") {
        sel = (sel + 1) % shown.length;
        render();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        sel = (sel - 1 + shown.length) % shown.length;
        render();
        e.preventDefault();
      } else if (e.key === "Enter") {
        const href = shown[sel]?.dataset.href;
        if (href) location.href = href;
      } else if (e.key === "Escape") close();
    });

    box.addEventListener("click", (e) => {
      if (e.target === box) close();
      const li = e.target.closest("li");
      if (li?.dataset.href) location.href = li.dataset.href;
    });

    addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        box.classList.contains("open") ? close() : open();
      }
      if (e.key === "Escape" && box.classList.contains("open")) close();
    });

    $("#paletteBtn")?.addEventListener("click", open);
  }

  /* ---------- easter egg ---------- */
  function egg() {
    let buf = "";
    const code = "nexus";
    addEventListener("keydown", (e) => {
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-code.length);
      if (buf === code) {
        document.body.style.animation = "shake .45s 3";
        flash();
        audio.blip(1200, 0.18, "sawtooth", 0.07);
        setTimeout(() => (document.body.style.animation = ""), 1500);
      }
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    cursor();
    nav();
    reveal();
    counters();
    skills();
    magnetic();
    tilt();
    parallax();
    background();
    clock();
    terminal();
    transitions();
    tools();
    accordion();
    palette();
    egg();
    addEventListener(
      "mousemove",
      (e) => {
        state.mouse.x = e.clientX;
        state.mouse.y = e.clientY;
        state.mouse.rx = e.clientX;
        state.mouse.ry = e.clientY;
      },
      { passive: true }
    );
    addEventListener("mouseover", (e) => {
      if (e.target.closest("a,button")) audio.init();
    }, { once: true });
    document.addEventListener("click", () => audio.init(), { once: true });
    window.NEXUS = { audio, flash, state };
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot();
    preloader();
  });
})();

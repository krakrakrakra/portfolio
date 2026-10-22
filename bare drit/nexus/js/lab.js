(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const audio = () => window.NEXUS?.audio;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function surface(canvas) {
    const ctx = canvas.getContext("2d");
    const s = { canvas, ctx, w: 0, h: 0, dpr: 1, mx: -9999, my: -9999, inside: false };

    s.resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      s.dpr = Math.min(devicePixelRatio || 1, 2);
      s.w = r.width;
      s.h = r.height;
      canvas.width = Math.round(r.width * s.dpr);
      canvas.height = Math.round(r.height * s.dpr);
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    };

    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      s.mx = e.clientX - r.left;
      s.my = e.clientY - r.top;
      s.inside = true;
    });
    canvas.addEventListener("pointerleave", () => {
      s.inside = false;
      s.mx = -9999;
      s.my = -9999;
    });

    s.resize();
    addEventListener("resize", s.resize);
    return s;
  }

  /* ---------------- 01 partikler ---------------- */
  const part = (() => {
    const s = surface($("#cvPart"));
    const hud = $("#hudPart");
    let nodes = [];
    let count = 240;
    let force = 0.9;
    let link = 130;
    let t = 0;

    const seed = () => {
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * s.w,
        y: Math.random() * s.h,
        vx: (Math.random() - 0.5) * 1.6,
        vy: (Math.random() - 0.5) * 1.6,
        r: Math.random() * 1.8 + 0.7,
      }));
    };

    const burst = () => {
      const cx = s.inside ? s.mx : s.w / 2;
      const cy = s.inside ? s.my : s.h / 2;
      nodes.forEach((n) => {
        const dx = n.x - cx;
        const dy = n.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        n.vx += (dx / d) * 14;
        n.vy += (dy / d) * 14;
      });
      audio()?.blip(180, 0.25, "sawtooth", 0.07);
      window.NEXUS?.flash();
    };

    const step = () => {
      t += 0.01;
      const a = css("--a") || "#00f0ff";
      const b = css("--b") || "#ff2bd6";
      s.ctx.clearRect(0, 0, s.w, s.h);

      const tx = s.inside ? s.mx : s.w / 2 + Math.cos(t) * s.w * 0.22;
      const ty = s.inside ? s.my : s.h / 2 + Math.sin(t * 1.3) * s.h * 0.22;

      for (const n of nodes) {
        const dx = tx - n.x;
        const dy = ty - n.y;
        const d = Math.hypot(dx, dy) || 1;
        const pull = s.inside ? (d < 380 ? (380 - d) / 380 : 0) * force * 0.5 : 0.12;
        n.vx += (dx / d) * pull;
        n.vy += (dy / d) * pull;

        n.vx += Math.sin(t + n.y * 0.01) * 0.02;
        n.vy += Math.cos(t + n.x * 0.01) * 0.02;
        n.vx *= 0.985;
        n.vy *= 0.985;
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0 || n.x > s.w) n.vx *= -1;
        if (n.y < 0 || n.y > s.h) n.vy *= -1;
        n.x = Math.max(0, Math.min(s.w, n.x));
        n.y = Math.max(0, Math.min(s.h, n.y));
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const p = nodes[i];
          const q = nodes[j];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d > link) continue;
          s.ctx.globalAlpha = (1 - d / link) * 0.5;
          s.ctx.strokeStyle = a;
          s.ctx.lineWidth = 0.7;
          s.ctx.beginPath();
          s.ctx.moveTo(p.x, p.y);
          s.ctx.lineTo(q.x, q.y);
          s.ctx.stroke();
        }
      }

      s.ctx.globalAlpha = 1;
      for (const n of nodes) {
        const near = Math.hypot(tx - n.x, ty - n.y) < 160;
        s.ctx.fillStyle = near ? b : a;
        s.ctx.shadowBlur = near ? 14 : 7;
        s.ctx.shadowColor = s.ctx.fillStyle;
        s.ctx.beginPath();
        s.ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        s.ctx.fill();
      }
      s.ctx.shadowBlur = 0;

      if (hud) hud.textContent = "partikler: " + nodes.length + " · lenker aktiv";
    };

    $("#partCount").addEventListener("input", (e) => {
      count = +e.target.value;
      $("#partCountV").textContent = count;
      seed();
    });
    $("#partForce").addEventListener("input", (e) => {
      force = +e.target.value / 10;
      $("#partForceV").textContent = force.toFixed(1);
    });
    $("#partLink").addEventListener("input", (e) => {
      link = +e.target.value;
      $("#partLinkV").textContent = link;
    });
    $("#partBurst").addEventListener("click", burst);

    addEventListener("resize", () => setTimeout(seed, 60));
    seed();
    return { step, resize: () => s.resize() };
  })();

  /* ---------------- 02 bølger ---------------- */
  const wave = (() => {
    const s = surface($("#cvWave"));
    const hud = $("#hudWave");
    let amp = 1;
    let speed = 1.4;
    let sources = 3;
    let t = 0;
    const shocks = [];

    const kick = (x, y) => {
      shocks.push({ x, y, r: 0, life: 1 });
      audio()?.blip(520, 0.14, "sine", 0.05);
    };

    s.canvas.addEventListener("pointerdown", (e) => {
      const r = s.canvas.getBoundingClientRect();
      kick(e.clientX - r.left, e.clientY - r.top);
    });

    $("#waveKick").addEventListener("click", () => kick(s.w / 2, s.h / 2));
    $("#waveAmp").addEventListener("input", (e) => {
      amp = +e.target.value / 10;
      $("#waveAmpV").textContent = amp.toFixed(1);
    });
    $("#waveSpeed").addEventListener("input", (e) => {
      speed = +e.target.value / 10;
      $("#waveSpeedV").textContent = speed.toFixed(1);
    });
    $("#waveSrc").addEventListener("input", (e) => {
      sources = +e.target.value;
      $("#waveSrcV").textContent = sources;
      if (hud) hud.textContent = "bølger: " + sources + " kilder";
    });

    const step = () => {
      t += 0.045 * speed;
      const a = css("--a") || "#00f0ff";
      const b = css("--b") || "#ff2bd6";
      s.ctx.fillStyle = "rgba(5,7,14,0.35)";
      s.ctx.fillRect(0, 0, s.w, s.h);

      const gap = 17;
      const pts = [];
      for (let x = gap / 2; x < s.w; x += gap) {
        for (let y = gap / 2; y < s.h; y += gap) {
          let v = 0;
          for (let k = 0; k < sources; k++) {
            const sx = s.w * (0.5 + 0.36 * Math.cos((k / sources) * Math.PI * 2 + t * 0.3));
            const sy = s.h * (0.5 + 0.36 * Math.sin((k / sources) * Math.PI * 2 - t * 0.3));
            const d = Math.hypot(x - sx, y - sy);
            v += Math.sin(d * 0.045 - t * 2) / (1 + d * 0.012);
          }
          for (const sh of shocks) {
            const d = Math.hypot(x - sh.x, y - sh.y);
            v += Math.sin(d * 0.06 - sh.r * 0.14) * Math.max(0, 1 - sh.r / 260) * 1.6;
          }
          pts.push({ x, y, v });
        }
      }

      for (const sh of shocks) {
        sh.r += 6;
        sh.life -= 0.016;
      }
      for (let i = shocks.length - 1; i >= 0; i--) if (shocks[i].life <= 0) shocks.splice(i, 1);

      for (const p of pts) {
        const k = Math.max(-1, Math.min(1, p.v * amp * 0.5));
        const r = Math.abs(k) * 7.5;
        s.ctx.globalAlpha = 0.18 + Math.abs(k) * 0.82;
        s.ctx.fillStyle = k > 0 ? a : b;
        s.ctx.beginPath();
        s.ctx.arc(p.x, p.y, Math.max(0.6, r), 0, Math.PI * 2);
        s.ctx.fill();
      }
      s.ctx.globalAlpha = 1;

      if (hud)
        hud.textContent =
          "bølger: " + sources + " kilder · støt: " + shocks.length;
    };

    return { step, resize: () => s.resize() };
  })();

  /* ---------------- 03 matrix ---------------- */
  const code = (() => {
    const s = surface($("#cvCode"));
    const hud = $("#hudCode");
    let speed = 1.8;
    let size = 16;
    let cols = 0;
    let drops = [];
    let glitch = 0;
    const glyphs = "アイウエオカキクケコサシスセソ0123456789<>/{}[]#$%&*+=NEXUS";

    const rebuild = () => {
      cols = Math.floor(s.w / size);
      drops = Array.from({ length: cols }, () => ({
        y: Math.random() * -s.h,
        speed: 0.5 + Math.random() * 0.9,
        bright: Math.random() > 0.85,
      }));
      if (hud) hud.textContent = "kolonner: " + cols;
    };

    $("#codeSpeed").addEventListener("input", (e) => {
      speed = +e.target.value / 10;
      $("#codeSpeedV").textContent = speed.toFixed(1);
    });
    $("#codeSize").addEventListener("input", (e) => {
      size = +e.target.value;
      $("#codeSizeV").textContent = size;
      s.resize();
      rebuild();
    });
    $("#codeGlitch").addEventListener("click", () => {
      glitch = 26;
      audio()?.blip(160, 0.2, "square", 0.06);
    });

    addEventListener("resize", () => {
      s.resize();
      rebuild();
    });

    const step = () => {
      const a = css("--a") || "#00f0ff";
      const c = css("--c") || "#b6ff2e";
      s.ctx.fillStyle = "rgba(5,7,14,0.14)";
      s.ctx.fillRect(0, 0, s.w, s.h);
      s.ctx.font = size + "px 'JetBrains Mono', monospace";
      s.ctx.textAlign = "center";

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        const x = i * size + size / 2;
        const ch = glyphs[(Math.random() * glyphs.length) | 0];
        s.ctx.fillStyle = d.bright ? "#ffffff" : c;
        s.ctx.shadowBlur = d.bright ? 16 : 8;
        s.ctx.shadowColor = d.bright ? a : c;
        s.ctx.fillText(ch, x, d.y);
        d.y += size * d.speed * speed;

        if (d.y > s.h + 40) {
          d.y = -Math.random() * 180;
          d.speed = 0.5 + Math.random() * 0.9;
          d.bright = Math.random() > 0.86;
        }
      }
      s.ctx.shadowBlur = 0;

      if (glitch > 0) {
        glitch--;
        for (let k = 0; k < 4; k++) {
          const y = Math.random() * s.h;
          const h = 6 + Math.random() * 26;
          const off = (Math.random() - 0.5) * 70;
          try {
            s.ctx.drawImage(s.canvas, 0, y * s.dpr, s.canvas.width, h * s.dpr, off, y, s.w, h);
          } catch (_) {}
        }
        s.ctx.globalAlpha = 0.18;
        s.ctx.fillStyle = a;
        s.ctx.fillRect(0, 0, s.w, s.h);
        s.ctx.globalAlpha = 1;
      }

      if (hud && Math.random() > 0.9) hud.textContent = "kolonner: " + cols + " · glitch: " + glitch;
    };

    rebuild();
    setTimeout(rebuild, 200);
    return { step, resize: () => {
      s.resize();
      rebuild();
    } };
  })();

  /* ---------------- tabs + loop ---------------- */
  const tabs = { part: part, wave: wave, code: code };
  let active = "part";

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("on"));
      tab.classList.add("on");
      $$(".panel").forEach((p) => p.classList.remove("on"));
      const id = tab.dataset.tab;
      $("#panel-" + id).classList.add("on");
      active = id;
      tabs[id].resize();
      audio()?.blip(700 + Object.keys(tabs).indexOf(id) * 140, 0.09);
      window.NEXUS?.flash();
    });
  });

  const loop = () => {
    tabs[active].step();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();

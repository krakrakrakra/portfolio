(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const grid = $("#projectGrid");
  const cards = $$(".project", grid);
  const empty = $("#emptyMsg");
  const modal = $("#modal");
  const audio = () => window.NEXUS?.audio;

  $$(".filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".filter").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      const f = btn.dataset.filter;
      let shown = 0;

      cards.forEach((card, i) => {
        const hit = f === "alle" || card.dataset.cat === f;
        card.classList.toggle("hide", !hit);
        if (hit) {
          shown++;
          card.classList.remove("seen");
          void card.offsetWidth;
          card.style.transitionDelay = i * 45 + "ms";
          requestAnimationFrame(() => card.classList.add("seen"));
          setTimeout(() => (card.style.transitionDelay = ""), 700);
        }
      });

      if (empty) empty.style.display = shown ? "none" : "block";
      audio()?.blip(shown ? 760 : 520, 0.07);
      window.NEXUS?.flash();
    });
  });

  function openModal(card) {
    $("#mTitle").textContent = card.dataset.title || "Prosjekt";
    $("#mDesc").textContent = card.dataset.desc || "";
    $("#mYear").textContent = "// " + (card.dataset.year || "2026");
    const chips = $("#mChips");
    chips.innerHTML = "";
    $$(".chip", card).forEach((c) => {
      const clone = c.cloneNode(true);
      chips.appendChild(clone);
    });
    modal.classList.add("open");
    document.body.classList.add("palette-open");
    audio()?.blip(980, 0.1, "triangle", 0.06);
  }

  function closeModal() {
    modal.classList.remove("open");
    document.body.classList.remove("palette-open");
    audio()?.blip(440, 0.08);
  }

  cards.forEach((card) => {
    card.addEventListener("click", () => openModal(card));
    card.addEventListener("mouseenter", () => audio()?.blip(600, 0.04, "triangle", 0.03));
  });

  $("#modalClose")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
  });
})();

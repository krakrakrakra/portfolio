(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const audio = () => window.NEXUS?.audio;

  const form = $("#contactForm");
  if (!form) return;

  const name = $("#name");
  const email = $("#email");
  const msg = $("#msg");
  const chars = $("#chars");

  const rules = {
    name: (v) => v.trim().length >= 2,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    msg: (v) => v.trim().length >= 10,
  };

  const fieldOf = (input) => input.closest("[data-field]");

  const validate = (input, silent = false) => {
    const ok = rules[input.name](input.value);
    const field = fieldOf(input);
    if (silent) {
      if (ok) field.classList.remove("invalid");
      return ok;
    }
    field.classList.toggle("invalid", !ok);
    if (!ok) audio()?.blip(240, 0.09, "square", 0.04);
    return ok;
  };

  [name, email, msg].forEach((input) => {
    input.addEventListener("input", () => {
      if (input === msg && chars) chars.textContent = input.value.length;
      validate(input, true);
      fieldOf(input).classList.remove("invalid");
    });
    input.addEventListener("blur", () => validate(input, true));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const results = [name, email, msg].map((i) => validate(i));

    if (results.includes(false)) {
      const first = [name, email, msg].find((i) => !rules[i.name](i.value));
      first?.focus();
      window.NEXUS?.flash();
      return;
    }

    const sent = $("#sent");
    $("#sentName").textContent = name.value.trim() || "operatør";
    form.style.transition = "opacity .4s ease, transform .4s ease";
    form.style.opacity = "0";
    form.style.transform = "translateY(-14px)";

    setTimeout(() => {
      form.style.display = "none";
      sent.classList.add("show");
      window.NEXUS?.flash();
      audio()?.blip(880, 0.1, "triangle", 0.07);
      setTimeout(() => audio()?.blip(1320, 0.16, "sine", 0.06), 130);
      setTimeout(() => audio()?.blip(1760, 0.2, "sine", 0.05), 260);
    }, 400);
  });

  $$(".acc").forEach((a, i) => {
    if (i === 0) a.classList.add("open");
  });
})();

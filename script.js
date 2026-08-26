/* =========================================================
   KFL — Skelbimų Centras
   script.js — prieigos kodas, kanalų valdymas, peržiūra,
   siuntimas per Discord Webhooks
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     0. Prieigos kodo užsklanda
     ========================================================= */
  const ACCESS_CODE = "0XD67";
  const ACCESS_KEY = "kfl_access_granted";

  const gate = {
    overlay: document.getElementById("gateOverlay"),
    card: document.getElementById("gateCard"),
    content: document.getElementById("gateContent"),
    form: document.getElementById("gateForm"),
    input: document.getElementById("gateInput"),
    error: document.getElementById("gateError"),
    success: document.getElementById("gateSuccess")
  };

  function initGate() {
    // Jei jau anksčiau atrakinta, html elementas jau turi klasę "kfl-unlocked"
    // (nustatyta inline script'u <head> viršuje) — tuomet čia daryti nieko nereikia.
    if (document.documentElement.classList.contains("kfl-unlocked")) {
      return;
    }

    gate.input.focus();

    gate.form.addEventListener("submit", (e) => {
      e.preventDefault();
      attemptUnlock();
    });
  }

  function attemptUnlock() {
    const entered = gate.input.value.trim().toUpperCase();

    if (entered !== ACCESS_CODE) {
      gate.error.hidden = false;
      gate.card.classList.remove("is-shaking");
      // trigger reflow so the shake animation can replay
      void gate.card.offsetWidth;
      gate.card.classList.add("is-shaking");
      gate.input.value = "";
      gate.input.focus();
      return;
    }

    // teisingas kodas — paleidžiame atrakinimo animaciją
    try {
      localStorage.setItem(ACCESS_KEY, "true");
    } catch (err) {
      /* localStorage gali būti nepasiekiamas — vis tiek leidžiame tęsti šią sesiją */
    }

    gate.error.hidden = true;
    gate.content.hidden = true;
    gate.success.hidden = false;

    setTimeout(() => {
      gate.overlay.classList.add("is-unlocking");
    }, 650);

    setTimeout(() => {
      gate.overlay.style.display = "none";
      document.documentElement.classList.add("kfl-unlocked");
      const appRoot = document.getElementById("appRoot");
      appRoot.classList.add("is-revealing");
      appRoot.addEventListener("animationend", () => {
        appRoot.classList.remove("is-revealing");
      }, { once: true });
    }, 1150);
  }

  /* =========================================================
     1. Pagrindinė programa
     ========================================================= */
  const WEBHOOKS_KEY = "kfl_webhooks_v1";
  const TEAMS_KEY = "kfl_teams_v1";

  // Numatytieji (įkelti iš anksto) webhook adresai kiekvienam kanalui.
  // Juos bet kada galima pakeisti "Webhook adresai" nustatymuose — ten
  // įvesti adresai visada turi pirmenybę prieš šiuos numatytuosius.
  const DEFAULT_WEBHOOKS = {
    announcements: "https://discord.com/api/webhooks/1542060589667319808/UUdBHdjCQD2pcuvNzcXuxruxnT5quACPIWbWI435-ixk-a0Z-_walKin5cGHk7kdgZkn",
    schedule:      "https://discord.com/api/webhooks/1542060756202426440/_36NJ21_CtmyzpH69gwhVdCaA9eWxvl-IciiCsrnR2NFC_GkuJ7T5Uwhnl6wRrbeQZO5",
    results:       "https://discord.com/api/webhooks/1542060909449449533/3izEOVyfEjiFNoUEQLbJlz4nig8NtnphkfPzZ0Gcl6331wD2dWdn_c-kTvhCpVKDRz-i"
  };

  const CHANNELS = {
    announcements: { label: "pranešimai", icon: "📢", color: "#2ecc71", formTitle: "Pranešimo turinys" },
    schedule:      { label: "tvarkaraštis", icon: "🗓️", color: "#3498db", formTitle: "Rungtynių grafikas" },
    results:       { label: "rezultatai", icon: "🏆", color: "#f1c40f", formTitle: "Rungtynių rezultatas" }
  };

  const ROUND_COUNT = 20;

  const state = {
    activeChannel: "announcements",
    webhooks: loadWebhooks(),
    teams: loadTeams(),
    userPickedColor: false
  };

  /* ---------- DOM refs ---------- */
  const els = {
    channelGrid: document.getElementById("channelGrid"),
    contentCardTitle: document.getElementById("contentCardTitle"),
    form: document.getElementById("messageForm"),

    fieldGroups: document.querySelectorAll(".field-group"),

    // pranešimai
    emojiInput: document.getElementById("emojiInput"),
    titleInput: document.getElementById("titleInput"),
    contentInput: document.getElementById("contentInput"),
    charCount: document.getElementById("charCount"),

    // tvarkaraštis
    scheduleRound: document.getElementById("scheduleRound"),
    scheduleTeamA: document.getElementById("scheduleTeamA"),
    scheduleTeamB: document.getElementById("scheduleTeamB"),
    scheduleDate: document.getElementById("scheduleDate"),
    scheduleTime: document.getElementById("scheduleTime"),
    scheduleVenue: document.getElementById("scheduleVenue"),
    scheduleNotes: document.getElementById("scheduleNotes"),
    scheduleTeamChips: document.getElementById("scheduleTeamChips"),

    // rezultatai
    resultsRound: document.getElementById("resultsRound"),
    resultsTeamA: document.getElementById("resultsTeamA"),
    resultsTeamB: document.getElementById("resultsTeamB"),
    resultsScoreA: document.getElementById("resultsScoreA"),
    resultsScoreB: document.getElementById("resultsScoreB"),
    resultsNotes: document.getElementById("resultsNotes"),
    resultsTeamChips: document.getElementById("resultsTeamChips"),
    winnerPreview: document.getElementById("winnerPreview"),

    teamsList: document.getElementById("teamsList"),

    colorInput: document.getElementById("colorInput"),
    colorPresets: document.getElementById("colorPresets"),
    sendBtn: document.getElementById("sendBtn"),

    webhookToggle: document.getElementById("webhookToggle"),
    webhookCard: document.getElementById("webhookCard"),
    webhookBody: document.getElementById("webhookBody"),
    saveWebhooks: document.getElementById("saveWebhooks"),
    whAnnouncements: document.getElementById("wh-announcements"),
    whSchedule: document.getElementById("wh-schedule"),
    whResults: document.getElementById("wh-results"),

    previewChannelIcon: document.getElementById("previewChannelIcon"),
    previewChannelName: document.getElementById("previewChannelName"),
    previewTitle: document.getElementById("previewTitle"),
    previewContent: document.getElementById("previewContent"),
    embedPreview: document.getElementById("embedPreview"),
    previewTime: document.getElementById("previewTime"),
    previewFooterTime: document.getElementById("previewFooterTime"),

    statusDot: document.getElementById("statusDot"),
    statusLabel: document.getElementById("statusLabel"),
    toastContainer: document.getElementById("toastContainer")
  };

  /* =========================================================
     Init
     ========================================================= */
  function init() {
    initGate();

    populateRoundSelect(els.scheduleRound);
    populateRoundSelect(els.resultsRound);

    // restore saved webhook URLs into settings fields
    els.whAnnouncements.value = state.webhooks.announcements || "";
    els.whSchedule.value = state.webhooks.schedule || "";
    els.whResults.value = state.webhooks.results || "";

    renderTeamsList();
    renderTeamChips(els.scheduleTeamChips);
    renderTeamChips(els.resultsTeamChips);

    switchChannel("announcements", { silent: true });
    updateConnectionStatus();
    updatePreview();
    updateClock();
    setInterval(updateClock, 30000);

    els.channelGrid.addEventListener("click", onChannelClick);

    // pranešimai
    els.titleInput.addEventListener("input", updatePreview);
    els.contentInput.addEventListener("input", updatePreview);
    els.emojiInput.addEventListener("input", updatePreview);

    // tvarkaraštis
    [els.scheduleRound, els.scheduleTeamA, els.scheduleTeamB, els.scheduleDate, els.scheduleTime, els.scheduleVenue, els.scheduleNotes]
      .forEach((el) => el.addEventListener("input", updatePreview));

    // rezultatai
    [els.resultsRound, els.resultsTeamA, els.resultsTeamB, els.resultsScoreA, els.resultsScoreB, els.resultsNotes]
      .forEach((el) => el.addEventListener("input", () => { updateWinnerPreview(); updatePreview(); }));

    els.colorInput.addEventListener("input", () => {
      state.userPickedColor = true;
      updatePreview();
    });

    els.colorPresets.addEventListener("click", (e) => {
      const btn = e.target.closest(".swatch");
      if (!btn) return;
      els.colorInput.value = btn.dataset.color;
      state.userPickedColor = true;
      updatePreview();
    });

    els.scheduleTeamChips.addEventListener("click", onTeamChipClick);
    els.resultsTeamChips.addEventListener("click", onTeamChipClick);

    els.webhookToggle.addEventListener("click", toggleWebhookPanel);
    els.saveWebhooks.addEventListener("click", saveWebhookUrls);

    els.form.addEventListener("submit", onSubmit);

    // Patogumo dėlei: Enter antraštės laukelyje peršoka į žinutės tekstą,
    // o Ctrl/Cmd + Enter žinutės laukelyje iškart išsiunčia žinutę.
    els.titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        els.contentInput.focus();
      }
    });
    els.contentInput.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        els.form.requestSubmit();
      }
    });
  }

  function populateRoundSelect(selectEl) {
    selectEl.innerHTML = "";
    for (let i = 1; i <= ROUND_COUNT; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i} turas`;
      selectEl.appendChild(opt);
    }
    const friendly = document.createElement("option");
    friendly.value = "draugiskos";
    friendly.textContent = "Draugiškos rungtynės";
    selectEl.appendChild(friendly);
  }

  /* =========================================================
     Channel selection
     ========================================================= */
  function onChannelClick(e) {
    const card = e.target.closest(".channel-card");
    if (!card) return;
    switchChannel(card.dataset.channel);
  }

  function switchChannel(channelKey, opts) {
    opts = opts || {};
    state.activeChannel = channelKey;
    const channel = CHANNELS[channelKey];

    els.channelGrid.querySelectorAll(".channel-card").forEach((c) =>
      c.classList.toggle("is-active", c.dataset.channel === channelKey)
    );

    els.fieldGroups.forEach((group) => {
      group.hidden = group.dataset.fields !== channelKey;
    });

    els.contentCardTitle.textContent = channel.formTitle;

    // set a sensible default accent color per channel, unless the
    // person has already hand-picked one in this session
    if (!state.userPickedColor) {
      els.colorInput.value = channel.color;
    }

    if (channelKey === "results") {
      updateWinnerPreview();
    }

    if (!opts.silent) {
      updatePreview();
    }
    updateConnectionStatus();
  }

  /* =========================================================
     Saved teams (autocomplete + quick chips)
     ========================================================= */
  function loadTeams() {
    try {
      const raw = localStorage.getItem(TEAMS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveTeams(names) {
    let changed = false;
    names.forEach((name) => {
      const clean = (name || "").trim();
      if (clean && !state.teams.some((t) => t.toLowerCase() === clean.toLowerCase())) {
        state.teams.push(clean);
        changed = true;
      }
    });
    if (changed) {
      state.teams.sort((a, b) => a.localeCompare(b, "lt"));
      try {
        localStorage.setItem(TEAMS_KEY, JSON.stringify(state.teams));
      } catch (err) { /* ignoruojame, jei localStorage nepasiekiamas */ }
      renderTeamsList();
      renderTeamChips(els.scheduleTeamChips);
      renderTeamChips(els.resultsTeamChips);
    }
  }

  function renderTeamsList() {
    els.teamsList.innerHTML = state.teams
      .map((name) => `<option value="${escapeHtml(name)}"></option>`)
      .join("");
  }

  function renderTeamChips(container) {
    if (!state.teams.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = state.teams
      .map((name) => `<button type="button" class="team-chip">${escapeHtml(name)}</button>`)
      .join("");
  }

  function onTeamChipClick(e) {
    const chip = e.target.closest(".team-chip");
    if (!chip) return;

    const container = e.currentTarget;
    const group = container.dataset.targetGroup;
    const name = chip.textContent;

    const teamAInput = group === "schedule" ? els.scheduleTeamA : els.resultsTeamA;
    const teamBInput = group === "schedule" ? els.scheduleTeamB : els.resultsTeamB;

    // fill whichever team field is empty; prefer A first, then B
    if (!teamAInput.value.trim()) {
      teamAInput.value = name;
      teamAInput.dispatchEvent(new Event("input"));
    } else if (!teamBInput.value.trim()) {
      teamBInput.value = name;
      teamBInput.dispatchEvent(new Event("input"));
    } else {
      teamAInput.value = name;
      teamAInput.dispatchEvent(new Event("input"));
    }
  }

  /* =========================================================
     Webhook settings panel
     ========================================================= */
  function toggleWebhookPanel() {
    const isOpen = els.webhookBody.hidden === false;
    els.webhookBody.hidden = isOpen;
    els.webhookToggle.setAttribute("aria-expanded", String(!isOpen));
    els.webhookCard.dataset.open = String(!isOpen);
  }

  function saveWebhookUrls() {
    const raw = {
      announcements: els.whAnnouncements.value.trim(),
      schedule: els.whSchedule.value.trim(),
      results: els.whResults.value.trim()
    };

    for (const key of Object.keys(raw)) {
      if (raw[key] && !isValidWebhookUrl(raw[key])) {
        showToast("error", "Neteisingas adresas", `# ${CHANNELS[key].label} webhook nuoroda neatrodo kaip tikra Discord Webhook nuoroda.`);
        return;
      }
    }

    // Jei laukelis paliktas tuščias, grįžtame prie numatytojo to kanalo adreso
    // vietoje to, kad kanalas liktų visai be webhook'o.
    const urls = {
      announcements: raw.announcements || DEFAULT_WEBHOOKS.announcements,
      schedule: raw.schedule || DEFAULT_WEBHOOKS.schedule,
      results: raw.results || DEFAULT_WEBHOOKS.results
    };

    state.webhooks = urls;
    try {
      localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(urls));
    } catch (err) { /* ignoruojame, jei localStorage nepasiekiamas */ }

    // Atnaujiname laukelius, kad matytųsi, koks adresas realiai naudojamas.
    els.whAnnouncements.value = urls.announcements;
    els.whSchedule.value = urls.schedule;
    els.whResults.value = urls.results;

    updateConnectionStatus();
    showToast("success", "Išsaugota", "Webhook adresai sėkmingai išsaugoti šioje naršyklėje.");
  }

  function loadWebhooks() {
    // Pradedame nuo numatytųjų adresų, o viską, kas išsaugota naršyklėje
    // (t. y. rankiniu būdu pakeista nustatymuose), uždedame ant viršaus.
    let saved = {};
    try {
      const raw = localStorage.getItem(WEBHOOKS_KEY);
      saved = raw ? JSON.parse(raw) : {};
    } catch (err) {
      saved = {};
    }
    return { ...DEFAULT_WEBHOOKS, ...saved };
  }

  function isValidWebhookUrl(url) {
    return /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/i.test(url.trim());
  }

  /* =========================================================
     Connection status pill
     ========================================================= */
  function updateConnectionStatus() {
    const url = state.webhooks[state.activeChannel];
    const channel = CHANNELS[state.activeChannel];

    if (url && isValidWebhookUrl(url)) {
      els.statusDot.className = "status-dot is-ready";
      els.statusLabel.textContent = `# ${channel.label} — webhook paruoštas`;
    } else if (url) {
      els.statusDot.className = "status-dot is-error";
      els.statusLabel.textContent = `# ${channel.label} — nuoroda netinkama`;
    } else {
      els.statusDot.className = "status-dot";
      els.statusLabel.textContent = `# ${channel.label} — webhook nesukonfigūruotas`;
    }
  }

  /* =========================================================
     Winner preview (results form)
     ========================================================= */
  function computeWinner() {
    const teamA = els.resultsTeamA.value.trim() || "Komanda A";
    const teamB = els.resultsTeamB.value.trim() || "Komanda B";
    const scoreA = els.resultsScoreA.value;
    const scoreB = els.resultsScoreB.value;

    if (scoreA === "" || scoreB === "") return null;

    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;

    if (a === b) return { draw: true, teamA, teamB, a, b };
    const winner = a > b ? teamA : teamB;
    return { draw: false, winner, teamA, teamB, a, b };
  }

  function updateWinnerPreview() {
    const result = computeWinner();
    els.winnerPreview.classList.remove("has-winner", "is-draw");

    if (!result) {
      els.winnerPreview.textContent = "Įveskite rezultatą, kad pamatytumėte nugalėtoją.";
      return;
    }

    if (result.draw) {
      els.winnerPreview.textContent = `🤝 Lygiosios — ${result.teamA} ${result.a}:${result.b} ${result.teamB}`;
      els.winnerPreview.classList.add("is-draw");
    } else {
      els.winnerPreview.textContent = `🏆 Laimėjo ${result.winner} (${result.teamA} ${result.a}:${result.b} ${result.teamB})`;
      els.winnerPreview.classList.add("has-winner");
    }
  }

  /* =========================================================
     Embed content builders (shared by preview + actual send)
     ========================================================= */
  function formatDateLt(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("lt-LT", { year: "numeric", month: "long", day: "numeric" });
  }

  function roundLabel(selectEl) {
    const val = selectEl.value;
    if (val === "draugiskos") return "Draugiškos rungtynės";
    return `${val} turas`;
  }

  function buildAnnouncementsEmbed() {
    const emoji = els.emojiInput.value.trim();
    const title = els.titleInput.value.trim();
    const content = els.contentInput.value.trim();
    return {
      title: (emoji ? emoji + " " : "") + (title || "Antraštė bus čia"),
      description: content || "Jūsų žinutės tekstas atsiras čia, kai pradėsite rašyti.",
      isEmpty: !title && !content
    };
  }

  function buildScheduleEmbed() {
    const round = roundLabel(els.scheduleRound);
    const teamA = els.scheduleTeamA.value.trim() || "Komanda A";
    const teamB = els.scheduleTeamB.value.trim() || "Komanda B";
    const date = els.scheduleDate.value ? formatDateLt(els.scheduleDate.value) : "Data nenurodyta";
    const time = els.scheduleTime.value || "Laikas nenurodytas";
    const venue = els.scheduleVenue.value.trim() || "Vieta bus paskelbta";
    const notes = els.scheduleNotes.value.trim();

    const lines = [
      `📅 **Data:** ${date}`,
      `⏰ **Laikas:** ${time}`,
      `📍 **Vieta:** ${venue}`
    ];
    if (notes) lines.push("", notes);

    return {
      title: `🗓️ ${round}: ${teamA} vs ${teamB}`,
      description: lines.join("\n"),
      isEmpty: !els.scheduleTeamA.value.trim() && !els.scheduleTeamB.value.trim()
    };
  }

  function buildResultsEmbed() {
    const round = roundLabel(els.resultsRound);
    const teamA = els.resultsTeamA.value.trim() || "Komanda A";
    const teamB = els.resultsTeamB.value.trim() || "Komanda B";
    const scoreA = els.resultsScoreA.value !== "" ? els.resultsScoreA.value : "0";
    const scoreB = els.resultsScoreB.value !== "" ? els.resultsScoreB.value : "0";
    const notes = els.resultsNotes.value.trim();
    const result = computeWinner();

    const lines = [`**${teamA}  ${scoreA} : ${scoreB}  ${teamB}**`, ""];

    if (result && result.draw) {
      lines.push("🤝 **Lygiosios**");
    } else if (result) {
      lines.push(`🏆 **Laimėjo:** ${result.winner}`);
    } else {
      lines.push("🏆 **Laimėjo:** —");
    }

    if (notes) lines.push("", notes);

    return {
      title: `🏆 ${round} rezultatai`,
      description: lines.join("\n"),
      isEmpty: !els.resultsTeamA.value.trim() && !els.resultsTeamB.value.trim()
    };
  }

  function buildEmbedForActiveChannel() {
    if (state.activeChannel === "schedule") return buildScheduleEmbed();
    if (state.activeChannel === "results") return buildResultsEmbed();
    return buildAnnouncementsEmbed();
  }

  /* =========================================================
     Live preview
     ========================================================= */
  function updatePreview() {
    const channel = CHANNELS[state.activeChannel];
    els.previewChannelIcon.textContent = channel.icon;
    els.previewChannelName.textContent = channel.label;

    const embed = buildEmbedForActiveChannel();
    const color = els.colorInput.value;

    els.previewTitle.textContent = embed.title;
    els.previewContent.textContent = embed.description;
    els.embedPreview.style.setProperty("--embed-color", color);

    els.charCount.textContent = String(els.contentInput.value.trim().length);
  }

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" });
    const label = `šiandien ${time}`;
    els.previewTime.textContent = label;
    els.previewFooterTime.textContent = label;
  }

  /* =========================================================
     Toasts
     ========================================================= */
  function showToast(type, title, message) {
    const toast = document.createElement("div");
    toast.className = "toast" + (type === "error" ? " toast--error" : "");
    toast.innerHTML = `
      <span class="toast__icon">${type === "error" ? "⚠️" : "✅"}</span>
      <div>
        <div class="toast__title">${escapeHtml(title)}</div>
        <div class="toast__msg">${escapeHtml(message)}</div>
      </div>
    `;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("is-leaving");
      setTimeout(() => toast.remove(), 250);
    }, 4200);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* =========================================================
     Validation per channel
     ========================================================= */
  function validateActiveChannel() {
    if (state.activeChannel === "announcements") {
      if (!els.titleInput.value.trim() || !els.contentInput.value.trim()) {
        return "Įveskite bent antraštę ir žinutės tekstą prieš siunčiant.";
      }
    }
    if (state.activeChannel === "schedule") {
      if (!els.scheduleTeamA.value.trim() || !els.scheduleTeamB.value.trim()) {
        return "Įveskite abiejų komandų pavadinimus.";
      }
      if (!els.scheduleDate.value) {
        return "Pasirinkite rungtynių datą.";
      }
    }
    if (state.activeChannel === "results") {
      if (!els.resultsTeamA.value.trim() || !els.resultsTeamB.value.trim()) {
        return "Įveskite abiejų komandų pavadinimus.";
      }
      if (els.resultsScoreA.value === "" || els.resultsScoreB.value === "") {
        return "Įveskite abiejų komandų įvarčius.";
      }
    }
    return null;
  }

  function collectTeamsForActiveChannel() {
    if (state.activeChannel === "schedule") {
      return [els.scheduleTeamA.value, els.scheduleTeamB.value];
    }
    if (state.activeChannel === "results") {
      return [els.resultsTeamA.value, els.resultsTeamB.value];
    }
    return [];
  }

  /* =========================================================
     Submit / send to Discord
     ========================================================= */
  async function onSubmit(e) {
    e.preventDefault();

    const channel = CHANNELS[state.activeChannel];
    const webhookUrl = state.webhooks[state.activeChannel];

    const validationError = validateActiveChannel();
    if (validationError) {
      showToast("error", "Trūksta duomenų", validationError);
      return;
    }

    if (!webhookUrl) {
      showToast("error", "Webhook nesukonfigūruotas", `Pridėkite # ${channel.label} kanalo webhook nuorodą nustatymuose.`);
      return;
    }

    if (!isValidWebhookUrl(webhookUrl)) {
      showToast("error", "Neteisingas webhook", `# ${channel.label} webhook nuoroda netinkama. Patikrinkite nustatymuose.`);
      return;
    }

    const embed = buildEmbedForActiveChannel();
    const color = els.colorInput.value;

    const payload = {
      username: "KFL Botas",
      embeds: [
        {
          title: embed.title,
          description: embed.description,
          color: hexToInt(color),
          footer: {
            text: "KFL · Klasės Futbolo Lyga"
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    setSending(true);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok || response.status === 204) {
        showToast("success", "Išsiųsta!", `Žinutė sėkmingai išsiųsta į # ${channel.label} kanalą.`);
        saveTeams(collectTeamsForActiveChannel());
        resetActiveChannelForm();
        updatePreview();
        if (state.activeChannel === "results") updateWinnerPreview();
      } else {
        const errText = await safeReadError(response);
        showToast("error", "Nepavyko išsiųsti", `Discord grąžino klaidą (${response.status}). ${errText}`);
      }
    } catch (err) {
      showToast("error", "Ryšio klaida", "Nepavyko pasiekti Discord serverio. Patikrinkite interneto ryšį ir webhook nuorodą.");
    } finally {
      setSending(false);
    }
  }

  function resetActiveChannelForm() {
    if (state.activeChannel === "announcements") {
      els.emojiInput.value = "";
      els.titleInput.value = "";
      els.contentInput.value = "";
    } else if (state.activeChannel === "schedule") {
      els.scheduleTeamA.value = "";
      els.scheduleTeamB.value = "";
      els.scheduleDate.value = "";
      els.scheduleTime.value = "";
      els.scheduleVenue.value = "";
      els.scheduleNotes.value = "";
      els.scheduleRound.selectedIndex = 0;
    } else if (state.activeChannel === "results") {
      els.resultsTeamA.value = "";
      els.resultsTeamB.value = "";
      els.resultsScoreA.value = "";
      els.resultsScoreB.value = "";
      els.resultsNotes.value = "";
      els.resultsRound.selectedIndex = 0;
    }
  }

  async function safeReadError(response) {
    try {
      const data = await response.json();
      return data && data.message ? data.message : "";
    } catch (err) {
      return "";
    }
  }

  function setSending(isSending) {
    els.sendBtn.disabled = isSending;
    els.sendBtn.classList.toggle("is-sending", isSending);
    els.sendBtn.querySelector("span:last-child").textContent = isSending ? "Siunčiama..." : "Siųsti į Discord";
  }

  function hexToInt(hex) {
    return parseInt(hex.replace("#", ""), 16);
  }

  /* ---------- go ---------- */
  document.addEventListener("DOMContentLoaded", init);
})();

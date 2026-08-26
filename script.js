/* =========================================================
   KFL — Skelbimų Centras
   script.js — kanalų valdymas, peržiūra, siuntimas per Discord Webhooks
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "kfl_webhooks_v1";

  // Numatytieji (įkelti iš anksto) webhook adresai kiekvienam kanalui.
  // Juos bet kada galima pakeisti "Webhook adresai" nustatymuose — ten
  // įvesti adresai visada turi pirmenybę prieš šiuos numatytuosius.
  const DEFAULT_WEBHOOKS = {
    announcements: "https://discord.com/api/webhooks/1542060589667319808/UUdBHdjCQD2pcuvNzcXuxruxnT5quACPIWbWI435-ixk-a0Z-_walKin5cGHk7kdgZkn",
    schedule:      "https://discord.com/api/webhooks/1542060756202426440/_36NJ21_CtmyzpH69gwhVdCaA9eWxvl-IciiCsrnR2NFC_GkuJ7T5Uwhnl6wRrbeQZO5",
    results:       "https://discord.com/api/webhooks/1542060909449449533/3izEOVyfEjiFNoUEQLbJlz4nig8NtnphkfPzZ0Gcl6331wD2dWdn_c-kTvhCpVKDRz-i"
  };

  const CHANNELS = {
    announcements: { label: "pranešimai", icon: "📢" },
    schedule:      { label: "tvarkaraštis", icon: "🗓️" },
    results:       { label: "rezultatai", icon: "🏆" }
  };

  const state = {
    activeChannel: "announcements",
    webhooks: loadWebhooks()
  };

  /* ---------- DOM refs ---------- */
  const els = {
    channelGrid: document.getElementById("channelGrid"),
    form: document.getElementById("messageForm"),
    emojiInput: document.getElementById("emojiInput"),
    titleInput: document.getElementById("titleInput"),
    contentInput: document.getElementById("contentInput"),
    colorInput: document.getElementById("colorInput"),
    colorPresets: document.getElementById("colorPresets"),
    charCount: document.getElementById("charCount"),
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
    // restore saved webhook URLs into settings fields
    els.whAnnouncements.value = state.webhooks.announcements || "";
    els.whSchedule.value = state.webhooks.schedule || "";
    els.whResults.value = state.webhooks.results || "";

    updateConnectionStatus();
    updatePreview();
    updateClock();
    setInterval(updateClock, 30000);

    els.channelGrid.addEventListener("click", onChannelClick);
    els.titleInput.addEventListener("input", updatePreview);
    els.contentInput.addEventListener("input", updatePreview);
    els.emojiInput.addEventListener("input", updatePreview);
    els.colorInput.addEventListener("input", updatePreview);

    els.colorPresets.addEventListener("click", (e) => {
      const btn = e.target.closest(".swatch");
      if (!btn) return;
      els.colorInput.value = btn.dataset.color;
      updatePreview();
    });

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

  /* =========================================================
     Channel selection
     ========================================================= */
  function onChannelClick(e) {
    const card = e.target.closest(".channel-card");
    if (!card) return;
    state.activeChannel = card.dataset.channel;

    els.channelGrid.querySelectorAll(".channel-card").forEach((c) =>
      c.classList.toggle("is-active", c === card)
    );

    updatePreview();
    updateConnectionStatus();
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));

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
      const raw = localStorage.getItem(STORAGE_KEY);
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
     Live preview
     ========================================================= */
  function updatePreview() {
    const channel = CHANNELS[state.activeChannel];
    els.previewChannelIcon.textContent = channel.icon;
    els.previewChannelName.textContent = channel.label;

    const emoji = els.emojiInput.value.trim();
    const title = els.titleInput.value.trim();
    const content = els.contentInput.value.trim();
    const color = els.colorInput.value;

    els.previewTitle.textContent = (emoji ? emoji + " " : "") + (title || "Antraštė bus čia");
    els.previewContent.textContent = content || "Jūsų žinutės tekstas atsiras čia, kai pradėsite rašyti.";
    els.embedPreview.style.setProperty("--embed-color", color);

    els.charCount.textContent = String(content.length);
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
     Submit / send to Discord
     ========================================================= */
  async function onSubmit(e) {
    e.preventDefault();

    const title = els.titleInput.value.trim();
    const content = els.contentInput.value.trim();
    const emoji = els.emojiInput.value.trim();
    const color = els.colorInput.value;
    const webhookUrl = state.webhooks[state.activeChannel];
    const channel = CHANNELS[state.activeChannel];

    if (!title || !content) {
      showToast("error", "Trūksta duomenų", "Įveskite bent antraštę ir žinutės tekstą prieš siunčiant.");
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

    const embedTitle = (emoji ? emoji + " " : "") + title;

    const payload = {
      username: "KFL Botas",
      embeds: [
        {
          title: embedTitle,
          description: content,
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
        els.form.reset();
        updatePreview();
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

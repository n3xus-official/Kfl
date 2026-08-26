(function () {
  "use strict";

  /* =========================================================
     0. Konstantos ir duomenys
     ========================================================= */

  // Base64 koduoti prieigos kodai
  const ACCESS_CODES_B64 = {
    admin: "MFhENjc=",        // decoduoja į "0XD67"
    coach1: "WFZDTEJURw==",   // decoduoja į "XVCLBTG"
    coach2: "WFZDQ1dURg=="    // decoduoja į "XVCCWTF"
  };

  // Webhook URL (paslėpti, rodomi tik kode)
  const WEBHOOKS = {
    announcements: "https://discord.com/api/webhooks/1542060589667319808/UUdBHdjCQD2pcuvNzcXuxruxnT5quACPIWbWI435-ixk-a0Z-_walKin5cGHk7kdgZkn",
    schedule: "https://discord.com/api/webhooks/1542060756202426440/_36NJ21_CtmyzpH69gwhVdCaA9eWxvl-IciiCsrnR2NFC_GkuJ7T5Uwhnl6wRrbeQZO5",
    results: "https://discord.com/api/webhooks/1542060909449449533/3izEOVyfEjiFNoUEQLbJlz4nig8NtnphkfPzZ0Gcl6331wD2dWdn_c-kTvhCpVKDRz-i"
  };

  // Bendras webhook'as KFL Manager veiksmams (transferiams)
  const MANAGER_WEBHOOK = "https://discord.com/api/webhooks/1542091577013436497/Jg0FnG9HOM6i5Bch_YjM7grvvh1ZOD5SDDbVKZrN6VjfhHIgi50SMDU19GtqMR_zV6wl";

  // 16 žaidėjų placeholderiai su numatytomis vertėmis (galima keisti kode)
  const DEFAULT_PLAYERS = [
    { id: 1,  name: "Jonas",    value: 35, rc: 50 },
    { id: 2,  name: "Matas",    value: 25, rc: 0 },
    { id: 3,  name: "Lukas",    value: 20, rc: 30 },
    { id: 4,  name: "Tomas",    value: 20, rc: 30 },
    { id: 5,  name: "Dovydas",  value: 40, rc: 0 },
    { id: 6,  name: "Nojus",    value: 18, rc: 25 },
    { id: 7,  name: "Kajus",    value: 22, rc: 0 },
    { id: 8,  name: "Mantas",   value: 28, rc: 35 },
    { id: 9,  name: "Rokas",    value: 15, rc: 20 },
    { id: 10, name: "Emilis",   value: 30, rc: 0 },
    { id: 11, name: "Benas",    value: 33, rc: 45 },
    { id: 12, name: "Arnas",    value: 17, rc: 0 },
    { id: 13, name: "Tadas",    value: 24, rc: 32 },
    { id: 14, name: "Paulius",  value: 19, rc: 0 },
    { id: 15, name: "Viltė",    value: 21, rc: 28 },
    { id: 16, name: "Ugnė",     value: 23, rc: 0 }
  ];

  const STORAGE_KEY = "kfl_access_v2";
  const PLAYERS_KEY = "kfl_players_data";
  const TEAMS_KEY = "kfl_teams_data";
  const TRANSFERS_KEY = "kfl_transfers_data";

  /* =========================================================
     1. Būsenos kintamieji
     ========================================================= */
  let currentUser = null;          // { role, coachName, teamName }
  let players = loadPlayers();     // žaidėjų duomenys
  let teams = loadTeams();         // trenerių komandos ir biudžetai
  let transfers = loadTransfers(); // transferų istorija

  /* =========================================================
     2. DOM elementai
     ========================================================= */
  const els = {
    gateOverlay: document.getElementById("gateOverlay"),
    gateCard: document.getElementById("gateCard"),
    gateContent: document.getElementById("gateContent"),
    gateCoach: document.getElementById("gateCoach"),
    gateForm: document.getElementById("gateForm"),
    gateInput: document.getElementById("gateInput"),
    gateError: document.getElementById("gateError"),
    coachForm: document.getElementById("coachForm"),
    coachTeamName: document.getElementById("coachTeamName"),
    coachError: document.getElementById("coachError"),
    gateSuccess: document.getElementById("gateSuccess"),
    gateSuccessText: document.getElementById("gateSuccessText"),

    headerUser: document.getElementById("headerUser"),
    headerSubtitle: document.getElementById("headerSubtitle"),

    navAnnouncements: document.getElementById("navAnnouncements"),
    navSchedule: document.getElementById("navSchedule"),
    navResults: document.getElementById("navResults"),
    navManager: document.getElementById("navManager"),

    sectionAnnouncements: document.getElementById("sectionAnnouncements"),
    sectionSchedule: document.getElementById("sectionSchedule"),
    sectionResults: document.getElementById("sectionResults"),
    sectionManager: document.getElementById("sectionManager"),

    // Forms
    announcementForm: document.getElementById("announcementForm"),
    annTitle: document.getElementById("annTitle"),
    annContent: document.getElementById("annContent"),
    annEmoji: document.getElementById("annEmoji"),

    scheduleForm: document.getElementById("scheduleForm"),
    scheduleText: document.getElementById("scheduleText"),

    resultsForm: document.getElementById("resultsForm"),
    resTeamA: document.getElementById("resTeamA"),
    resScoreA: document.getElementById("resScoreA"),
    resTeamB: document.getElementById("resTeamB"),
    resScoreB: document.getElementById("resScoreB"),
    teamsList: document.getElementById("teamsList"),

    // Manager
    budgetTotal: document.getElementById("budgetTotal"),
    budgetSpent: document.getElementById("budgetSpent"),
    budgetLeft: document.getElementById("budgetLeft"),
    myTeamList: document.getElementById("myTeamList"),
    myTeamTitle: document.getElementById("myTeamTitle"),
    marketList: document.getElementById("marketList"),
    adminPanel: document.getElementById("adminPanel"),
    adminPlayerList: document.getElementById("adminPlayerList"),
    transferHistory: document.getElementById("transferHistory"),

    toastContainer: document.getElementById("toastContainer")
  };

  /* =========================================================
     3. Inicializacija
     ========================================================= */
  function init() {
    // Patikriname, ar vartotojas jau prisijungęs
    const savedAccess = localStorage.getItem(STORAGE_KEY);
    if (savedAccess === "granted") {
      const user = JSON.parse(localStorage.getItem("kfl_user") || "null");
      if (user) {
        currentUser = user;
        document.documentElement.classList.add("kfl-unlocked");
        showApp();
      }
    } else {
      // Rodyti prisijungimo formą
      els.gateOverlay.style.display = "flex";
      els.gateInput.focus();
    }

    // Event listeners
    els.gateForm.addEventListener("submit", onGateSubmit);
    els.coachForm.addEventListener("submit", onCoachSubmit);

    // Navigacija
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => switchSection(btn.dataset.section));
    });

    // Formų submit'ai
    els.announcementForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendAnnouncement();
    });
    els.scheduleForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendSchedule();
    });
    els.resultsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendResults();
    });

    // Užpildyti datalist komandomis
    renderTeamsDatalist();

    // Pradinis sekcijos rodymas (tik admin matys kitas, treneris – tik manager)
    if (currentUser) {
      if (currentUser.role === "admin") {
        switchSection("announcements");
      } else {
        switchSection("manager");
      }
    } else {
      switchSection("announcements");
    }
  }

  /* =========================================================
     4. Prisijungimo logika
     ========================================================= */
  function decodeBase64(encoded) {
    try {
      return atob(encoded);
    } catch (e) {
      return "";
    }
  }

  function getAccessCodes() {
    return {
      admin: decodeBase64(ACCESS_CODES_B64.admin),
      coach1: decodeBase64(ACCESS_CODES_B64.coach1),
      coach2: decodeBase64(ACCESS_CODES_B64.coach2)
    };
  }

  function onGateSubmit(e) {
    e.preventDefault();
    const inputCode = els.gateInput.value.trim().toUpperCase();
    const codes = getAccessCodes();

    // Pirmiausia paslėpiame bet kokį sėkmės pranešimą ir klaidą
    els.gateSuccess.hidden = true;
    els.gateError.hidden = true;

    if (inputCode === codes.admin) {
      // Admin prisijungimas
      currentUser = { role: "admin", coachName: "Admin", teamName: "Admin" };
      saveUserAndUnlock();
    } else if (inputCode === codes.coach1 || inputCode === codes.coach2) {
      // Treneris – reikia komandos pavadinimo
      showCoachForm();
    } else {
      // Neteisingas kodas
      els.gateError.hidden = false;
      els.gateCard.classList.remove("is-shaking");
      void els.gateCard.offsetWidth;
      els.gateCard.classList.add("is-shaking");
      els.gateInput.value = "";
      els.gateInput.focus();
      setTimeout(() => { els.gateError.hidden = true; }, 3000);
    }
  }

  function showCoachForm() {
    els.gateContent.hidden = true;
    els.gateCoach.hidden = false;
    els.coachTeamName.focus();
  }

  function onCoachSubmit(e) {
    e.preventDefault();
    const teamName = els.coachTeamName.value.trim();
    els.coachError.hidden = true;

    if (!teamName) {
      els.coachError.hidden = false;
      return;
    }
    currentUser = { role: "coach", coachName: teamName, teamName: teamName };
    saveUserAndUnlock();
  }

  function saveUserAndUnlock() {
    localStorage.setItem(STORAGE_KEY, "granted");
    localStorage.setItem("kfl_user", JSON.stringify(currentUser));

    // Jei treneris dar neturi komandos duomenų, sukuriame
    if (currentUser.role === "coach" && !teams[currentUser.teamName]) {
      teams[currentUser.teamName] = {
        budget: 150000000,
        spent: 0,
        players: []
      };
      saveTeams();
    }

    // Sėkmės animacija
    els.gateContent.hidden = true;
    els.gateCoach.hidden = true;
    els.gateSuccess.hidden = false;
    els.gateSuccessText.textContent = currentUser.role === "admin" ? "Prieiga suteikta (Admin)" : "Prieiga suteikta";

    setTimeout(() => {
      els.gateOverlay.classList.add("is-unlocking");
    }, 600);
    setTimeout(() => {
      els.gateOverlay.style.display = "none";
      document.documentElement.classList.add("kfl-unlocked");
      showApp();
    }, 1000);
  }

  function showApp() {
    updateHeaderUser();
    updateManagerUI();
    renderTeamsDatalist();

    // Nustatome, kokius nav mygtukus rodyti
    if (currentUser.role === "admin") {
      els.navAnnouncements.style.display = "";
      els.navSchedule.style.display = "";
      els.navResults.style.display = "";
      els.navManager.style.display = "";
      els.adminPanel.hidden = false;
      renderAdminPlayerList();
    } else {
      // Treneris mato tik Manager mygtuką
      els.navAnnouncements.style.display = "none";
      els.navSchedule.style.display = "none";
      els.navResults.style.display = "none";
      els.navManager.style.display = "";
      els.adminPanel.hidden = true;
    }

    // Perjungiame į tinkamą sekciją
    if (currentUser.role === "admin") {
      switchSection("announcements");
    } else {
      switchSection("manager");
    }
  }

  function updateHeaderUser() {
    if (currentUser) {
      const roleText = currentUser.role === "admin" ? "Administratorius" : `Treneris: ${currentUser.teamName}`;
      els.headerUser.textContent = roleText;
      els.headerSubtitle.textContent = "Klasės Futbolo Lyga · " + roleText;
    }
  }

  /* =========================================================
     5. Navigacija tarp sekcijų
     ========================================================= */
  function switchSection(section) {
    // Jei treneris bando patekti į kitas sekcijas nei manager, neleidžiame
    if (currentUser && currentUser.role === "coach" && section !== "manager") {
      section = "manager";
    }

    // Slėpti visas
    els.sectionAnnouncements.hidden = true;
    els.sectionSchedule.hidden = true;
    els.sectionResults.hidden = true;
    els.sectionManager.hidden = true;

    // Rodyti pasirinktą
    if (section === "announcements") {
      els.sectionAnnouncements.hidden = false;
    } else if (section === "schedule") {
      els.sectionSchedule.hidden = false;
    } else if (section === "results") {
      els.sectionResults.hidden = false;
    } else if (section === "manager") {
      els.sectionManager.hidden = false;
      updateManagerUI();
    }

    // Atnaujinti nav aktyvumą
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.section === section);
    });
  }

  /* =========================================================
     6. Duomenų saugojimas / įkėlimas
     ========================================================= */
  function loadPlayers() {
    const raw = localStorage.getItem(PLAYERS_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    return JSON.parse(JSON.stringify(DEFAULT_PLAYERS));
  }

  function savePlayers() {
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
  }

  function loadTeams() {
    const raw = localStorage.getItem(TEAMS_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    return {};
  }

  function saveTeams() {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
  }

  function loadTransfers() {
    const raw = localStorage.getItem(TRANSFERS_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    return [];
  }

  function saveTransfers() {
    localStorage.setItem(TRANSFERS_KEY, JSON.stringify(transfers));
  }

  /* =========================================================
     7. Skelbimų siuntimas į Discord
     ========================================================= */
  async function sendDiscordEmbed(webhookUrl, embedData) {
    const payload = {
      username: "KFL Botas",
      embeds: [embedData]
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.ok || response.status === 204) {
        showToast("success", "Išsiųsta!", "Žinutė sėkmingai išsiųsta į Discord.");
        return true;
      } else {
        const errText = await response.text();
        showToast("error", "Klaida", `Discord grąžino klaidą (${response.status}). ${errText}`);
        return false;
      }
    } catch (err) {
      showToast("error", "Ryšio klaida", "Nepavyko pasiekti Discord serverio.");
      return false;
    }
  }

  function getLtDateTime() {
    return new Date().toLocaleString("lt-LT", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  async function sendAnnouncement() {
    const title = els.annTitle.value.trim();
    const content = els.annContent.value.trim();
    const emoji = els.annEmoji.value.trim();
    if (!title || !content) {
      showToast("error", "Trūksta duomenų", "Įveskite antraštę ir tekstą.");
      return;
    }

    const embed = {
      title: (emoji ? emoji + " " : "") + title,
      description: content,
      color: 0x2ecc71,
      footer: { text: "KFL · " + getLtDateTime() }
    };

    await sendDiscordEmbed(WEBHOOKS.announcements, embed);
  }

  async function sendSchedule() {
    const text = els.scheduleText.value.trim();
    if (!text) {
      showToast("error", "Trūksta duomenų", "Įveskite tvarkaraštį.");
      return;
    }

    const embed = {
      title: "🗓️ Tvarkaraštis",
      description: text,
      color: 0x3498db,
      footer: { text: "KFL · " + getLtDateTime() }
    };

    await sendDiscordEmbed(WEBHOOKS.schedule, embed);
  }

  async function sendResults() {
    const teamA = els.resTeamA.value.trim();
    const teamB = els.resTeamB.value.trim();
    const scoreA = els.resScoreA.value;
    const scoreB = els.resScoreB.value;
    if (!teamA || !teamB || scoreA === "" || scoreB === "") {
      showToast("error", "Trūksta duomenų", "Įveskite komandas ir įvarčius.");
      return;
    }

    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    let title, description;
    if (a > b) {
      title = `🏆 Laimėjo ${teamA}`;
      description = `${scoreA}:${scoreB}`;
    } else if (b > a) {
      title = `🏆 Laimėjo ${teamB}`;
      description = `${scoreA}:${scoreB}`;
    } else {
      title = "🤝 Lygiosios";
      description = `${scoreA}:${scoreB}`;
    }

    const embed = {
      title: title,
      description: description,
      color: 0xf1c40f,
      footer: { text: "KFL · " + getLtDateTime() }
    };

    await sendDiscordEmbed(WEBHOOKS.results, embed);
  }

  /* =========================================================
     8. KFL Manager funkcijos
     ========================================================= */
  function formatMoney(amount) {
    return amount.toLocaleString("lt-LT") + " €";
  }

  function getTeamData(teamName) {
    if (!teams[teamName]) {
      teams[teamName] = { budget: 150000000, spent: 0, players: [] };
      saveTeams();
    }
    return teams[teamName];
  }

  function updateManagerUI() {
    if (!currentUser) return;

    // Biudžetas
    if (currentUser.role === "admin") {
      const firstTeam = Object.keys(teams)[0];
      if (firstTeam) {
        const data = teams[firstTeam];
        els.budgetTotal.textContent = formatMoney(data.budget + data.spent);
        els.budgetSpent.textContent = formatMoney(data.spent);
        els.budgetLeft.textContent = formatMoney(data.budget);
      } else {
        els.budgetTotal.textContent = "150,000,000 €";
        els.budgetSpent.textContent = "0 €";
        els.budgetLeft.textContent = "150,000,000 €";
      }
    } else {
      const data = getTeamData(currentUser.teamName);
      els.budgetTotal.textContent = formatMoney(data.budget + data.spent);
      els.budgetSpent.textContent = formatMoney(data.spent);
      els.budgetLeft.textContent = formatMoney(data.budget);
    }

    // Mano komanda
    if (currentUser.role === "coach") {
      const data = getTeamData(currentUser.teamName);
      els.myTeamTitle.textContent = `${currentUser.teamName} komanda`;
      renderMyTeam(data.players);
      renderMarket(data.players);
    } else {
      // Admin – rodyti rinką su visais žaidėjais
      els.myTeamTitle.textContent = "Visos komandos";
      renderMarket([]);
      els.myTeamList.innerHTML = "";
    }

    // Transferų istorija
    renderTransferHistory();

    // Jei admin, atnaujinti admin panel
    if (currentUser.role === "admin") {
      renderAdminPlayerList();
    }
  }

  function renderMyTeam(playerIds) {
    if (!playerIds.length) {
      els.myTeamList.innerHTML = '<p style="color:var(--text-faint)">Komanda tuščia.</p>';
      return;
    }
    const html = playerIds.map(pid => {
      const p = players.find(pl => pl.id === pid);
      if (!p) return "";
      return `
        <div class="player-item">
          <span class="player-name">${p.name}</span>
          <span class="player-info">Vertė: ${p.value} mln. €${p.rc > 0 ? ` | RC: ${p.rc} mln. €` : ""}</span>
          <div class="player-actions">
            <button class="btn-small sell" data-id="${p.id}">Parduoti</button>
          </div>
        </div>
      `;
    }).join("");
    els.myTeamList.innerHTML = html || '<p style="color:var(--text-faint)">Komanda tuščia.</p>';

    els.myTeamList.querySelectorAll(".sell").forEach(btn => {
      btn.addEventListener("click", () => sellPlayer(parseInt(btn.dataset.id)));
    });
  }

  function renderMarket(ownedIds) {
    const availablePlayers = players.filter(p => p.value !== -1 && !ownedIds.includes(p.id));
    if (!availablePlayers.length) {
      els.marketList.innerHTML = '<p style="color:var(--text-faint)">Rinka tuščia.</p>';
      return;
    }
    const html = availablePlayers.map(p => {
      const hasRC = p.rc > 0;
      return `
        <div class="player-item">
          <span class="player-name">${p.name}</span>
          <span class="player-info">Vertė: ${p.value} mln. € | RC: ${hasRC ? p.rc + " mln. €" : "NĖRA"}</span>
          <div class="player-actions">
            ${hasRC ? `<button class="btn-small buy" data-id="${p.id}">PIRKTI</button>` : ""}
          </div>
        </div>
      `;
    }).join("");
    els.marketList.innerHTML = html || '<p style="color:var(--text-faint)">Rinka tuščia.</p>';

    els.marketList.querySelectorAll(".buy").forEach(btn => {
      btn.addEventListener("click", () => buyPlayer(parseInt(btn.dataset.id)));
    });
  }

  function buyPlayer(playerId) {
    if (currentUser.role !== "coach") {
      showToast("error", "Negalima", "Tik treneris gali pirkti žaidėjus.");
      return;
    }
    const teamData = getTeamData(currentUser.teamName);
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const price = player.rc > 0 ? player.rc : player.value;
    if (teamData.budget < price) {
      showToast("error", "Nepakanka lėšų", `Reikia ${price} mln. €, bet liko ${teamData.budget} mln. €.`);
      return;
    }

    teamData.budget -= price;
    teamData.spent += price;
    teamData.players.push(player.id);
    saveTeams();

    transfers.push({
      playerId: player.id,
      playerName: player.name,
      from: "Market",
      to: currentUser.teamName,
      amount: price,
      date: new Date().toISOString().slice(0,10),
      type: "buy"
    });
    saveTransfers();

    const message = `✅ **${player.name}** pirktas už **${price} mln. €**\n` +
                    `Komanda: ${currentUser.teamName}\n` +
                    `Data: ${getLtDateTime()}`;
    sendDiscordEmbed(MANAGER_WEBHOOK, { title: "Transferis", description: message, color: 0x2ecc71 });

    showToast("success", "Pirkimas įvykdytas", `${player.name} prisijungė prie ${currentUser.teamName}.`);
    updateManagerUI();
  }

  function sellPlayer(playerId) {
    if (currentUser.role !== "coach") {
      showToast("error", "Negalima", "Tik treneris gali parduoti žaidėjus.");
      return;
    }
    const teamData = getTeamData(currentUser.teamName);
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const sellPrice = player.value;
    teamData.budget += sellPrice;
    teamData.spent -= sellPrice;
    teamData.players = teamData.players.filter(id => id !== playerId);
    saveTeams();

    transfers.push({
      playerId: player.id,
      playerName: player.name,
      from: currentUser.teamName,
      to: "Market",
      amount: sellPrice,
      date: new Date().toISOString().slice(0,10),
      type: "sell"
    });
    saveTransfers();

    const message = `🔄 **${player.name}** parduotas už **${sellPrice} mln. €**\n` +
                    `Komanda: ${currentUser.teamName}\n` +
                    `Data: ${getLtDateTime()}`;
    sendDiscordEmbed(MANAGER_WEBHOOK, { title: "Transferis", description: message, color: 0xed4245 });

    showToast("success", "Pardavimas įvykdytas", `${player.name} grįžo į rinką.`);
    updateManagerUI();
  }

  function renderTransferHistory() {
    if (!transfers.length) {
      els.transferHistory.innerHTML = '<p style="color:var(--text-faint)">Transferių nėra.</p>';
      return;
    }
    const html = transfers.map(t => {
      return `<div class="history-item">${t.playerName} → ${t.to} — ${t.amount} mln. € — ${t.date}</div>`;
    }).join("");
    els.transferHistory.innerHTML = html;
  }

  /* =========================================================
     9. Admin funkcijos
     ========================================================= */
  function renderAdminPlayerList() {
    if (currentUser.role !== "admin") return;
    const html = players.filter(p => p.value !== -1).map(p => `
      <div class="admin-player-row" data-id="${p.id}">
        <input type="text" value="${p.name}" class="admin-name" placeholder="Vardas">
        <input type="number" value="${p.value}" class="admin-value" min="0" step="1">
        <input type="number" value="${p.rc}" class="admin-rc" min="0" step="1" placeholder="RC (0 = NĖRA)">
        <button class="btn-small" data-action="save">💾</button>
      </div>
    `).join("");
    els.adminPlayerList.innerHTML = html;

    els.adminPlayerList.querySelectorAll("[data-action='save']").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const row = e.target.closest(".admin-player-row");
        const id = parseInt(row.dataset.id);
        const name = row.querySelector(".admin-name").value.trim();
        const value = parseInt(row.querySelector(".admin-value").value);
        const rc = parseInt(row.querySelector(".admin-rc").value);
        if (name && !isNaN(value) && value >= 0 && !isNaN(rc) && rc >= 0) {
          const player = players.find(p => p.id === id);
          if (player) {
            player.name = name;
            player.value = value;
            player.rc = rc;
            savePlayers();
            showToast("success", "Išsaugota", `${name} duomenys atnaujinti.`);
            updateManagerUI();
          }
        } else {
          showToast("error", "Klaida", "Neteisingi duomenys.");
        }
      });
    });
  }

  /* =========================================================
     10. Pagalbinės funkcijos
     ========================================================= */
  function renderTeamsDatalist() {
    const teamNames = Object.keys(teams);
    if (currentUser?.teamName) {
      teamNames.push(currentUser.teamName);
    }
    const defaults = ["FC A", "FC B", "8a klasė", "8b klasė"];
    defaults.forEach(name => {
      if (!teamNames.includes(name)) teamNames.push(name);
    });
    els.teamsList.innerHTML = teamNames.map(name => `<option value="${name}">`).join("");
  }

  function showToast(type, title, message) {
    const toast = document.createElement("div");
    toast.className = "toast" + (type === "error" ? " toast--error" : "");
    toast.innerHTML = `
      <span class="toast__icon">${type === "error" ? "⚠️" : "✅"}</span>
      <div>
        <div class="toast__title">${title}</div>
        <div class="toast__msg">${message}</div>
      </div>
    `;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("is-leaving");
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  /* =========================================================
     11. Start
     ========================================================= */
  document.addEventListener("DOMContentLoaded", init);
})();
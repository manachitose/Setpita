function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

const t = (key) => chrome.i18n.getMessage(key);
const uiLang = chrome.i18n.getUILanguage();

document.documentElement.lang = uiLang;

for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = t(el.dataset.i18n);
}

document.getElementById("tokiSyncFooterLink").title = t("tokiSyncFooterTitle");
document.getElementById("tokiSyncFooterImg").alt = t("tokiSyncFooterTitle");
document.getElementById("creatorHpFooterLink").title = t("creatorHpFooterTitle");
document.getElementById("creatorHpFooterImg").alt = t("creatorHpFooterTitle");

// 不具合報告フォームは日本語ユーザー向けにのみ用意されているため、日本語UI以外では非表示にする
if (!uiLang.startsWith("ja")) {
  document.getElementById("bugReportLink").style.display = "none";
  document.getElementById("bugReportSep").style.display = "none";
}

// コード変更のたびに手動で更新する(バージョンはmanifest.jsonから自動取得)
const LAST_UPDATED = "2026-08-01";

document.getElementById("appVersionInfo").textContent =
  `v${chrome.runtime.getManifest().version} (${t("lastUpdatedPrefix")}${LAST_UPDATED})`;

document.getElementById("storePageLink").href =
  "https://chromewebstore.google.com/detail/setpita-%E3%82%BB%E3%83%88%E3%83%94%E3%82%BF/caajbfckihllgmbgannehljfabddabhg";

function formatLocalTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString(uiLang, { hour12: false });
}

function parseTimeInput(str) {
  const parts = str.trim().split(":").map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p))) return null;

  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

function formatSeconds(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

let currentLogs = [];

function renderLogs(logs) {
  currentLogs = [...logs].sort((a, b) => a.ts - b.ts);
  const listEl = document.getElementById("logList");
  listEl.innerHTML = "";

  for (const log of currentLogs) {
    const row = document.createElement("div");
    row.className = "log-row";

    const time = document.createElement("span");
    time.className = "time";
    time.textContent = formatLocalTime(log.ts);

    let badge = null;
    if (log.isAutoplay) {
      badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = t("autoBadge");
    }

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = log.title;
    titleInput.addEventListener("change", async () => {
      await sendMessage({
        type: "UPDATE_LOG_TITLE",
        id: log.id,
        title: titleInput.value,
      });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "danger-outline";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", async () => {
      await sendMessage({ type: "DELETE_LOG", id: log.id });
      await refresh();
    });

    row.append(time);
    if (badge) row.append(badge);
    row.append(titleInput, deleteBtn);
    listEl.append(row);
  }
}

function renderPlaybackStatus(status) {
  const statusEl = document.getElementById("playbackStatus");
  const noteEl = document.getElementById("playbackStatusNote");

  if (status?.playing) {
    statusEl.textContent = `${t("playingStatusPrefix")}${status.title}`;
    statusEl.classList.add("playing");
    noteEl.textContent = t("playingNote");
  } else {
    statusEl.textContent = t("notPlayingStatus");
    statusEl.classList.remove("playing");
    noteEl.textContent = "";
  }
}

function renderSettings(settings) {
  document.getElementById("autoResetEnabledInput").checked = settings.autoResetEnabled;
  document.getElementById("autoResetHoursInput").value = settings.autoResetHours;
  document.getElementById("autoResetHoursRow").style.display = settings.autoResetEnabled
    ? "flex"
    : "none";
}

async function refresh() {
  const state = await sendMessage({ type: "GET_STATE" });
  renderLogs(state.logs);
  renderPlaybackStatus(state.playbackStatus);
  renderSettings(state.settings);
}

document.getElementById("clearLogsBtn").addEventListener("click", async () => {
  await sendMessage({ type: "CLEAR_LOGS" });
  await refresh();
});

document.getElementById("generateBtn").addEventListener("click", () => {
  const outputEl = document.getElementById("setlistOutput");
  if (currentLogs.length === 0) {
    outputEl.value = t("noLogsOutput");
    return;
  }

  const inputStr = document.getElementById("firstSongTimeInput").value;
  const firstSongSeconds = parseTimeInput(inputStr);
  if (firstSongSeconds === null) {
    outputEl.value = t("invalidTimeFormat");
    return;
  }

  const offsetMs = firstSongSeconds * 1000 - currentLogs[0].ts;
  const blocks = [[`00:00:00 ${t("streamStartLabel")}`]];
  for (const log of currentLogs) {
    const seconds = (log.ts + offsetMs) / 1000;
    const lines = [`${formatSeconds(seconds)} ${log.title}`];
    if (log.url) lines.push(log.url);
    blocks.push(lines);
  }
  outputEl.value = blocks.map((lines) => lines.join("\n")).join("\n\n");
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  const outputEl = document.getElementById("setlistOutput");
  await navigator.clipboard.writeText(outputEl.value);
});

document.getElementById("autoResetEnabledInput").addEventListener("change", async (e) => {
  document.getElementById("autoResetHoursRow").style.display = e.target.checked
    ? "flex"
    : "none";
  await sendMessage({
    type: "SET_SETTINGS",
    settings: { autoResetEnabled: e.target.checked },
  });
});

document.getElementById("autoResetHoursInput").addEventListener("change", async (e) => {
  const hours = Number(e.target.value);
  if (!Number.isFinite(hours) || hours <= 0) return;
  await sendMessage({ type: "SET_SETTINGS", settings: { autoResetHours: hours } });
});

// popupを開いたまま記録・再生状態が変わった場合に追従する
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.logs) {
    renderLogs(changes.logs.newValue ?? []);
  }
  if (changes.playbackStatus) {
    renderPlaybackStatus(changes.playbackStatus.newValue ?? null);
  }
});

refresh();

// ログの保存・管理を行うservice worker。
// popup/side panelが閉じていてもここが動き続けるので、記録はUIの開閉に影響されない。
// YouTube上のどのタブで再生されても記録する(タブを指定する仕組みは持たない)。

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error(err));

// 初回インストール時に使い方の案内ページを開く
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});

// 最後の記録から一定時間以上経っていたら、前回配信の消し忘れとみなして自動リセットする
// (時間・有効無効はユーザーがサイドパネルの設定から変更できる)
const DEFAULT_AUTO_RESET_HOURS = 20;

async function getRawLogs() {
  const { logs = [] } = await chrome.storage.local.get(["logs"]);
  return logs;
}

async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get(["settings"]);
  return {
    autoResetEnabled: settings.autoResetEnabled ?? true,
    autoResetHours: settings.autoResetHours ?? DEFAULT_AUTO_RESET_HOURS,
    pauseAutoplayEnabled: settings.pauseAutoplayEnabled ?? true,
  };
}

async function getLogsWithAutoReset(settings) {
  const logs = await getRawLogs();
  if (logs.length === 0 || !settings.autoResetEnabled) return logs;

  const thresholdMs = settings.autoResetHours * 60 * 60 * 1000;
  const lastTs = logs[logs.length - 1].ts;
  if (Date.now() - lastTs > thresholdMs) {
    await chrome.storage.local.set({ logs: [] });
    return [];
  }
  return logs;
}

async function getState() {
  const settings = await getSettings();
  const [logs, { playbackStatus = null }] = await Promise.all([
    getLogsWithAutoReset(settings),
    chrome.storage.local.get(["playbackStatus"]),
  ]);
  return { logs, playbackStatus, settings };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "PLAY_EVENT": {
        const { logs } = await getState();
        const entry = {
          id: `${message.ts}-${Math.random().toString(36).slice(2, 8)}`,
          ts: message.ts,
          title: message.title,
          url: message.url ?? null,
          isAutoplay: !!message.isAutoplay,
        };
        await chrome.storage.local.set({ logs: [...logs, entry] });
        sendResponse({ recorded: true });
        break;
      }

      case "PLAYBACK_STATE": {
        await chrome.storage.local.set({
          playbackStatus: message.playing
            ? { playing: true, title: message.title, url: message.url ?? null }
            : { playing: false },
          // 再生中のタブが停止イベントを出さずに閉じられた場合に備えて、
          // どのタブが再生中と報告してきたかを覚えておく(onRemovedで使う)
          playingTabId: message.playing ? sender.tab?.id ?? null : null,
        });
        sendResponse({ ok: true });
        break;
      }

      case "GET_STATE": {
        sendResponse(await getState());
        break;
      }

      case "SET_SETTINGS": {
        const current = await getSettings();
        await chrome.storage.local.set({
          settings: { ...current, ...message.settings },
        });
        sendResponse({ ok: true });
        break;
      }

      case "CLEAR_LOGS": {
        await chrome.storage.local.set({ logs: [] });
        sendResponse({ ok: true });
        break;
      }

      case "DELETE_LOG": {
        const { logs } = await getState();
        await chrome.storage.local.set({
          logs: logs.filter((l) => l.id !== message.id),
        });
        sendResponse({ ok: true });
        break;
      }

      case "UPDATE_LOG_TITLE": {
        const { logs } = await getState();
        await chrome.storage.local.set({
          logs: logs.map((l) =>
            l.id === message.id ? { ...l, title: message.title } : l
          ),
        });
        sendResponse({ ok: true });
        break;
      }

      default:
        sendResponse({ error: "unknown message type" });
    }
  })();

  return true; // sendResponseを非同期で呼ぶために必要
});

// 再生中のタブが、一時停止・終了イベントを出さないまま閉じられることがある
// (再生したままタブを閉じる等)。放置すると「再生中: XXXXX」が残り続けて
// 以後の記録が止まって見えるため、そのタブが閉じられたら再生状態を戻す。
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { playingTabId = null } = await chrome.storage.local.get(["playingTabId"]);
  if (playingTabId !== tabId) return;
  await chrome.storage.local.set({
    playbackStatus: { playing: false },
    playingTabId: null,
  });
});

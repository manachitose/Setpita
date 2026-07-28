// YouTubeの再生ページに注入され、動画の再生開始を検知してbackgroundへ通知する。
// SPA遷移で<video>要素が入れ替わっても拾えるよう、documentのキャプチャフェーズで監視する。
// "本当に新曲かどうか"の判定はせず、playイベントは都度そのまま通知する(docs参照)。

function cleanTitle(rawTitle) {
  // YouTubeは未読通知があると先頭に"(2) "のような件数を付けるため取り除く
  return rawTitle
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*-\s*YouTube\s*$/, "")
    .trim();
}

// playイベント発火時点ではdocument.titleがまだ前の動画のままのことがあるため、
// 少し待ってからタイトルを読む。各再生イベントごとに独立して待つだけのシンプルな方式にする
// (タイトル変更の"検知"待ちにすると、再生が短時間に連続した際に別イベント同士で
//  タイトルを取り違えるバグがあったため)。
const TITLE_READ_DELAY_MS = 800;

function getTitleAfterDelay() {
  return new Promise((resolve) => {
    setTimeout(() => resolve(cleanTitle(document.title)), TITLE_READ_DELAY_MS);
  });
}

// list/index等の再生リスト情報を除いた動画単体のURLにする
function getCleanVideoUrl() {
  const videoId = new URL(location.href).searchParams.get("v");
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : location.href;
}

// サムネイルホバー時のプレビュー再生等を除外し、メインプレイヤーの動画だけを対象にする
function isMainPlayerVideo(el) {
  return el instanceof HTMLVideoElement && !!el.closest("#movie_player");
}

// 直近にユーザー操作(クリック/キー入力)があったかどうかで、
// 手動再生か自動再生(次の動画への遷移時の自動再生など)かを推定する。
const AUTOPLAY_THRESHOLD_MS = 1500;
let lastInteractionTs = 0;

// 拡張がリロードされた後もこのタブに残り続けている古いcontent.jsは、
// chrome.runtimeへの参照自体が「Extension context invalidated」で例外を吐く。
// 一度検知したら全リスナーを外して静かに諦める(直すにはタブのリロードが必要)。
let invalidated = false;

function markInvalidated(err) {
  if (invalidated) return;
  invalidated = true;
  console.warn(
    "[Setpeta] 拡張機能が更新されたため、このタブでは記録を停止しました。タブをリロードしてください。",
    err
  );
  try {
    document.removeEventListener("pointerdown", onInteraction, true);
    document.removeEventListener("keydown", onInteraction, true);
    document.removeEventListener("play", onPlay, true);
    document.removeEventListener("pause", onStop, true);
    document.removeEventListener("ended", onStop, true);
  } catch {
    // リスナー解除自体が失敗しても無視する
  }
}

function onInteraction() {
  if (invalidated) return;
  try {
    lastInteractionTs = Date.now();
  } catch (err) {
    markInvalidated(err);
  }
}

function onPlay(event) {
  if (invalidated || !isMainPlayerVideo(event.target)) return;

  try {
    if (!chrome.runtime?.id) {
      markInvalidated();
      return;
    }

    const ts = Date.now();
    const isAutoplay = ts - lastInteractionTs > AUTOPLAY_THRESHOLD_MS;

    getTitleAfterDelay().then((title) => {
      if (invalidated) return;

      const url = getCleanVideoUrl();

      chrome.runtime
        .sendMessage({ type: "PLAY_EVENT", title, url, ts, isAutoplay })
        .catch((err) => markInvalidated(err));

      chrome.runtime
        .sendMessage({ type: "PLAYBACK_STATE", playing: true, title, url })
        .catch((err) => markInvalidated(err));
    });
  } catch (err) {
    markInvalidated(err);
  }
}

// 一時停止・再生終了時に「今は再生していない」ことをbackgroundへ伝える。
// (再生中は"次のログが増えるまで新しい記録は追加されない"ことをUI側で示すため)
function onStop(event) {
  if (invalidated || !isMainPlayerVideo(event.target)) return;

  try {
    if (!chrome.runtime?.id) {
      markInvalidated();
      return;
    }
    chrome.runtime
      .sendMessage({ type: "PLAYBACK_STATE", playing: false })
      .catch((err) => markInvalidated(err));
  } catch (err) {
    markInvalidated(err);
  }
}

document.addEventListener("pointerdown", onInteraction, true);
document.addEventListener("keydown", onInteraction, true);
document.addEventListener("play", onPlay, true);
document.addEventListener("pause", onStop, true);
document.addEventListener("ended", onStop, true);

// 再生リストを選択した直後など、content.jsの起動より先に自動再生が始まっていた場合、
// playイベントを取りこぼしてしまうため、起動時点で既に再生中かどうかを確認して拾う。
(function checkAlreadyPlaying() {
  const video = document.querySelector("#movie_player video");
  if (video && !video.paused) {
    onPlay({ target: video });
  }
})();

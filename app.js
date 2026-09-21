/* ============================================================
 * 应用启动 + 横竖屏适配
 * 横竖屏都显示同一套 Phaser 老虎机（不再嵌外部留声机 iframe）。
 * 状态：localStorage（wanjin_slot_save + bgMusic*）
 * ============================================================ */

(function bootstrapGame() {
  const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: "game",
    // 仅作为 create() 里 createBackdrop() 绘制完成前的极短兜底色，
    // 与暗角边缘色 #030202 统一，避免加载瞬间出现色差闪烁。
    backgroundColor: "#030202",
    banner: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    scene: SlotGame,
  };

  window.__slotGame = new Phaser.Game(config);

  function unlockAudioOnce() {
    try {
      const sc =
        window.__slotGameScene ||
        (window.__slotGame &&
          window.__slotGame.scene &&
          window.__slotGame.scene.getScenes()[0]);
      if (sc && sc.sfx) {
        sc.sfx.enabled = true;
        sc.sfx.init();
        sc.sfx.warmup();
      } else {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          const ctx = new AC();
          if (ctx.state === "suspended") {
            const r = ctx.resume();
            if (r && typeof r.catch === "function") r.catch(function () {});
          }
        }
      }
    } catch (e) {}
    try {
      bgMusic.tryPlay();
    } catch (e) {}
    document.removeEventListener("touchstart", unlockAudioOnce, true);
    document.removeEventListener("mousedown", unlockAudioOnce, true);
    document.removeEventListener("keydown", unlockAudioOnce, true);
  }
  document.addEventListener("touchstart", unlockAudioOnce, true);
  document.addEventListener("mousedown", unlockAudioOnce, true);
  document.addEventListener("keydown", unlockAudioOnce, true);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    try {
      if (typeof bgMusic !== "undefined" && bgMusic.enabled) {
        bgMusic.tryPlay();
      }
    } catch (e) {}
  });

  window.addEventListener("beforeunload", function () {
    try {
      const sc = window.__slotGameScene;
      if (sc && sc.clockTimer) {
        clearInterval(sc.clockTimer);
        sc.clockTimer = null;
      }
      if (sc && typeof sc.saveGameState === "function") sc.saveGameState(true);
    } catch (e) {}
  });
})();

/** 横竖屏切换时只刷新缩放，不再切到外部页面 */
(function setupOrientationResize() {
  const isIOS =
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    (!!navigator.vendor &&
      navigator.vendor.indexOf("Apple") >= 0 &&
      "ontouchend" in document);

  let debounceTimer = 0;
  let stabilizeTimer = 0;

  // 竖屏：把 #game-wrapper 嵌进 Royale 边框透明转轮窗；横屏还原全屏
  // 边框图 1024×1536，透明区约 x 23.8%~75.7%、y 15.6%~79.4%
  const FRAME_W = 1024;
  const FRAME_H = 1536;
  const SLOT = { left: 0.238, top: 0.156, right: 0.757, bottom: 0.794 };

  function layoutPortraitFrame() {
    const wrap = document.getElementById("game-wrapper");
    const frame = document.getElementById("portrait-frame");
    if (!wrap) return;

    const isPortrait = window.matchMedia
      ? window.matchMedia("(orientation: portrait)").matches
      : window.innerHeight >= window.innerWidth;

    if (!isPortrait) {
      wrap.style.left = "";
      wrap.style.top = "";
      wrap.style.width = "";
      wrap.style.height = "";
      wrap.style.position = "";
      wrap.style.background = "";
      return;
    }

    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const scale = Math.min(vw / FRAME_W, vh / FRAME_H);
    const fw = FRAME_W * scale;
    const fh = FRAME_H * scale;
    const ox = (vw - fw) / 2;
    const oy = (vh - fh) / 2;

    const left = ox + SLOT.left * fw;
    const top = oy + SLOT.top * fh;
    const width = (SLOT.right - SLOT.left) * fw;
    const height = (SLOT.bottom - SLOT.top) * fh;

    wrap.style.position = "fixed";
    wrap.style.left = Math.round(left) + "px";
    wrap.style.top = Math.round(top) + "px";
    wrap.style.width = Math.round(width) + "px";
    wrap.style.height = Math.round(height) + "px";
    wrap.style.background = "transparent";

    if (frame) {
      frame.style.display = "block";
    }
  }

  function refreshScale() {
    layoutPortraitFrame();
    try {
      const g = window.__slotGame;
      if (g && g.scale && typeof g.scale.refresh === "function") {
        g.scale.refresh();
      }
    } catch (e) {}
    try {
      if (typeof bgMusic !== "undefined" && bgMusic.enabled) {
        bgMusic.tryPlay();
      }
    } catch (e) {}
  }

  // 首屏立即布局一次（等图片/字体无关）
  layoutPortraitFrame();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", layoutPortraitFrame);
  }
  window.addEventListener("load", layoutPortraitFrame);

  function scheduleRefresh() {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (stabilizeTimer) clearTimeout(stabilizeTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = 0;
      var w1 = window.innerWidth || 0;
      var h1 = window.innerHeight || 0;
      stabilizeTimer = setTimeout(function () {
        stabilizeTimer = 0;
        var w2 = window.innerWidth || 0;
        var h2 = window.innerHeight || 0;
        if (w1 !== w2 || h1 !== h2) {
          scheduleRefresh();
          return;
        }
        refreshScale();
      }, isIOS ? 120 : 80);
    }, isIOS ? 220 : 180);
  }

  window.addEventListener("orientationchange", scheduleRefresh);
  window.addEventListener("resize", scheduleRefresh);
  try {
    if (window.matchMedia) {
      const mql = window.matchMedia("(orientation: portrait)");
      if (mql.addEventListener) mql.addEventListener("change", scheduleRefresh);
      else if (mql.addListener) mql.addListener(scheduleRefresh);
    }
  } catch (e) {}
})();
